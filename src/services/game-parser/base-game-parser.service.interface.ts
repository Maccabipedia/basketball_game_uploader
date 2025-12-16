import { IISExistGame } from "./isexist-game.interface"

export interface IBaseGameParser {
    updateLastGames(count: number): Promise<void>
}