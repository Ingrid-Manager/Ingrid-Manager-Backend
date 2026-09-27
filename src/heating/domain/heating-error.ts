export enum HeatingErrorCode {
  FRITZBOX_UNREACHABLE = 'FRITZBOX_UNREACHABLE',
  THERMOSTAT_UNREACHABLE = 'THERMOSTAT_UNREACHABLE',
  UNKNOWN_ROOM = 'UNKNOWN_ROOM',
  UNKNOWN_LOCATION = 'UNKNOWN_LOCATION',
  INVALID_TEMPERATURE = 'INVALID_TEMPERATURE',
  MISSING_FRITZBOX_MAPPING = 'MISSING_FRITZBOX_MAPPING',
  CONFIGURATION_ERROR = 'CONFIGURATION_ERROR',
  DATA_SOURCE_ERROR = 'DATA_SOURCE_ERROR',
}

export interface HeatingErrorContext {
  locationId?: number;
  roomId?: number;
  avmId?: string | null;
}

export class HeatingError extends Error {
  readonly name = 'HeatingError';

  constructor(
    readonly code: HeatingErrorCode,
    message: string,
    readonly context: HeatingErrorContext = {},
    readonly originalError?: unknown,
  ) {
    super(message);
  }

  toLogMessage(): string {
    const parts = [`[${this.code}]`];

    if (this.context.locationId !== undefined) {
      parts.push(`location=${this.context.locationId}`);
    }
    if (this.context.roomId !== undefined) {
      parts.push(`room=${this.context.roomId}`);
    }
    if (this.context.avmId) {
      parts.push(`ain=${this.context.avmId}`);
    }

    parts.push(this.message);

    if (this.originalError instanceof Error) {
      parts.push(`(${this.originalError.name}: ${this.originalError.message})`);
    }

    return parts.join(' ');
  }
}

/*
 * Ordnet Fehler der FRITZ!Box-AHA-Bibliothek anhand ihres (dort fest
 * gesetzten) Klassennamens einem fachlichen Fehlercode zu.
 */
const FRITZBOX_ERROR_CODES: Record<string, HeatingErrorCode> = {
  ConnectionError: HeatingErrorCode.FRITZBOX_UNREACHABLE,
  TimeoutError: HeatingErrorCode.FRITZBOX_UNREACHABLE,
  AuthenticationError: HeatingErrorCode.FRITZBOX_UNREACHABLE,
  SessionError: HeatingErrorCode.FRITZBOX_UNREACHABLE,
  DeviceNotFoundError: HeatingErrorCode.THERMOSTAT_UNREACHABLE,
  DeviceUnavailableError: HeatingErrorCode.THERMOSTAT_UNREACHABLE,
  ProtocolError: HeatingErrorCode.THERMOSTAT_UNREACHABLE,
  UnsupportedFeatureError: HeatingErrorCode.THERMOSTAT_UNREACHABLE,
  InvalidTemperatureError: HeatingErrorCode.INVALID_TEMPERATURE,
  ConfigurationError: HeatingErrorCode.CONFIGURATION_ERROR,
};

export function toHeatingError(
  error: unknown,
  fallbackCode: HeatingErrorCode,
  context: HeatingErrorContext = {},
): HeatingError {
  if (error instanceof HeatingError) {
    return error;
  }

  const name = error instanceof Error ? error.name : undefined;
  const code = (name && FRITZBOX_ERROR_CODES[name]) || fallbackCode;
  const message = error instanceof Error ? error.message : String(error);

  return new HeatingError(code, message, context, error);
}
