import {
  Actions,
  Inputs,
  Interfaces,
  StyleGroup,
  Components,
  assoc,
  clickable,
  deepmerge,
  getStyle,
} from 'fractal-core'
import { View, h } from 'fractal-core/interfaces/view'
import { getServer } from '../config'
import { extractId } from '../utils'
import { palette, BP, textStyle } from './constants'

declare var hello: any
declare var fbq: any

if (typeof window !== 'undefined') {
  var hello: any = require('hellojs/dist/hello.all.js')
}

import * as Main from './Main'
import * as Dashboard from './Dashboard'
import * as Admin from './Admin'
import * as Site from './Site'
import * as Stats from './Stats'

export const name = 'Root'

export const components: Components = {
  Main,
  Dashboard,
  Admin,
  Site,
  Stats,
}

export const state = {
  section: 'Main', // 'Main' | 'Site'
  route: 'Main', // 'Main' | 'Dashboard' | 'Admin' | 'Stats'
  token: '',
  name: '',
  picture: '',
  _nest: components,
}

export type S = typeof state

export async function routeToComp (hash: string, F) {
  if (hash === '#-panel') {
    await F.toIt('setRoute', 'Dashboard')
    await F.toChild('Dashboard', 'setActive')
  } if (hash === '#-stats') {
    await F.toIt('setRoute', 'Stats')
    await F.toChild('Stats', 'setActive')
  } else if (hash === '#-admin-s34-2343') {
    await F.toIt('setRoute', 'Admin')
    await F.toChild('Admin', 'setActive')
  } else if (hash === '#') {
    await F.toAct('SetRoute', 'Main')
    await F.toChild('Main', 'setActive')
  }
}

function authenticate (network, socialToken) {
  return fetch(getServer() + '/api/auth', <any> {
    method: 'POST',
    headers: {
      Accept: 'application/json, text/plain, */*',
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      socialToken: socialToken,
    }),
  }).then(r => r.text())
}

export const inputs: Inputs = F => ({
  init: async () => {
    if (typeof window !== 'undefined') {
      F.on('login', F.in('login'))
      let hash = extractId(window.location.href)
      let route = hash.split('/')[0]
      if ((window as any).ssrInitialized) {
        let components = (window as any).ssrComponents
        // TODO: handle nesting of components
        let name
        for (name in components) {
          F.ctx.components[name].state = deepmerge(F.ctx.components[name].state, components[name].state)
        }
      }
      await F.toIt('authenticate')
      routeToComp('#' + route, F)
    }
  },
  authenticate: async () => {
    hello.init({
      facebook: '257690644717021',
    }, {
      redirect_uri: 'redirect.html'
    })
    let token = localStorage.getItem('token')
    if (token) {
      try {
        F.toIt('fetchUser', token)
        F.toAct('SetToken', token)
        F.toChild('Main', 'setAuth', true)
        return
      } catch (err) {
        if (err === '401') {
          localStorage.removeItem('token')
        }
      }
    }
    hello.on('auth.login', auth => {
      hello(auth.network).api('me').then(profile => {
        let socialToken = auth.authResponse.access_token
        authenticate(auth.network, socialToken).then(async (token: any) => {
          if (token === '-1') {
            return alert('Hay un problema, le daré solución prontamente')
          }
          if (token === '-2') {
            return alert('Debes verificar tu cuenta de Facebook para poder acceder')
          }
          localStorage.setItem('token', token)
          await F.toAct('SetToken', token)
          F.toChild('Main', 'setAuth', true)
          fbq('track', 'CompleteRegistration') // FB Pixel
          try {
            await F.toIt('fetchUser', token)
          } catch (err) {
            if (err === '401') {
              localStorage.removeItem('token')
            }
          }
        })
        .catch((err) => {
          console.clear()
          console.error(err)
          alert('Hay un problema, lo resolveré prontamente')
        })
      })
    })
    hello.on('auth.logout', async () => {
      await F.toAct('SetToken', '')
      F.toChild('Main', 'setAuth', false)
      localStorage.removeItem('token')
    })
  },
  fetchUser: async token => {
    try {
      let user = await fetch(getServer() + '/api/user', <any> {
        headers: {
          Authorization: 'Bearer ' + token,
        },
      })
        .then(function(response) {
          if (!response.ok) {
            throw Error(response.status + '')
          }
          return response
        })
        .then(r => r.json())
      await F.toChild('Dashboard', 'setTokenAndProfile', [token, user])
      await F.toAct('SetPicture', user.fbData.pictureURL)
      await F.toAct('SetName', user.name)
      await F.toChild('Admin', 'setTokenAndProfile', [token, user])
    } catch (err) {
      throw Error(err)
    }
  },
  setSection: async (name: string) => {
    await F.toAct('SetSection', name)
  },
  toRoute: async ([name, state]) => {
    if (name === '/') {
      await F.toAct('SetSection', 'Main')
      await F.toChild('Main', 'setActive')
    } else {
      await F.toChild('Site', 'setActive', {
        fetched: true,
        ...state.state,
      })
      await F.toAct('SetSection', 'Site')
    }
  },
  setRoute: async (route: string) => {
    await F.toAct('SetRoute', route)
  },
  // TODO: Remove side effect!
  setHash: async (hash: string) => {
    setTimeout(() => {
      window.location.href = '#'
      window.location.href = hash
    }, 0)
    routeToComp(hash, F)
  },
  login: async () => {
    hello('facebook').login()
    await F.toIt('setHash', '#-panel')
  },
  logout: async () => {
    hello.logout('facebook')
    await F.toChild('Dashboard', 'logout')
    await F.toIt('setHash', '#')
    await F.toAct('SetToken', '')
    F.toChild('Main', 'setAuth', false)
    localStorage.removeItem('token')
  },
})

