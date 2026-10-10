import {
  BadGatewayException,
  BadRequestException,
  HttpException,
  NotFoundException,
  UnprocessableEntityException,
} from '@nestjs/common';

/*
 * Übersetzt Fehler der fritzbox-aha-Bibliothek (anhand ihres Klassennamens)
 * für die Diagnose-Endpunkte in passende HTTP-Fehler statt HTTP 500.
 *
 * Eine fehlgeschlagene Anmeldung an der FRITZ!Box wird bewusst als 422 und
 * nicht als 401 gemeldet: 401 steht in dieser API für ein ungültiges
 * Access-Token und löst im Frontend einen Token-Refresh aus.
 */
export function toDiagnosticHttpError(error: unknown): unknown {
  if (error instanceof HttpException || !(error instanceof Error)) {
    return error;
  }

  switch (error.name) {
    case 'AuthenticationError':
      return new UnprocessableEntityException(
        `Anmeldung an der FRITZ!Box fehlgeschlagen: ${error.message}`,
      );
    case 'ConfigurationError':
    case 'InvalidTemperatureError':
      return new BadRequestException(error.message);
    case 'DeviceNotFoundError':
      return new NotFoundException(error.message);
    case 'ConnectionError':
    case 'TimeoutError':
    case 'SessionError':
    case 'ProtocolError':
    case 'DeviceUnavailableError':
    case 'UnsupportedFeatureError':
      return new BadGatewayException(error.message);
    default:
      return error;
  }
}
