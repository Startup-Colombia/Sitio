import {
  Actions,
  Inputs,
  Interfaces,
  StyleGroup,
  assoc,
  clone,
  clickable,
  Components,
  mapAsync,
  _,
} from 'fractal-core'
import { View, h } from 'fractal-core/interfaces/view'
import { textStyle, BP, palette } from './constants'
import { refreshHashScroll, changeSearchString, search } from '../utils'
import { cloudantURL } from '../config'

const structuredData = h('script', { attrs: { type: 'application/ld+json' } }, `
{
  "@graph": [
    {
      "@context": "http://schema.org",
      "@type": "WebSite",
      "name": "Startup Colombia",
      "url": "https://startupcol.com/",
      "potentialAction": {
        "@type": "SearchAction",
        "target": "https://startupcol.com/?q={search_term_string}",
        "query-input": "required name=search_term_string"
      }
    },
    {
      "@context": "http://schema.org",
      "@type": "Organization",
      "url": "https://startupcol.com/",
      "logo": "https://startupcol.com/assets/favicon.png"
    }
  ]
}
`)

export const meta = {
  title: 'Startup Colombia - Comunidad de empresas de base tecnológica',
  description: 'Founders intercambiando experiencias y aprendizajes. Comuniad de empresas de base tecnologica.',
  keywords: 'empresas colombianas,startup colombia,comunidad de empresas colombianas,startups colombianas,comunidad de startups',
}

import * as Company from './common/Company'

export const components: Components = {
  Company1: clone(Company),
  Company2: clone(Company),
  Company3: clone(Company),
}

export const state = {
  online: true,
  searchState: 'wait',
  searchTimeout: -1,
  companiesPerPage: 20,
  page: 0,
  pages: [''],
  maxPages: 1,
  searchText: '',
  searchFilter: 'all',
  filteredCompanies: [],
  initialized: false,
  companiesCount: 0,
  randomFetched: false,
  _nest: components,
  _compUpdated: false,
}

export type S = typeof state

let filterOptions = [
  ['all', 'General'],
  ['tags', 'Por categorías'],
  ['name', 'Por nombre'],
  ['places', 'Por lugares'],
  ['user', 'Por usuario'],
]

export const setSearchString = (text: string, filterName: string) => {
  changeSearchString(`q=${encodeURIComponent(text)}&filter=${encodeURIComponent(filterName)}`)
}

