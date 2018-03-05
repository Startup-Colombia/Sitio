import {
  Actions,
  Inputs,
  Interfaces,
  StyleGroup,
  getStyle,
} from 'fractal-core'
import { View, h } from 'fractal-core/interfaces/view'
import * as Chart from 'chart.js'

export const state = {}

export type S = typeof state

export const inputs: Inputs = F => ({
  setActive: async () => {
    const stats = await fetch('https://1ec8c733-54bd-44c9-aafd-cd14edb80cf1-bluemix.cloudant.com/startups/stats')
      .then(r => r.json())
    console.log(stats)
    setTimeout(() => {
      const myChart = new Chart('chart123', {
        type: 'pie',
        data: {
          labels: stats.sector.labels,
          datasets: [{ data: stats.sector.data }],
        },
      })
    }, 100)
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
    h('div', { class: style('title') }, 'Estadísticas de las Startups Digitales'),
    h('canvas', { attrs: { id: 'chart123', width: '400', height: '400' } }),
  ])
}

export const interfaces: Interfaces = { view }

const style: StyleGroup = {
  base: {
    flexShrink: 0,
    minHeight: 'calc(100% - 249px)',
    paddingBottom: '50px',
  },
}

export const groups = { style }
