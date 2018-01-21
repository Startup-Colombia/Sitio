let fs = require('fs')
let data = require('../app/version.json')

data.version = data.version + 1

fs.unlink('./app/version.json', err => {
  fs.writeFile('./app/version.json', JSON.stringify(data), { flag: 'wx' }, err => {
    if (err) throw err
    console.log('Guardado en archivo app/version.json')
  })
})
