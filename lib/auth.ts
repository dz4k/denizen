import { Card } from "./model.ts"
import * as bcrypt from "../deps/bcrypt.ts"
import { createUser, getUser } from "./db.ts"

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
            Card.fromMf2Json(json.profile)
        )
    }
}

const genSalt = bcrypt.genSalt
const hashPW = (pw: string, salt: string) => bcrypt.hash(pw, salt)
const checkPW = (pw: string, hash: string) => bcrypt.compare(pw, hash)

export const signup = async (username: string, pw: string, card: Card) => {
    const salt = await genSalt()
    const user = new User(username, await hashPW(pw, salt), card)
    await createUser(user)
}

export const login = async (username: string, pw: string): Promise<User | null> => {
    const user = await getUser(username)
    if (await checkPW(pw, user.pwhash)) return user
    else return null
}
