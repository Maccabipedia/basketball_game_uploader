import * as fs from 'fs'
import * as path from 'path'
import { ILoggerService } from './logger.service.interface'
import { LogLevelEnum } from '../../../enums/log-level.enum'

export class LoggerService implements ILoggerService {
    private static instance: LoggerService
    private readonly logsDir: string

    constructor() {
        this.logsDir = path.join(__dirname, '../../../logs')
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
