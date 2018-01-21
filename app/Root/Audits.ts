import {
  Actions,
  Inputs,
  Interfaces,
  StyleGroup,
  assoc,
} from 'fractal-core'
import { View, h } from 'fractal-core/interfaces/view'
import { BP, palette, textStyle } from './constants'
import { Company } from '../../schema/index'

export const meta = {
  title: 'Startup Colombia - Rank de páginas web',
}

export const name = 'Audits'

export const state = {
  companies: [],
}

export type S = typeof state

export const inputs: Inputs = F => ({
  setCompanies: async companies => {
    companies = companies
      .filter(c => c.webAudits && c.webpage)
      .sort((a, b) => {
        let pa = a.webAudits.reduce((acum, audit) => acum + audit.score, 0)
        let pb = b.webAudits.reduce((acum, audit) => acum + audit.score, 0)
        if (pa === pb) {
          return 0
        } else if (pa < pb) {
          return 1
        } else {
          return -1
        }
      })
    await F.toAct('SetCompanies', companies)
  },
})

export const actions: Actions<S> = {
  SetCompanies: assoc('companies'),
}

const view: View<S> = F => async s => {
  let style = F.ctx.groups.style

  return h('article', {
    key: F.ctx.name,
    class: { [style.base]: true },
  }, [
    h('a', {
      class: { [style.toMainPage]: true, [style.linkNormal]: true },
      attrs: { href: '/', target: '_blank', rel: 'nofollow noopener noreferrer' },
    }, 'startupcol.com'),
    h('header', { class: { [style.header]: true } }, [
      h('h2', {
        class: { [style.titulo]: true },
      }, 'Rank de páginas Web'),
      h('p', {class: { [style.description]: true }}, [
        <any> `Rank de las páginas web de las empresas que interactúan en el grupo, se evaluaron ${s.companies.length}. La herramienta usada fue Lighthouse, la cual ahora viene integrada en Chrome! así que pueden evaluar directamente sus páginas y mejorarlas`,
      ]),
    ]),
    h('div', {class: { [style.companies]: true }},
      s.companies.map(
        (company: Company) => h('div', {class: { [style.company]: true }}, [
          h('a', {
            class: { [style.link]: true },
            attrs: {
              href: company.webpage,
              rel: 'nofollow noopener noreferrer',
              target: '_blank',
            },
          }, company.name),
          h('div', {class: { [style.audits]: true }},
            company.webAudits.map(a => auditView(style, a))
          ),
        ])
      )
    ),
  ])
}

const auditNames = {
  pwa: 'Aplicación progresiva',
  performance: 'Velocidad',
  accessibility: 'Accesibilidad',
  'best-practices': 'Buenas prácticas',
}

const auditView = (style, audit) =>
  h('div', {class: { [style.audit]: true }}, [
    h('div', {class: { [style.auditName]: true }}, auditNames[audit.id]),
    h('div', {
      class: { [style.auditBar]: true },
      style: {
        width: audit.score > 4 ? audit.score + '%' : '4%',
        backgroundColor: `hsl(${audit.score * 120 / 100}, 86%, 52%)`,
      },
    }, Math.round(audit.score) + ''),
  ])

export const interfaces: Interfaces = { view }

const style: StyleGroup = {
  base: {
    position: 'relative',
    flexShrink: 0,
    minHeight: 'calc(100% - 249px)',
    paddingBottom: '50px',
    display: 'flex',
    flexDirection: 'column',
    alignItems: 'center',
    ...textStyle,
  },
  linkNormal: {
    padding: '5px',
    fontSize: '14px',
    color: palette.textTertiary,
    textDecoration: 'none',
    $nest: {
      '&:hover': {
        textDecoration: 'underline',
      },
    },
  },
  toMainPage: {
    position: 'absolute',
    top: '0px',
    right: '0px',
    $nest: {
      [`@media screen and (max-width: ${BP.sm}px)`]: {
        top: 'auto',
        bottom: '0px',
      },
    },
  },
  header: {
    display: 'flex',
    flexDirection: 'column',
    alignItems: 'center',
  },
  titulo: {
    margin: '30px 0 10px 0',
    fontSize: '28px',
    color: palette.primary,
  },
  description: {
    maxWidth: '800px',
    textAlign: 'center',
    lineHeight: '1.5em',
    fontSize: '20px',
    margin: '15px 10px 25px 10px',
    color: palette.textPrimary,
    $nest: {
      [`@media screen and (max-width: ${BP.sm}px)`]: {
        marginBottom: '20px',
      },
    },
  },
  companies: {
    width: '320px',
  },
  company: {
    margin: '10px',
    display: 'flex',
    flexDirection: 'column',
    alignItems: 'center',
  },
  link: {
    margin: '2px 4px 3px 4px',
    fontSize: '20px',
    color: palette.primary,
    textDecoration: 'none',
    textAlign: 'center',
    $nest: {
      '&:hover': {
        textDecoration: 'underline',
      },
    },
  },
  audits: {
    width: '100%',
  },
  auditName: {},
  auditBar: {
    height: '14px',
    borderRadius: '5px',
    fontSize: '10px',
    textAlign: 'center',
    color: palette.textPrimary,
    boxShadow: '0px 1px 1px 0px ' + palette.shadowGrey,
  },
}

export const groups = { style }
