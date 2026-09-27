import { DeviceNotFoundError } from '../errors/FritzBoxError.js';
import { ThermostatImpl } from './Thermostat.js';
/** Creates cached thermostat facades by AIN. */
export class ThermostatService {
    aha;
    parser;
    devices;
    cache = new Map();
    constructor(aha, parser, devices) {
        this.aha = aha;
        this.parser = parser;
        this.devices = devices;
    }
    /** Returns the cached thermostat facade for an AIN. @throws DeviceNotFoundError for an empty AIN. */
    get(ain) {
        if (!ain.trim())
            throw new DeviceNotFoundError('AIN must not be empty');
        const cached = this.cache.get(ain);
        if (cached)
            return cached;
        const thermostat = new ThermostatImpl(ain, ain, this.aha, this.parser, async () => {
            const devices = await this.devices.list();
            return devices.find((device) => device.ain === ain);
        });
        this.cache.set(ain, thermostat);
        return thermostat;
    }
}
//# sourceMappingURL=ThermostatService.js.map