import {
  Actions,
  Inputs,
  Interfaces,
  StyleGroup,
  Components,
  props,
  clone,
  styles,
  pipe,
  assoc,
  _,
} from 'fractal-core'
import { View, h } from 'fractal-core/interfaces/view'
import { palette, simpleInput, BP } from '../constants'
import { strToLink, search } from '../../utils'

import * as TextInput from './TextInput'
import * as TextArea from './TextArea'

export const emptyCompany = {
  id: '',
  type: 'micro',
  user: '',
  userId: '',
  tags: [],
  places: [],
  isStartup: false,
  error: false,
}

let textFieldStyle: StyleGroup = {
  base: {
    width: '80%',
    $nest: {
      [`@media screen and (max-width: ${BP.sm}px)`]: {
        width: '95%',
      },
    },
  },
}

let FormTextInput = styles(textFieldStyle)(clone(TextInput))

export const components: Components = {
  name: props({ hint: 'Nombre de tu empresa*', attrs: { list: 'companiesData' } })(clone(FormTextInput)),
  email: props({ hint: 'Email de Contacto*' })(clone(FormTextInput)),
  description: pipe(
    styles(textFieldStyle),
    props({
      hint: '¿Qué hace tu empresa?* (155 max)',
      attrs: { maxlength: 155, rows: 5 },
    })
  )(clone(TextArea)),
  webpage: props({ hint: 'Página web' })(clone(FormTextInput)),
  facebook: props({ hint: 'Facebook' })(clone(FormTextInput)),
  twitter: props({ hint: 'Twitter' })(clone(FormTextInput)),
  linkedin: props({ hint: 'LinkedIn' })(clone(FormTextInput)),
  github: props({ hint: 'Github' })(clone(FormTextInput)),
  places: props({ hint: 'Sede' })(clone(FormTextInput)),
  tags: props({ hint: 'Categoría (5 máximo, separadas por comas)*' })(clone(FormTextInput)),
}

export const state = {
  mode: 'modify', // 'modify' | 'request' | 'review'
  originalName: '',
  company: emptyCompany,
  companies: [],
  companySizes: [
    ['micro', '1-10'],
    ['small', '11-50'],
    ['median', '51-200'],
    ['big', '201-...'],
  ],
  error: false,
  nameSearchTimer: -1,
  _nest: components,
}

export type S = typeof state

const nameSearchFn = (value: string, ms: number, cb) => setTimeout(() => {
  search(value, 'name', '', 10)
    .then(([companies]) => cb(companies))
}, ms)

export const inputs: Inputs = F => ({
  init: async () => {
    let s: S = F.stateOf()
    if (s.mode === 'review') {
      await F.toChild('name', '_action', ['SetAttrs', { disabled: true }])
    }
  },
  setActive: async () => {},
  setCompany: async ([company, setName]) => {
    await F.toAct('SetCompanyField', ['id', company._id])
    if (setName) {
      await F.toChild('name', 'change', company.name)
      await F.toAct('SetOriginalName', company.name)
    }
    await F.toChild('email', 'change', company.email || '')
    await F.toChild('description', 'change', company.description || '')
    await F.toChild('webpage', 'change', company.webpage || '')
    await F.toChild('facebook', 'change', company.networks.facebook || '')
    await F.toChild('twitter', 'change', company.networks.twitter || '')
    await F.toChild('linkedin', 'change', company.networks.linkedin || '')
    await F.toChild('github', 'change', company.networks.github || '')
    await F.toChild('places', 'change', company.places.join(', ') || '')
    await F.toChild('tags', 'change', company.tags.join(', ') || '')
    await F.toAct('SetCompanyField', ['isStartup', company.isStartup || false])
    await F.toAct('SetCompanyField', ['type', company.type || 'micro'])
  },
  reset: async () => {
    await F.toAct('SetCompanyField', ['id', ''])
    await F.toChild('name', 'change', '')
    await F.toChild('email', 'change', '')
    await F.toChild('description', 'change', '')
    await F.toChild('webpage', 'change', '')
    await F.toChild('facebook', 'change', '')
    await F.toChild('twitter', 'change', '')
    await F.toChild('linkedin', 'change', '')
    await F.toChild('github', 'change', '')
    await F.toChild('places', 'change', '')
    await F.toChild('tags', 'change', '')
    await F.toAct('SetCompany', emptyCompany)
    await F.toAct('SetError', false)
  },
  getData: async () => {
    let s: S = F.stateOf()
    let company: any = {}
    company.id = s.company.id
    company.name = F.stateOf('name').value
    company.email = F.stateOf('email').value
    company.description = F.stateOf('description').value
    company.webpage = F.stateOf('webpage').value
    company.networks = {}
    company.networks.facebook = F.stateOf('facebook').value
    company.networks.twitter = F.stateOf('twitter').value
    company.networks.linkedin = F.stateOf('linkedin').value
    company.networks.github = F.stateOf('github').value
    company.tags = F.stateOf('tags').value.split(',').map(t => t.trim())
    company.places = F.stateOf('places').value.split(',').map(p => p.trim())
    company.isStartup = s.company.isStartup
    company.type = <any> s.company.type
    if (
      company.name &&
      company.email &&
      company.description &&
      company.tags.join(', ') &&
      !s.error
    ) {
      await F.toAct('SetError', false)
      await F.toIt('data', company)
    } else {
      await F.toAct('SetError', true)
      await F.toIt('validationError')
    }
  },
  $name_change: async value => {
    let s: S = F.stateOf()
    if (s.mode === 'review') {
      return
    }
    if (s.nameSearchTimer !== -1) {
      clearTimeout(s.nameSearchTimer)
    }
    // <any> por un error con el compilador AOT, algo relacionado con Timer
    s.nameSearchTimer = <any> nameSearchFn(value, 400, async companies => {
      await F.toAct('SetCompanies', companies)
      let companiesEq = companies.filter(c => strToLink(c.name) === strToLink(value))
      if (companiesEq[0]) {
        if (s.mode === 'request') {
          await F.toIt('setCompany', [companies[0], false])
          await F.toAct('SetError', false)
        } else if (s.mode === 'modify' && strToLink(s.originalName) !== strToLink(value)) {
          await F.toChild('name', 'setError', true)
          await F.toAct('SetError', true)
        }
      } else {
        if (s.error) {
          await F.toAct('SetError', false)
        }
      }
    })
  },
  $email_change: async () => await F.toAct('SetError', false),
  $description_change: async () => await F.toAct('SetError', false),
  $tags_change: async () => await F.toAct('SetError', false),
  data: async () => {},
  validationError: async () => {},
})

