import { EventEmitter } from 'node:events';
import type { FritzBoxConfig } from './FritzBoxConfig.js';
import { type HttpTransport } from '../transport/HttpTransport.js';
import { type DeviceService } from '../devices/DeviceService.js';
import { ThermostatService } from '../thermostats/ThermostatService.js';
import type { Device } from '../devices/Device.js';
import type { Group } from '../groups/Group.js';
import { type GroupService } from '../groups/GroupService.js';
/** Represents one isolated FRITZ!Box AHA endpoint. */
export type ConnectionState = 'disconnected' | 'connecting' | 'connected';
export declare class FritzBox extends EventEmitter {
    readonly config: FritzBoxConfig;
    readonly devices: DeviceService;
    readonly thermostats: ThermostatService;
    private state;
    private readonly session;
    readonly groups: GroupService;
    constructor(config: FritzBoxConfig, transport?: HttpTransport);
    connect(): Promise<void>;
    disconnect(): Promise<void>;
    isConnected(): boolean;
    getState(): ConnectionState;
    listDevices(): Promise<Device[]>;
    listGroups(): Promise<Group[]>;
    isGroup(ain: string): Promise<boolean>;
    getGroupTemperature(ain: string): Promise<import("../groups/GroupService.js").GroupTemperature>;
}
//# sourceMappingURL=FritzBox.d.ts.map