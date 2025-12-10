import { ServicesProvider } from "./services-provider/services-provider"

export class BaseService {
    protected services: ServicesProvider

    constructor(services: ServicesProvider) {
        this.services = services
    }
}