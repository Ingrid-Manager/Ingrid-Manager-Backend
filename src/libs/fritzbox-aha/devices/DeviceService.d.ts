import type { AhaClient } from '../aha/AhaClient.js';
import type { AhaResponseParser } from '../aha/AhaResponseParser.js';
import type { Device } from './Device.js';
/** Provides discovery and validated access to AHA devices. */
export interface DeviceService {
    list(): Promise<Device[]>;
    get(ain: string): Promise<Device>;
}
/** Discovers devices and validates AINs against the current FRITZ!Box device list. */
export declare class DefaultDeviceService implements DeviceService {
    private readonly aha;
    private readonly parser;
    constructor(aha: AhaClient, parser: AhaResponseParser);
    list(): Promise<Device[]>;
    get(ain: string): Promise<Device>;
}
//# sourceMappingURL=DeviceService.d.ts.map