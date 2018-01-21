import dotenv = require('dotenv')
dotenv.config()

import { User, Company, Metric } from '../schema'
import Cloudant = require('cloudant')
import request = require('request')
import Router = require('koa-router')
import jwt = require('jsonwebtoken')
import koaJWT = require('koa-jwt')
import { deepmerge } from 'fractal-core/core'
import { normalize, strToLink } from '../app/utils'

var key = process.env.cloudant_key
var password = process.env.cloudant_password
var jwt_secret = process.env.jwt_secret
var emailPassword = process.env.email_password

if (!key || !password || !jwt_secret || !emailPassword) {
  throw 'Error! environment not setted'
}

let router = Router()

const runAPI = (router, cloudant) => {

  let usersDB = cloudant.use('users')
  let companiesDB = cloudant.use('companies')
  let companiesUnreviewedDB = cloudant.use('companies_unreviewed')
  let metricsDB = cloudant.use('metrics')

  // --- API

  // PUBLIC

  router.post('/auth', async ctx => {
    let data
    let socialToken = ctx.request.body.socialToken
    try {
      data = await new Promise((resolve, reject) => request({
        url: 'https://graph.facebook.com/me',
        qs: { access_token: socialToken, fields: 'id,name,email,verified,picture{url}' },
      },
      (error, response, body) => {
        if (!error && response.statusCode == 200) {
          resolve(JSON.parse(body))
        } else {
          reject(error)
        }
      }))
    } catch (err) {
      return ctx.body = '-1'
    }
    if (!data.verified) {
      return ctx.body = '-2' // unverified FB account
    }
    try {
      let user = await usersDB.get(data.id)
      // refresh name
      user.name = data.name
      user.fbData = {
        verified: data.verified,
        email: data.email,
        pictureURL: data.picture.data.url,
      }
      user.timestamp = (new Date()).toISOString()
      await usersDB.insert(user)
    } catch (error) {
      // create a new user
      let user: User = {
        _id: data.id,
        name: data.name,
        email: '',
        networks: {
          facebook: data.id,
        },
        fbData: {
          verified: data.verified,
          email: data.email,
          pictureURL: data.picture.data.url,
        },
        companies: {},
        timestamp: (new Date()).toISOString(),
      }
      let res = await usersDB.insert(user)
      let metric: Metric = {
        type: 'newUser',
        userId: res.id,
        companyId: '',
        companyName: '',
        timestamp: user.timestamp,
      }
      await metricsDB.insert(metric)
    }
    ctx.body = jwt.sign(data, jwt_secret, {
      expiresIn: '8h',
      issuer: 'startupcol.com',
    })
  })

  // PRIVATE

  router.use(koaJWT({ secret: jwt_secret }))

  router.get('/user', async ctx => {
    try {
      ctx.body = await usersDB.get(ctx.state.user.id)
      ctx.body.code = 0
    } catch (err) {
      ctx.body = { code: -1 }
    }
  })

  router.get('/companies', async ctx => {
    try {
      let res = await companiesDB.search(
        'companies',
        'companies',
        {
          q: `userId:${ctx.state.user.id}*`,
          include_docs: true,
        }
      )
      ctx.body = res.rows.map(r => r.doc)
    } catch (err) {
      ctx.body = { code: -1 }
    }
  })

  router.post('/companyRequest', async ctx => {
    let company = ctx.request.body
    let user
    try {
      user = await usersDB.get(ctx.state.user.id)
      if (!company._userEmail && !user.email) {
        return ctx.body = { code: -1 }
      } else if (company._userEmail) {
        user.email = company._userEmail
        delete company._userEmail
        user.timestamp = (new Date()).toISOString()
        await usersDB.insert(user)
      }
    } catch (err) {
      return ctx.body = { code: -1 }
    }
    if (company.id) {
      // company is already in list
      try {
        let companyIn = await companiesDB.get(company.id)
        company.userFb = companyIn.userFb
        if (companyIn.userId) {
          // something already owns the company
          return ctx.body = { code: -2 }
        }
      } catch (err) {
        return ctx.body = { code: -3 }
      }
    }
    company.userId = user._id
    company.user = user.name
    try {
      if (true) {
        company.timestamp = (new Date()).toISOString()
        await companiesUnreviewedDB.insert(company)
        let metric: Metric = {
          type: 'companyRequest',
          userId: user._id,
          companyId: '',
          companyName: company.name,
          timestamp: company.timestamp,
        }
        await metricsDB.insert(metric)
        sendEmail({
          from: '"Startup Colombia" soporte@startupcol.com',
          to: 'carloslfu@gmail.com',
          subject: 'Company Request - ' + company.name,
          text: `
${company.name}

${user.name} - ${user.email} - ${user._id}
  `
        }, (error, info) => {
          if (error) {
              // return console.log(error)
          }
          // console.log('Message %s sent: %s', info.messageId, info.response)
        })
        return ctx.body = { code: 0 }
      } else {
        return ctx.body = { code: -4 }
      }
    } catch (err) {
      return ctx.body = { code: -5 }
    }
  })

  // Update a company
  router.post('/company', async ctx => {
    let userId = ctx.state.user.id
    let companyUpdated = ctx.request.body
    try {
      let company: Company = await companiesDB.get(companyUpdated._id)
      if (company.userId !== userId) {
        return ctx.body = { code: -1 }
      }
      if (companyUpdated.name !== company.name) {
        // search if there are a name collision, this is client side validated
        let nameQuery = companyUpdated.name
          .split(' ')
          .map(p => 'name:' + normalize(p.trim()))
          .join(' AND ')
        let res = await companiesDB.search(
          'companies',
          'companies',
          {
            q: nameQuery,
            include_docs: true,
          }
        )
        let sameName = res.rows.filter(r => strToLink(r.doc.name) === strToLink(companyUpdated.name))
        if (sameName[0]) {
          // Something weird, bad API use
          return { code: -99 }
        }
      }
      companyUpdated._rev = company._rev
      let companyResult = deepmerge(company, companyUpdated)
      companyResult.places = companyUpdated.places.slice(0, 20)
      companyResult.tags = companyUpdated.tags.slice(0, 5)
      // Verify integrity of data
      if (false) {
        return ctx.body = { code: -2 }
      }
      companyResult.timestamp = (new Date()).toISOString()
      await companiesDB.insert(companyResult)
      let metric: Metric = {
        type: 'companyUpdate',
        userId: userId,
        companyId: companyResult._id,
        companyName: companyResult.name,
        timestamp: companyResult.timestamp,
      }
      await metricsDB.insert(metric)
      ctx.body = { code: 0 }
    } catch (err) {
      console.log(err)
      ctx.body = { code: -3 }
    }
  })

  // REVIEW

  let carloslfuId = '1741269969231686'

  router.get('/unreviewed/:num', async ctx => {
    if (ctx.state.user.id !== carloslfuId) {
      return ctx.body = { code: -1 }
    }
    let num = 0
    if (ctx.params.num !== undefined) {
      num = ctx.params.num
    }
    try {
      let res = await companiesUnreviewedDB.list({ include_docs: true, limit: 1 })
      let companies = res.rows.map(r => r.doc)
      if (companies[num]) {
        ctx.body = companies[num]
      } else {
        return ctx.body = { code: -2 }
      }
    } catch (err) {
      return ctx.body = { code: -1 }
    }
  })

  router.post('/accept', async ctx => {
    let userId = ctx.state.user.id
    if (userId !== carloslfuId) {
      return ctx.body = { code: -1 }
    }
    try {
      let companyRequest = ctx.request.body
      let company
      if (companyRequest.id) {
        company = await companiesDB.get(companyRequest.id)
        // if (companyRequest.name !== company.name) {
        //   // Something weird, bad API use
        //   return { code: -99 }
        // }
      }
      let companyUnreviewed = await companiesUnreviewedDB.get(companyRequest._id)
      // remove unreviewed register
      await companiesUnreviewedDB.destroy(companyUnreviewed._id, companyUnreviewed._rev)
      let companyResult = deepmerge(companyUnreviewed, companyRequest)
      companyResult.places = companyRequest.places.slice(0, 20)
      companyResult.tags = companyRequest.tags.slice(0, 5)
      delete companyResult.id
      delete companyResult._id
      delete companyResult._rev
      if (companyRequest.id) {
        companyResult._id = company._id
        companyResult._rev = company._rev
      }
      // Verify integrity of data
      if (false) {
        return ctx.body = { code: -3 }
      }
      // Update or create company
      companyResult.timestamp = (new Date()).toISOString()
      let res = await companiesDB.insert(companyResult)
      let metric: Metric = {
        type: 'companyAccept',
        userId: userId,
        companyId: res.id,
        companyName: companyResult.name,
        timestamp: companyResult.timestamp,
      }
      await metricsDB.insert(metric)
      let user: User = await usersDB.get(companyResult.userId)
      // Add company to user
      user.companies[res.id] = true
      user.timestamp = (new Date()).toISOString()
      await usersDB.insert(user)
      sendEmail({
       from: '"Startup Colombia" soporte@startupcol.com',
        to: user.email,
        subject: 'Se ha actualizado ' + companyResult.name + '!',
        text: `Hola ${user.name.split(' ')[0]}

Tu empresa ${companyResult.name} ha sido actualizada en la plataforma! Ahora puedes modificar los datos directamente desde el Panel de Control. También tendrás acceso a interesantes características que iré implementando. Escríbeme a este correo si tienes alguna duda, inquietud, sugerencia o idea. También puedes contactarme por Facebook si así lo deseas.

Un saludo,
Carlos Galarza
`
      }, (error, info) => {
        if (error) {
            // return console.log(error)
        }
        // console.log('Message %s sent: %s', info.messageId, info.response)
      })
      ctx.body = { code: 0 }
    } catch (err) {
      return ctx.body = { code: -2 }
    }
  })

  router.post('/deny', async ctx => {
    let userId = ctx.state.user.id
    if (userId !== carloslfuId) {
      return ctx.body = { code: -1 }
    }
    try {
      let companyUnreviewed = await companiesUnreviewedDB.get(ctx.request.body.id)
      // remove unreviewed register
      await companiesUnreviewedDB.destroy(companyUnreviewed._id, companyUnreviewed._rev)
      let metric: Metric = {
        type: 'companyDeny',
        userId: userId,
        companyId: '',
        companyName: companyUnreviewed.name,
        timestamp: (new Date()).toISOString(),
      }
      await metricsDB.insert(metric)
      let user = await usersDB.get(companyUnreviewed.userId)
      sendEmail({
        from: '"Startup Colombia" soporte@startupcol.com',
        to: user.email,
        subject: 'Error en solicitud, ' + companyUnreviewed.name,
        text: `Hola ${user.name.split(' ')[0]}

Hay algo erróneo en la solicitud de ${companyUnreviewed.name}, debes hacer una nueva solicitud. Escríbeme si tienes alguna duda o inquietud.

Un saludo,
Carlos Galarza
`,
      }, (error, info) => {
        if (error) {
            // return console.log(error)
        }
        // console.log('Message %s sent: %s', info.messageId, info.response)
      })
      return ctx.body = { code: 0 }
    } catch (err) {
      return ctx.body = { code: -2 }
    }
  })

}

// Asegura que la API siempre corra
function ensureRunAPI (router) {
  Cloudant({
    account: '1ec8c733-54bd-44c9-aafd-cd14edb80cf1-bluemix',
    key: key,
    password: password,
    plugin: 'promises',
  }, (err, cloudant, reply) => {
    if (err) {
      console.log('No connection to Database, trying again in 4 seconds ...')
      setTimeout(() => ensureRunAPI(router), 4000)
      return
    }
    runAPI(router, cloudant)
  })
}

ensureRunAPI(router)

// Envio de emails from soporte@startupcol.com

var nodemailer = require('nodemailer')

// Create the transporter with the required configuration for Gmail
// change the user and pass !
var transporter = nodemailer.createTransport({
    host: 'smtp.zoho.com',
    port: 465,
    secure: true, // use SSL
    auth: {
        user: 'soporte@startupcol.com',
        pass: emailPassword,
    }
})

interface MailOptions {
  from: string // sender address (who sends)
  to: string // list of receivers (who receives)
  subject: string // Subject line
  text?: string // plaintext body
  html?: string
}

function sendEmail (mailOptions: MailOptions, cb: any) {
  transporter.sendMail(mailOptions, cb)
}

export default router
