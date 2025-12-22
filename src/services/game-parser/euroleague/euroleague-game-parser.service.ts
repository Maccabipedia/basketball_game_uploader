import puppeteer from 'puppeteer'
import { BaseService } from "../../base.provider"
import { ServicesProvider } from "../../services-provider/services-provider"
import { IISExistGame } from "../isexist-game.interface"
import { IEuroleagueGameParser } from "./euroleague-game-parser.service.interface"
import { ENG_TO_HEB_TEAM_NAMES } from '../../../consts/english-to-hebrew-team-names'


export class euroleagueGameParserService extends BaseService implements IEuroleagueGameParser {
    constructor(services: ServicesProvider) {
        super(services)
    }

    SOURCE_URL = 'https://www.euroleaguebasketball.net/en/euroleague/teams/maccabi-rapyd-tel-aviv/games/tel/'


    public async updateLastGames(count: number): Promise<void> {
        try {
            const gamesToCheckExistance = await this._getGamesToCheckExistance(count)
            if (!gamesToCheckExistance) {
                throw new Error('No games to check existance found')
            }

            const gamesExistChecker = await this.services.bot.getPageExistanceChecker(
                gamesToCheckExistance.map(game => game.maccabipediaPageTitle)
            )
            if (!gamesExistChecker) {
                throw new Error('Bot is not available to check games existance')
            }

            gamesToCheckExistance.forEach(async (game: IISExistGame) => {
                if (!gamesExistChecker(game.maccabipediaPageTitle)) {
                    try {
                        this.services.logger.info(`Game ${game.maccabipediaPageTitle} does not exist. Uploading process started.`)
                        // await this._uploadNewGame(game)
                    } catch (error) {
                        this.services.logger.error(`Failed to upload new game: ${game.maccabipediaPageTitle}.`, error as Error)
                    }
                }
            })
        } catch (error) {
            this.services.logger.error(`Failed to update last games from Euroleague.`, error as Error)
        }
    }


    private async _uploadNewGame(game: IISExistGame): Promise<void> {
        return
    }


    private async _getGamesToCheckExistance(count: number): Promise<IISExistGame[] | null> {
        try {
            const browser = await puppeteer.launch({
                headless: true
            })

            const page = await browser.newPage()
            await page.goto(this.SOURCE_URL, {
                waitUntil: 'networkidle2'
            })

            await page.waitForSelector('section[class*="team-results_section"]')

            const elResultsSectionHandler = await page.evaluateHandle(() => {
                const sections = document.querySelectorAll('section[class*="team-results_section"]');

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

                const rawGamesData = await page.evaluate((articles) => {
                    return Array.from(articles).map(article => {
                        const a = Array.from(article.children).find(el => el.tagName.toLowerCase() === 'a')

                        if (!a) {
                            throw new Error('Game link not found in article')
                        }

                        const elsTeamNames = article.querySelectorAll('span.hidden.xl\\:block.font-bold')
                        const homeTeamName = elsTeamNames[0]?.textContent.trim()
                        const awayTeamName = elsTeamNames[1]?.textContent.trim()

                        const elTime = article.querySelector('time')
                        let gameDate = null
                        if (elTime) {
                            const isoString = elTime.getAttribute('datetime')
                            if (isoString) {
                                const date = new Date(isoString)
                                const dd = String(date.getUTCDate()).padStart(2, '0')
                                const mm = String(date.getUTCMonth() + 1).padStart(2, '0')
                                const yyyy = date.getUTCFullYear()
                                gameDate = `${dd}-${mm}-${yyyy}`
                            }
                        }

                        return {
                            scrapeSourceUrl: `https://www.euroleaguebasketball.net/${a.getAttribute('href')}`,
                            homeTeamName,
                            awayTeamName,
                            gameDate
                        }
                    })
                }, elGamesToParseHandlers)

                await browser.close()

                return rawGamesData.map(game => ({
                    scrapeSourceUrl: game.scrapeSourceUrl,
                    maccabipediaPageTitle: `כדורסל:${game.gameDate} ${ENG_TO_HEB_TEAM_NAMES[game.homeTeamName]} נגד ${ENG_TO_HEB_TEAM_NAMES[game.awayTeamName]} - יורוליג`
                }))

            } else {
                throw new Error('Results div not found on the page')
            }
        } catch (error) {
            this.services.logger.error('Error fetching last games URLs:', error as Error)
            return []
        }
    }
} 