export const actions: Actions<S> = {
  SetMode: assoc('mode'),
  SetCompany: assoc('company'),
  SetError: assoc('error'),
  SetCompanies: assoc('companies'),
  SetOriginalName: assoc('originalName'),
  SetIsStartup: selectedIndex => s => {
    s.company.isStartup = selectedIndex === 1
    return s
  },
  SetCompanyType: selectedIndex => s => {
    s.company.type = <any> s.companySizes[selectedIndex][0]
    return s
  },
  SetCompanyField: ([name, value]) => s => {
    s.company[name] = value
    return s
  },
}

const view: View<S> = F => async s => {
  let style = F.ctx.groups.style

  return h('div', {
    key: F.ctx.name,
    class: { [style.base]: true },
  }, [
    await F.vw('name'),
    ...s.mode === 'request' ? [h('datalist', { attrs: { id: 'companiesData' } },
      s.companies.filter(c => !c.userId).map(
        c => h('option', c.name),
      )
    )] : [],
    await F.vw('email'),
    await F.vw('description'),
    await F.vw('webpage'),
    await F.vw('facebook'),
    await F.vw('twitter'),
    await F.vw('linkedin'),
    await F.vw('github'),
    await F.vw('places'),
    await F.vw('tags'),
    h('div', {class: { [style.description]: true }},
      '¿Tu empresa está en búsqueda de un modelo de negocio repetible y escalable (Startup)?*'
    ),
    h('select', {
      class: { [style.select]: true },
      on: { change: F.act('SetIsStartup', _, ['target', 'selectedIndex']) },
    }, [
      h('option', { props: { selected: !s.company.isStartup } }, 'No'),
      h('option', { props: { selected: s.company.isStartup } }, 'Si'),
    ]),
    h('div', {class: { [style.description]: true }},
      '¿Cuantas personas hay en tu empresa?*'
    ),
    h('select', {
      class: { [style.select]: true },
      on: { change: F.act('SetCompanyType', _, ['target', 'selectedIndex']) },
    }, s.companySizes.map(
      sz => h('option', {
        props: { selected: s.company.type === sz[0] || s.company.type === undefined },
      }, sz[1])
    )),
  ])
}

export const interfaces: Interfaces = { view }

const style: StyleGroup = {
  base: {
    maxWidth: '500px',
    flexShrink: 0,
    display: 'flex',
    flexDirection: 'column',
    alignItems: 'center',
  },
  input: simpleInput,
  finalInput: {
    marginBottom: '15px',
  },
  description: {
    maxWidth: '500px',
    padding: '17px 10px 17px 10px',
    textAlign: 'center',
    fontSize: '18px',
  },
  select: {
    marginBottom: '10px',
    fontSize: '18px',
    border: 'none',
    outline: 'none',
    background: 'none',
    borderBottom: '1px solid ' + palette.borderLight,
  },
}

export const groups = { style }
