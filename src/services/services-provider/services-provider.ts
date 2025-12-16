import { BotService } from "../bot/bot.service"
import { BasketGameParserService } from "../game-parser/basket/basket-game-parser.service"
import { euroleagueGameParserService } from "../game-parser/euroleague/euroleague-game-parser.service"
import { LoggerService } from "../logger/logger/logger.service"
import { OauthService } from "../oauth/oauth.service"

export class ServicesProvider {
    constructor() {
        this.logger = new LoggerService()
        this.oauth = new OauthService(this)
        this.bot = new BotService(this)
        this.basketGameParser = new BasketGameParserService(this)
        this.euroleagueGameParser = new euroleagueGameParserService(this)
    }

    logger: LoggerService
    oauth: OauthService
    bot: BotService
    basketGameParser: BasketGameParserService
    euroleagueGameParser: euroleagueGameParserService
}