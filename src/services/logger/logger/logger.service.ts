import { ILoggerService } from './logger.service.interface'

export class LoggerService implements ILoggerService {
    constructor() {
    }

    private debugIcon = '🐛'
    private errorIcon = '❌'

    info(message: string): void {
        console.log(`INFO: ${message}`);
    }

    debug(message: string): void {
        console.log(`${this.debugIcon} DEBUG: ${message}`);
    }

    error(message: string, error?: Error): void {
        if (error) {
            console.error(`${this.errorIcon} ERROR: ${message}\n`, error);
        } else {
            console.error(`${this.errorIcon} ERROR: ${message}`);
        }
    }
}
