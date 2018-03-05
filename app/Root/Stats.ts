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
import { palette } from './constants';

export const state = {
  charts: [],
  _nest: { JoinToSee },
  _compUpdated: false,
}

export type S = typeof state

export const inputs: Inputs = F => ({
  setActive: async () => {
    const response = await fetch('https://1ec8c733-54bd-44c9-aafd-cd14edb80cf1-bluemix.cloudant.com/startups/stats')
      .then(r => r.json())

    let s: S = F.stateOf()
    let len = s.charts.length
    F.toAct('AddCharts', response.list)
    if (len > 0) {
      for(let chartName of s.charts) {
        F.toChild(chartName, 'init')
      }
    }
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

  return h('div', {
    key: F.ctx.name,
    class: style('base'),
  }, [
    h('div', { class: style('title') }, 'Estadísticas de las Startups Digitales'),
    h('div', { class: style('description') }, [
      <any> 'Los datos provienen del ',
      h('a', { attrs: { target: '_blank', rel: 'noopener', href: 'https://docs.google.com/spreadsheets/d/1gn-wJpq_kxhGbByp76Sc3drJxXNDAVRiNjJy87HJ7Uc/edit#gid=0' } }, 'directorio de startups digitales'),
      <any> ' mantenido activamente por ',
      h('a', { attrs: { target: '_blank', rel: 'noopener', href: 'https://www.facebook.com/camilotravel' } }, 'Camilo Galeano'),
      <any> ' quien hace parte de nuestro equipo.',
    ]),
    h('div', { class: style('charts') },
      await mapAsync(s.charts,
        async chartName => h('div', { class: style('chart') }, [
          await F.vw(chartName)
        ])
      )
    ),
  ])
}

export const interfaces: Interfaces = { view }

const style: StyleGroup = {
  base: {
    display: 'flex',
    flexDirection: 'column',
    alignItems: 'center',
    flexShrink: 0,
    minHeight: 'calc(100% - 249px)',
    paddingBottom: '50px',
  },
  title: {
    padding: '25px 10px 15px 10px',
    textAlign: 'center',
    fontSize: '32px',
  },
  description: {
    padding: '10px',
    fontSize: '20px',
    textAlign: 'center',
    maxWidth: '660px',
    color: palette.textSecondary,
  },
  charts: {
    marginTop: '20px',
    width: '100%',
    display: 'flex',
    flexDirection: 'column',
    alignItems: 'center',
  },
  chart: {
    margin: '10px',
    width: '100%',
    maxWidth: '660px',
    flexShrink: 0,
  },
}

export const groups = { style }
