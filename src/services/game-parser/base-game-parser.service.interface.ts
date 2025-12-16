export interface IBaseGameParser {
    updateLastGames(count: number): Promise<void>
}