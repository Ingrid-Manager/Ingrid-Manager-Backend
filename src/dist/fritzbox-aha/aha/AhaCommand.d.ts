export type AhaCommand = {
    readonly kind: 'getDeviceListInfos';
} | {
    readonly kind: 'getTemperature';
    readonly ain: string;
} | {
    readonly kind: 'getTargetTemperature';
    readonly ain: string;
} | {
    readonly kind: 'getComfortTemperature';
    readonly ain: string;
} | {
    readonly kind: 'getReductionTemperature';
    readonly ain: string;
} | {
    readonly kind: 'setTargetTemperature';
    readonly ain: string;
    readonly value: number;
};
export interface AhaResponse {
    readonly status: number;
    readonly body: string;
    readonly command: AhaCommand;
}
//# sourceMappingURL=AhaCommand.d.ts.map