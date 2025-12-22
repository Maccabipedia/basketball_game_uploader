import { IISExistGame } from "../isexist-game.interface"


export interface IIsExistGameBasket extends IISExistGame {
    date: string
    isMaccabiHomeTeam: boolean
    opponent: string
    homeTeamScore: number
    awayTeamScore: number
    hour: string
}