import {
	assertEquals,
	assertExists,
} from 'jsr:@std/assert@1.0.10'
import mf2 from '../../lib/mf2/mf2-parser.ts'

Deno.test('parses a simple h-entry', () => {
	const html = `<!DOCTYPE html>
  <article class="h-entry">
    <h1 class="p-name">Hello, World!</h1>
    <link class="u-url" href="https://example.com/hello-world">
    <time class="dt-published" datetime="2021-01-01T00:00:00Z">January 1, 2021</time>
    <p class="e-content">This is a test.</p>
  </article>`

	const mf2doc = mf2(html, { baseUrl: 'https://example.com' })

	assertEquals(mf2doc.items.length, 1)

	const item = mf2doc.items[0]

	assertEquals(item.type, ['h-entry'])
	assertEquals(item.properties.name, ['Hello, World!'])
	assertEquals(item.properties.url, ['https://example.com/hello-world'])
	assertEquals(item.properties.published, ['2021-01-01T00:00:00Z'])
	assertEquals(item.properties.content, [{
		html: 'This is a test.',
		value: 'This is a test.',
	}])
})

Deno.test('parses a simple h-entry with nested properties', () => {
	const html = `<!DOCTYPE html>
  <article class="h-entry">
    <h1 class="p-name">Hello, World!</h1>
    <a class="u-url" href="https://example.com/hello-world">
      <time class="dt-published" datetime="2021-01-01T00:00:00Z">January 1, 2021</time>
    </a>
    <p class="e-content">This is a test.</p>
  </article>`

	const mf2doc = mf2(html, { baseUrl: 'https://example.com' })

	assertEquals(mf2doc.items.length, 1)

	const item = mf2doc.items[0]

	assertEquals(item.type, ['h-entry'])
	assertEquals(item.properties.name, ['Hello, World!'])
	assertEquals(item.properties.url, ['https://example.com/hello-world'])
	assertEquals(item.properties.published, ['2021-01-01T00:00:00Z'])
	assertEquals(item.properties.content, [{
		html: 'This is a test.',
		value: 'This is a test.',
	}])
})

Deno.test('parses a simple h-entry with nested properties and multiple values', () => {
	const html = `<!DOCTYPE html>
  <article class="h-entry">
    <h1 class="p-name">Hello, World!</h1>
    <a class="u-url" href="https://example.com/hello-world">
      <time class="dt-published" datetime="2021-01-01T00:00:00Z">January 1, 2021</time>
    </a>
    <p class="e-content">This is a test.</p>
    <p class="p-category">test</p>
    <p class="p-category">example</p>
  </article>`

	const mf2doc = mf2(html, { baseUrl: 'https://example.com' })

	assertEquals(mf2doc.items.length, 1)

	const item = mf2doc.items[0]

	assertEquals(item.type, ['h-entry'])
	assertEquals(item.properties.name, ['Hello, World!'])
	assertEquals(item.properties.url, ['https://example.com/hello-world'])
	assertEquals(item.properties.published, ['2021-01-01T00:00:00Z'])
	assertEquals(item.properties.content, [{
		html: 'This is a test.',
		value: 'This is a test.',
	}])
	assertEquals(item.properties.category, ['test', 'example'])
})

Deno.test('parses an h-feed with children', () => {
	const html = `<!DOCTYPE html>
  <div class="h-feed">
    <h1 class="p-name">My Blog</h1>
    <link class="u-url" href="https://example.com/blog">
    <article class="h-entry">
      <h1 class="p-name">Hello, World!</h1>
      <link class="u-url" href="https://example.com/hello-world">
      <time class="dt-published" datetime="2021-01-01T00:00:00Z">January 1, 2021</time>
      <p class="e-content">This is a test.</p>
    </article>
  </div>`

	const mf2doc = mf2(html, { baseUrl: 'https://example.com' })
	console.log(JSON.stringify(mf2doc, null, 2))

	assertEquals(mf2doc.items.length, 1)

	const feed = mf2doc.items[0]

	assertEquals(feed.type, ['h-feed'])
	assertEquals(feed.properties.name, ['My Blog'])
	assertExists(feed.children)
	assertEquals(feed.children!.length, 1)

	const entry = feed.children![0]

	assertEquals(entry.type, ['h-entry'])
	assertEquals(entry.properties.name, ['Hello, World!'])
	assertEquals(entry.properties.url, ['https://example.com/hello-world'])
	assertEquals(entry.properties.published, ['2021-01-01T00:00:00Z'])
	assertEquals(entry.properties.content, [{
		html: 'This is a test.',
		value: 'This is a test.',
	}])
})