export const actions: Actions<S> = {
  SetSection: assoc('section'),
  SetRoute: assoc('route'),
  SetToken: assoc('token'),
  SetPicture: assoc('picture'),
  SetName: assoc('name'),
}

const view: View<S> = F => async s => {
  let style = getStyle(F)
  let loggedIn = s.token !== ''

  return s.section === 'Site'
  ? F.vw('Site')
  : s.section === 'Main' ? h('div', {
    key: F.ctx.name,
    class: style('base'),
  }, [
    h('header', {
      class: style('header'),
    }, [
      h('a', {
        class: style('titulo'),
        attrs: {  href: '/' },
      }, [
        h('img', {
          class: style('tituloImagen'),
          attrs: { src: 'assets/favicon.png', alt: 'Startup Colombia', itemprop: 'image' },
        }),
        h('h1', {
          class: style('tituloText'),
        }, 'Startup Colombia'),
      ]),
      h('div', { class: style('menu') }, [
        ...loggedIn
        ? [
          h('div', {class: style('routes')},
            [
              ['Panel de Control', '#-panel', 'Dashboard'],
              ['Lista', '#', 'Main'],
              ['Estadísticas', '#-stats', 'Stats'],
            ].map(
              ([op, hash, route]) => h('div', {
                class: style(
                  'option', true,
                  'optionActive', route === s.route,
                ),
                on: { click: F.in('setHash', hash) },
              }, op)
            )
          ),
        ]
        : [],
        h('div', {class: style('leftMenu')}, [
          ...loggedIn
          ? [
            h('img', {
              class: style('picture'),
              attrs: {
                alt: s.name,
                title: s.name,
                src: s.picture,
              },
            }),
          ]
          : [],
          h('div', {
            class: style('auth'),
            on: { click: F.in(loggedIn ? 'logout' : 'login') },
          }, loggedIn ? 'Salir' : 'Entrar'),
        ]),
      ]),
    ]),
    h('div', {class: style('footer')}, [
      h('div', {class: style('footerAuthor')}, [
        <any> 'Hecho con',
        h('svg', {
          class: style('HearthIcon'),
          attrs: { viewBox: '0 0 200 200' },
        }, [
          h('path', {
            class: style('HearthIconPath'),
            attrs: {
              d: 'm95.36899,50.0558c37.26498,-106.90773 183.27039,0 0,137.45279c-183.27039,-137.45279 -37.26498,-244.36052 0,-137.45279z',
            },
          }),
        ]),
        <any> 'por el equipo de ',
        h('a', {
          class: style(
            'footerLink', true,
            'footerPrimaryLink', true
          ),
          attrs: {
            href: 'https://www.facebook.com/StartupsColombia/',
            rel: 'noopener',
            target: '_blank',
          },
        }, [
          h('span', {}, 'Startup Colombia'),
        ]),
      ]),
    ]),
    await F.vw(s.route),
  ])
  : h('p', {}, 'Sección no encontrada')
}

