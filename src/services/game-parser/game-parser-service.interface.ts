import { ExistencePredicate } from "mwbot-ts"
import { IIsExistGameBasket } from "./basket/isexist-game-basket.interface"
import { IPlayer } from "./player.interface"
import { IGameData } from "./game-data.interface"
import { IIsExistGameEuroleague } from "./euroleague/isexist-game-euroleague.interface"


export interface IGameParserService {
    getGameExistChecker(games: IIsExistGameBasket[] | IIsExistGameEuroleague[]): Promise<ExistencePredicate | undefined>
    uploadNewGame<T extends IIsExistGameBasket | IIsExistGameEuroleague>(games: T[], gameExistChecker: ExistencePredicate, uploadGame: (game: T) => Promise<void>): Promise<void>
    extractRowScores(cells: string[]): (number | null)[]
    appendScoreLines(keys: string[], scores: (number | null)[]): string
    parsePlayer(player: IPlayer): string
    parsePlayersArray(players: IPlayer[]): string
    parseGameData(gameData: IGameData): string
}