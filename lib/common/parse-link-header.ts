// https://github.com/bryik/deno-parse-link-header/tree/v0.1.1/parseLinkHeader.ts

type LinkHeader = {
  href: string
  [key: string]: string
}

export const parseLinkHeader = (header: string): LinkHeader[] => {
  // parser context
  let pos = 0
  const consumeChar = () => {
    if (pos >= header.length) return
    return header[pos++]
  }
  const peekChar = () => {
    if (pos >= header.length) return null
    return header[pos]
  }
  const until = (c: string) => {
    const start = pos
    while (peekChar() !== c) {
      if (consumeChar() === null) return null
    }
    return header.slice(start, pos)
  }

  const ows = () => {
    // OWS = *( SP / HTAB )
    while (peekChar() === ' ' || peekChar() === '\t') {
      consumeChar()
    }
  }

  const bws = ows

  const token = () => {
    // tchar = "!" / "#" / "$" / "%" / "&" / "'" / "*" / "+" / "-" / "." /
    //  "^" / "_" / "`" / "|" / "~" / DIGIT / ALPHA
    // token = 1*tchar
    const regex = /[!#$%&'*+\-.^_`|~0-9a-zA-Z]/
    if (!regex.test(peekChar()!)) return null
    let result = consumeChar()
    while (true) {
      const c = peekChar()
      if (c && regex.test(c)) result += consumeChar()!
      else break
    }
    return result
  }

  const quotedString = () => {
    // qdtext = HTAB / SP / %x21 / %x23-5B / %x5D-7E / obs-text
    // quoted-string = DQUOTE *( qdtext / quoted-pair ) DQUOTE
    if (peekChar() !== '"') return null
    consumeChar()
    let result = ''
    while (true) {
      const c = consumeChar()
      if (c === null) {
        throw new Error('expected closing quote at position ' + pos)
      }
      if (c === '"') break
      if (c === '\\') {
        const next = consumeChar()
        if (next === null) {
          throw new Error('expected escaped character at position ' + pos)
        }
        result += next
      } else {
        result += c
      }
    }
    return result
  }

  const linkParam = (): [string, string] => {
    // link-param = token BWS [ "=" BWS ( token / quoted-string ) ]
    const key = token()
    if (!key) {
      throw new Error('expected token at position ' + pos)
    }

    let value
    bws()
    if (consumeChar() === '=') {
      bws()
      value = token() ?? quotedString()
      if (!value) {
        throw new Error('expected token or quoted-string at position ' + pos)
      }
    }

    return [key, value ?? '']
  }

  const linkValue = () => {
    // link-value = "<" URI-Reference ">" *( OWS ";" OWS link-param )
    if (peekChar() !== '<') return null
    consumeChar()

    // cheat on URI-Reference and just grab everything until the next '>'
    const href = until('>')
    if (!href) return null
    if (consumeChar() !== '>') {
      throw new Error('expected ">" at position ' + pos)
    }

    const params = [] as [string, string][]
    while (true) {
      const restore = pos
      ows()
      if (consumeChar() !== ';') {
        pos = restore
        break
      }
      ows()
      const param = linkParam()
      if (!param) break
      params.push(param)
    }
    return { href, ...Object.fromEntries(params) }
  }

  // Link       = #link-value
  const links = [] as LinkHeader[]
  while (true) {
    ows()
    const link = linkValue()
    if (!link) break
    links.push(link)
    ows()
    if (consumeChar() !== ',') break
  }
  return links
}
