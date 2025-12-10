import { Mwbot } from "mwbot-ts"

export interface IOauthService {
    login(): Promise<Mwbot>;
}