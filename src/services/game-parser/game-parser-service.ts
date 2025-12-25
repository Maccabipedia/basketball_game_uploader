import { ExistencePredicate } from "mwbot-ts"
import { BaseService } from "../base.provider"
import { ServicesProvider } from "../services-provider/services-provider"
import { IIsExistGameBasket } from "./basket/isexist-game-basket.interface"
import { IGameParserService } from "./game-parser-service.interface"
import { IPlayer } from "./player.interface"
import { IGameData } from "./game-data.interface"
import { IIsExistGameEuroleague } from "./euroleague/isexist-game-euroleague.interface"


export class GameParserService extends BaseService implements IGameParserService {
    constructor(services: ServicesProvider) {
        super(services)
    }

    async getGameExistChecker(games: IIsExistGameBasket[] | IIsExistGameEuroleague[]) {
        const gamesExistChecker = await this.services.bot.getPageExistanceChecker(
            games.map(game => game.maccabipediaPageTitle)
        )
        if (!gamesExistChecker) throw new Error('Bot is not available to check games existance')
        return gamesExistChecker
    }


    async uploadNewGame<T extends IIsExistGameBasket | IIsExistGameEuroleague>(games: T[], gameExistChecker: ExistencePredicate, uploadGame: (game: T) => Promise<void>): Promise<void> {
        games.forEach(async (game: T) => {
            if (!gameExistChecker(game.maccabipediaPageTitle)) {
                try {
                    this.services.logger.info(`Game ${game.maccabipediaPageTitle} does not exist. Uploading process started.`)
                    await uploadGame.bind(this)(game)
                } catch (error) {
                    this.services.logger.error(`Failed to upload new game: ${game.maccabipediaPageTitle}.`, error as Error)
                }
            }
        })
    }


    extractRowScores(cells: string[]): (number | null)[] {
        return cells.slice(1).map(text => {
            const val = parseInt(text.trim(), 10)
            return Number.isNaN(val) ? null : val
        })
    }


    appendScoreLines(keys: string[], scores: (number | null)[]): string {
        let str = ''
        for (let i = 0; i < keys.length; i++) {
            const val = scores[i]
            if (val !== null && val !== undefined) {
                str += `|${keys[i]}=${val}\n`
            }
        }
        return str
    }


    parsePlayer(player: IPlayer) {
        const pointCount = this.services.util.isValidNumber(player.pointCount)
            ? player.pointCount
            : (this.services.util.isValidNumber(player.fieldThrowsScored) ? player.fieldThrowsScored || 0 * 2 : 0)
            + (this.services.util.isValidNumber(player.threeThrowsScored) ? player.threeThrowsScored || 0 * 3 : 0)
            + (this.services.util.isValidNumber(player.freeThrowsScored) ? player.freeThrowsScored || 0 : 0)

        const fields = [
            `שם=${this.services.util.isValidString(player.name) ? player.name : ''}`,
            `מספר=${this.services.util.isValidNumber(player.number) ? player.number : ''}`,
            `דקות=${this.services.util.isValidNumber(player.minuteCount) ? player.minuteCount : ''}`,
            `חמישייה=${player.isStartingFive ? 'כן' : ''}`,
            `נק=${pointCount || ''}`,
            `זריקות עונשין=${this.services.util.isValidNumber(player.freeThrowsAttempt) ? player.freeThrowsAttempt : ''}`,
            `קליעות עונשין=${this.services.util.isValidNumber(player.freeThrowsScored) ? player.freeThrowsScored : ''}`,
            `זריקות שתי נק=${this.services.util.isValidNumber(player.fieldThrowsAttempt) ? player.fieldThrowsAttempt : ''}`,
            `קליעות שתי נק=${this.services.util.isValidNumber(player.fieldThrowsScored) ? player.fieldThrowsScored : ''}`,
            `זריקות שלוש נק=${this.services.util.isValidNumber(player.threeThrowsAttempt) ? player.threeThrowsAttempt : ''}`,
            `קליעות שלוש נק=${this.services.util.isValidNumber(player.threeThrowsScored) ? player.threeThrowsScored : ''}`,
            `ריבאונד הגנה=${this.services.util.isValidNumber(player.defensiveRebound) ? player.defensiveRebound : ''}`,
            `ריבאונד התקפה=${this.services.util.isValidNumber(player.offensiveRebound) ? player.offensiveRebound : ''}`,
            `פאולים=${this.services.util.isValidNumber(player.foul) ? player.foul : ''}`,
            `חטיפות=${this.services.util.isValidNumber(player.steal) ? player.steal : ''}`,
            `איבודים=${this.services.util.isValidNumber(player.turnover) ? player.turnover : ''}`,
            `אסיסטים=${this.services.util.isValidNumber(player.assist) ? player.assist : ''}`,
            `בלוקים=${this.services.util.isValidNumber(player.block) ? player.block : ''}`,
        ]

        if (player.didNotPlayed) fields.push('לא שיחק=כן')

        return `{{אירועי שחקן סל |${fields.join(' |')}}}`
    }


    parsePlayersArray(players: IPlayer[]): string {
        if (!Array.isArray(players) || players.length === 0) return ''

        return players
            .map(this.parsePlayer.bind(this))
            .map((tpl, idx, arr) => idx < arr.length - 1 ? tpl + ',' : tpl)
            .join('\n')
    }


    parseGameData(gameData: IGameData): string {
        return `{{משחק כדורסל
|תאריך המשחק=${gameData.date}
|שעת המשחק=${gameData.hour}
|עונה=2025/26
|מפעל=ליגת העל
|שלב במפעל=${gameData.fixture}
|בית חוץ=${gameData.isMaccabiHomeTeam ? 'בית' : 'חוץ'}
|שם יריבה=${gameData.opponent}
|אולם=${gameData.stadium}
|תוצאת משחק מכבי=${gameData.maccabiScore}
|תוצאת משחק יריבה=${gameData.opponentScore}
${gameData.scoreBlock}
|מאמן מכבי=${gameData.maccabiCoach}
|מאמן יריבה=${gameData.opponentCoach}
|שופט ראשי=${gameData.mainReferee}
|עוזרי שופט=${Array.isArray(gameData.assistantReferees) && gameData.assistantReferees.join(', ')}
|כמות קהל=${gameData.crowd}
|גוף שידור=
|תקציר וידאו=
|תקציר וידאו2=
|משחק מלא=
|משחק מלא2=
|וידאו אוהדים=
|וידאו אוהדים2=
|כתבה1=${gameData.refernce}
|משחק קודם בסדרה=
|משחק הבא בסדרה=
|תוצאה בטכני=
|משחק זכיה=
|סיכום משחק=


|שחקנים מכבי=${gameData.maccabiPlayersStats}

|שחקנים יריבה=${gameData.opponentPlayersStats}
}}`
    }
}