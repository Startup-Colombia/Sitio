import {
  Actions,
  Inputs,
  Interfaces,
  StyleGroup,
  Components,
  deepmerge,
  CSS,
  assoc,
  clone,
  props,
} from 'fractal-core'
import { View, h } from 'fractal-core/interfaces/view'
import { getServer } from '../../config'
import { buttonCancelStyle, buttonPrimaryStyle } from '../constants'

import * as CompanyForm from '../common/CompanyForm'

export const components: Components = {
  CompanyForm: props({ mode: 'review' })(clone(CompanyForm)),
}

export const state = {
  active: false,
  token: '',
  profile: {
    id: '',
  },
  companyUnreviewedId: '',
  companyId: '',
  userId: '',
  userFb: '',
  _nest: components,
}

export type S = typeof state

export const inputs: Inputs = F => ({
  setTokenAndProfile: async ([token, profile]) => {
    let s: S = F.stateOf()
    await F.toAct('SetTokenAndProfile', [token, profile])
    if (s.active) {
      await F.toIt('getUnreviewed')
    }
  },
  setActive: async () => {
    let s: S = F.stateOf()
    await F.toAct('SetActive', true)
    if (s.token) {
      await F.toIt('getUnreviewed')
    }
  },
  getUnreviewed: async () => {
    let s: S = F.stateOf()
    await F.toChild('CompanyForm', 'reset')
    try {
      let company = await fetch(getServer() + '/api/unreviewed/0', {
        headers: <any> {
          Authorization: 'Bearer ' + s.token,
        },
      }).then(r => r.json())
      if (company.code === -2) {
        alert('No hay mas compañias por revisar ...')
      } else if (company.code < 0) {
        alert('Hay un problema, estoy trabajando en darle pronta solución')
      } else {
        await F.toAct('SetCompanyUnreviewedId', company._id)
        await F.toAct('SetCompanyId', company.id)
        await F.toChild('CompanyForm', 'setCompany', [company, true])
        await F.toIt('setCompanyData', company)
      }
    } catch (err) {
      alert('No hay conexión o hay un error, puedes escribirme si el problema persiste')
    }
  },
  deny: async () => {
    let s: S = F.stateOf()
    try {
      let res = await fetch(getServer() + '/api/deny', {
        method: 'POST',
        headers: <any> {
          Authorization: 'Bearer ' + s.token,
          Accept: 'application/json, text/plain, */*',
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ id: s.companyUnreviewedId }),
      }).then(r => r.json())
      if (res.code === 0) {
        await F.toChild('CompanyForm', 'reset')
        await F.toAct('SetCompanyUnreviewedId', '')
        await F.toAct('SetCompanyId', '')
        await F.toIt('getUnreviewed')
      } else {
        alert('Hay un problema, estoy trabajando en darle pronta solución')
      }
    } catch (err) {
      alert('No hay conexión o hay un error, puedes escribirme si el problema persiste')
    }
  },
  addCompany: async () => {
    await F.toChild('CompanyForm', 'getData')
  },
  setCompanyData: async company => {
    await F.toAct('SetUserId', company.userId)
    await F.toAct('SetUserFb', company.userFb)
  },
  $CompanyForm_data: async company => {
    let s: S = F.stateOf()
    company._id = s.companyUnreviewedId
    company.id = s.companyId
    fetch(getServer() + '/api/accept', {
      method: 'POST',
      headers: <any> {
        Authorization: 'Bearer ' + s.token,
        Accept: 'application/json, text/plain, */*',
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(company),
    })
      .then(r => r.json())
      .then(res => {
        if (res.code === 0) {
          F.toChild('CompanyForm', 'reset')
          F.toAct('SetCompanyUnreviewedId', '')
          F.toIt('getUnreviewed')
        } else {
          alert('Hay un problema, estoy trabajando en darle pronta solución')
        }
      })
      .catch(() => alert('No hay conexión o hay un error, puedes escribirme si el problema persiste'))
  },
  $CompanyForm_validationError: async () => {
    alert('Por favor, completa el formulario')
  },
})

export const actions: Actions<S> = {
  SetTokenAndProfile: ([token, profile]) => s => {
    s.token = token
    return s
  },
  SetCompanyUnreviewedId: assoc('companyUnreviewedId'),
  SetActive: assoc('active'),
  SetUserId: assoc('userId'),
  SetUserFb: assoc('userFb'),
  SetCompanyId: assoc('companyId'),
}

const view: View<S> = F => async s => {
  let style = F.ctx.groups.style

  return !s.token
  ? h('div', {class: { [style.base]: true }}, 'Sitio para administradores')
  : h('div', {
    key: F.ctx.name,
    class: { [style.base]: true },
  },[
    await F.vw('CompanyForm'),
    h('a', {
      class: { [style.link]: true },
      attrs: { href: 'https://facebook.com/' + s.userId, target: '_blank', rel: 'noopener noreferrer' },
    }, 'Facebook de usuario que hace PETICION'),
    ...s.userFb ? [
      h('a', {
        class: { [style.link]: true },
        attrs: { href: s.userFb, target: '_blank', rel: 'noopener noreferrer' },
      }, 'Facebook de usuario de EMPRESA'),
    ] : [
      h('div', 'Nueva empresa'),
    ],
    ...s.companyUnreviewedId ? [
      h('div', {class: { [style.buttonContainer]: true }}, [
        h('button', {
          class: { [style.denyBtn]: true },
          on: {  click: F.in('deny') },
        }, 'Denegar'),
        h('button', {
          class: { [style.addCompanyBtn]: true },
          on: { click: F.in('addCompany') },
        }, 'Aceptar'),
      ])
    ] : [
      h('button', {
        class: { [style.addCompanyBtn]: true },
        on: { click: F.in('getUnreviewed') },
      }, 'Cargar')
    ],
  ])
}

export const interfaces: Interfaces = { view }

const style: StyleGroup = {
  base: {
    flexShrink: 0,
    width: '100%',
    paddingBottom: '40px',
    display: 'flex',
    flexDirection: 'column',
    alignItems: 'center',
  },
  link: {
    padding: '10px',
  },
  buttonContainer: {
    flexShrink: 0,
    display: 'flex',
    margin: '24px 15px 35px 15px',
  },
  denyBtn: deepmerge(buttonCancelStyle, <CSS> {
    marginTop: '35px',
    marginRight: '35px',
  }),
  addCompanyBtn: deepmerge(buttonPrimaryStyle, <CSS> {
    marginTop: '35px',
  }),
}

export const groups = { style }
