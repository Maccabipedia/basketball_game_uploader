import puppeteer from 'puppeteer'
import { BaseService } from "../../base.provider"
import { ServicesProvider } from "../../services-provider/services-provider"
import { IISExistGame } from "../isexist-game.interface"
import { IEuroleagueGameParser } from "./euroleague-game-parser.service.interface"
import { ENG_TO_HEB_TEAM_NAMES } from '../../../consts/english-to-hebrew-team-names'
import { IIsExistGameEuroleague } from './isexist-game-euroleague.interface'


export class euroleagueGameParserService extends BaseService implements IEuroleagueGameParser {
    constructor(services: ServicesProvider) {
        super(services)
    }

    SOURCE_URL = 'https://www.euroleaguebasketball.net/en/euroleague/teams/maccabi-rapyd-tel-aviv/games/tel/'


    public async updateLastGames(count: number): Promise<void> {
        try {
            const gamesToCheckExistance = await this._getGamesToCheckExistance(count)
            const gamesExistChecker = await this.services.gameParser.getGameExistChecker(gamesToCheckExistance)

            if (!gamesExistChecker) {
                throw new Error('Bot is not available to check games existance')
            }

            await this.services.gameParser.uploadNewGame(gamesToCheckExistance, gamesExistChecker, this._uploadNewGame)
        } catch (error) {
            this.services.logger.error(`Failed to update last games from Euroleague.`, error as Error)
        }
    }


    private async _uploadNewGame(game: IIsExistGameEuroleague): Promise<void> {
        return
    }


    private async _getGamesToCheckExistance(count: number): Promise<IIsExistGameEuroleague[]> {
        const isCiServer = this.services.util.isCiServer
        try {
            const browser = await puppeteer.launch({
                headless: true,
                args: isCiServer ? ['--no-sandbox', '--disable-setuid-sandbox'] : []
            })

            const page = await browser.newPage()
            await page.goto(this.SOURCE_URL, {
                waitUntil: 'networkidle2'
            })

            await page.waitForSelector('section[class*="team-results_section"]')

            const elResultsSectionHandler = await page.evaluateHandle(() => {
                const sections = document.querySelectorAll('section[class*="team-results_section"]')

                for (const section of sections) {
                    const divs = section.querySelectorAll('div')
                    for (const div of divs) {
                        const h2 = div.querySelector('h2')
                        if (h2 && h2.textContent.trim().toLowerCase() === 'results') {
                            return div
                        }
                    }
                }

                return null
            })

            const elResultsSection = elResultsSectionHandler.asElement()

            if (elResultsSection) {
                this.services.logger.info('Got results div at Euroleague successfully, starting to parse games')

                const elGamesToParseHandlers = await page.evaluateHandle((el, count) => {
                    if (!(el instanceof HTMLElement)) return []
                    const articles = el.querySelectorAll('article')
                    return Array.from(articles).slice(0, count)
                }, elResultsSection, count)

                const rawGamesData = await page.evaluate((articles, ENG_TO_HEB_TEAM_NAMES) => {
                    return Array.from(articles).map(article => {
                        const a = Array.from(article.children).find(el => el.tagName.toLowerCase() === 'a')

                        if (!a) throw new Error('Game link not found in article')

                        const elsTeamNames = article.querySelectorAll('span.hidden.xl\\:block.font-bold')
                        const homeTeamName = elsTeamNames[0]?.textContent.trim()
                        const awayTeamName = elsTeamNames[1]?.textContent.trim()

                        const elTime = article.querySelector('time')
                        let gameDate = ''
                        let hour = ''
                        if (elTime) {
                            const isoString = elTime.getAttribute('datetime')
                            if (isoString) {
                                const date = new Date(isoString)
                                const dd = String(date.getUTCDate()).padStart(2, '0')
                                const mm = String(date.getUTCMonth() + 1).padStart(2, '0')
                                const yyyy = date.getUTCFullYear()
                                gameDate = `${dd}-${mm}-${yyyy}`

                                const hh = String(date.getHours()).padStart(2, '0')
                                const hmm = String(date.getMinutes()).padStart(2, '0')
                                hour = `${hh}:${hmm}`
                            }
                        }

                        const elRoundContainer = article.querySelector('div.hidden.lg\\:flex.flex-col.gap-4.justify-center')
                        const elRoundText = elRoundContainer?.querySelector('div.text-xs.text-gray-400')
                        const roundTextParts = elRoundText?.textContent.split('Round')
                        const fixture = roundTextParts ? roundTextParts[1]?.trim() || '' : ''

                        const elScoreContainer = article.querySelector('div.border-green-500.border.text-2xl.overflow-hidden.rounded-lg.font-bold.grid.grid-cols-2')
                        const elScoreSpans = elScoreContainer?.querySelectorAll(':scope > span')
                        const gameScore = (elScoreSpans && elScoreSpans.length > 1) ? {
                            homeTeamScore: elScoreSpans[0]?.textContent?.trim(),
                            awayTeamScore: elScoreSpans[1]?.textContent?.trim(),
                        } : {}


                        return {
                            scrapeSourceUrl: `https://www.euroleaguebasketball.net/${a.getAttribute('href')}`,
                            homeTeamName,
                            awayTeamName,
                            gameDate,
                            hour,
                            isMaccabiHomeTeam: ENG_TO_HEB_TEAM_NAMES[homeTeamName] === 'מכבי תל אביב' ? true : false,
                            homeTeamScore: gameScore.homeTeamScore || '',
                            awayTeamScore: gameScore.awayTeamScore || '',
                            fixture
                        }
                    })
                }, elGamesToParseHandlers, ENG_TO_HEB_TEAM_NAMES)

                await browser.close()

                const gamesToCheckExistance = rawGamesData.map(game => ({
                    scrapeSourceUrl: game.scrapeSourceUrl,
                    maccabipediaPageTitle: `כדורסל:${game.gameDate} ${ENG_TO_HEB_TEAM_NAMES[game.homeTeamName]} נגד ${ENG_TO_HEB_TEAM_NAMES[game.awayTeamName]} - יורוליג`,
                    date: game.gameDate,
                    hour: game.hour,
                    isMaccabiHomeTeam: game.isMaccabiHomeTeam,
                    opponent: game.isMaccabiHomeTeam ? game.awayTeamName : game.homeTeamName,
                    homeTeamScore: game.homeTeamScore,
                    awayTeamScore: game.awayTeamScore,
                    fixture: game.fixture
                }))

                this.services.logger.info(
                    `Will check existence for these games:\n${JSON.stringify(
                        gamesToCheckExistance.map((game: IIsExistGameEuroleague) => ({
                            scrapeSourceUrl: game.scrapeSourceUrl,
                            maccabipediaPageTitle: game.maccabipediaPageTitle
                        })),
                        null,
                        2
                    )}`
                )

                return gamesToCheckExistance
            } else {
                throw new Error('Results div not found on the page')
            }
        } catch (error) {
            this.services.logger.error('Error fetching last games URLs:', error as Error)
            return []
        }
    }
} 