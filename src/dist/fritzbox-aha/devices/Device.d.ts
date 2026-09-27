import type { DeviceType } from './DeviceType.js';
export interface DeviceCapabilities {
    readonly temperature: boolean;
    readonly targetTemperature: boolean;
    readonly comfortTemperature: boolean;
    readonly reductionTemperature: boolean;
}
/** A discovered AHA Smart-Home device. `ain` is the AVM device identifier. */
export interface Device {
    readonly ain: string;
    readonly name: string;
    readonly manufacturer?: string;
    readonly product?: string;
    readonly type: DeviceType;
    readonly present: boolean;
    readonly capabilities: DeviceCapabilities;
    readonly batteryLow?: boolean;
}
//# sourceMappingURL=Device.d.ts.map