export const interfaces: Interfaces = { view }

const style: StyleGroup = {
  base: {
    width: '100%',
    height: '100%',
    display: 'flex',
    flexDirection: 'column',
    color: palette.textPrimary,
    overflowY: 'scroll',
    ...textStyle,
  },
  header: {
    flexShrink: 0,
    position: 'relative',
    width: '100%',
    height: '180px',
    padding: '30px 20px 30px 20px',
    display: 'flex',
    flexDirection: 'column',
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: palette.primary,
    boxShadow: '0px 1px 1px 0px ' + palette.shadowGrey,
    $nest: {
      [`@media screen and (max-width: ${BP.sm}px)`]: {
        flexDirection: 'column',
        paddingBottom: '10px',
      },
    },
  },
  titulo: {
    display: 'flex',
    alignItems: 'center',
    textDecoration: 'none',
  },
  tituloImagen: {
    width: '120px',
    height: 'auto',
    marginRight: '20px',
    $nest: {
      [`@media screen and (max-width: ${BP.md}px)`]: {
        width: '100px',
        marginRight: '10px',
      },
    },
  },
  tituloText: {
    margin: '0',
    paddingRight: '40px',
    fontSize: '42px',
    color: 'white',
    $nest: {
      [`@media screen and (max-width: ${BP.md}px)`]: {
        paddingRight: '0',
        fontSize: '38px',
      },
    },
  },
  menu: {
    position: 'absolute',
    top: '0px',
    right: '0px',
    padding: '5px',
    display: 'flex',
    alignItems: 'center',
    $nest: {
      [`@media screen and (max-width: ${BP.sm}px)`]: {
        position: 'initial',
      },
    },
  },
  routes: {
    display: 'flex',
    paddingRight: '15px',
    $nest: {
      [`@media screen and (max-width: ${BP.sm}px)`]: {
        padding: '10px 0 0 0',
      },
    },
  },
  option: {
    borderRadius: '2px',
    padding: '4px 8px',
    color: 'white',
    fontSize: '16px',
    fontWeight: 'bold',
    ...clickable,
    $nest: {
      '&:hover': {
        backgroundColor: palette.primaryLight,
      },
    },
  },
  optionActive: {
    backgroundColor: palette.primaryLight,
  },
  leftMenu: {
    display: 'flex',
    alignItems: 'center',
    $nest: {
      [`@media screen and (max-width: ${BP.sm}px)`]: {
        position: 'absolute',
        top: '0px',
        right: '0px',
        padding: '5px',
      },
    },
  },
  picture: {
    width: '25px',
    height: '25px',
    borderRadius: '50%',
  },
  auth: {
    marginLeft: '10px',
    padding: '4px 7px',
    borderRadius: '2px',
    color: 'white',
    fontSize: '16px',
    fontWeight: 'bold',
    ...clickable,
    $nest: {
      '&:hover': {
        backgroundColor: palette.primaryLight,
      },
    },
  },
  footer: {
    flexShrink: 0,
    order: 1,
    position: 'relative',
    marginTop: '13px',
    padding: '20px 0 10px 0',
    display: 'flex',
    flexDirection: 'column',
    alignItems: 'center',
    backgroundColor: palette.shadowLight,
    boxShadow: '0px -1px 1px 0px ' + palette.shadowLighter,
  },
  footerAuthor: {
    padding: '15px 10px',
    fontSize: '16px',
    color: palette.textTertiary,
    marginBottom: '4px',
  },
  HearthIcon: {
    width: '18px',
    height: '18px',
    margin: '0px 4px -3px 6px',
  },
  HearthIconPath: {
    fill: palette.redCol,
  },
  footerLink: {
    padding: '4px',
    fontSize: '16px',
    textDecoration: 'none',
    $nest: {
      '&:hover': {
        textDecoration: 'underline',
      },
    },
  },
  footerPrimaryLink: {
    fontSize: '16px',
    color: palette.primary,
  },
  partnerNotice: {
    position: 'absolute',
    bottom: '0',
    right: '0',
    padding: '5px',
    fontSize: '12px',
    color: palette.textSecondary,
  },
  partner: {
    fontSize: '12px',
    color: palette.textTertiary,
    padding: '4px',
    textDecoration: 'none',
    $nest: {
      '&:hover': {
        textDecoration: 'underline',
      },
    },
  },
}

export const groups = { style }
