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
  styles,
  clickable,
  absoluteCenter,
} from 'fractal-core'
import { View, h } from 'fractal-core/interfaces/view'
import { getServer } from '../../config'
import { buttonPrimaryStyle, buttonCancelStyle, scrollBar, BP, palette } from '../constants'

import * as CompanyForm from '../common/CompanyForm'
import * as TextInput from '../common/TextInput'

export const components: Components = {
  CompanyForm: pipe(
    props({ mode: 'request' }),
    styles({ base: { marginTop: '5px' } }),
  )(clone(CompanyForm)),
  email: pipe(
    styles({ base: { width: '80%' } }),
    props({ hint: 'Tu email aquí' })
  )(clone(TextInput)),
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
  _nest: components,
}

export type S = typeof state

export const inputs: Inputs = F => ({
  setActive: async ([token, profile]) => {
    await F.toAct('SetToken', token)
    await F.toAct('SetProfile', profile)
    await F.toChild('CompanyForm', 'setActive')
  },
  cancel: async () => {
    await F.toChild('CompanyForm', 'reset')
    await F.toChild('email', 'change', '')
    await F.toIt('close')
  },
  addCompany: async () => {
    await F.toChild('CompanyForm', 'getData')
  },
  $CompanyForm_data: async company => {
    let s: S = F.stateOf()
    if (!s.profile.email) {
      ;(company as any)._userEmail = F.stateOf('email').value
      if (!company._userEmail) {
        await F.toChild('email', 'setError', true)
        alert('Déjame tu email de contacto personal, te avisaré cuando tu empresa sea añadida y cuando implemente nuevas características en la plataforma')
        return
      }
    }
    try {
      let res = await fetch(getServer() + '/api/companyRequest', {
        method: 'POST',
        headers: <any> {
          Authorization: 'Bearer ' + s.token,
          Accept: 'application/json, text/plain, */*',
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(company),
      }).then(r => r.json())
      if (res.code === 0) {
        await F.toChild('CompanyForm', 'reset')
        await F.toChild('email', 'setError', false)
        await F.toChild('email', 'change', '')
        await F.toIt('close')
        await F.toIt('companyAdded', company)
        alert('Tu solicitud fue enviada... la revisaré y te contactaré prontamente')
      } else {
        alert('Hay un problema, estoy trabajando en darle pronta solución')
      }
    } catch (err) {
      alert('No hay conexión o hay un error, puedes escribirme si el problema persiste')
    }
  },
  $CompanyForm_validationError: async () => {
    alert('Debes completar el formulario')
  },
  companyAdded: async () => {},
  close: async () => {},
})

export const actions: Actions<S> = {
  SetToken: assoc('token'),
  SetProfile: assoc('profile'),
}

const view: View<S> = F => async s => {
  let style = F.ctx.groups.style

  return h('div', {
    key: F.ctx.name,
    class: { [style.base]: true },
    on: { click: 'ignore' },
  }, [
    h('div', {
      class: { [style.closeBtn]: true },
      on: {  click: F.in('close') },
    }, 'x'),
    h('div', {class: { [style.container]: true }}, [
      ...!s.profile.email ? [
        h('div', {class: { [style.emailForm]: true }}, [
          h('div', {class: { [style.emailText]: true }},
            'Escribe tu email, te avisaré cuando tu empresa sea añadida y cuando implemente nuevas características en la plataforma*'
          ),
          await F.vw('email'),
        ]),
      ] : [],
      h('div', {class: { [style.emailText]: true }},
        'Datos de la empresa'
      ),
      await F.vw('CompanyForm'),
      h('div', {class: { [style.buttonContainer]: true }}, [
        h('button', {
          class: { [style.cancelBtn]: true },
          on: {  click: F.in('cancel') },
        }, 'Cancelar'),
        h('button', {
          class: { [style.addCompanyBtn]: true },
          on: { click: F.in('addCompany') },
        }, 'Agregar'),
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
  addCompanyBtn: buttonPrimaryStyle,
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
