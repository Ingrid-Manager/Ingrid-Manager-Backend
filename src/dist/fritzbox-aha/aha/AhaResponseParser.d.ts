import type { AhaResponse } from './AhaCommand.js';
import type { Device } from '../devices/Device.js';
export declare class AhaResponseParser {
    parseScalar(response: AhaResponse): number;
    parseDeviceList(response: AhaResponse): Device[];
    private mapDevice;
}
//# sourceMappingURL=AhaResponseParser.d.ts.map