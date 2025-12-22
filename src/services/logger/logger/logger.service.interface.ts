export interface ILoggerService {
    info(message: string): void
    error(message: string, error?: Error): void
}