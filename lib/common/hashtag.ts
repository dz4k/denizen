export const parseHashtags = (html: string) => {
  const tags: string[] = []
  html = html.replace(/(?<!\w)#(\w+)/g, (hashtag, tag) => {
    tags.push(tag)
    return `<a href="/tag/${tag}">${hashtag}</a>`
  })
  return { html, tags }
}
