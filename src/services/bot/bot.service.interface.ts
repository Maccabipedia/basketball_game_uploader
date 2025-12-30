import { ExistencePredicate, Mwbot } from "mwbot-ts"


export interface IBotService {
    bot: Mwbot | null
    getPageExistanceChecker(pageTitles: string[]): Promise<ExistencePredicate | undefined>
    uploadPage(title: string, content: string): Promise<void>
}