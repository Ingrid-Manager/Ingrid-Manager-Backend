import { DeviceNotFoundError } from '../errors/FritzBoxError.js';
/** Discovers devices and validates AINs against the current FRITZ!Box device list. */
export class DefaultDeviceService {
    aha;
    parser;
    constructor(aha, parser) {
        this.aha = aha;
        this.parser = parser;
    }
    async list() {
        return this.parser.parseDeviceList(await this.aha.execute({ kind: 'getDeviceListInfos' }));
    }
    async get(ain) {
        if (!ain.trim())
            throw new DeviceNotFoundError('AIN must not be empty');
        const device = (await this.list()).find((item) => item.ain === ain);
        if (!device)
            throw new DeviceNotFoundError(`Unknown AIN: ${ain}`);
        return device;
    }
}
//# sourceMappingURL=DeviceService.js.map