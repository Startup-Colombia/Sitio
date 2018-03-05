import * as fs from 'fs'
import * as path from 'path'
import Router = require('koa-router')
import * as google from 'googleapis'
const randomColor = require('randomcolor')
import { authorize } from './authorize'

const sheets = google.sheets('v4')

let google_sheets_credentials
let google_sheets_token

// Durente desarrollo las credenciales se traen de archivos
if (!process.env.google_sheets_credentials) {
  const cwd = process.cwd()
  google_sheets_credentials = JSON.parse(fs.readFileSync(path.join(cwd, 'client_secret.json'), 'utf-8'))
  google_sheets_token = JSON.parse(fs.readFileSync(path.join(cwd, 'token.json'), 'utf-8'))
} else {
  google_sheets_credentials = JSON.parse(process.env.google_sheets_credentials)
  google_sheets_token = JSON.parse(process.env.google_sheets_token)
}

const fieldNames = [
  'sector',
  'name',
  'website',
  'valueProposition',
  'business',
  'founderName',
  'founderProfile',
  'founderUniversity',
  'founderAge',
  'founderGender',
]

export const runStartupsAPI = cloudant => {

  const startupsDB = cloudant.use('startups')

  let router = Router()

  const auth = authorize(google_sheets_credentials, google_sheets_token)

  router.get('/refreshData', async ctx => {
    if (ctx.request.query.token !== process.env.refreshStartupsDataToken) {
      ctx.body = 'No estas autorizado ;)'
      return
    }
    const rows = await new Promise((resolve, reject) => sheets.spreadsheets.values.get({
      auth: auth,
      spreadsheetId: '1gn-wJpq_kxhGbByp76Sc3drJxXNDAVRiNjJy87HJ7Uc',
      range: 'Hoja 1!A1:ZZ',
    }, function(err, response) {
      if (err) {
        console.log('The API returned an error: ' + err)
        reject(err)
        return
      }
      var rows = response.values
      resolve(rows)
    }))

    let titles
    const startups = []

    for (let i = 0, row; row = rows[i]; i++) {
      let startup = {}
      if (row[0] === undefined) {
        break
      }
      for (let j = 0, fieldName; fieldName = fieldNames[j]; j++) {
        let value = row[j]
        startup[fieldName] = value
      }
      if (i === 0) {
        titles = startup
      } else {
        startups.push(startup)
      }
    }

    // Se calculan estadisticas, conteo de ocurrencias
    const statsInfo = [
      ['sector', 'Por Sectores', 'horizontalBar'],
      ['business', 'Por Tipo de Negocio', 'bar'],
      ['founderUniversity', 'Universidad del Fundador / CEO', 'horizontalBar'],
      ['founderAge', 'Edad del Fundador / CEO', 'bar'],
      ['founderGender', 'Genero del Fundador / CEO', 'pie'],
    ]
    const stats = {}

    let startup, statInfo, statName, stat, value
    for (startup of startups) {
      for (statInfo of statsInfo) {
        statName = statInfo[0]
        if (!(statName in stats)) {
          stats[statName] = {}
        }
        stat = stats[statName]
        value = startup[statName]
        if (value) {
          // se colocan los valores en un formato común
          value = value
            .trim()
            .toLowerCase()
            .split(' ')
            .map(str => str.slice(0, 1).toUpperCase() + str.slice(1, str.length))
            .join(' ')
        }
        if (!value) {
          break
        }
        if (!stat[value]) {
          stat[value] = 1
        } else {
          stat[value]++
        }
      }
    }

    // Se preparan los datos para las gráficas
    let labels, data, key, tempArr, backgroundColor
    for (statInfo of statsInfo) {
      statName = statInfo[0]
      stat = stats[statName]
      tempArr = []
      for (key in stat) {
        tempArr.push([stat[key], key, randomColor()])
      }
      tempArr = tempArr.sort((a, b) => b[0] - a[0])
      data = tempArr.map(el => el[0])
      labels = tempArr.map(el => el[1])
      backgroundColor = tempArr.map(el => el[2])
      stats[statName] = {
        title: statInfo[1],
        type: statInfo[2],
        labels,
        data,
        backgroundColor,
      }
    }

    // Se guardan los nuevos datos en Cloudant

    const startupsDoc = await startupsDB.get('startups')
    startupsDoc.titles = titles
    startupsDoc.list = startups
    await startupsDB.insert(startupsDoc)

    const statsDoc = await startupsDB.get('stats')
    await startupsDB.insert({
      _id: 'stats',
      _rev: statsDoc._rev,
      length: startups.length,
      list: stats,
      timestamp: (new Date()).getTime(),
    })

    ctx.body = 'Se realizó la actualización con éxito'
  })

  return router
}
