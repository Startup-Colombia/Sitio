// const Cloudant = require('cloudant')
// // const dotenv = require('dotenv')
// // dotenv.config()

// var cloudant

// var key = process.env.cloudant_key
// var password = process.env.cloudant_password

// Cloudant({
//   account: '1ec8c733-54bd-44c9-aafd-cd14edb80cf1-bluemix',
//   key: key,
//   password: password,
//   plugin: 'promises',
// }, (er, cloudant, reply) => {
//   if (er) {
//     throw er
//   }

//   let usersDB = cloudant.use('users')

//   create(usersDB)
//     .then(() => {
//       console.log('Tests finalizados')
//     })

// })

// async function create (usersDB) {
//   let res
//   try {
//     res = await usersDB.get('_design/users')
//   } catch (err) {

//     var indexer = function(doc) {
//         index('name', doc.name)
//         index('name', doc.name)
//     }

//     var ddoc = {
//       _id: '_design/users',
//       indexes: {
//         users: {
//           analyzer: { name: 'standard' },
//           index   : indexer,
//         }
//       }
//     }

//     usersDB.insert(ddoc, function (er, result) {
//       if (er) {
//         throw er
//       }
//       console.log('Created design document with users index')
//     })
//   }

// }
