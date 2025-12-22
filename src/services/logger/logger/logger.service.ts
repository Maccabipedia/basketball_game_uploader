import { ILoggerService } from './logger.service.interface'


export class LoggerService implements ILoggerService {
    constructor() {
    }

    private errorIcon = '❌'

    info(message: string): void {
        console.log(`INFO: ${message}`)
    }

    error(message: string, error?: Error): void {
        if (error) {
            console.error(`${this.errorIcon} ERROR: ${message}\n`, error)
        } else {
            console.error(`${this.errorIcon} ERROR: ${message}`)
        }
    }
}
