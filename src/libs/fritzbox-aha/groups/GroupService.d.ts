import type { AhaClient } from '../aha/AhaClient.js';
import type { AhaResponseParser } from '../aha/AhaResponseParser.js';
import type { DeviceService } from '../devices/DeviceService.js';
import type { Group } from './Group.js';
export interface GroupTemperature {
    readonly ain: string;
    readonly name: string;
    readonly temperature: number;
    readonly targetTemperature: number;
    readonly members: readonly string[];
}
export interface GroupService {
    list(): Promise<Group[]>;
    isGroup(ain: string): Promise<boolean>;
    getTemperature(ain: string): Promise<GroupTemperature>;
}
export declare class DefaultGroupService implements GroupService {
    private readonly aha;
    private readonly parser;
    private readonly devices;
    constructor(aha: AhaClient, parser: AhaResponseParser, devices: DeviceService);
    list(): Promise<Group[]>;
    isGroup(ain: string): Promise<boolean>;
    getTemperature(ain: string): Promise<GroupTemperature>;
}
//# sourceMappingURL=GroupService.d.ts.map