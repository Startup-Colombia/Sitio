// const dotenv = require('dotenv')
const Cloudant = require('cloudant')

// dotenv.config()

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

  create(empresasDB, companiesDB)
    .then(() => {
      console.log('Finalizado')
    })

})

async function create (empresasDB, companiesDB) {
  let res = await empresasDB.list({ include_docs: true })
  let empresas = res.rows.map(r => {
    delete r.doc._id
    delete r.doc._rev
    return r.doc
  })
  console.log(empresas)
  try {
    let user = await companiesDB.bulk({ docs: empresas })
  } catch (err) {
    console.log(err)
  }
}
