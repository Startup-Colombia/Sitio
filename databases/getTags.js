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

  getTags(companiesDB)
    .then(() => {
      console.log('Finished')
    })

})

async function getTags (companiesDB) {
  let tags = {}
  let res = await companiesDB.list({ include_docs: true })
  let companies = res.rows.map(r => r.doc).filter(d => d._id.indexOf('_design/') === -1)
  companies.forEach(c =>
    c.tags.forEach(tag => {
      tag = tag.toLowerCase()
      if (!tags.hasOwnProperty(tag)) {
        tags[tag] = 1
      }
      tags[tag]++
    })
  )
  let result = []
  for (let tag in tags) {
    result.push([tag, tags[tag]])
  }
  result = result.sort((t1, t2) => t2[1] - t1[1])
  fs.writeFileSync('tags.json', JSON.stringify(result, null, 2))
}
