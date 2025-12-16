import { BasketGameParserService } from "../game-parser/basket/basket-game-parser.service"
import { LoggerService } from "../logger/logger/logger.service"
import { OauthService } from "../oauth/oauth.service"

export class ServicesProvider {
    constructor() {
        this.logger = new LoggerService()
        this.oauth = new OauthService(this)
        this.basketGameParser = new BasketGameParserService(this)
    }

    logger: LoggerService
    oauth: OauthService
    basketGameParser: BasketGameParserService
}