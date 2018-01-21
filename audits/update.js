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

let companyIds = [
]

async function audit (companiesDB) {
  for (let i = 0; companyId = companyIds[i]; i++) {
    let company = await companiesDB.get(companyId)
    try {
      const flags = {}
      let reportCategories = await launchChromeAndRunLighthouse(company.webpage, flags).then(results => {
        return Promise.resolve(results.reportCategories)
      })

      company.webAudits = reportCategories.map(rc => ({
        id: rc.id,
        score: rc.score,
      }))

      console.log(company.webAudits)

      await companiesDB.insert(company)

      console.log(i)
      console.log(company.name)
    } catch (err) {
      console.log(company.name + ' Error: ' + company.webpage)
    }

  }

}
