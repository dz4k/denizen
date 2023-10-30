/** @jsx hono.jsx */
/** @jsxFrag hono.fragment */

import * as hono from '../../deps/hono.ts'

import { Card } from '../model.ts'

export const Face = ({ card, link }: { card: Card; link?: string | URL }) => (
	<a href={link}>
		<img
			src={card.photo[0] ?? makeProfileSvg(card)}
			alt={card.name}
			title={card.name}
			class='face'
		/>
	</a>
)

export const makeProfileSvg = (card: Card) => {
	const rand = Math.random()
	const hue = rand * 360
	const svg = `
    <svg xmlns="http://www.w3.org/2000/svg"
      viewBox="0 0 20 20">
      <defs>
        <linearGradient id="bgGradient" gradientTransform="rotate(90)">
          <stop stop-color="hsl(${hue},  70%, 40%)" offset="0%" />
          <stop stop-color="hsl(${hue}, 100%, 20%)" offset="100%" />
        </linearGradient>
      </defs>
      <rect x="0" y="0" width="20" height="20" fill="url(#bgGradient)" />
      <text
        x="10"
        y="10"
        dominant-baseline="middle"
        text-anchor="middle"
        font-family="sans-serif"
        font-size="10"
        font-weight="bold"
        fill="white">${initials(card)}</text>
    </svg>
  `
	return `data:image/svg+xml,${encodeURIComponent(svg)}`
}

const initials = (card: Card) => {
	const name = card.name ?? card.uid?.hostname ?? card.url[0]?.hostname ?? ''
	const words = name.split(/\W+/g)
	if (words.length <= 1) return words[0].slice(0, 2)
	else return words[0][0] + words[1][0]
}
