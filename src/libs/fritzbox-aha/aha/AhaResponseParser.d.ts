import type { AhaResponse } from './AhaCommand.js';
import type { Device } from '../devices/Device.js';
import type { Group } from '../groups/Group.js';
export declare class AhaResponseParser {
    parseScalar(response: AhaResponse): number;
    parseDeviceList(response: AhaResponse): Device[];
    parseGroupList(response: AhaResponse): Group[];
    private mapDevice;
    private mapGroup;
}
//# sourceMappingURL=AhaResponseParser.d.ts.map