import {
  Actions,
  Inputs,
  Interfaces,
  StyleGroup,
  deepmerge,
  clickable,
  _,
} from 'fractal-core'
import { View, h } from 'fractal-core/interfaces/view'
import { textStyle, palette, BP } from './constants'

export const state = {
  fetched: false,
  name: '',
  description: '',
  webpage: '',
  user: '',
  userId: '',
  userFb: '',
  networks: {
    facebook: '',
  },
  places: [],
  tags: [],
}

export type S = typeof state

export const inputs: Inputs = F => ({
  setActive: async state => {
    await F.toAct('SetState', state)
  },
  toSite: async route => {
    await F.task('route', [route])
  },
})

export const actions: Actions<S> = {
  SetState: state => s => deepmerge(s, state),
}

const view: View<S> = F => async s => {
  let style = F.ctx.groups.style

  return !s.fetched ? h('div', {
    key: F.ctx.name,
    class: { [style.base]: true },
  }, [
    h('h1', {class: { [style.titleError]: true }}, `No existe una empresa llamada "${s.name}" en la plataforma`),
    h('div', {class: { [style.description]: true }}, [
      <any> 'Inscríbela fácilmente dese ',
      h('a', {
        class: { [style.linkNormal]: true },
        attrs: { href: '/' },
        on: { click: F.in('toSite', '/', _, { default: false }) },
      }, 'startupcol.com'),
    ]),
  ])
  : h('div', {
    key: F.ctx.name,
    class: { [style.base]: true },
  }, [
    h('a', {
      class: { [style.toMainPage]: true, [style.linkNormal]: true },
      attrs: { href: '/' },
      on: { click: F.in('toSite', '/', _, { default: false }) },
    }, 'startupcol.com'),
    h('h1', {class: { [style.title]: true }}, s.name),
    ...s.description ? [h('p', {class: { [style.description]: true }}, s.description)] : [],
    ...s.webpage ? [h('a', {
      class: { [style.link]: true, [style.coloredLink]: true },
      attrs: { href: s.webpage, target: '_blank', rel: 'noopener noreferrer' },
    }, 'Sitio')] : [],
    ...s.networks.facebook ? [h('a', {
      class: { [style.link]: true, [style.coloredLink]: true },
      attrs: { href: s.networks.facebook, target: '_blank', rel: 'nofollow noopener noreferrer' },
    }, 'Facebook')] : [],
    h('a', {
      class: { [style.link]: true },
      attrs: { href: s.userFb ? s.userFb : 'facebook.com/' + s.userId, target: '_blank', rel: 'nofollow noopener noreferrer' },
    }, s.user),
    h('div', {
      class: { [style.places]: true },
    }, s.places[0]),
    s.tags ? h('div', {class: { [style.tags]: true }},
      s.tags.map(
        tagName => h('div', {
          class: { [style.tag]: true },
          // on: { click: ev('setFilter', ['tags', tagName]) },
        }, tagName)
      ),
    ): h('div'),
  ])
}

export const interfaces: Interfaces = { view }

const style: StyleGroup = {
  base: {
    position: 'relative',
    width: '100%',
    height: '100%',
    display: 'flex',
    flexDirection: 'column',
    alignItems: 'center',
    overflow: 'auto',
    ...textStyle,
  },
  linkNormal: {
    padding: '5px',
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
  title: {
    minWidth: '400px',
    margin: '0 0 7px 0',
    padding: '20px 20px 20px 20px',
    fontSize: '45px',
    textAlign: 'center',
    color: palette.primary,
    borderBottom: '1px solid ' + palette.borderLight,
    $nest: {
      [`@media screen and (max-width: ${BP.sm}px)`]: {
        minWidth: '100%',
      },
    },
  },
  titleError: {
    minWidth: '400px',
    margin: '0 0 20px 0',
    padding: '20px 20px 20px 20px',
    fontSize: '22px',
    textAlign: 'center',
    color: palette.primary,
    borderBottom: '1px solid ' + palette.borderLight,
  },
  description: {
    margin: '0',
    maxWidth: '700px',
    padding: '12px 15px 24px 15px',
    textAlign: 'center',
    fontSize: '24px',
    color: palette.textPrimary,
    $nest: {
      [`@media screen and (max-width: ${BP.sm}px)`]: {
        fontSize: '22px',
      },
    },
  },
  link: {
    color: palette.textTertiary,
    padding: '5px 8px',
    textDecoration: 'none',
    fontSize: '20px',
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
  coloredLink: {
    color: palette.primary,
  },
  places: {
    marginTop: '8px',
    marginBottom: '2px',
    padding: '3px',
    borderRadius: '4px',
    fontSize: '16px',
    color: palette.textTertiary,
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
    // ...clickable,
    // $nest: {
    //   '&:hover': {
    //     backgroundColor: palette.shadowLight,
    //   },
    // },
  },
}

export const groups = { style }
