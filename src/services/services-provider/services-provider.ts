import { BotService } from "../bot/bot.service"
import { BasketGameParserService } from "../game-parser/basket/basket-game-parser.service"
import { euroleagueGameParserService } from "../game-parser/euroleague/euroleague-game-parser.service"
import { GameParserService } from "../game-parser/game-parser-service"
import { IGameParserService } from "../game-parser/game-parser-service.interface"
import { LoggerService } from "../logger/logger/logger.service"
import { OauthService } from "../oauth/oauth.service"
import { UtilService } from "../util/util.service"


export class ServicesProvider {
    constructor() {
        this.logger = new LoggerService()
        this.util = new UtilService(this)
        this.oauth = new OauthService(this)
        this.bot = new BotService(this)
        this.gameParser = new GameParserService(this)
        this.basketGameParser = new BasketGameParserService(this)
        this.euroleagueGameParser = new euroleagueGameParserService(this)
    }

    logger: LoggerService
    util: UtilService
    oauth: OauthService
    bot: BotService
    gameParser: IGameParserService
    basketGameParser: BasketGameParserService
    euroleagueGameParser: euroleagueGameParserService
}