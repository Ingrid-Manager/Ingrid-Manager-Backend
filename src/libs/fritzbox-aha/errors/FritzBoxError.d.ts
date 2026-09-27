export declare class FritzBoxError extends Error {
    readonly name: string;
    constructor(message: string, options?: {
        cause?: unknown;
    });
}
export declare class AuthenticationError extends FritzBoxError {
    readonly name = "AuthenticationError";
}
export declare class SessionError extends FritzBoxError {
    readonly name = "SessionError";
}
export declare class ConnectionError extends FritzBoxError {
    readonly name = "ConnectionError";
}
export declare class TimeoutError extends FritzBoxError {
    readonly name = "TimeoutError";
}
export declare class ProtocolError extends FritzBoxError {
    readonly name = "ProtocolError";
}
export declare class DeviceNotFoundError extends FritzBoxError {
    readonly name = "DeviceNotFoundError";
}
export declare class DeviceUnavailableError extends FritzBoxError {
    readonly name = "DeviceUnavailableError";
}
export declare class UnsupportedFeatureError extends FritzBoxError {
    readonly name = "UnsupportedFeatureError";
}
export declare class InvalidTemperatureError extends FritzBoxError {
    readonly name = "InvalidTemperatureError";
}
export declare class ConfigurationError extends FritzBoxError {
    readonly name = "ConfigurationError";
}
//# sourceMappingURL=FritzBoxError.d.ts.map