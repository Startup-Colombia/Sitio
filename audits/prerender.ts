import { prerender } from '../tools/aot'
import { sendMsg } from 'fractal-core/core'

import { runModule } from '../app/module'
import * as Audits from '../app/Audits'

const version = '1.0'

const dotenv = require('dotenv')
dotenv.config()

const Cloudant = require('cloudant')

Cloudant({
  account: '1ec8c733-54bd-44c9-aafd-cd14edb80cf1-bluemix',
  plugin: 'promises',
}, async (er, cloudant, reply) => {
  if (er) {
    throw er
  }

  let companiesDB = cloudant.use('companies')

  let res = await companiesDB.list({ include_docs: true })
  let companies = res.rows.map(r => r.doc).filter(d => d._id.indexOf('_design') === -1)

  prerender({
    encoding: 'utf8',
    htmlFile: './app/index.ejs',
    cssFile: './app/styles.css',
    outputFile: './aot/rank-de-sitios.html',
    isStatic: true,
    root: Audits,
    runModule,
    lang: 'es',
    url: '/',
    version,
    ...(Audits as any).meta,
    componentNames: [],
    extras: '<meta name="robots" content="noindex,nofollow">',
    cb: async app => {
      sendMsg(app, 'Audits', 'setCompanies', companies)
    },
  })

})
