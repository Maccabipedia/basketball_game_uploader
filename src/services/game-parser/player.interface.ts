export interface IPlayer {
    name: string | null
    number: number | null
    minuteCount: number | null
    pointCount: number | null
    isStartingFive: boolean
    freeThrowsAttempt: number | null
    freeThrowsScored: number | null
    fieldThrowsAttempt: number | null
    fieldThrowsScored: number | null
    threeThrowsAttempt: number | null
    threeThrowsScored: number | null
    defensiveRebound: number | null
    offensiveRebound: number | null
    foul: number | null
    steal: number | null
    turnover: number | null
    assist: number | null
    block: number | null
    didNotPlayed?: boolean
}