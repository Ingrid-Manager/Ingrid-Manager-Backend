import { EventEmitter } from 'node:events';
import type { AhaClient } from '../aha/AhaClient.js';
import type { AhaResponseParser } from '../aha/AhaResponseParser.js';
import type { Device } from '../devices/Device.js';
import type { ThermostatStatus } from './ThermostatStatus.js';
export interface PollingOptions {
    readonly interval: number;
}
/** Public thermostat API with status, target-temperature and polling operations. */
export interface Thermostat {
    readonly ain: string;
    readonly name: string;
    getStatus(): Promise<ThermostatStatus>;
    setTemperature(temperature: number): Promise<void>;
    startPolling(options: PollingOptions): void;
    stopPolling(): void;
    on(event: 'statusChanged' | 'error', listener: (...args: unknown[]) => void): this;
    off(event: 'statusChanged' | 'error', listener: (...args: unknown[]) => void): this;
}
export declare class ThermostatImpl extends EventEmitter implements Thermostat {
    readonly ain: string;
    readonly name: string;
    private readonly aha;
    private readonly parser;
    private readonly resolveDevice;
    private timer;
    private lastStatus;
    private inFlight;
    private pollingGeneration;
    constructor(ain: string, name: string, aha: AhaClient, parser: AhaResponseParser, resolveDevice: () => Promise<Device | undefined>);
    getStatus(): Promise<ThermostatStatus>;
    setTemperature(temperature: number): Promise<void>;
    startPolling(options: PollingOptions): void;
    stopPolling(): void;
    off(event: 'statusChanged' | 'error', listener: (...args: unknown[]) => void): this;
    private scalarMeasuredTemperature;
    private scalarHkrTemperature;
}
//# sourceMappingURL=Thermostat.d.ts.map