export const inputs: Inputs = F => ({
  initEmpresas: async ([empresas, maxCompanies, bookmark]) => {
    let empresasVisible = clone(empresas)
    await F.toIt('setFilteredCompanies', [clone(empresasVisible), maxCompanies, bookmark])
  },
  setFilteredCompanies: async ([empresas, maxCompanies, bookmark]) => {
    await F.toAct('SetBookmark', bookmark)
    await F.toAct('SetFilteredCompanies', [clone(empresas), maxCompanies])
    var i = 0, empresaNext
    async function addCompany (empresa) {
      await F.toAct('AddCompany', empresa._id)
      await F.toChild(empresa._id, 'setState', empresa)
      i++
      empresaNext = empresas[i]
      if (empresaNext) {
        await addCompany(empresaNext)
      }
    }
    if (empresas[0]) {
      await addCompany(empresas[0])
    }
  },
  setPage: async (num: number) => {
    let s: S = F.stateOf()
    await F.toAct('SetPage', num)
    search(s.searchText, s.searchFilter, s.pages[s.page], s.companiesPerPage)
      .then(async ([empresas, maxCompanies, bookmark]) => {
        await F.toIt('initEmpresas', [empresas, maxCompanies, bookmark])
        await F.toIt('scrollTop')
      })
    .catch(err => {})
  },
  setActive: async () => {
    if (typeof window !== 'undefined') {
      let search = window.location.search.substr(1)
      if (search !== '') {
        let parts = search.split('&')
        let searchObj = { q: '', filter: 'all' }
        for (let i = 0, part; part = parts[i]; i++) {
          let subParts = part.split('=')
          searchObj[subParts[0]] = subParts[1]
        }
        if (searchObj.q === '') {
          await F.toIt('randomCompanies')
        }
        let text = decodeURIComponent(searchObj.q)
        let filterName = decodeURIComponent(searchObj.filter)
        await F.toAct('SetSearchFilter', filterName)
        await F.toAct('SetSearchFilter', filterName)
        await F.toAct('SetSearchText', text)
        await F.toIt('search', text)
      } else {
        if (F.stateOf().filteredCompanies.length > 0) {
          await F.toAct('SetSearchText', '')
          await F.toIt('setFilteredCompanies', [])
        }
        await F.toIt('randomCompanies')
      }
    }
  },
  scrollTop: async () => {
    document.querySelector('#app div').scrollTop = 0
  },
  searchInputKeyup: async (text) => {
    text = text.trim()
    if (text === '' ) {
      await F.toAct('SetSearchText', '')
      setSearchString('', 'all')
      await F.toIt('initEmpresas', [[], 0, ''])
      await F.toIt('randomCompanies')
      return
    }
    F.toAct('SetRandomFetched', false)
    let s: S = F.stateOf()
    if (s.searchState === 'wait') {
      await F.toAct('SetSearchState', 'ignore')
      await F.toAct('SetSearchText', text)
      s.searchTimeout = <any> setTimeout(async () => {
        await F.toAct('SetSearchState', 'ready')
        await F.toIt('searchInputKeyup', s.searchText)
      }, 400)
    } else if (s.searchState === 'ready') {
      await F.toIt('search', text)
      await F.toAct('SetSearchState', 'wait')
      s.searchTimeout = -1
    } else {
      clearTimeout(s.searchTimeout)
      await F.toAct('SetSearchText', text)
      s.searchTimeout = <any> setTimeout(async () => {
        await F.toAct('SetSearchState', 'ready')
        await F.toIt('searchInputKeyup', s.searchText)
      }, 400)
    }
  },
  searchFilterChange: async idx => {
    await F.toAct('SetSearchFilter', filterOptions[idx][0])
    await F.toIt('search', F.stateOf().searchText)
  },
  search: async text => {
    let s: S = F.stateOf()
    search(text, s.searchFilter, '', s.companiesPerPage)
      .then(async ([companies, maxCompanies, bookmark]) => {
        await F.toAct('SetOnline', true)
        await F.toIt('initEmpresas', [companies, maxCompanies, bookmark])
        setSearchString(text, s.searchFilter)
        if (s.initialized) {
          window.location.hash = ''
        } else {
          refreshHashScroll()
          await F.toAct('SetInitialized', true)
        }
      })
      .catch(() => F.toAct('SetOnline', false))
  },
  randomCompanies: async () => {
    await F.toAct('SetOnline', true)
    fetch(cloudantURL + '/companies')
      .then(r => r.json())
      .then(res => {
        F.toAct('SetCompaniesCount', Math.floor(res.doc_count / 10) * 10)
        fetch(cloudantURL + '/companies/_all_docs')
          .then(r => r.json())
          .then(({ rows }) => {
            let last
            for (let i = 0; i < 3; i++) {
              let idx = Math.ceil(Math.random() * res.doc_count)
              while (idx === last) {
                idx = Math.ceil(Math.random() * res.doc_count)
              }
              fetch(cloudantURL + '/companies/' + rows[idx].id)
                .then(r => r.json())
                .then(async doc => {
                  await F.toChild('Company' + (i + 1), 'setState', doc)
                  if (i === 2) {
                    await F.toAct('SetRandomFetched', true)
                  }
                })
              last = idx
            }
          }).catch(() => F.toAct('SetOnline', false))
      }).catch(() => F.toAct('SetOnline', false))
  },
  $_setFilter: async ([comp, [filterName, text]]) => {
    await F.toIt('scrollTop')
    await F.toAct('SetSearchFilter', filterName)
    await F.toAct('SetSearchText', text)
    setSearchString(text, filterName)
    await F.toIt('search', text)
  },
  login: async () => {},
})

export const actions: Actions<S> = {
  SetOnline: assoc('online'),
  SetPage: assoc('page'),
  AddCompany: id => s => {
    s._nest[id] = Company
    s._compUpdated = true
    return s
  },
  SetBookmark: bookmark => s => {
    if (!s.pages[s.page + 1]) {
      s.pages[s.page + 1] = bookmark
    }
    return s
  },
  NextPage: () => s => {
    if (s.page < s.maxPages) {
      s.page++
    }
    return s
  },
  SetSearchText: text => s => {
    s.searchText = text
    s.pages = ['']
    return s
  },
  SetSearchState: assoc('searchState'),
  SetSearchFilter: text => s => {
    s.searchFilter = text
    s.pages = ['']
    return s
  },
  SetFilteredCompanies: ([filteredCompanies, maxCompanies]) => s => {
    s.filteredCompanies = filteredCompanies
    s.maxPages = Math.ceil(maxCompanies / s.companiesPerPage)
    return s
  },
  SetInitialized: assoc('initialized'),
  SetCompaniesCount: assoc('companiesCount'),
  SetRandomFetched: assoc('randomFetched'),
}