Deno.test('parses p-* properties correctly', () => {
	const html = `<!DOCTYPE html>
  <div class="h-test-structure">
    <p class="p-prop-1">one</p>
    <link class="p-prop-2" href="https://example.com/2" title="two">
    <abbr class="p-prop-3" title="three">3</abbr>
    <data class="p-prop-4" value="four">a third of a dozen</data>
    <img class="p-prop-5" src="https://example.com/5" alt="five">
    <map>
      <area class="p-prop-6" href="https://example.com/6" alt="six">
    </map>
    <meta class="p-prop-7" content="seven">
  </div>`

	const mf2doc = mf2(html, { baseUrl: 'https://example.com' })

	assertEquals(mf2doc.items.length, 1)

	const item = mf2doc.items[0]

	assertEquals(item.type, ['h-test-structure'])
	assertEquals(item.properties['prop-1'], ['one'])
	assertEquals(item.properties['prop-2'], ['two'])
	assertEquals(item.properties['prop-3'], ['three'])
	assertEquals(item.properties['prop-4'], ['four'])
	assertEquals(item.properties['prop-5'], ['five'])
	assertEquals(item.properties['prop-6'], ['six'])
	assertEquals(item.properties['prop-7'], ['seven'])
})

Deno.test('parses u-* properties correctly', () => {
	const html = `<!DOCTYPE html>
  <div class="h-test-structure">
    <a class="u-prop-1" href="https://example.com/1">one</a>
    <area class="u-prop-2" href="https://example.com/2">two</area>
    <link class="u-prop-3" href="https://example.com/3">three</link>
    <img class="u-prop-4" src="https://example.com/4" alt="four">
    <audio class="u-prop-5" src="https://example.com/5">
      <source class="u-prop-6" src="https://example.com/6">
    </audio>
    <iframe class="u-prop-7" src="https://example.com/7"></iframe>
    <video class="u-prop-8" src="https://example.com/8"></video>
    <video class="u-prop-9" poster="https://example.com/9"></video>
    <object class="u-prop-10" data="https://example.com/10"></object>
    <abbr class="u-prop-11" title="eleven">11</abbr>
    <data class="u-prop-12" value="twelve">a dozen</data>
    <input class="u-prop-13" type="url" value="https://example.com/13">
    <meta class="u-prop-14" content="fourteen">
    <span class="u-prop-15">fifteen</span>
  </div>`

	const mf2doc = mf2(html, { baseUrl: 'https://example.com' })

	assertEquals(mf2doc.items.length, 1)

	const item = mf2doc.items[0]

	assertEquals(item.type, ['h-test-structure'])
	assertEquals(item.properties['prop-1'], ['https://example.com/1'])
	assertEquals(item.properties['prop-2'], ['https://example.com/2'])
	assertEquals(item.properties['prop-3'], ['https://example.com/3'])
	assertEquals(item.properties['prop-4'], [{
		value: 'https://example.com/4',
		alt: 'four',
	}])
	assertEquals(item.properties['prop-5'], ['https://example.com/5'])
	assertEquals(item.properties['prop-6'], ['https://example.com/6'])
	assertEquals(item.properties['prop-7'], ['https://example.com/7'])
	assertEquals(item.properties['prop-8'], ['https://example.com/8'])
	assertEquals(item.properties['prop-9'], ['https://example.com/9'])
	assertEquals(item.properties['prop-10'], ['https://example.com/10'])
	assertEquals(item.properties['prop-11'], ['eleven'])
	assertEquals(item.properties['prop-12'], ['twelve'])
	assertEquals(item.properties['prop-13'], ['https://example.com/13'])
	assertEquals(item.properties['prop-14'], ['fourteen'])
	assertEquals(item.properties['prop-15'], ['fifteen'])
})

