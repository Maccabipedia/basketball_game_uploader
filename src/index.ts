import { Mwbot } from "mwbot-ts"
import dotenv from "dotenv"
import { ServicesProvider } from "./services/services-provider/services-provider"


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
}).catch(error => {
    services.logger.error('Failed to log in bot:', error)
})
