import axios from "axios"
import puppeteer from 'puppeteer'
import { BaseService } from "../../base.provider"
import { ServicesProvider } from "../../services-provider/services-provider"
import { IBasketGameParser } from "./basket-game-parser.service.interface"
import { ENG_TO_HEB_TEAM_NAME_MAP } from "../../../consts/eng-to-heb-team-name-map"
import { BASKET_GAME_TYPE_HEB_NAME } from "../../../consts/basket-game-type-heb-name"
import { IIsExistGameBasket } from "./isexist-game-basket.interface"
import { WIKI_GAME_MACCABI_SCORE_KEYS, WIKI_GAME_OPPONENT_SCORE_KEYS } from "../../../consts/wiki-game-team-score-keys"
import { IPlayer } from "../player.interface"


export class BasketGameParserService extends BaseService implements IBasketGameParser {
    constructor(services: ServicesProvider) {
        super(services)
    }

    SOURCE_URL = 'https://basket.co.il/pbp/json/games_all.json'


    public async updateLastGames(count: number): Promise<void> {
        try {
            const gamesToCheckExistance = await this._getGamesToCheckExistance(count)
            const gamesExistChecker = await this.services.gameParser.getGameExistChecker(gamesToCheckExistance)

            if (!gamesExistChecker) {
                throw new Error('Bot is not available to check games existance')
            }

            await this.services.gameParser.uploadNewGame(gamesToCheckExistance, gamesExistChecker, this._uploadNewGame)
        } catch (error) {
            this.services.logger.error(`Failed to update last games from Basket.`, error as Error)
        }
    }


