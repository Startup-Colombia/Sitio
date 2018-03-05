import {
  Actions,
  Inputs,
  Interfaces,
  StyleGroup,
  getStyle,
  mapAsync,
  comp,
} from 'fractal-core'
import { View, h } from 'fractal-core/interfaces/view'

import * as JoinToSee from './common/JoinToSee'
import * as Chart from './common/Chart'

export const state = {
  token: '',
  charts: [],
  _nest: { JoinToSee },
  _compUpdated: false,
}

export type S = typeof state

export const inputs: Inputs = F => ({
  setActive: async () => {
    const token = localStorage.getItem('token')
    F.set('token', token)
    if (!token) {
      return
    }
    const response = await fetch('https://1ec8c733-54bd-44c9-aafd-cd14edb80cf1-bluemix.cloudant.com/startups/stats')
      .then(r => r.json())

    F.toAct('AddCharts', response.list)
  },
})

export const actions: Actions<S> = {
  AddCharts: stats => s => {
    for (let statName in stats) {
      let stat = stats[statName]
      s._nest[statName] = comp(Chart, {
        state: {
          title: stat.title,
          type: stat.type,
          labels: stat.labels,
          data: stat.data,
          backgroundColor: stat.backgroundColor,
        },
      })
      s.charts.push(statName)
    }
    s._compUpdated = true
    return s
  },
}

const view: View<S> = F => async s => {
  let style = getStyle(F)

  return s.token ? h('div', {
    key: F.ctx.name,
    class: style('base'),
  }, [
    h('div', { class: style('title') }, 'Estadísticas de las Startups Digitales'),
    h('div', { class: style('charts') },
      await mapAsync(s.charts,
        async chartName => h('div', { class: style('chart') }, [
          await F.vw(chartName)
        ])
      )
    ),
  ]) : await F.vw('JoinToSee')
}

export const interfaces: Interfaces = { view }

const style: StyleGroup = {
  base: {
    flexShrink: 0,
    minHeight: 'calc(100% - 249px)',
    paddingBottom: '50px',
  },
  title: {
    padding: '15px 10px',
    textAlign: 'center',
    fontSize: '32px',
  },
  charts: {
    display: 'flex',
    flexDirection: 'column',
    alignItems: 'center',
  },
  chart: {
    margin: '10px',
    width: '100%',
    maxWidth: '660px',
    flexShrink: 0,
  }
}

export const groups = { style }
