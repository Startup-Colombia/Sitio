import es = require('keyword-extractor/lib/stopwords/es')
import request = require('request')
import { strToLink } from '../app/utils'

export const getKeywords = (description: string) => {
  let parts = description
    .replace(/\.|,/g, '')
    .split(' ')
    .map(
      p => p.trim().toLowerCase()
    )
  let keywords = []
  let keyword
  for (let i = 0, len = parts.length; i < len; i++) {
    if (es.stopwords.indexOf(parts[i]) !== -1) {
      if (i !== 0) {
        keywords.push(keyword)
      }
      keyword = ''
    } else {
      if (i === 0) {
        keyword = parts[i]
      } else {
        keyword += ' ' + parts[i]
      }
      if (i === len - 1) {
        keywords.push(keyword)
      }
    }
  }
  keywords = keywords.filter(k => k !== '')
  return keywords
}

// DB

export async function getCategories () {
  let result: any = await new Promise((resolve, reject) => request(
    'https://1ec8c733-54bd-44c9-aafd-cd14edb80cf1-bluemix.cloudant.com/companies/_all_docs?include_docs=true',
    (error, res, body) =>{
      if (error) {
        return reject(error)
      }
      resolve(body)
    },
  ))
  result = JSON.parse(result)
  let companies = result.rows.map(r => r.doc)
  let categoriesObj = {}
  companies.forEach(c => {
    if (!c.tags) return
    c.tags.forEach(t => {
      categoriesObj[t] = {
        name: t,
        link: '/categoria/' + strToLink(
          t.replace(/-|\//g, ' ').split(' ').map(p => p.trim()).filter(p => p).join(' ')
        ),
      }
    })
  })
  let categories = []
  let name
  for (name in categoriesObj) {
    categories.push(categoriesObj[name])
  }
  return categories
}

export async function getCategoryCompanies (category: string) {
  let name = category.replace(/-|\//g, ' ')
  let query = name
    .split(' ')
    .map(p => 'tags:' + p.trim())
    .join(' AND ')
  let queryURI = encodeURIComponent(query)
  let result: any = await new Promise((resolve, reject) => request(
    'https://1ec8c733-54bd-44c9-aafd-cd14edb80cf1-bluemix.cloudant.com/companies/_design/companies/_search/companies?q=' + queryURI + '&include_docs=true',
    (error, res, body) =>{
      if (error) {
        return reject(error)
      }
      resolve(body)
    },
  ))
  result = JSON.parse(result)
  let companies = result
    .rows
    .map(r => r.doc)
    .map(c => ({
      name: c.name,
      link: '/' + strToLink(c.name),
    }))
  return companies
}
