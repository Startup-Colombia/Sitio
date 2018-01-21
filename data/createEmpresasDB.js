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

  let empresasDB_p = cloudant.use('empresas')
  let empresasDB = cloudant.use('empresas_db')

  createEmpresas(empresasDB_p, empresasDB)
    .then(() => {
      console.log('Tests finalizados')
    })

})

async function createEmpresas (empresasDB_p, empresasDB) {
  let res = await empresasDB_p.get('9a983de8d0550f1c7838a6737bda4c05')
  let empresas = res.empresas
  for (let i = 0; empresa = empresas[i]; i++) {
    try {
      let user = await empresasDB.insert({
        name: empresa.nombre,
        networks: {
          facebook: empresa.fanpage,
        },
        webpage: empresa.webpage,
        user: empresa.usuario,
        userFb: empresa.perfil,
        type: '',
        tags: empresa.categorias,
        places: empresa.sedes,
      })
      console.log(i)
      console.log(empresa.nombre)
    } catch (err) {
      console.log(err)
    }
  }
}
