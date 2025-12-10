import { LoggerService } from "../logger/logger/logger.service"
import { OauthService } from "../oauth/oauth.service"

export class ServicesProvider {
    constructor() {
        this.logger = new LoggerService()
        this.oauth = new OauthService(this)
    }

    logger: LoggerService
    oauth: OauthService
}