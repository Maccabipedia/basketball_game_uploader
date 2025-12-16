import axios from "axios"
import { BaseService } from "../../base.provider"
import { ServicesProvider } from "../../services-provider/services-provider"
import { IISExistGame } from "../isexist-game.interface"
import { IBasketGameParser } from "./basket-game-parser.service.interface"
import { ENG_TO_HEB_TEAM_NAMES } from "../../../consts/english-to-hebrew-team-names"
import { BASKET_GAME_TYPE_HEB_NAME } from "../../../consts/basket-game-type-heb-name"


export class BasketGameParserService extends BaseService implements IBasketGameParser {
    constructor(services: ServicesProvider) {
        super(services)
    }

    SOURCE_URL = 'https://basket.co.il/pbp/json/games_all.json'

    public async updateLastGames(count: number): Promise<void> {
        const gamesToCheckExistance = await this._getGamesToCheckExistance(count)

        return
    }


    private async _getGamesToCheckExistance(count: number): Promise<IISExistGame[]> {
        try {
            const response = await axios.get(this.SOURCE_URL)

            this.services.logger.info('Fetched last games data from Basket.co.il successfully')
            const games = response.data[0].games

            const maccabiGames = games.filter((game: any) => {
                return game.team_name_eng_1 === 'Maccabi Tel-Aviv' || game.team_name_eng_2 === 'Maccabi Tel-Aviv'
            })

            const endedGames = maccabiGames.filter((game: any) => {
                return game.score_team1 && game.score_team2
            })

            this.services.logger.info(`Found ${endedGames.length} Maccabi games with results`)

            const sortedGamesByEndDate = endedGames.sort((a: any, b: any) => {
                var pa = a.game_date_txt.split('/')
                var pb = b.game_date_txt.split('/')

                return new Date(pb[2], pb[1] - 1, pb[0]).getTime() -
                    new Date(pa[2], pa[1] - 1, pa[0]).getTime()
            })

            const gamesToCheckExistance = sortedGamesByEndDate
                .slice(0, count)
                .map((game: any) => {
                    const date = game.game_date_txt.replace(/\//g, '-')
                    const home_team = ENG_TO_HEB_TEAM_NAMES[game.team_name_eng_1]
                    const away_team = ENG_TO_HEB_TEAM_NAMES[game.team_name_eng_2]
                    const competition = BASKET_GAME_TYPE_HEB_NAME[game.game_type]

                    return {
                        scrapeSourceUrl: `https://basket.co.il/game-zone.asp?GameId=${game.id}`,
                        maccabipediaPageTitle: `כדורסל: ${date} ${home_team} נגד ${away_team} - ${competition}`
                    }
                })

            this.services.logger.info(`Will check existance for those games: \n 
                ${JSON.stringify(gamesToCheckExistance, null, 2)}`)

            const notExistGames = gamesToCheckExistance.filter((game: IISExistGame) => {
                return true
            })

            return notExistGames
        } catch (error) {
            this.services.logger.error('Error fetching last games URLs:', error as Error)
            return []
        }
    }
}