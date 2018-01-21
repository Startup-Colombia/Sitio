// DPRECATED
import lunr = require('lunr')
import fs = require('fs')
import { procesarEmpresas } from '../app/procesarEmpresas'
import { normalize, normalizeSpelling, spreadWord } from '../app/utils'
import * as empresas from './empresas.json'

// Procesamiento de datos, se quitan duplicados y se construye el indice

const empresasProc = procesarEmpresas(empresas)

const index = lunr(function () {
  this.ref('id')
  this.field('nombre')
  this.field('usuario')
  this.field('categoria')
  this.field('sede')

  // this.k1(10000)
  // this.b(0)

  this.use(normalizeSpelling)

  for (var i = 0, key, doc, empresa; empresa = empresasProc[i]; i++) {
    doc = {}
    for (key in empresa) {
      if (key === 'nombre' || key === 'usuario' || key === 'categoria' || key === 'sede') {
        if (key === 'nombre') {
          doc.id = empresa.nombre
        }
        doc[key] = spreadWord(normalize(empresa[key]))
      }
    }
    this.add(doc)
  }
})

console.log(JSON.stringify(
  index.search('categoria:market sede:bogo').filter(r => r.score > 0.6)
, null, 2))


console.log(JSON.stringify(
  index.search('categoria:hotel').filter(r => r.score > 0.6)
, null, 2))

fs.unlink('./data/empresasProc.json', err => {
  fs.writeFile('./data/empresasProc.json', JSON.stringify(empresasProc), { flag: 'wx' }, err => {
    if (err) throw err
    console.log('Guardado en archivo ./data/empresasProc.json')
  })
})

fs.unlink('./data/empresasIdx.json', err => {
  fs.writeFile('./data/empresasIdx.json', JSON.stringify(index), { flag: 'wx' }, err => {
    if (err) throw err
    console.log('Guardado en archivo ./data/empresasIdx.json')
  })
})