const view: View<S> = F => async s => {
  let style = F.ctx.groups.style

  return h('article', {
    key: F.ctx.id,
    class: { [style.base]: true },
  }, [
    h('header', { class: { [style.header]: true } }, [
      // h('h2', {
      //   class: { [style.titulo]: true },
      //   attrs: { itemprop: 'applicationCategory' },
      // }, 'Lista de Empresas'),
      h('p', {class: { [style.descripcion]: true }}, [
        <any> 'Comunidad de empresas de base tecnológica',
      ]),
      h('button', {
        class: { [style.authBtn]: true },
        on: { click: F.in('login') },
      }, '¡Únete!'),
    ]),
    h('input', {
      class: { [style.searchInput]: true },
      attrs: { type: 'text', placeholder: 'Lista de empresas...' },
      props: { value: s.searchText },
      on: {
        keyup: F.in('searchInputKeyup', _, ['target', 'value']),
      },
    }),
    h('div', {class: { [style.empresas]: true }}, [
      ...!s.online
        ? [ h('div', {class: { [style.empresasVacio]: true }}, 'No hay conexión') ]
        : s.filteredCompanies.length === 0 && s.searchText !== ''
        ? [ h('div', {class: { [style.empresasVacio]: true }}, '. . .') ]
        : s.searchText === ''
        ? []
        : await mapAsync(
          s.filteredCompanies,
          async (empresa, idx) => await F.vw(empresa._id)
        ),
    ]),
    ...s.searchText !== '' ? [h('div', {class: { [style.pages]: true }}, [
      ...s.pages.filter((page, idx) => idx < s.maxPages).map(
        (bookmark, idx) => h('div', {
          class: {
            [style.pageNumber]: true,
            [style.pageNumberActive]: idx === s.page,
          },
          on: { click: F.in('setPage', idx) },
        }, idx + 1 + '')
      ),
      h('div', {
        class: { [style.nextMessage]: true },
      }, `... ${s.maxPages} páginas`),
    ])]: [],
    structuredData,
    ...s.randomFetched && s.filteredCompanies.length === 0 ? [
      h('div', {class: { [style.randomContainer]: true }}, [
        h('div', {class: { [style.randomDescription]: true }}, `Aquí una muestra de 3 ¡Somos más de ${s.companiesCount} empresas!`),
        await F.vw('Company1'),
        await F.vw('Company2'),
        await F.vw('Company3'),
        h('div', {class: { [style.moreRandomContainer]: true }}, [
          h('button', {
            class: { [style.moreRandomBtn]: true },
            on: { click: F.in('randomCompanies') },
          }, 'Quiero más!'),
        ]),
      ]),
    ] : [],
  ])
}

export const interfaces: Interfaces = { view }

const style: StyleGroup = {
  base: {
    flexShrink: 0,
    minHeight: 'calc(100% - 249px)',
    paddingBottom: '50px',
    display: 'flex',
    flexDirection: 'column',
    alignItems: 'center',
  },
  header: {
    display: 'flex',
    flexDirection: 'column',
    alignItems: 'center',
  },
  titulo: {
    margin: '30px 0 10px 0',
    fontSize: '28px',
    color: palette.secondary,
  },
  descripcion: {
    maxWidth: '800px',
    textAlign: 'center',
    lineHeight: '1.5em',
    fontSize: '24px',
    margin: '25px 10px 25px 10px',
    color: palette.textPrimary,
    $nest: {
      [`@media screen and (max-width: ${BP.sm}px)`]: {
        marginBottom: '20px',
      },
    },
  },
  authBtn: {
    marginBottom: '20px',
    padding: '10px 24px',
    background: 'none',
    border: 'none',
    fontSize: '30px',
    color: 'white',
    borderRadius: '7px',
    backgroundColor: palette.secondary,
    ...clickable,
    $nest: {
      '&:hover': {
        backgroundColor: palette.secondaryLight,
      },
    },
  },
  searchInput: {
    width: '95%',
    maxWidth: '500px',
    paddingBottom: '10px',
    border: 'none',
    fontSize: '28px',
    textAlign: 'center',
    color: palette.textPrimary,
    borderBottom: '1px solid ' + palette.borderLight,
    outline: 'none',
    ...textStyle,
    $nest: {
      [`@media screen and (max-width: ${BP.sm}px)`]: {
        minWidth: '310px',
        margin: '0 10px 20px 10px',
        textAlign: 'center',
        padding: '0 10px',
      },
    },
  },
  empresas: {
    width: '100%',
    maxWidth: '484px',
  },
  empresasVacio: {
    textAlign: 'center',
    fontSize: '30px',
  },
  pages: {
    marginTop: '20px',
    padding: '10px',
    display: 'flex',
    alignItems: 'center',
    flexWrap: 'wrap',
    justifyContent: 'center',
  },
  pageNumber: {
    margin: '2px',
    padding: '5px 7px',
    borderRadius: '4px',
    textDecoration: 'underline',
    ...clickable,
    $nest: {
      '&:hover': {
        backgroundColor: palette.shadowLight,
      },
      [`@media screen and (max-width: ${BP.sm}px)`]: {
        padding: '8px 12px',
        fontSize: '20px',
        textDecoration: 'none',
      },
    },
  },
  pageNumberActive: {
    backgroundColor: palette.shadowLight,
  },
  nextMessage: {
    margin: '2px',
    padding: '5px 7px',
  },
  randomContainer: {
    marginTop: '30px',
  },
  randomDescription: {
    textAlign: 'center',
    padding: '5px 10px',
  },
  moreRandomContainer: {
    padding: '25px',
    display: 'flex',
    justifyContent: 'center',
    alignItems: 'center',
  },
  moreRandomBtn: {
    padding: '8px',
    ...textStyle,
    fontSize: '20px',
    border: '1px solid ' + palette.borderLight,
    borderRadius: '4px',
    backgroundColor: 'white',
    color: palette.textSecondary,
    outline: 'none',
    ...clickable,
    $nest: {
      '&:hover': {
        backgroundColor: palette.shadowLight,
      },
    },
  },
}

export const groups = { style }
