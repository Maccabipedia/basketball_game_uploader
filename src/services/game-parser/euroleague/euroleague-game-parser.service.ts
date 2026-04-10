import puppeteer from 'puppeteer'
import { BaseService } from "../../base.provider"
import { ServicesProvider } from "../../services-provider/services-provider"
import { IEuroleagueGameParser } from "./euroleague-game-parser.service.interface"
import { ENG_TO_HEB_TEAM_NAME_MAP } from '../../../consts/eng-to-heb-team-name-map'
import { IIsExistGameEuroleague } from './isexist-game-euroleague.interface'
import { WIKI_GAME_MACCABI_SCORE_KEYS, WIKI_GAME_OPPONENT_SCORE_KEYS } from '../../../consts/wiki-game-team-score-keys'
import { ENG_TO_HEB_STADIUM_NAME_MAP } from '../../../consts/eng-to-heb-stadium-name-map'
import { IPlayer } from '../player.interface'
import { ENG_TO_HEB_PERSON_NAME_MAP } from '../../../consts/eng-to-heb-person-name-map'


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


            const rawScoreData = await page.evaluate(function () {
                const table = document.querySelector('table.relative.shadow-regular.w-full.m-auto.xl\\:h-full')
                if (!table) {
                    throw new Error('No score table to scrape data from')
                }

                const rows = table.querySelectorAll('tbody tr') as NodeListOf<HTMLTableRowElement>
                if (rows.length < 2) {
                    throw new Error('Not enough rows on score table to scrape data from')
                }

                return Array.from(rows).map(row =>
                    Array.from(row.querySelectorAll('td')).map(td =>
                        td.textContent?.trim() || ''
                    )
                )
            })

            const maccabiRow = game.isMaccabiHomeTeam ? rawScoreData[0] : rawScoreData[1]
            const opponentRow = game.isMaccabiHomeTeam ? rawScoreData[1] : rawScoreData[0]

            const maccabiScores = this.services.gameParser.extractRowScores(maccabiRow)
            const opponentScores = this.services.gameParser.extractRowScores(opponentRow)

            const scoreBlock = this.services.gameParser.appendScoreLines(WIKI_GAME_MACCABI_SCORE_KEYS, maccabiScores)
                + this.services.gameParser.appendScoreLines(WIKI_GAME_OPPONENT_SCORE_KEYS, opponentScores)


            const matchInfoData = await page.evaluate(function () {
                const elsH3 = Array.from(document.querySelectorAll('h3'))
                const matchInfoHeader = elsH3.find(h =>
                    h.textContent?.trim().includes('Match Information')
                )

                if (!matchInfoHeader) {
                    throw new Error('Cannot scrape match info data')
                }

                const elsSiblingsDiv: Element[] = []
                let current = matchInfoHeader.nextElementSibling

                while (current && elsSiblingsDiv.length < 3) {
                    elsSiblingsDiv.push(current)
                    current = current.nextElementSibling
                }

                const getValueFromSibling = (el?: Element) =>
                    el?.querySelector('div.text-base.font-medium')?.textContent?.trim() || ''

                return elsSiblingsDiv.length < 3
                    ? {
                        stadium: getValueFromSibling(elsSiblingsDiv[0]),
                        referees: getValueFromSibling(elsSiblingsDiv[1])
                    }
                    : {
                        stadium: getValueFromSibling(elsSiblingsDiv[0]),
                        crowd: getValueFromSibling(elsSiblingsDiv[1]),
                        referees: getValueFromSibling(elsSiblingsDiv[2])
                    }
            })

            const referees = matchInfoData.referees.split(',')
            const mainReferee = ENG_TO_HEB_PERSON_NAME_MAP[referees[0]] || referees[0]
            const assistantReferees = referees.slice(1).map(ref => ENG_TO_HEB_PERSON_NAME_MAP[ref.trim()] || ref.trim())


            await page.goto(`${game.scrapeSourceUrl}#box-score`, {
                waitUntil: 'domcontentloaded'
            })

            const boxScoreData = await page.evaluate((isMaccabiHomeTeam, ENG_TO_HEB_PERSON_NAME_MAP) => {
                const root = document.querySelector('div.max-w-full.w-game-center-content.mx-auto.flex.flex-col.gap-4.lg\\:gap-8')

                if (!root) {
                    throw new Error('Game center root not found')
                }

                const homeContainer = root.querySelector('div.relative.block')
                const awayContainer = root.querySelector('div.hidden.relative')

                if (!homeContainer || !awayContainer) {
                    throw new Error('Home or Away container not found')
                }

                function scrapeCoach(container: Element): string {
                    return container.querySelector(
                        'div.flex.p-3.lg\\:p-6.gap-3.lg\\:gap-6.items-center.border-b.border-gray ' +
                        'div.text-secondary.text-base.font-normal.flex.gap-1 ' +
                        'div.flex.gap-1 span'
                    )?.textContent?.trim() || ''
                }

                const homeCoach = scrapeCoach(homeContainer)
                const awayCoach = scrapeCoach(awayContainer)


                function normalizePlayerNameFromHref(href: string): string {
                    const match = href.match(/players\/([^/]+)\//)
                    if (!match) return ''

                    return match[1]
                        .split('-')
                        .map(w => w.charAt(0).toUpperCase() + w.slice(1))
                        .join(' ')
                }

                function scrapePlayers(container: Element) {
                    const players: IPlayer[] = []
                    const identityTable = container.querySelector('table')
                    const identityRows = identityTable?.querySelectorAll('tbody tr')

                    if (!identityRows || identityRows.length < 3) return players

                    const validIdentityRows = Array.from(identityRows).slice(0, -2)

                    for (const row of validIdentityRows) {
                        const player: any = {}

                        const infoDiv = row.querySelector('div.flex.w-full.gap-1')
                        if (!infoDiv) continue

                        // number
                        const numberSpan = infoDiv.querySelector(':scope > span')
                        const numberText = numberSpan?.textContent?.trim()
                        player.number = numberText ? parseInt(numberText, 10) : null

                        // name
                        const anchor = infoDiv.querySelector('a')
                        const normalizedName = normalizePlayerNameFromHref(anchor?.getAttribute('href')!)
                        player.name = anchor?.getAttribute('href')
                            ? ENG_TO_HEB_PERSON_NAME_MAP[normalizedName] || normalizedName
                            : ''

                        // starting five
                        player.isStartingFive = Array.from(infoDiv.querySelectorAll('a span'))
                            .some(span => span.textContent?.trim() === '*')

                        players.push(player)
                    }

                    const statsWrapper = container.querySelector(
                        'div.grid.grid-cols-\\[auto\\,1fr\\].w-full.border-b.border-gray ' +
                        'div.flex.w-full.overflow-x-auto'
                    )

                    if (!statsWrapper) return players

                    const statTables = Array.from(
                        statsWrapper.querySelectorAll(':scope > div table')
                    )

                    function validRowsFromTable(table?: Element) {
                        const rows = table?.querySelectorAll('tbody tr')
                        return rows ? Array.from(rows).slice(0, -2) : []
                    }

                    validRowsFromTable(statTables[0]).forEach((row, i) => {
                        const tds = row.querySelectorAll('td')
                        const player = players[i]
                        if (!player || tds.length < 2) return

                        const time = tds[0].textContent?.trim() || ''
                        if (time === '00:00') {
                            player.didNotPlayed = true
                            player.minuteCount = 0
                        } else {
                            const [mm, ss] = time.split(':').map(v => parseInt(v, 10))
                            if (!isNaN(mm)) {
                                player.minuteCount = ss > 0 ? mm + 1 : mm
                            }
                        }

                        player.pointCount = parseInt(tds[1].textContent || '0', 10)
                    })

                    validRowsFromTable(statTables[1]).forEach((row, i) => {
                        const td = row.querySelector('td')
                        const player = players[i]
                        if (!player || !td) return

                        const [s, a] = td.textContent!.split('/').map(v => parseInt(v, 10))
                        player.fieldThrowsAttempt = a
                        player.fieldThrowsScored = s
                    })

                    validRowsFromTable(statTables[2]).forEach((row, i) => {
                        const td = row.querySelector('td')
                        const player = players[i]
                        if (!player || !td) return

                        const [s, a] = td.textContent!.split('/').map(v => parseInt(v, 10))
                        player.threeThrowsAttempt = a
                        player.threeThrowsScored = s
                    })

                    validRowsFromTable(statTables[3]).forEach((row, i) => {
                        const td = row.querySelector('td')
                        const player = players[i]
                        if (!player || !td) return

                        const [s, a] = td.textContent!.split('/').map(v => parseInt(v, 10))
                        player.freeThrowsAttempt = a
                        player.freeThrowsScored = s
                    })

                    validRowsFromTable(statTables[4]).forEach((row, i) => {
                        const tds = row.querySelectorAll('td')
                        const player = players[i]
                        if (!player || tds.length < 2) return

                        player.offensiveRebound = parseInt(tds[0].textContent || '0', 10)
                        player.defensiveRebound = parseInt(tds[1].textContent || '0', 10)
                    })

                    validRowsFromTable(statTables[5]).forEach((row, i) => {
                        const tds = row.querySelectorAll('td')
                        const player = players[i]
                        if (!player || tds.length < 3) return

                        player.assist = parseInt(tds[0].textContent || '0', 10)
                        player.steal = parseInt(tds[1].textContent || '0', 10)
                        player.turnover = parseInt(tds[2].textContent || '0', 10)
                    })

                    validRowsFromTable(statTables[6]).forEach((row, i) => {
                        const td = row.querySelector('td')
                        const player = players[i]
                        if (!player || !td) return

                        player.block = parseInt(td.textContent || '0', 10)
                    })

                    validRowsFromTable(statTables[7]).forEach((row, i) => {
                        const td = row.querySelector('td')
                        const player = players[i]
                        if (!player || !td) return

                        player.foul = parseInt(td.textContent || '0', 10)
                    })

                    return players
                }

                const homePlayers = scrapePlayers(homeContainer)
                const awayPlayers = scrapePlayers(awayContainer)

                return {
                    maccabiCoach: isMaccabiHomeTeam ? homeCoach : awayCoach,
                    opponentCoach: isMaccabiHomeTeam ? awayCoach : homeCoach,
                    maccabiPlayersStats: isMaccabiHomeTeam ? homePlayers : awayPlayers,
                    opponentPlayersStats: isMaccabiHomeTeam ? awayPlayers : homePlayers
                }

            }, game.isMaccabiHomeTeam, ENG_TO_HEB_PERSON_NAME_MAP)


            await browser.close()


            const gameData = this.services.gameParser.parseGameData({
                date: game.date,
                hour: game.hour,
                competition: 'יורוליג',
                fixture: this.services.util.isValidNumber(+game.fixture) ? `מחזור ${game.fixture}` : '',
                isMaccabiHomeTeam: game.isMaccabiHomeTeam,
                opponent: ENG_TO_HEB_TEAM_NAME_MAP[game.opponent],
                stadium: ENG_TO_HEB_STADIUM_NAME_MAP[matchInfoData.stadium] || matchInfoData.stadium,
                maccabiScore: game.isMaccabiHomeTeam ? +game.homeTeamScore : +game.awayTeamScore,
                opponentScore: game.isMaccabiHomeTeam ? +game.awayTeamScore : +game.homeTeamScore,
                scoreBlock,
                maccabiCoach: ENG_TO_HEB_PERSON_NAME_MAP[boxScoreData.maccabiCoach] || boxScoreData.maccabiCoach,
                opponentCoach: ENG_TO_HEB_PERSON_NAME_MAP[boxScoreData.opponentCoach] || boxScoreData.opponentCoach,
                mainReferee,
                assistantReferees,
                crowd: matchInfoData?.crowd?.replace(',', '') || '',
                refernce: `[${game.scrapeSourceUrl} עמוד המשחק באתר היורוליג]`,
                maccabiPlayersStats: this.services.gameParser.parsePlayersArray(boxScoreData.maccabiPlayersStats as IPlayer[]),
                opponentPlayersStats: this.services.gameParser.parsePlayersArray(boxScoreData.opponentPlayersStats as IPlayer[])
            })

            this.services.logger.info(`Game ready to upload: ${gameData}`)

            this.services.bot.uploadPage(game.maccabipediaPageTitle, gameData)
        } catch (error) {
            this.services.logger.error(`Could not scrape game ${game.maccabipediaPageTitle} `, error as Error)
        }
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
                }, elGamesToParseHandlers, ENG_TO_HEB_TEAM_NAME_MAP)

                await browser.close()

                const gamesToCheckExistance = rawGamesData.map(game => ({
                    scrapeSourceUrl: game.scrapeSourceUrl,
                    maccabipediaPageTitle: `כדורסל:${game.gameDate} ${ENG_TO_HEB_TEAM_NAME_MAP[game.homeTeamName]} נגד ${ENG_TO_HEB_TEAM_NAME_MAP[game.awayTeamName]} - יורוליג`,
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