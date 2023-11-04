import { Post } from './post.ts'

export type WMResponseType = 'repost' | 'like' | 'reply' | 'mention'

export class Webmention {
	constructor(
		public source: string,
		public target: string,
		public responseType: WMResponseType,
		public content: Post,
	) {}

	serialize() {
		return {
			...this,
			content: this.content.toMF2Json(),
		}
	}

	static deserialize(obj: Record<string, unknown>) {
		return new Webmention(
			obj.source as string,
			obj.target as string,
			obj.responseType as WMResponseType,
			Post.fromMF2Json(obj.content),
		)
	}
}
