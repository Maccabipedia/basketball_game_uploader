import { BaseService } from "../base.provider"
import { ServicesProvider } from "../services-provider/services-provider"
import { IUtilService } from "./util.service.interface"


export class UtilService extends BaseService implements IUtilService {
    constructor(services: ServicesProvider) {
        super(services)
    }


    isValidNumber(value: any): boolean {
        return typeof value === 'number' && !isNaN(value)
    }

    isValidString(value: any): boolean {
        return typeof value === 'string'
    }
}