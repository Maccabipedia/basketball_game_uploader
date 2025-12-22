import { ExistencePredicate } from "mwbot-ts"
import { IIsExistGameBasket } from "./basket/isexist-game-basket.interface"
import { IPlayer } from "./player.interface"
import { IGameData } from "./game-data.interface"


export interface IGameParserService {
    getGameExistChecker(games: IIsExistGameBasket[]): Promise<ExistencePredicate | undefined>
    uploadNewGame(games: IIsExistGameBasket[], gameExistChecker: ExistencePredicate, uploadGame: (game: IIsExistGameBasket) => Promise<void>): Promise<void>
    parsePlayer(player: IPlayer): string
    parsePlayersArray(players: IPlayer[]): string
    parseGameData(gameData: IGameData): string
}