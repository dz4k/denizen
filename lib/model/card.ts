import {
  ImageUrl,
  MF2Html,
  mf2Img,
  mf2ImgArray,
  MF2Object,
  MF2PropertyValue,
  mf2String,
  mf2StringArray,
  mf2Url,
  mf2UrlArray,
  removeEmptyProperties,
} from '../common/mf2.ts'

/**
 * @see http://microformats.org/wiki/h-card
 */

export class Card {
  name: string
  // honorificPrefix?: string
  // givenName?: string
  // additionalName?: string
  // sortString?: string
  // honorificSuffix?: string
  // nickname?: string
  email: URL[] = []
  tel: string[] = []
  // adr: Address[] = []
  // geo: (Geolocation | URL)[] = []
  impp: URL[] = []

  logo: URL[] = []
  photo: ImageUrl[] = []

  // Not a Date since birthdays can have unspecified year, month or day
  bday?: string
  anniversary?: string

  org: Card[] = []
  jobTitle?: string
  role?: string

  url: URL[] = []
  uid?: URL

  category: string[] = []
  note: string[] = []

  // p-sex and p-gender-identity suck
  gender: string[] = []
  // u-pronoun and p-x-pronoun-* are both nonstandard and not great, but they'll do
  pronoun: (string | URL)[] = []

  me: Record<string, string> = {}

  // denizen vendor-specific properties
  denizenBadge: DenizenBadge[] = []

  // TODO: handle multiple names
  // TODO: what is p-label?
  // TODO: what to do with name parts?
  // TODO: do we need adr and geo?
  constructor(name: string, props?: Partial<Card>) {
    this.name = name
    Object.assign(this, props)
  }

  static fromMf2Json(it: unknown): Card {
    const mf2 = MF2PropertyValue.parse(it)
    if (typeof mf2 === 'string') return new Card(mf2)
    if (!('properties' in mf2)) {
      return new Card(mf2.value ?? (mf2 as MF2Html).html)
    }

    const p = mf2.properties

    if (!('name' in p)) throw new Error('h-card has no name')

    const rv = new Card(mf2String(p.name[0]))

    if ('email' in p) rv.email = mf2UrlArray(p.email)
    if ('impp' in p) rv.impp = mf2UrlArray(p.impp)
    if ('tel' in p) rv.tel = mf2StringArray(p.tel)
    if ('logo' in p) rv.logo = mf2UrlArray(p.logo)
    if ('photo' in p) rv.photo = mf2ImgArray(p.photo)
    if ('bday' in p) rv.bday = mf2String(p.bday[0])
    if ('anniversary' in p) rv.anniversary = mf2String(p.anniversary[0])
    if ('org' in p) rv.org = p.org.map((v) => Card.fromMf2Json(v))
    if ('job-title' in p) rv.jobTitle = mf2String(p['job-title'][0])
    if ('role' in p) rv.role = mf2String(p.role[0])
    if ('url' in p) rv.url = mf2UrlArray(p.url)
    if ('uid' in p) rv.uid = mf2Url(p.uid[0])
    if ('category' in p) rv.category = mf2StringArray(p.category)
    if ('note' in p) rv.note = mf2StringArray(p.note)
    if ('gender' in p) rv.gender = mf2StringArray(p.gender)
    if ('pronoun' in p) rv.pronoun = mf2StringArray(p.pronoun) // TODO handle URL pronoun
    if ('x-me-key' in p) {
      const values = mf2StringArray(p['x-me-value'])
      mf2StringArray(p['x-me-key']).forEach((name, i) =>
        rv.me[name] = values[i]
      )
    }
    if ('x-denizen-badge' in p) {
      rv.denizenBadge = p['x-denizen-badge'].map((v) =>
        DenizenBadge.fromMf2Json(v)
      )
    }

    return rv
  }

  toMF2Json(): MF2Object {
    return removeEmptyProperties({
      type: ['h-card'],
      properties: {
        name: [this.name],

        email: this.email.map(String),
        tel: this.tel,
        // adr: Address[] = []
        // geo: (Geolocation | URL)[] = []
        impp: this.impp.map(String),

        logo: this.logo.map(String),
        photo: this.photo.map(({ url, alt }) => ({ value: url.href, alt })),

        // Not a Date since birthdays can have unspecified year, month or day
        bday: this.bday ? [this.bday] : [],
        anniversary: this.anniversary ? [this.anniversary] : [],

        org: this.org.map((card) => card.toMF2Json()),
        jobTitle: this.jobTitle ? [this.jobTitle] : [],
        role: this.role ? [this.role] : [],

        url: this.url.map(String),
        uid: this.uid ? [this.uid.toString()] : [],

        category: this.category,
        note: this.note,

        // p-sex and p-gender-identity suck
        gender: this.gender,
        // u-pronoun and p-x-pronoun-* are both nonstandard and not great, but they'll do
        pronoun: this.pronoun.map(String),

        'x-me-key': Object.keys(this.me),
        'x-me-value': Object.values(this.me),

        'x-denizen-badge': this.denizenBadge.map((badge) => badge.toMF2Json()),
      },
    })
  }
}

export class DenizenBadge {
  iid: string = crypto.randomUUID()
  photo?: ImageUrl
  url?: URL

  constructor(props?: Partial<DenizenBadge>) {
    Object.assign(this, props)
  }

  static fromMf2Json(it: unknown): DenizenBadge {
    const mf2 = MF2PropertyValue.parse(it)
    if (typeof mf2 !== 'object') {
      throw new Error(
        'Denizen badges must be images or entities in microformat data',
      )
    }
    if ('value' in mf2 && 'alt' in mf2) {
      return new DenizenBadge({ photo: mf2Img(mf2) })
    }
    if (!('type' in mf2) || !('properties' in mf2)) {
      throw new Error(
        'Denizen badges must be images or entities in microformat data',
      )
    }
    if (!mf2.type.includes('h-x-denizen-badge')) {
      throw new Error(
        'Denizen badges must be entities of type h-x-denizen-badge',
      )
    }

    const p = mf2.properties

    const rv = new DenizenBadge()
    if ('iid' in p) rv.iid = mf2String(p.iid[0])
    if ('url' in p) rv.url = mf2Url(p.url[0])
    if ('photo' in p) rv.photo = mf2Img(p.photo[0])

    return rv
  }

  toMF2Json(): MF2Object {
    return removeEmptyProperties({
      type: ['h-x-denizen-badge'],
      properties: {
        iid: [this.iid],
        photo: this.photo
          ? [{ value: this.photo.url.href, alt: this.photo.alt }]
          : [],
        url: this.url ? [this.url.toString()] : [],
      },
    })
  }
}
