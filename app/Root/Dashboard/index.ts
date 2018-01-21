import {
  Actions,
  Inputs,
  Interfaces,
  StyleGroup,
  assoc,
  Components,
  deepmerge,
  CSS,
  clickable,
  clone,
  mapAsync,
} from 'fractal-core'
import { View, h } from 'fractal-core/interfaces/view'
import { getServer } from '../../config'
import { palette, buttonPrimaryStyle, BP } from '../constants'
import { Company as CompanyType } from '../../../schema'

import * as NewCompany from './NewCompany'
import * as ModifyCompany from './ModifyCompany'
import * as Company from '../common/Company'

const alertNoPanic = () => alert('Algo esta mal, estoy trabajando para solucionarlo')

export const components: Components = {
  NewCompany,
  ModifyCompany,
}

export const state = {
  fetched: false,
  token: '',
  profile: {
    name: '',
    email: '',
  },
  companies: [],
  activeModal: '', // '' | 'NewCompany' | 'ModifyCompany'
  _nest: components,
  _compUpdated: false,
}

export type S = typeof state

export const inputs: Inputs = F => ({
  setActive: async () => {
    let s: S = F.stateOf()
    if (s.token) {
      await F.toIt('fetchCompanies')
    }
  },
  login: async () => {},
  logout: async () => await F.toAct('SetToken', ''),
  setTokenAndProfile: async ([token, profile]) => {
    await F.toAct('SetToken', token)
    await F.toAct('SetProfile', profile)
    await F.toIt('fetchCompanies')
  },
  fetchCompanies: async () => {
    try {
      let res = await fetch(getServer() + '/api/companies', {
        headers: <any> {
          Authorization: 'Bearer ' + F.stateOf().token,
        },
      }).then(r => r.json())
      await F.toAct('Fetched')
      if (res.code < 0) {
        return alertNoPanic()
      }
      await F.toIt('setCompanies', res)
    } catch (err) {
      alertNoPanic()
    }
  },
  activeNewCompany: async () => {
    let s: S = F.stateOf()
    await F.toChild('NewCompany', 'setActive', [s.token, s.profile])
    await F.toAct('SetActiveModal', 'NewCompany')
  },
  $NewCompany_close: async () => F.toAct('SetActiveModal', ''),
  $NewCompany_companyAdded: async company => {
    if (company._userEmail) {
      await F.toAct('SetEmail', company._userEmail)
    }
  },
  $ModifyCompany_close: async () => {
    await F.toAct('SetActiveModal', '')
    await F.toIt('fetchCompanies')
  },
  setCompanies: async companies => {
    await F.toAct('SetCompanies', companies)
    for (let i = 0, comp: CompanyType; comp = companies[i]; i++) {
      await F.toChild(comp._id, 'setState', comp)
    }
  },
  activeModifyCompany: async company => {
    let s: S = F.stateOf()
    await F.toChild('ModifyCompany', 'setActive', [s.token, s.profile])
    await F.toChild('ModifyCompany', 'setCompany', company)
    await F.toAct('SetActiveModal', 'ModifyCompany')
  },
})

export const actions: Actions<S> = {
  Fetched: () => assoc('fetched')(true),
  SetToken: assoc('token'),
  SetProfile: assoc('profile'),
  SetEmail: email => s => {
    s.profile.email = email
    return s
  },
  SetCompanies: companies => s => {
    for (let i = 0, company; company = companies[i]; i++) {
      s._nest[company._id] = clone(Company)
    }
    s.companies = companies
    s._compUpdated = true
    return s
  },
  SetActiveModal: assoc('activeModal'),
}

