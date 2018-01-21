import {
  run,
  Component,
  // DEV
  logFns,
  RunModule,
} from 'fractal-core'
import { viewHandler } from 'fractal-core/interfaces/view'
import { styleHandler } from 'fractal-core/groups/style'

export const runModule: RunModule = (Root: Component<any>, DEV: boolean, options?: any) => run({
  log: DEV,
  record: DEV,
  Root,
  ...options,
  groups: {
    style: styleHandler('', DEV),
  },
  tasks: {
    route: mod => {
      if (typeof window !== 'undefined') {
        if (!(window as any).ssrInitialized) {
          if (window.location.pathname === '/') {
            let hash = window.location.hash
            let search = window.location.search
            window.history.pushState({ route: '/', hash, search }, '', '/' + hash + search)
          }
        }
        window.onpopstate = ev => {
          if (ev.state) {
            mod.dispatchEv({}, ['Root', 'toRoute', [ev.state.route || '/', ev.state]])
          }
        }
      }
      return {
        state: {},
        handle: async ([route, state]) => {
          if (typeof window !== 'undefined') {
            window.history.pushState({ route }, route, route)
          }
          mod.dispatchEv({}, ['Root', 'toRoute', [route, { state }]])
        },
        dispose: () => {},
      }
    },
  },
  interfaces: {
    view: viewHandler('#app'),
  },
  ...DEV ? logFns : {},
})
