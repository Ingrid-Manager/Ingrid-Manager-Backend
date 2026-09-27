export class FritzBoxError extends Error {
    name = 'FritzBoxError';
    constructor(message, options) {
        super(message, options);
    }
}
export class AuthenticationError extends FritzBoxError {
    name = 'AuthenticationError';
}
export class SessionError extends FritzBoxError {
    name = 'SessionError';
}
export class ConnectionError extends FritzBoxError {
    name = 'ConnectionError';
}
export class TimeoutError extends FritzBoxError {
    name = 'TimeoutError';
}
export class ProtocolError extends FritzBoxError {
    name = 'ProtocolError';
}
export class DeviceNotFoundError extends FritzBoxError {
    name = 'DeviceNotFoundError';
}
export class DeviceUnavailableError extends FritzBoxError {
    name = 'DeviceUnavailableError';
}
export class UnsupportedFeatureError extends FritzBoxError {
    name = 'UnsupportedFeatureError';
}
export class InvalidTemperatureError extends FritzBoxError {
    name = 'InvalidTemperatureError';
}
export class ConfigurationError extends FritzBoxError {
    name = 'ConfigurationError';
}
//# sourceMappingURL=FritzBoxError.js.map