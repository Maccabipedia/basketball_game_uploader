export interface IPlayer {
    name: string | null
    number: number | null
    minuteCount: number | null
    pointCount: number | null
    isStartingFive: boolean
    freeThrowsAttempts: number | null
    freeThrowsScored: number | null
    fieldThrowsAttempts: number | null
    fieldThrowsScored: number | null
    threeThrowsAttempts: number | null
    threeThrowsScored: number | null
    defensiveRebounds: number | null
    offensiveRebounds: number | null
    personalTotalFouls: number | null
    steals: number | null
    turnovers: number | null
    assists: number | null
    blocks: number | null
    didNotPlayed?: boolean
}