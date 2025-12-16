import { Mwbot } from "mwbot-ts"
import dotenv from "dotenv"
import { ServicesProvider } from "./services/services-provider/services-provider"
import { GAMES_TO_CHECK_COUNT } from "./consts/games-to-check-count"


dotenv.config({
    path: [
        './env/maccabipedia-bot-credentials.env'
    ],
    quiet: true
})

const services = new ServicesProvider()
let bot: Mwbot

services.oauth.login().then(async mpBot => {
    bot = mpBot
    services.logger.info('Bot logged in successfully')

    await services.basketGameParser.updateLastGames(GAMES_TO_CHECK_COUNT)
}).catch(error => {
    services.logger.error('Failed to log in bot:', error)
})
