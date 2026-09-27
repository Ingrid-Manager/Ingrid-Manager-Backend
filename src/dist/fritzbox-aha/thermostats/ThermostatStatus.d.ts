export interface ThermostatStatus {
    readonly ain: string;
    readonly name: string;
    readonly temperature: number;
    readonly targetTemperature: number;
    readonly comfortTemperature: number;
    readonly reductionTemperature: number;
    readonly reachable?: boolean;
    readonly batteryLow?: boolean;
    readonly lastUpdated: Date;
}
//# sourceMappingURL=ThermostatStatus.d.ts.map