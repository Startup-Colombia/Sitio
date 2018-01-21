import { runModule } from '../app/module'
import { prerender } from 'fractal-core/utils/aot'
import * as data from '../app/version.json'

import * as Root from '../app/Root'
import * as List from '../app/List'

prerender({
  htmlFile: './app/index.ejs',
  cssFile: './app/styles.css',
  outputFile: './aot/index.html',
}, {
  encoding: 'utf-8',
  root: Root,
  runModule,
  lang: 'es',
  url: '/',
  version: (data as any).version,
  ...(List as any).meta,
  bundlePaths: ['bundle.js'],
  cb: app => {},
})
