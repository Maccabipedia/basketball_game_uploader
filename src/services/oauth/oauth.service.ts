import * as dotenv from 'dotenv'
import { Mwbot, MwbotInitOptions } from "mwbot-ts"
import { IOauthService } from './oauth.service.interface'
import { ServicesProvider } from '../services-provider/services-provider'
import { BaseService } from '../base.provider'

export class OauthService extends BaseService implements IOauthService {
  constructor(services: ServicesProvider) {
    super(services)
    dotenv.config()
  }

  private _username = process.env.WIKI_USERNAME
  private _password = process.env.WIKI_PASSWORD

  async login(): Promise<Mwbot> {
    const INIT_OPTION: MwbotInitOptions = {
      apiUrl: 'https://www.maccabipedia.co.il/api.php',
      userAgent: 'MaccabiPediaBot/1.0.0',
      credentials: {
        username: this._username || '',
        password: this._password || '',
      }
    }

    try {
      const bot = await Mwbot.init(INIT_OPTION)
      this.services.logger.info(`${this._username} bot initialized (login success)`)
      return bot
    } catch (error) {
      this.services.logger.error('Failed to initialize bot (login fail)', error as Error)
      throw error
    }
  }
}