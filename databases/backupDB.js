// const dotenv = require('dotenv')
// dotenv.config()
const Cloudant = require('cloudant')
const fs = require('fs')

var cloudant

var key = process.env.cloudant_key
var password = process.env.cloudant_password

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
  let usersDB = cloudant.use('users')
  let metricsDB = cloudant.use('metrics')

  saveDB(companiesDB, 'companies')
    .then(() => {
      console.log('CompaniesDB saved')
    })

  saveDB(usersDB, 'users')
    .then(() => {
      console.log('UsersDB saved')
    })

  saveDB(metricsDB, 'metrics')
    .then(() => {
      console.log('MetricsDB saved')
    })

})

async function saveDB (DB, name) {
  let tags = {}
  let res = await DB.list({ include_docs: true })
  let docs = res.rows.map(r => r.doc)
  fs.unlink('./databases/DB/' + name + '.json', err => {
    fs.writeFile('./databases/DB/' + name + '.json', JSON.stringify(docs, null, 2), { flag: 'wx' }, err => {
      if (err) throw err
      console.log('Guardado en archivo databases/DB/' + name + '.json')
    })
  })
}

