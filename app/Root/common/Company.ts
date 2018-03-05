import {
  Actions,
  Inputs,
  Interfaces,
  StyleGroup,
  deepmerge,
  clickable,
  clone,
  _,
} from 'fractal-core'
import { View, h } from 'fractal-core/interfaces/view'
import { palette, BP } from '../constants'
import { strToLink } from '../../utils'

export const state = {
  _id: '',
  name: '',
  description: '',
  webpage: '',
  webpageName: '',
  networks: {
    facebook: '',
  },
  userFb: '',
  user: '',
  userId: '',
  tags: [],
  places: [],
}

export type S = typeof state

export const inputs: Inputs = F => ({
  setState: async s => {
    await F.toAct('SetState', s)
  },
  setFilter: async ([filterName, text]) => {},
  toSite: async s => {
    let id = strToLink(s.name)
    await F.task('route', ['/' + id, s])
  },
})

export const actions: Actions<S> = {
  SetState: company => s => {
    let merged = deepmerge(clone(state), company)
    merged.webpageName = merged.webpage.split('/')[2]
    return merged
  },
}

const view: View<S> = F => async s => {
  let style = F.ctx.groups.style

  let mainURL = s.webpage
    ? s.webpage
    : s.networks.facebook
    ? s.networks.facebook
    : s.userFb
    ? s.userFb
    : 'https://facebook.com/' + s.userId

  return h('div', {
    key: F.ctx.id,
    class: { [style.base]: true },
  }, [
    h('a', {
      key: 'title',
      class: { [style.title]: true },
      attrs: {
        href: mainURL,
        target: '_blank',
        rel: 'nofollow noopener noreferrer',
      },
    }, s.name),
    ...s.description ? [
      h('div', { key: 'description' , class: { [style.description]: true }}, s.description),
    ] : [],
    h('div', {
      key: 'container',
      class: { [style.dataContainer]: true },
    }, [
      ...s.webpage ? [
        h('a', {
          key: 'webpage',
          class: {
            [style.webpage]: true,
            [style.link]: true,
          },
          attrs: {
            href: s.webpage,
            rel: 'nofollow noopener noreferrer',
            target: '_blank',
          },

        }, s.webpageName)
      ] : [],
      ...s.networks.facebook ? [
        h('a', {
          key: 'fanpage',
          class: {
            [style.fanpage]: true,
            [style.link]: true,
          },
          attrs: {
            href: s.networks.facebook,
            rel: 'nofollow noopener noreferrer',
            target: '_blank',
          },
        }, 'Fanpage')
      ] : [],
      h('a', {
        class: {
          [style.user]: true,
          [style.link]: true,
        },
        attrs: {
          href: s.userFb ? s.userFb : 'https://facebook.com/' + s.userId,
          rel: 'nofollow noopener noreferrer',
          target: '_blank',
        },
      }, s.user),
    ]),
    s.places ? h('div', {
      class: { [style.places]: true },
      on: { click: F.in('setFilter', ['places', s.places[0]]) },
    }, s.places[0]) : h('div'),
    s.tags ? h('div', {class: { [style.tags]: true }},
      s.tags.map(
        tagName => h('div', {
          class: { [style.tag]: true },
          on: { click: F.in('setFilter', ['tags', tagName]) },
        }, tagName)
      ),
    ): h('div'),
    h('a', {
      class: { [style.moreLink]: true },
      attrs: { href: '/' + strToLink(s.name) },
      on: { click: F.in('toSite', s, _, { default: false }) },
    }, 'ver más...'),
  ])
}

export const interfaces: Interfaces = { view }

const style: StyleGroup = {
  base: {
    position: 'relative',
    width: '100%',
    maxWidth: '484px',
    display: 'flex',
    flexDirection: 'column',
    padding: '0 0 15px 0',
    alignItems: 'center',
    borderBottom: '1px solid ' + palette.borderLight,
  },
  title: {
    margin: '0',
    padding: '10px',
    borderRadius: '4px',
    display: 'flex',
    justifyContent: 'center',
    alignItems: 'center',
    color: palette.textPrimary,
    fontSize: '24px',
    textAlign: 'center',
    textDecoration: 'none',
    cursor: 'pointer',
    $nest: {
      [`@media screen and (max-width: ${BP.sm}px)`]: {
        maxWidth: '245px',
        width: '100%',
        padding: '10px 0',
        fontSize: '20px',
      },
      '&:hover': {
        textDecoration: 'underline',
      },
    },
  },
  description: {
    maxWidth: '93%',
    padding: '5px 10px 10px 10px',
    fontSize: '16px',
    textAlign: 'center',
    color: palette.textSecondary,
    $nest: {
      [`@media screen and (max-width: ${BP.sm}px)`]: {
        maxWidth: '100%',
        padding: '5px 4px 10px 4px',
        fontSize: '14px',
      },
    },
  },
  dataContainer: {
    display: 'flex',
    flexDirection: 'column',
    alignItems: 'center',
    [`@media screen and (max-width: ${BP.sm}px)`]: {
      width: '100%',
    },
  },
  link: {
    display: 'flex',
    flexDirection: 'column',
    alignItems: 'center',
    padding: '5px 8px',
    textDecoration: 'none',
    borderRadius: '4px',
    ...clickable,
    $nest: {
      '&:hover': {
        backgroundColor: palette.shadowLight,
      },
      [`@media screen and (max-width: ${BP.sm}px)`]: {
        width: '90%',
        padding: '8px 8px',
        textAlign: 'center',
      },
    },
  },
  webpage: {
    color: palette.primary,
  },
  fanpage: {
    color: palette.primary,
  },
  user: {
    color: palette.textTertiary,
  },
  places: {
    marginTop: '8px',
    marginBottom: '2px',
    padding: '4px 6px',
    borderRadius: '4px',
    fontSize: '14px',
    color: palette.textTertiary,
    ...clickable,
    $nest: {
      '&:hover': {
        backgroundColor: palette.shadowLight,
      },
    },
  },
  tags: {
    maxWidth: '85%',
    display: 'flex',
    justifyContent: 'center',
    flexWrap: 'wrap',
  },
  tag: {
    margin: '3px',
    padding: '3px',
    borderRadius: '4px',
    fontSize: '14px',
    color: palette.textTertiary,
    border: '1px solid ' + palette.borderGrey,
    ...clickable,
    $nest: {
      '&:hover': {
        backgroundColor: palette.shadowLight,
      },
    },
  },
  moreLink: {
    position: 'absolute',
    bottom: '0px',
    right: '0px',
    fontSize: '14px',
    color: palette.textTertiary,
    textDecoration: 'none',
    ...clickable,
    $nest: {
      '&:hover': {
        textDecoration: 'underline',
      },
    },
  },
}

export const groups = { style }

