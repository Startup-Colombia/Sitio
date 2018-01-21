
export let config = {
  DEV: false,
}

export const setDev = (value: boolean) => config.DEV = value

export const getDev = (value: boolean) => config.DEV

export const getServer = () => config.DEV ? 'http://localhost:3001' : ''

export const cloudantURL = 'https://1ec8c733-54bd-44c9-aafd-cd14edb80cf1-bluemix.cloudant.com'