const view: View<S> = F => async s => {
  let style = F.ctx.groups.style

  return s.token !== ''
  ? h('article', {class: { [style.base]: true }}, [
    ...s.activeModal !== '' ? [h('div', {
      class: {
        [style.modal]: true,
      },
      on: { click: F.act('SetActiveModal', '') },
    }, [
      await F.vw(s.activeModal),
    ])] : [],
    h('h1', {class: { [style.title]: true }}, `¡Hola ${s.profile.name}!`),
    !s.fetched
    ? h('div', {class: { [style.description]: true }}, '. . .')
    : h('div', {class: { [style.container]: true }}, [
      h('button', {
        class: { [style.addCompanyBtn]: true },
        on: { click: F.in('activeNewCompany') },
      }, 'Agregar Empresa'),
      h('div', {class: { [style.companies]: true }}, [
        h('div', {class: { [style.companiesTitle]: true }}, 'Empresas'),
        ...await mapAsync(s.companies, async company =>
          h('div', {class: { [style.companyContainer]: true }}, [
            await F.vw(company._id),
            h('svg', {
              class: { [style.modifyCompanyBtn]: true },
              attrs: { viewBox: '0 0 268.765 268.765' },
              on: { click: F.in('activeModifyCompany', company) },
            }, [
              h('path', {
                attrs: {
                  d: 'M267.92,119.461c-0.425-3.778-4.83-6.617-8.639-6.617 c-12.315,0-23.243-7.231-27.826-18.414c-4.682-11.454-1.663-24.812,7.515-33.231c2.889-2.641,3.24-7.062,0.817-10.133 c-6.303-8.004-13.467-15.234-21.289-21.5c-3.063-2.458-7.557-2.116-10.213,0.825c-8.01,8.871-22.398,12.168-33.516,7.529 c-11.57-4.867-18.866-16.591-18.152-29.176c0.235-3.953-2.654-7.39-6.595-7.849c-10.038-1.161-20.164-1.197-30.232-0.08 c-3.896,0.43-6.785,3.786-6.654,7.689c0.438,12.461-6.946,23.98-18.401,28.672c-10.985,4.487-25.272,1.218-33.266-7.574    c-2.642-2.896-7.063-3.252-10.141-0.853c-8.054,6.319-15.379,13.555-21.74,21.493c-2.481,3.086-2.116,7.559,0.802,10.214    c9.353,8.47,12.373,21.944,7.514,33.53c-4.639,11.046-16.109,18.165-29.24,18.165c-4.261-0.137-7.296,2.723-7.762,6.597    c-1.182,10.096-1.196,20.383-0.058,30.561c0.422,3.794,4.961,6.608,8.812,6.608c11.702-0.299,22.937,6.946,27.65,18.415    c4.698,11.454,1.678,24.804-7.514,33.23c-2.875,2.641-3.24,7.055-0.817,10.126c6.244,7.953,13.409,15.19,21.259,21.508    c3.079,2.481,7.559,2.131,10.228-0.81c8.04-8.893,22.427-12.184,33.501-7.536c11.599,4.852,18.895,16.575,18.181,29.167    c-0.233,3.955,2.67,7.398,6.595,7.85c5.135,0.599,10.301,0.898,15.481,0.898c4.917,0,9.835-0.27,14.752-0.817    c3.897-0.43,6.784-3.786,6.653-7.696c-0.451-12.454,6.946-23.973,18.386-28.657c11.059-4.517,25.286-1.211,33.281,7.572    c2.657,2.89,7.047,3.239,10.142,0.848c8.039-6.304,15.349-13.534,21.74-21.494c2.48-3.079,2.13-7.559-0.803-10.213    c-9.353-8.47-12.388-21.946-7.529-33.524c4.568-10.899,15.612-18.217,27.491-18.217l1.662,0.043    c3.853,0.313,7.398-2.655,7.865-6.588C269.044,139.917,269.058,129.639,267.92,119.461z M134.595,179.491    c-24.718,0-44.824-20.106-44.824-44.824c0-24.717,20.106-44.824,44.824-44.824c24.717,0,44.823,20.107,44.823,44.824    C179.418,159.385,159.312,179.491,134.595,179.491z',
                },
              }),
            ]),
          ])
        ),
      ]),
    ]),
  ])
  : h('article', {class: { [style.base]: true }}, [
    h('div', {class: { [style.title]: true }}, 'Bienvenido!'),
    h('button', {
      class: { [style.login]: true },
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
  modal: {
    position: 'fixed',
    zIndex: 99,
    top: '0',
    left: '0',
    width: '100%',
    height: '100%',
    display: 'flex',
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: 'rgba(0, 0, 0, 0.5)',
  },
  title: {
    margin: '30px 0 25px 0',
    textAlign: 'center',
    fontSize: '28px',
    fontWeight: 'normal',
    color: palette.secondary,
  },
  container: {
    width: '100%',
    display: 'flex',
    flexDirection: 'column',
    alignItems: 'center',
  },
  description: {
    textAlign: 'center',
    fontSize: '18px',
  },
  login: deepmerge(buttonPrimaryStyle, <CSS> { width: '130px' }),
  addCompanyBtn: buttonPrimaryStyle,
  companies: {
    marginTop: '30px',
    width: '90%',
    display: 'flex',
    flexDirection: 'column',
    alignItems: 'center',
    $nest: {
      [`@media screen and (max-width: ${BP.sm}px)`]: {
        width: '100%',
      },
    },
  },
  companiesTitle: {
    width: '500px',
    padding: '0 20px 15px 20px',
    textAlign: 'center',
    fontSize: '24px',
    color: palette.secondary,
    borderBottom: '1px solid ' + palette.borderLight,
    $nest: {
      [`@media screen and (max-width: ${BP.sm}px)`]: {
        width: '90%',
      },
    },
  },
  companyContainer: {
    position: 'relative',
    width: '500px',
    $nest: {
      [`@media screen and (max-width: ${BP.sm}px)`]: {
        width: '90%',
      },
    },
  },
  modifyCompanyBtn: {
    position: 'absolute',
    bottom: '4px',
    left: '2px',
    width: '35px',
    height: '35px',
    padding: '3px',
    fill: palette.primary,
    border: '1px solid rgba(0, 0, 0, 0)',
    borderRadius: '4px',
    ...clickable,
    $nest: {
      '&:hover': {
        fill: palette.primaryLight,
        border: '1px solid ' + palette.borderLight,
      },
    },
  },
}

export const groups = { style }
