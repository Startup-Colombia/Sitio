import {
  Actions,
  Inputs,
  Interfaces,
  StyleGroup,
  assoc,
  CSS,
  deepmerge,
  Components,
  props,
  clone,
  pipe,
  absoluteCenter,
  clickable,
} from 'fractal-core'
import { View, h } from 'fractal-core/interfaces/view'
import { getServer } from '../../config'
import { buttonPrimaryStyle, buttonCancelStyle, scrollBar, BP, palette } from '../constants'

import * as CompanyForm from '../common/CompanyForm'

export const components: Components = {
  CompanyForm: pipe(
    props({ mode: 'modify' }),
  )(clone(CompanyForm)),
}

export const state = {
  token: '',
  datos: {
    code: 0,
    state: '',
  },
  profile: {
    name: '',
    email: '',
  },
  pendingRemoval: false,
  _nest: components,
}

export type S = typeof state

export const inputs: Inputs = F => ({
  setActive: async ([token, profile]) => {
    await F.toAct('SetToken', token)
    await F.toAct('SetProfile', profile)
    await F.toChild('CompanyForm', 'setActive')
  },
  setCompany: async company => {
    await F.toChild('CompanyForm', 'setCompany', [company, true])
  },
  remove: async () => {
    await F.toAct('Set', ['pendingRemoval', true])
    await F.toChild('CompanyForm', 'getData')
  },
  saveCompany: async () => {
    await F.toAct('Set', ['pendingRemoval', false])
    await F.toChild('CompanyForm', 'getData')
  },
  $CompanyForm_data: async company => {
    let s: S = F.stateOf()
    company._id = company.id
    delete company.id
    if (s.pendingRemoval) {
      if (confirm('¿Estas seguro de que deseas eliminar ' + company.name + '?')) {}
      company._deleted = true
    }
    fetch(getServer() + '/api/company', {
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
          F.toIt('close')
          if (s.pendingRemoval) {
            alert('La empresa fue guardada exitosamente')
          } else {
            alert('La empresa fue eliminada exitosamente')
          }
        } else {
          alert('Hay un problema, estoy trabajando en darle pronta solución')
        }
      })
      .catch(() => alert('No hay conexión o hay un error, puedes escribirme si el problema persiste'))
  },
  $CompanyForm_validationError: async () => {
    alert('Debes completar el formulario')
  },
  close: async () => {
    await F.toChild('CompanyForm', 'reset')
  },
})

export const actions: Actions<S> = {
  SetToken: assoc('token'),
  SetProfile: assoc('profile'),
}

const view: View<S> = F => async s => {
  let style = F.ctx.groups.style

  return h('div', {
    class: { [style.base]: true },
    on: { click: 'ignore' },
  }, [
    h('div', {
      class: { [style.closeBtn]: true },
      on: {  click: F.in('close') },
    }, 'x'),
    h('div', {class: { [style.container]: true }}, [
      await F.vw('CompanyForm'),
      h('div', {class: { [style.buttonContainer]: true }}, [
        h('button', {
          class: { [style.cancelBtn]: true },
          on: {  click: F.in('remove') },
        }, 'Eliminar'),
        h('button', {
          class: { [style.saveCompanyBtn]: true },
          on: { click: F.in('saveCompany') },
        }, 'Guardar'),
      ]),
    ]),
  ])
}

export const interfaces: Interfaces = { view }

const style: StyleGroup = {
  base: {
    position: 'relative',
    height: '90%',
    borderRadius: '7px',
    backgroundColor: 'white',
    $nest: {
      [`@media screen and (max-width: ${BP.sm}px)`]: {
        height: '100%',
        borderRadius: '0',
      },
    },
  },
  container: {
    width: '100%',
    height: '100%',
    padding: '20px',
    display: 'flex',
    flexDirection: 'column',
    alignItems: 'center',
    overflowY: 'scroll',
    ...scrollBar,
  },
  emailForm: {
    flexShrink: 0,
    display: 'flex',
    flexDirection: 'column',
    alignItems: 'center',
    padding: '0 0 10px 0',
  },
  emailText: {
    maxWidth: '500px',
    padding: '0 20px 5px 20px',
    textAlign: 'center',
    fontSize: '18px',
  },
  initialInput: {
    marginTop: '10px',
  },
  finalInput: {
    marginBottom: '15px',
  },
  companyForm: {
    flexShrink: 0,
    display: 'flex',
    flexDirection: 'column',
    alignItems: 'center',
  },
  buttonContainer: {
    flexShrink: 0,
    display: 'flex',
    margin: '24px 15px 15px 15px',
  },
  cancelBtn: deepmerge(buttonCancelStyle, <CSS> {
    marginRight: '35px',
  }),
  saveCompanyBtn: buttonPrimaryStyle,
  closeBtn: {
    position: 'absolute',
    right: '-12px',
    top: '-12px',
    width: '24px',
    height: '24px',
    fontSize: '16px',
    borderRadius: '50%',
    background: 'white',
    boxShadow: '0 0 1px 1px ' + palette.borderLight,
    ...clickable,
    ...absoluteCenter,
  },
}

export const groups = { style }
