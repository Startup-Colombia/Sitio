// const dotenv = require('dotenv')
// dotenv.config()

const Cloudant = require('cloudant')

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

  fix(companiesDB)
    .then(() => {
      console.log('Fixed')
    })

})

async function fix (companiesDB) {
  let res = await companiesDB.list({ include_docs: true })
  let companies = res.rows.map(r => r.doc).filter(d => d._id.indexOf('_design') === -1)
  let error
  for (let i = 0; company = companies[i]; i++) {
    error = false
    if (company.webpage && company.webpage.indexOf('http') === -1) {
      console.log('---- Company: ' + company.name + ' / ' + company.webpage)
      company.webpage = 'http://' + company.webpage
      error = true
    }
    if (!company.networks) {
      console.log('---- Company: ' + company.name + ' No networks object')
      continue
    }
    if (company.networks.facebook && company.networks.facebook.indexOf('http') === -1) {
      console.log('---- Company: ' + company.name + ' / ' + company.networks.facebook)
      company.networks.facebook = 'https://' + company.networks.facebook
      error = true
    }
    if (company.networks.linkedin && company.networks.linkedin.indexOf('http') === -1) {
      console.log('---- Company: ' + company.name + ' / ' + company.networks.linkedin)
      company.networks.linkedin = 'https://' + company.networks.linkedin
      error = true
    }
    if (company.networks.twitter && company.networks.twitter.indexOf('http') === -1) {
      console.log('---- Company: ' + company.name + ' / ' + company.networks.twitter)
      company.networks.twitter = 'https://' + company.networks.twitter
      error = true
    }
    if (company.networks.github && company.networks.github.indexOf('http') === -1) {
      console.log('---- Company: ' + company.name + ' / ' + company.networks.github)
      company.networks.github = 'https://' + company.networks.github
      error = true
    }
    if (error) {
      await companiesDB.insert(company)
    }

  }

}
