import { Card } from './card.ts'

export class User {
  constructor(
    public username: string,
    public pwhash: string,
    public profile: Card,
  ) {}

  serialize() {
    return {
      ...this,
      profile: this.profile.toMF2Json(),
    }
  }

  static deserialize(json: Record<string, unknown>) {
    return new User(
      String(json.username),
      String(json.pwhash),
      Card.fromMf2Json(json.profile),
    )
  }
}
