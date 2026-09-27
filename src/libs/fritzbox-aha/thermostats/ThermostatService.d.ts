import type { AhaClient } from '../aha/AhaClient.js';
import type { AhaResponseParser } from '../aha/AhaResponseParser.js';
import type { DeviceService } from '../devices/DeviceService.js';
import type { Thermostat } from './Thermostat.js';
/** Creates cached thermostat facades by AIN. */
export declare class ThermostatService {
    private readonly aha;
    private readonly parser;
    private readonly devices;
    private readonly cache;
    constructor(aha: AhaClient, parser: AhaResponseParser, devices: DeviceService);
    /** Returns the cached thermostat facade for an AIN. @throws DeviceNotFoundError for an empty AIN. */
    get(ain: string): Thermostat;
}
//# sourceMappingURL=ThermostatService.d.ts.map