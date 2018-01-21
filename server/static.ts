import fs = require('fs')
import request = require('request')
import Router = require('koa-router')
import { sendMsg } from 'fractal-core'
import { renderHTML } from 'fractal-core/utils/ssr'
import { strToLink } from '../app/utils'
import { getKeywords } from './utils'
import { Company } from '../schema/index'
import keywordsBase = require('../../../SEO/keywords.json')

import { runModule } from '../app/module'
import * as Root from '../app/Root'

let staticRouter = new Router()

try {
  let html = fs.readFileSync('./app/index.ejs', 'utf8')
  let css = fs.readFileSync('./app/styles.css', 'utf8')

  staticRouter.get('/:name', async ctx => {
    try {
      let nameParam = decodeURIComponent(ctx.params.name)
      let name = nameParam.replace(/-/g, ' ')
      let query = name
        .split(' ')
        .map(p => 'name:' + p)
        .join(' OR ')

      let queryURI = encodeURIComponent(query)
      let result: any = await new Promise((resolve, reject) => request(
        'https://1ec8c733-54bd-44c9-aafd-cd14edb80cf1-bluemix.cloudant.com/companies/_design/companies/_search/companies?q=' + queryURI + '&include_docs=true&limit=1',
        (error, res, body) =>{
          if (error) {
            return reject(error)
          }
          resolve(body)
        },
      ))
      result = JSON.parse(result)
      let company
      for (let i = 0, len = result.rows.length; i < len; i++) {
        if (result.rows[i] && strToLink(result.rows[i].doc.name) === nameParam) {
          company = result.rows[i].doc
          company.fetched = true
          break
        }
      }
      let companyOriginal: Company = company
      let keywords: any = keywordsBase
      if (!company) {
        company = { name }
      } else if (company.description) {
        keywords = getKeywords(company.description)
      }
      let title = companyOriginal.name || ''
      let description = companyOriginal.description || ''
      let author = companyOriginal.user || ''
      ctx.body = await renderHTML({
        root: Root,
        runModule,
        bundlePaths: ['bundle.js'],
        lang: 'es',
        html,
        css,
        title,
        description,
        keywords: keywords.join(','),
        author,
        url: '/' + ctx.params.name,
        cb: async app => {
          await sendMsg(app, 'Root', 'toRoute', ['Site', { state: company }])
        }
      })
    } catch (err) {
      ctx.status = err.status || 500
      ctx.body = err || 'Ha ocurrido un error, lo solucionare en un momento'
    }
  })

} catch (err) {
  console.log(err)
}

export default staticRouter
