import fs = require('fs')
import { getCategories } from '../server/utils'

;(async () => {
  let categories = await getCategories()

  fs.unlink('./cachedData/categories.json', err => {
    fs.writeFile('./cachedData/categories.json', JSON.stringify(categories), { flag: 'wx' }, err => {
      if (err) throw err
      console.log('Guardado en archivo ./cachedData/categories.json')
    })
  })
})()
