import {
  Actions,
  Inputs,
  Interfaces,
  StyleGroup,
  getStyle,
  deepmerge,
  CSS,
} from 'fractal-core'
import { View, h } from 'fractal-core/interfaces/view'
import { palette, buttonPrimaryStyle } from '../constants'

export const state = {}

export type S = typeof state

export const inputs: Inputs = F => ({
  login: async () => {
    F.emit('login')
  },
})

export const actions: Actions<S> = {
}

const view: View<S> = F => async s => {
  let style = getStyle(F)

  return h('article', {
    key: F.ctx.name,
    class: style('base'),
  }, [
    h('div', { class: style('title') }, 'Bienvenido!'),
    h('button', {
      class: style('loginBtn'),
      on: { click: F.in('login') },
    }, 'Entrar'),
  ])
}

export const interfaces: Interfaces = { view }

const style: StyleGroup = {
  base: {
    flexShrink: 0,
    width: '100%',
    minHeight: 'calc(100% - 249px)',
    paddingBottom: '50px',
    display: 'flex',
    flexDirection: 'column',
    alignItems: 'center',
  },
  title: {
    margin: '30px 0 25px 0',
    textAlign: 'center',
    fontSize: '28px',
    fontWeight: 'normal',
    color: palette.secondary,
  },
  loginBtn: deepmerge(buttonPrimaryStyle, <CSS> { width: '130px' }),
}

export const groups = { style }