    private async _uploadNewGame(game: IIsExistGameBasket): Promise<void> {
        const isCiServer = this.services.util.isCiServer
        try {
            const browser = await puppeteer.launch({
                headless: true,
                args: isCiServer ? ['--no-sandbox', '--disable-setuid-sandbox'] : []
            })

            const page = await browser.newPage()
            await page.goto(game.scrapeSourceUrl, {
                waitUntil: 'domcontentloaded'
            })

            const headerData = await page.evaluate(function () {
                const data: { [key: string]: string | string[] | number } = {}

                const container = document.querySelector('#wrap_inner_3')
                if (!container) {
                    throw new Error('No header to scrape data from')
                }

                const elFixtureContainer = container.querySelector('h4')
                if (elFixtureContainer) {
                    const elImg = elFixtureContainer.querySelector('img')

                    if (elImg && elImg.nextSibling && elImg.nextSibling.textContent) {
                        data.fixture = elImg.nextSibling.textContent.trim().replace('סל', '').trim()
                    }
                }

                data.stadium = container.querySelector('h5')?.textContent.split(',')[0].trim() || ''

                const refsContainer = container.querySelector('h6')
                if (refsContainer) {
                    const refsContainerText = refsContainer.textContent.replace(/\s+/g, ' ').trim()

                    const afterJudgesText = refsContainerText.split('שופטים:')[1]

                    if (afterJudgesText) {
                        let refText
                        if (afterJudgesText.indexOf('משקיף:') !== -1) {
                            refText = afterJudgesText.split('משקיף:')[0].trim()
                        } else {
                            refText = afterJudgesText.trim()
                        }

                        const refs = refText.split(',')
                        for (let i = 0; i < refs.length; i++) {
                            refs[i] = refs[i].trim()
                        }

                        data.mainReferee = refs.splice(0, 1)[0] || ''
                        data.assistantReferees = refs
                    }
                }

                const crowdContainer = container.querySelector('h5 div.link-1')?.textContent.split('צופים:')[1].trim()
                if (crowdContainer) data.crowd = +crowdContainer

                return data
            })

            const rawScoreData = await page.evaluate(function () {
                const tables = document.querySelectorAll('table.stats_tbl.categories')
                if (!tables.length) {
                    throw new Error('No score table to scrape data from')
                }

                const rows = tables[0].querySelectorAll('tr')
                if (rows.length < 3) {
                    throw new Error('Not enough rows on score table to scrape data from')
                }

                return Array.from(rows).map(row =>
                    Array.from(row.querySelectorAll('td')).map(td =>
                        td.textContent?.trim() || ''
                    )
                )
            })

            const maccabiRow = game.isMaccabiHomeTeam ? rawScoreData[1] : rawScoreData[2]
            const opponentRow = game.isMaccabiHomeTeam ? rawScoreData[2] : rawScoreData[1]

            const maccabiScores = this.services.gameParser.extractRowScores(maccabiRow)
            const opponentScores = this.services.gameParser.extractRowScores(opponentRow)

            const scoreBlock = this.services.gameParser.appendScoreLines(WIKI_GAME_MACCABI_SCORE_KEYS, maccabiScores)
                + this.services.gameParser.appendScoreLines(WIKI_GAME_OPPONENT_SCORE_KEYS, opponentScores)



            const boxScoreData = await page.evaluate(function (isMaccabiHomeTeam) {
                const data: { [key: string]: string | any[] } = {}

                const tables = document.querySelectorAll('table.stats_tbl')
                if (tables.length < 4) {
                    return data
                }

                const maccabiTable = isMaccabiHomeTeam ? tables[2] : tables[3]
                const opponentTable = isMaccabiHomeTeam ? tables[3] : tables[2]

                function extractCoach(table: Element): string {
                    const links = table.querySelectorAll('tr td a')
                    if (links.length < 2) return ''

                    const text = links[1].textContent || ''
                    const parts = text.split(':')

                    return parts[1] ? parts[1].trim() : ''
                }
                data.maccabiCoach = extractCoach(maccabiTable)
                data.opponentCoach = extractCoach(opponentTable)


                function extractPlayersStats(table: Element): any[] {
                    const players: IPlayer[] = []

                    const rows = table.querySelectorAll('tr')
                    if (!rows.length) return players

                    let startIndex = -1
                    for (let i = 0, seen = 0; i < rows.length; i++) {
                        if (rows[i].classList.contains('row') && ++seen === 2) {
                            startIndex = i
                            break
                        }
                    }

                    if (startIndex === -1) return players

                    for (let i = startIndex; i < rows.length - 1; i++) {
                        const tds = rows[i].querySelectorAll('td')
                        if (tds.length < 21) continue

                        function toInt(text?: string | null): number {
                            const v = text ? parseInt(text.trim(), 10) : NaN
                            return isNaN(v) ? 0 : v
                        }

                        function splitStat(text?: string | null): { a: number; s: number } {
                            if (!text) return { a: 0, s: 0 }
                            const parts = text.split('/')
                            return {
                                s: toInt(parts[0]),
                                a: toInt(parts[1])
                            }
                        }

                        const fg = splitStat(tds[5]?.textContent)
                        const tg = splitStat(tds[7]?.textContent)
                        const ft = splitStat(tds[9]?.textContent)

                        players.push({
                            number: toInt(tds[0].querySelector('a')?.textContent),
                            name: tds[1].querySelector('a')?.textContent?.trim() || '',
                            isStartingFive: !!tds[2].textContent?.trim(),
                            minuteCount: toInt(tds[3].textContent),
                            pointCount: toInt(tds[4].textContent),
                            fieldThrowsAttempt: fg.a,
                            fieldThrowsScored: fg.s,
                            threeThrowsAttempt: tg.a,
                            threeThrowsScored: tg.s,
                            freeThrowsAttempt: ft.a,
                            freeThrowsScored: ft.s,
                            defensiveRebound: toInt(tds[11].textContent),
                            offensiveRebound: toInt(tds[12].textContent),
                            foul: toInt(tds[14].textContent),
                            steal: toInt(tds[16].textContent),
                            turnover: toInt(tds[17].textContent),
                            assist: toInt(tds[18].textContent),
                            block: toInt(tds[19].textContent)
                        })
                    }

                    return players
                }

                data.maccabiPlayersStats = extractPlayersStats(maccabiTable)
                data.opponentPlayersStats = extractPlayersStats(opponentTable)

                return data
            }, game.isMaccabiHomeTeam)


            await browser.close()


            const gameData = this.services.gameParser.parseGameData({
                date: game.date,
                hour: game.hour,
                competition: 'ליגת העל',
                fixture: headerData.fixture as string,
                isMaccabiHomeTeam: game.isMaccabiHomeTeam,
                opponent: game.opponent,
                stadium: headerData.stadium as string,
                maccabiScore: game.isMaccabiHomeTeam ? game.homeTeamScore : game.awayTeamScore,
                opponentScore: game.isMaccabiHomeTeam ? game.awayTeamScore : game.homeTeamScore,
                scoreBlock,
                maccabiCoach: boxScoreData.maccabiCoach as string,
                opponentCoach: boxScoreData.opponentCoach as string,
                mainReferee: headerData.mainReferee as string,
                assistantReferees: headerData.assistantReferees as string[],
                crowd: headerData.crowd as string,
                refernce: `[${game.scrapeSourceUrl} עמוד המשחק באתר מנהלת ליגת העל בכדורסל]`,
                maccabiPlayersStats: this.services.gameParser.parsePlayersArray(boxScoreData.maccabiPlayersStats as IPlayer[]),
                opponentPlayersStats: this.services.gameParser.parsePlayersArray(boxScoreData.opponentPlayersStats as IPlayer[])
            })

            this.services.logger.info(`Game ready to upload: ${gameData}`)
        } catch (error) {
            this.services.logger.error(`Could not scrape game ${game.maccabipediaPageTitle} `, error as Error)
        }
    }


    private async _getGamesToCheckExistance(count: number): Promise<IIsExistGameBasket[]> {
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
                    const home_team = ENG_TO_HEB_TEAM_NAME_MAP[game.team_name_eng_1]
                    const away_team = ENG_TO_HEB_TEAM_NAME_MAP[game.team_name_eng_2]
                    const competition = BASKET_GAME_TYPE_HEB_NAME[game.game_type]

                    return {
                        scrapeSourceUrl: `https://basket.co.il/game-zone.asp?GameId=${game.id}`,
                        maccabipediaPageTitle: `כדורסל:${date} ${home_team} נגד ${away_team} - ${competition}`,
                        date,
                        isMaccabiHomeTeam: home_team === 'מכבי תל אביב' ? true : false,
                        opponent: home_team === 'מכבי תל אביב' ? away_team : home_team,
                        homeTeamScore: game.score_team1,
                        awayTeamScore: game.score_team2,
                        hour: game.game_time
                    }
                })

            this.services.logger.info(
                `Will check existence for these games:\n${JSON.stringify(
                    gamesToCheckExistance.map((game: IIsExistGameBasket) => ({
                        scrapeSourceUrl: game.scrapeSourceUrl,
                        maccabipediaPageTitle: game.maccabipediaPageTitle
                    })),
                    null,
                    2
                )}`
            )

            return gamesToCheckExistance
        } catch (error) {
            this.services.logger.error('Error fetching last games URLs:', error as Error)
            return []
        }
    }
}