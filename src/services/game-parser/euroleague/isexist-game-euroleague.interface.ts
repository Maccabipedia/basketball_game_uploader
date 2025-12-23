import { IISExistGame } from "../isexist-game.interface"


export interface IIsExistGameEuroleague extends IISExistGame {
    date: string
    hour: string
    isMaccabiHomeTeam: boolean
    opponent: string
    homeTeamScore: string
    awayTeamScore: string
    fixture: string
}