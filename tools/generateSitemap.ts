import fs = require('fs')
import request = require('request')
import { strToLink } from '../app/utils'

const generateSitemap = pages => `<?xml version="1.0" encoding="UTF-8"?>
<urlset
      xmlns="http://www.sitemaps.org/schemas/sitemap/0.9"
      xmlns:xsi="http://www.w3.org/2001/XMLSchema-instance"
      xsi:schemaLocation="http://www.sitemaps.org/schemas/sitemap/0.9
            http://www.sitemaps.org/schemas/sitemap/0.9/sitemap.xsd">
${pages.map(page => `
  <url>
    <loc>${page.url}</loc>
    <lastmod>${(new Date()).toISOString()}</lastmod>
    <changefreq>daily</changefreq>
  </url>
`).join('')}
</urlset>`

request(
  'https://1ec8c733-54bd-44c9-aafd-cd14edb80cf1-bluemix.cloudant.com/companies/_all_docs?include_docs=true',
  (error, _, body) => {
    if (error) {
      console.error(error)
    }
    let res = JSON.parse(body)
    console.log(res.rows.length)
    let companiesPages = res.rows
      .map(r => r.doc)
      .filter(c => c._id.indexOf('_design/') === -1)
      .map(c => ({
        url: `https://startupcol.com/${encodeURIComponent(strToLink(c.name))}`,
      }))
    let pages = [
      { url: 'https://startupcol.com' },
      ...companiesPages,
    ]

    let sitemap = generateSitemap(pages)

    fs.unlink('./dist/public/sitemap.xml', err => {
      fs.writeFile('./dist/public/sitemap.xml', sitemap, { flag: 'wx' }, err => {
        if (err) throw err
        console.log('Guardado en archivo ./dist/public/sitemap.xml')
      })
    })
  }
)
