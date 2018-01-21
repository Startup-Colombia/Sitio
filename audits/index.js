const lighthouse = require('lighthouse')
const chromeLauncher = require('lighthouse/chrome-launcher')
const dotenv = require('dotenv')

const Cloudant = require('cloudant')

dotenv.config()

var cloudant

var key = process.env.cloudant_key
var password = process.env.cloudant_password

let version = '1.0'

function launchChromeAndRunLighthouse(url, flags = {}, config = null) {
  return chromeLauncher.launch().then(chrome => {
    flags.port = chrome.port
    return lighthouse(url, flags, config).then(results =>
      chrome.kill().then(() => results))
  })
}

Cloudant({
  account: '1ec8c733-54bd-44c9-aafd-cd14edb80cf1-bluemix',
  key: key,
  password: password,
  plugin: 'promises',
}, (er, cloudant, reply) => {
  if (er) {
    throw er
  }

  let companiesDB = cloudant.use('companies')

  audit(companiesDB)
    .then(() => {
      console.log('Tests finalizados')
    })

})

async function audit (companiesDB) {
  let res = await companiesDB.list({ include_docs: true })
  let companies = res.rows.map(r => r.doc)
  for (let i = 0; company = companies[i]; i++) {
    if (company.webpage) {
      if (!company.webAudits) {
        try {
          const flags = {}
          let reportCategories = await launchChromeAndRunLighthouse(company.webpage, flags).then(results => {
            return Promise.resolve(results.reportCategories)
          })

          company.webAudits = reportCategories.map(rc => ({
            id: rc.id,
            score: rc.score,
          }))

          await companiesDB.insert(company)

          console.log(i)
          console.log(company.name)
        } catch (err) {
          console.log(company.name + ' Error: ' + company.webpage)
        }
      } else {
        company.webAuditsVersion = version
        await companiesDB.insert(company)
      }

    }
  }

}
