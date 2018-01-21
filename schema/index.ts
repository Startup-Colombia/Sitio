export interface Doc {
  _id?: string
  _rev?: string
  timestamp?: string
}

export interface Metric extends Doc {
  type: 'newUser' | 'companyRequest' | 'companyAccept' | 'companyDeny' | 'companyUpdate'
  userId: string
  companyName: string
  companyId: string
}

export interface Company extends Doc {
  name: string
  networks: {
    facebook?: string
    linkedin?: string
    twitter?: string
    github?: string
  }
  description: string
  webpage: string
  user: string
  userId: string
  type: 'micro' | 'small' | 'median' | 'big'
  isStartup: boolean
  tags: string[]
  places: string[]
  email: string
  id?: string // used for company already in list verification
  userFb?: string // Pending of deprecation
  webAudits?: any
  webAuditsVersion?: string
}

export interface User extends Doc {
  name: string
  email: string
  networks: {
    facebook: string
  }
  companies: {
    [id: string]: boolean
  }
  fbData: {}
}
