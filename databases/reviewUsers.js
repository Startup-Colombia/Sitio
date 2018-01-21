// const dotenv = require('dotenv')
const Cloudant = require('cloudant')

// dotenv.config()
const fs = require('fs')
var https = require('https')
var webdriver = require('selenium-webdriver'),
  By = webdriver.By,
  until = webdriver.until

let username = process.env.saucelabs_name
let accessKey = process.env.saucelabs_key
let facebook_name = process.env.facebook_name
let facebook_pass = process.env.facebook_pass

var PAGE_LOAD_TIMEOUT_MS = 200000
var SCRIPT_LOAD_TIMEOUT_MS = 200000

var cloudant

var key = process.env.cloudant_key
var password = process.env.cloudant_password

Cloudant({
  account: '1ec8c733-54bd-44c9-aafd-cd14edb80cf1-bluemix',
  key: key,
  password: password,
  plugin: 'promises',
}, (er, cloudant, reply) => {
  if (er) {
    throw er
  }

  let usersDB = cloudant.use('users')
  let companiesDB = cloudant.use('companies')

  review(usersDB, companiesDB)
    .then(() => console.log('Finalizado ...'))
    .catch(error => console.log(error))

})


async function review (usersDB, companiesDB) {
  // var driver = new webdriver.Builder()
  //   .forBrowser('chrome')
  //   .build()
  let driver = new webdriver.Builder()
    .withCapabilities({
      browserName: 'chrome',
      platform: 'Windows 10',
      version: '59.0',
      username: username,
      accessKey: accessKey
    })
    .usingServer('http://' + username + ':' + accessKey + '@ondemand.saucelabs.com:80/wd/hub')
    .build()
  driver.manage().timeouts().pageLoadTimeout(PAGE_LOAD_TIMEOUT_MS)
  driver.manage().timeouts().setScriptTimeout(SCRIPT_LOAD_TIMEOUT_MS)
  await driver.get('https://facebook.com')

  await driver.executeScript('document.getElementById("email").setAttribute("value", "carloslfu@gmail.com")')
  await driver.executeScript('document.getElementById("pass").setAttribute("value", "Investigacion1")')
  await driver.findElement(By.id('u_0_r')).click()

  var { rows } = await companiesDB.list({ include_docs: true })
  let companies = rows.map(r => r.doc)
  console.log(companies.length)
  var { rows } = await usersDB.list({ include_docs: true })
  let users = rows.map(r => r.doc).filter(u => u.state === 'unreviewed')
  console.log(users.length)

  for (let i = 0, len = users.length; i < len; i++) {
    let user = users[i]
    console.log(i)
    try {
      await driver.get('https://facebook.com/' + user._id)
      let url = await driver.getCurrentUrl()
      console.log(url)
      let selfCompanies = companies.filter(c => c.userFb === url)
      let updatedCompanies = selfCompanies.map(c => {
        user.companies[c._id] = true
        c.userId = user._id
        return c
      })
      await companiesDB.bulk({ docs: updatedCompanies })
      user.state = 'reviewed'
      await usersDB.insert(user)
    } catch (err) {
      console.log(err)
    }
  }
  driver.quit()
}

function delay (ms) {
  return new Promise((resolve, reject) => {
    setTimeout(() => resolve(), ms)
  })
}
