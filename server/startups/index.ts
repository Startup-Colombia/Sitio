import * as fs from 'fs'
import * as path from 'path'
import Router = require('koa-router')
import * as google from 'googleapis'
import { authorize } from './authorize'

let google_sheets_credentials = process.env.google_sheets_credentials
let google_sheets_token = process.env.google_sheets_token

// Durente desarrollo las credenciales se traen de archivos
if (!google_sheets_credentials) {
  const cwd = process.cwd()
  google_sheets_credentials = JSON.parse(fs.readFileSync(path.join(cwd, 'client_secret.json'), 'utf-8'))
  google_sheets_token = JSON.parse(fs.readFileSync(path.join(cwd, 'token.json'), 'utf-8'))
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
    var sheets = google.sheets('v4')
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
    const statNames = ['sector', 'business', 'founderUniversity', 'founderAge']
    const stats = {}

    let startup, statName, stat, value
    for (startup of startups) {
      for (statName of statNames) {
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
        if (!stat[value]) {
          stat[value] = 1
        } else {
          stat[value]++
        }
      }
    }

    // Se preparan los datos para las gráficas
    let labels, data
    for (statName of statNames) {
      stat = stats[statName]
      labels = Object.keys(stat)
      data = (Object as any).values(stat)
      stats[statName] = {
        labels,
        data,
      }
    }

    // Se eliminan datos anteriores y guardan los nuevos en Cloudant

    const startupsDoc = await startupsDB.get('startups')
    startupsDoc.titles = titles
    startupsDoc.list = startups
    await startupsDB.insert(startupsDoc)

    const statsDoc = await startupsDB.get('stats')
    await startupsDB.insert({
      _id: 'stats',
      _rev: statsDoc._rev,
      ...stats,
    })

    ctx.body = 'Se realizó la actualización con éxito'

  })

  return router
}
