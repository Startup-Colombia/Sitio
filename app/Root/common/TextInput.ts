import {
  Actions,
  Inputs,
  Interfaces,
  StyleGroup,
  assoc,
  _,
} from 'fractal-core'
import { View, h } from 'fractal-core/interfaces/view'
import { palette, textStyle } from '../constants'

export const state = {
  width: 0,
  value: '',
  hint: '',
  focus: false,
  error: false,
  attrs: {},
}

export type S = typeof state

export const inputs: Inputs = F => ({
  setFocus: async v => await F.toAct('SetFocus', v),
  change: async v => await F.toAct('Change', v),
  keyUp: async () => {},
  setError: async v => await F.toAct('SetError', v),
})

export const actions: Actions<S> = {
  SetWidth: assoc('width'),
  SetFocus: assoc('focus'),
  SetError: assoc('error'),
  SetAttrs: assoc('attrs'),
  Change: value => s => {
    s.value = value
    s.error = false
    return s
  },
}

const view: View<S> = F => async s => {
  let style = F.ctx.groups.style

  return h('div', {
    key: F.ctx.name,
    class: {
      [style.base]: true,
    },
    size: F.act('SetWidth', _, 'width'),
  }, [
    h('input', {
      key: F.ctx.name,
      class: { [style.input]: true },
      props: { value: s.value },
      on: {
        keyup: F.in('keyUp', _, 'keyCode', { default: true }),
        input: F.in('change', _, ['target', 'value']),
        focus: F.in('setFocus', true),
        blur: F.in('setFocus', false),
      },
      attrs: {
        type: 'text',
        ...s.attrs,
      },
    }),
    h('div', {class: {
      [style.lineContainer]: true,
      [style.lineContainerFocus]: s.focus,
    }}, [
      h('div', {
        class: {
          [style.bottomLine]: true,
          [style.bottomLineFocus]: s.focus,
          [style.bottomLineError]: s.error,
        },
        style: s.focus ? { transform: `scaleX(${s.width})` } : {},
      })
    ]),
    h('label', {
      class: {
        [style.hint]: true,
        [style.hintActive]: s.focus || s.value !== '',
        [style.hintError]: s.error,
      },
    }, s.hint),
  ])
}

export const interfaces: Interfaces = { view }

const style: StyleGroup = {
  base: {
    width: '100%',
    position: 'relative',
    margin: '10px',
  },
  input: {
    position: 'relative',
    width: '100%',
    zIndex: 2,
    padding: '15px 0px 4px 0px',
    fontSize: '18px',
    outline: 'none',
    border: 'none',
    backgroundColor: 'rgba(0, 0, 0, 0)',
    ...textStyle,
  },
  hint: {
    position: 'absolute',
    left: '9px',
    top: '15px',
    padding: '0 4px 4px 0',
    fontSize: '18px',
    textRendering: 'geometricPrecision',
    transition: 'transform .2s',
    transformOrigin: 'left top',
    ...textStyle,
    color: palette.textTertiary,
  },
  hintActive: {
    transform: 'translate(-9px, -15px) scale(0.67)',
    padding: '0',
    color: palette.primary,
  },
  hintError: {
    color: palette.redCol,
  },
  lineContainer: {
    width: '100%',
    height: '2px',
    borderTop: '1px solid ' + palette.borderLight,
    display: 'flex',
    justifyContent: 'center',
  },
  lineContainerFocus: {
    borderTop: 'none',
  },
  bottomLine: {
    visibility: 'hidden',
    width: '1px',
    height: '2px',
    transition: 'transform .3s',
    backgroundColor: palette.primary,
  },
  bottomLineFocus: {
    visibility: 'visible',
  },
  bottomLineError: {
    backgroundColor: palette.redCol,
  },
}

export const groups = { style }
