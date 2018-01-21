import './styles.css'
import { runModule } from './module'
import * as Root from './Root'
import { setDev } from './config'
// import './hmr'

let DEV = false // !process.env.isProduction

setDev(DEV)

;(async () => {
  const app = await runModule(Root, DEV)
  ;(window as any).app = app
})()
