import { ExistencePredicate, Mwbot } from "mwbot-ts"
import { IBotService } from "./bot.service.interface"
import { BaseService } from "../base.provider"
import { ServicesProvider } from "../services-provider/services-provider"

export class BotService extends BaseService implements IBotService {
    constructor(services: ServicesProvider) {
        super(services)
        this._bot = null
    }

    private _bot: Mwbot | null

    public get bot(): Mwbot | null {
        return this._bot
    }

    public async login() {
        try {
            this._bot = await this.services.oauth.login()
        } catch (error) {
            this.services.logger.error(`Failed to login bot: ${error}`, error as Error)
        }
    }


    public async getPageExistanceChecker(pageTitles: string[]): Promise<ExistencePredicate | undefined> {
        return await this.services.bot.bot?.getExistencePredicate(pageTitles)
    }
}