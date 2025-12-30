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
            this.services.logger.error(`Failed to login bot.`, error as Error)
        }
    }


    public async getPageExistanceChecker(pageTitles: string[]): Promise<ExistencePredicate | undefined> {
        return await this.services.bot.bot?.getExistencePredicate(pageTitles)
    }


    public async uploadPage(title: string, content: string): Promise<void> {
        try {
            if (!this.bot) throw new Error('Bot not logged in')

            await this.bot.create(title, content)
            this.services.logger.info(`Page created: ${title}`)
        } catch (error) {
            this.services.logger.error(`Failed to upload page.`, error as Error)
        }
    }
}