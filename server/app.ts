import Koa = require('koa')
import serve = require('koa-static')
import mount = require('koa-mount')
import bodyParser = require('koa-bodyparser')

import api from './api'
import staticRouter from './static'

export default function runServer () {

  let port = process.env.PORT || 3001

  let app = new Koa()

  require('http').Server(app.callback())

  if (process.env.ENV !== 'production') {
    app.use(require('kcors')())
  }

  app.use((<any> bodyParser)())

  app.use(serve('dist/public'))

  app
    .use(mount('/api', api.routes()))
    .use(mount('/api', api.allowedMethods()))

  app
    .use(mount('/', staticRouter.routes()))
    .use(mount('/', staticRouter.allowedMethods()))

  app.listen(port)

  console.log('Server running in ' + port + ' ...')

}
