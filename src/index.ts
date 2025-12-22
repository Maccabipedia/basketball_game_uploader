import dotenv from "dotenv"
import { ServicesProvider } from "./services/services-provider/services-provider"
import { GAMES_TO_CHECK_COUNT } from "./consts/games-to-check-count"


dotenv.config({
    path: [
        './env/maccabipedia-bot-credentials.env'
    ],
    quiet: true
});+


(async () => {
    const services = new ServicesProvider()
    if (!services.bot.bot) {
        await services.bot.login()
    }

    services.basketGameParser.updateLastGames(GAMES_TO_CHECK_COUNT)

    // services.euroleagueGameParser.updateLastGames(GAMES_TO_CHECK_COUNT)
})()