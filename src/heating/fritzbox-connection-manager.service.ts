import {
  Inject,
  Injectable,
  Logger,
  NotFoundException,
  OnModuleDestroy,
  UnprocessableEntityException,
} from '@nestjs/common';
import { createHash } from 'crypto';

import { FritzBox, FritzBoxManager } from '../libs/fritzbox-aha/index.js';

import { AvmLocationsService } from '../avm-locations/avm-locations.service';
import { AvmConnection } from '../avm-locations/avm-connection.type';
import { isAllowedFritzBoxUrl } from '../avm-locations/validation/is-fritzbox-url.validator';
import {
  HeatingError,
  HeatingErrorCode,
  toHeatingError,
} from './domain/heating-error';

export const FRITZBOX_MANAGER = Symbol('FRITZBOX_MANAGER');

/*
 * Verwaltet genau eine FRITZ!Box-Verbindung pro AVM-Location.
 *
 *   room -> locationid -> AvmLocation -> FritzBox
 *
 * Die eigentlichen Verbindungen hält der FritzBoxManager der
 * fritzbox-aha-Bibliothek (eine isolierte FritzBox-Instanz je Location).
 * Die Zugangsdaten stammen aus der AVM-Location (Passwort verschlüsselt in
 * der Datenbank) und werden bei jedem Zugriff frisch geladen; ändern sie
 * sich, wird die Verbindung der Location neu aufgebaut.
 */
@Injectable()
export class FritzBoxConnectionManager implements OnModuleDestroy {
  private readonly logger = new Logger(FritzBoxConnectionManager.name);

  private readonly fingerprints = new Map<number, string>();

  // Verhindert parallele Verbindungsaufbauten zur selben FRITZ!Box.
  private readonly pending = new Map<number, Promise<FritzBox>>();

  constructor(
    @Inject(FRITZBOX_MANAGER)
    private readonly manager: FritzBoxManager,
    private readonly avmLocationsService: AvmLocationsService,
  ) {}

  static connectionId(locationId: number): string {
    return `avm-location-${locationId}`;
  }

  /*
   * Liefert die verbundene FRITZ!Box der Location.
   *
   * @throws HeatingError UNKNOWN_LOCATION, MISSING_FRITZBOX_MAPPING,
   *         CONFIGURATION_ERROR oder FRITZBOX_UNREACHABLE
   */
  getConnection(locationId: number): Promise<FritzBox> {
    const pending = this.pending.get(locationId);

    if (pending) {
      return pending;
    }

    const promise = this.resolveConnection(locationId).finally(() => {
      this.pending.delete(locationId);
    });
    this.pending.set(locationId, promise);

    return promise;
  }

  /*
   * Verwirft die Verbindung einer Location, z. B. nachdem die FRITZ!Box
   * nicht erreichbar war. Beim nächsten Zugriff wird neu verbunden.
   */
  async invalidate(locationId: number): Promise<void> {
    const id = FritzBoxConnectionManager.connectionId(locationId);

    this.fingerprints.delete(locationId);

    try {
      await this.manager.remove(id);
    } catch (error) {
      this.logger.warn(
        `Could not disconnect FRITZ!Box of location ${locationId}: ${String(
          error instanceof Error ? error.message : error,
        )}`,
      );
    }
  }

  async onModuleDestroy(): Promise<void> {
    await this.manager.disconnectAll();
  }

  private async resolveConnection(locationId: number): Promise<FritzBox> {
    const connection = await this.loadConnection(locationId);
    const id = FritzBoxConnectionManager.connectionId(locationId);
    const fingerprint = this.fingerprint(connection);

    let box = this.manager.get(id);

    if (box && this.fingerprints.get(locationId) !== fingerprint) {
      await this.invalidate(locationId);
      box = undefined;
    }

    if (!box) {
      if (!isAllowedFritzBoxUrl(connection.url)) {
        this.logger.warn(
          `FRITZ!Box of location ${locationId} is reached via plain HTTP on a public address; ` +
            'the session id is transmitted unencrypted. Please switch the location to HTTPS.',
        );
      }

      try {
        box = this.manager.add({
          id,
          title: connection.title,
          ahaUrl: connection.url,
          ahaUser: connection.username,
          ahaPassword: connection.password,
        });
      } catch (error) {
        throw toHeatingError(error, HeatingErrorCode.CONFIGURATION_ERROR, {
          locationId,
        });
      }

      this.fingerprints.set(locationId, fingerprint);
    }

    if (!box.isConnected()) {
      try {
        await box.connect();
      } catch (error) {
        throw new HeatingError(
          HeatingErrorCode.FRITZBOX_UNREACHABLE,
          `FRITZ!Box of location ${locationId} is not reachable`,
          { locationId },
          error,
        );
      }
    }

    return box;
  }

  private async loadConnection(locationId: number): Promise<AvmConnection> {
    try {
      return await this.avmLocationsService.getConnection(locationId);
    } catch (error) {
      if (error instanceof NotFoundException) {
        throw new HeatingError(
          HeatingErrorCode.UNKNOWN_LOCATION,
          `Location ${locationId} does not exist`,
          { locationId },
          error,
        );
      }

      if (error instanceof UnprocessableEntityException) {
        throw new HeatingError(
          HeatingErrorCode.MISSING_FRITZBOX_MAPPING,
          `Location ${locationId} has no FRITZ!Box connection configured`,
          { locationId },
          error,
        );
      }

      // z. B. Passwort nicht entschlüsselbar (APP_CRYPTO_KEY) oder DB-Fehler
      throw new HeatingError(
        HeatingErrorCode.CONFIGURATION_ERROR,
        `FRITZ!Box connection of location ${locationId} could not be loaded`,
        { locationId },
        error,
      );
    }
  }

  private fingerprint(connection: AvmConnection): string {
    return createHash('sha256')
      .update(
        [connection.url, connection.username, connection.password].join('\n'),
      )
      .digest('hex');
  }
}