Deno.test('parses dt-* properties correctly', () => {
	const html = `<!DOCTYPE html>
  <div class="h-test-structure">
    <time class="dt-prop-1" datetime="2021-01-01T00:00:00Z">one</time>
    <ins class="dt-prop-2" datetime="2021-01-02T00:00:00Z">two</ins>
    <del class="dt-prop-3" datetime="2021-01-03T00:00:00Z">three</del>
    <abbr class="dt-prop-4" title="four">4</abbr>
    <data class="dt-prop-5" value="five">a handful</data>
    <input class="dt-prop-6" type="date" value="2021-01-06">
    <meta class="dt-prop-7" content="seven">
    <span class="dt-prop-8">eight</span>
  </div>`

	const mf2doc = mf2(html, { baseUrl: 'https://example.com' })

	assertEquals(mf2doc.items.length, 1)

	const item = mf2doc.items[0]

	assertEquals(item.type, ['h-test-structure'])
	assertEquals(item.properties['prop-1'], ['2021-01-01T00:00:00Z'])
	assertEquals(item.properties['prop-2'], ['2021-01-02T00:00:00Z'])
	assertEquals(item.properties['prop-3'], ['2021-01-03T00:00:00Z'])
	assertEquals(item.properties['prop-4'], ['four'])
	assertEquals(item.properties['prop-5'], ['five'])
	assertEquals(item.properties['prop-6'], ['2021-01-06'])
	assertEquals(item.properties['prop-7'], ['seven'])
	assertEquals(item.properties['prop-8'], ['eight'])
})

Deno.test('parses e-* properties correctly', () => {
	const html = `<!DOCTYPE html>
  <div class="h-test-structure">
    <p class="e-prop-1"><b>one</b></p>
    <p class="e-prop-2" lang=tok><b>tu</b></p>
  </div>`

	const mf2doc = mf2(html, { baseUrl: 'https://example.com' })

	assertEquals(mf2doc.items.length, 1)

	const item = mf2doc.items[0]

	assertEquals(item.type, ['h-test-structure'])
	assertEquals(item.properties['prop-1'], [{
		html: '<b>one</b>',
		value: 'one',
	}])
	assertEquals(item.properties['prop-2'], [{
		html: '<b>tu</b>',
		value: 'tu',
		lang: 'tok',
	}])
})

Deno.test('parses implicit properties of h-card', () => {
	const html = `<!DOCTYPE html>
  <a class="h-card" href="https://example.com">Example</a>`

	const mf2doc = mf2(html, { baseUrl: 'https://example.com' })

	assertEquals(mf2doc.items.length, 1)

	const item = mf2doc.items[0]

	assertEquals(item.type, ['h-card'])
	assertEquals(item.properties.url, ['https://example.com'])
	assertEquals(item.properties.name, ['Example'])
})

Deno.test('parses implicit properties of made-up type', () => {
	const html = `<!DOCTYPE html>
	<a class="h-test-structure" href="https://example.com"
		><img src="https://example.com/photo.jpg"
		>Example</a>`

	const mf2doc = mf2(html, { baseUrl: 'https://example.com' })

	assertEquals(mf2doc.items.length, 1)

	const item = mf2doc.items[0]

	assertEquals(item.type, ['h-test-structure'])
	assertEquals(item.properties.url, ['https://example.com'])
	assertEquals(item.properties.photo, [{
		value: 'https://example.com/photo.jpg',
		alt: '',
	}])
	assertEquals(item.properties.name, ['Example'])
})
