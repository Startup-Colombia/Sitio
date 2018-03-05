import {
  Actions,
  Inputs,
  Interfaces,
  StyleGroup,
  getStyle,
  _,
  clone,
} from 'fractal-core'
import { View, h } from 'fractal-core/interfaces/view'
const Chart = require('chart.js')

const chartTypeDictionary = {
  horizontalBar: 'Barras Horizontales',
  pie: 'Pastel',
  bar: 'Barras',
}
const chartTypes = (Object as any).keys(chartTypeDictionary)
const chartTypeStrings = (Object as any).values(chartTypeDictionary)

export const state = {
  title: '',
  type: '',
  labels: [],
  data: [],
  backgroundColor: [],
  chart: <any> -1,
}

export type S = typeof state

const createConfig = (s: S) => clone({
  type: s.type,
  data: {
    labels: s.labels,
    datasets: [{ label: s.title, data: s.data, backgroundColor: s.backgroundColor }],
  },
  options: {
    legend: {
      display: s.type === 'pie',
      defaultFontSize: 5,
    },
  },
})

export const inputs: Inputs = F => ({
  init: async () => {
    let s: S = F.stateOf()
    setTimeout(() => {
      const chart = new Chart(F.ctx.id, createConfig(s))
      F.set('chart', chart)
    }, 150)
  },
  setType: async selectedIndex => {
    let s: S = F.stateOf()
    await F.set('type', chartTypes[selectedIndex])
    if (s.chart !== -1) {
      s.chart.destroy()
    }
    await F.set('chart', new Chart(F.ctx.id, createConfig(s)))
  },
})

export const actions: Actions<S> = {
}

const view: View<S> = F => async s => {
  let style = getStyle(F)

  return h('div', {
    key: F.ctx.name,
    class: style('base'),
  }, [
    h('select', {
      class: style('type'),
      on: { change: F.in('setType', _, ['target', 'selectedIndex']) },
    },
      chartTypeStrings.map(
        (op, idx) => h('option', {
          props: s.type === chartTypes[idx] ? { selected: 'selected' } : {},
        }, op)
      )
    ),
    h('div', { class: style('title') }, s.title),
    h('canvas', { attrs: { id: F.ctx.id, width: '400', height: '400' } }),
  ])
}

export const interfaces: Interfaces = { view }

const style: StyleGroup = {
  base: {
    position: 'relative',
    width: '100%',
    height: '100%',
    padding: '30px 20px 30px 20px',
    border: '1px dashed grey',
  },
  title: {
    paddingBottom: '30px',
    textAlign: 'center',
    fontSize: '27px',
  },
  type: {
    position: 'absolute',
    right: '4px',
    top: '4px',
    padding: '3px',
    background: 'none',
    fontSize: '12px',
  },
}

export const groups = { style }
