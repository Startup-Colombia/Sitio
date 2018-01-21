// const dotenv = require('dotenv')
const Cloudant = require('cloudant')
const users = require('./users.json')

// dotenv.config()

var cloudant

var key = process.env.cloudant_key
var password = process.env.cloudant_password

Cloudant({
  account: '1ec8c733-54bd-44c9-aafd-cd14edb80cf1-bluemix',
  key: key,
  password: password,
  plugin: 'promises',
}, (er, cloudantInstance, reply) => {
  if (er) {
    throw er
  }
  console.log(reply)

  cloudant = cloudantInstance

  createUsers(users)
    .then(() => {
      console.log('Tests finalizados')
    })

})

async function createUsers (users) {
  let usersDB = cloudant.db.use('users')
  for (let key in users) {
    try {
      let user = await usersDB.get(key)
      console.log('Error ' + key + ' already exists')
      console.log(users[key])
    } catch (err) {
      try {
        users[key]._id = key
        await usersDB.insert(users[key])
        console.log(`Created user ${key}`)
      } catch (err) {
        // this should never ocurs
        console.log(err)
      }
    }
  }
}
