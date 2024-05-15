import { assertEquals } from 'https://deno.land/std@0.204.0/assert/mod.ts'
import { parseLinkHeader } from '../../lib/common/parse-link-header.ts'

Deno.test('parses a single, simple link', () => {
	const header = '<https://example.com>'
	const parsed = parseLinkHeader(header)
	assertEquals(parsed, [{ uri: 'https://example.com' }])
})

Deno.test('parses a single, simple link with whitespace', () => {
	const header = '  <https://example.com>  '
	const parsed = parseLinkHeader(header)
	assertEquals(parsed, [{ uri: 'https://example.com' }])
})

Deno.test('parses a single link with a rel attribute', () => {
	const header = '<https://example.com>; rel="alternate"'
	const parsed = parseLinkHeader(header)
	assertEquals(parsed, [{ uri: 'https://example.com', rel: 'alternate' }])
})

Deno.test('parses a single link with a title attribute', () => {
	const header = '<https://example.com>; title="Test"'
	const parsed = parseLinkHeader(header)
	assertEquals(parsed, [{ uri: 'https://example.com', title: 'Test' }])
})

Deno.test('parses a single link with multiple attributes', () => {
	const header = '<https://example.com>; rel="alternate"; title="Test"'
	const parsed = parseLinkHeader(header)
	assertEquals(parsed, [{
		uri: 'https://example.com',
		rel: 'alternate',
		title: 'Test',
	}])
})

Deno.test('parses multiple links', () => {
	const header = '<https://example.com>; rel="alternate"; title="Test",\
    <https://example.org>; rel="canonical"; title="Test"'
	const parsed = parseLinkHeader(header)
	assertEquals(parsed, [
		{
			uri: 'https://example.com',
			rel: 'alternate',
			title: 'Test',
		},
		{
			uri: 'https://example.org',
			rel: 'canonical',
			title: 'Test',
		},
	])
})

Deno.test('parses multiple links with whitespace', () => {
	const header = '  <https://example.com>; rel="alternate"; title="Test",\
    <https://example.org>; rel="canonical"; title="Example"  '
	const parsed = parseLinkHeader(header)
	assertEquals(parsed, [
		{
			uri: 'https://example.com',
			rel: 'alternate',
			title: 'Test',
		},
		{
			uri: 'https://example.org',
			rel: 'canonical',
			title: 'Example',
		},
	])
})

Deno.test('parses a link with a quoted title', () => {
	const header = String.raw`<https://example.com>; title="Test \"Title\""`
	const parsed = parseLinkHeader(header)
	console.log(parsed)
	assertEquals(parsed, [{ uri: 'https://example.com', title: 'Test "Title"' }])
})

Deno.test('parses a link with an unquoted title', () => {
	const header = '<https://example.com>; title=Test'
	const parsed = parseLinkHeader(header)
	assertEquals(parsed, [{ uri: 'https://example.com', title: 'Test' }])
})

Deno.test('parses a link with unquoted title and rel attribute', () => {
	const header = '<https://example.com>; title=Test; rel=alternate'
	const parsed = parseLinkHeader(header)
	assertEquals(parsed, [{
		uri: 'https://example.com',
		title: 'Test',
		rel: 'alternate',
	}])
})
