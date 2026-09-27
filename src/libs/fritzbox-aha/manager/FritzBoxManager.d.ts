import { EventEmitter } from 'node:events';
import { FritzBoxError } from '../errors/FritzBoxError.js';
import { FritzBox } from '../fritzbox/FritzBox.js';
import type { FritzBoxConfig } from '../fritzbox/FritzBoxConfig.js';
import type { Device } from '../devices/Device.js';
export interface ConnectionResult {
    readonly id: string;
    readonly ok: boolean;
    readonly error?: FritzBoxError;
}
export interface ManagedDevice extends Device {
    readonly fritzBoxId: string;
}
/** Coordinates multiple isolated FRITZ!Box instances. */
export declare class FritzBoxManager extends EventEmitter {
    private readonly boxes;
    /** Adds a uniquely identified FRITZ!Box. @throws ConfigurationError if the id is already registered or configuration is invalid. */
    add(config: FritzBoxConfig): FritzBox;
    /** Removes a FRITZ!Box after disconnecting it. */
    remove(id: string): Promise<void>;
    /** Returns a registered FRITZ!Box, if present. */
    get(id: string): FritzBox | undefined;
    list(): FritzBox[];
    /** Connects all boxes independently and returns one result per box. */
    connectAll(): Promise<ConnectionResult[]>;
    /** Disconnects all boxes independently and returns one result per box. */
    disconnectAll(): Promise<ConnectionResult[]>;
    listDevices(): Promise<ManagedDevice[]>;
}
//# sourceMappingURL=FritzBoxManager.d.ts.map