import {
  Injectable,
  Logger,
  NotFoundException,
  OnModuleDestroy,
  UnprocessableEntityException,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';

import {
  DeviceNotFoundError,
  DeviceUnavailableError,
  FritzBox,
  FritzBoxError,
  InvalidTemperatureError,
} from '../../libs/fritzbox-aha/index.js';
import type { FritzBoxConfig } from '../../libs/fritzbox-aha/index.js';
import { AvmLocation } from '../../avm-locations/infrastructure/relational/persistence/entities/avm-location.entity';
import { CryptoService } from '../../crypto/crypto.service';

interface CachedFritzBox {
  /** Ändern sich URL, User oder Passwort der Location, wird neu verbunden. */
  fingerprint: string;
  box: FritzBox;
}

/**
 * Hält je AVM Location (avmlocation.id) genau eine FRITZ!Box-Verbindung
 * für die Heizregeln.
 *
 * Die Zugangsdaten stammen aus der AVM Location (Passwort verschlüsselt
 * gespeichert). Die Session (SID) verwaltet die fritzbox-aha-Bibliothek
 * selbst und erneuert sie bei Ablauf (HTTP 403) automatisch.
 */
@Injectable()
export class FritzBoxConnectionService implements OnModuleDestroy {
  private readonly logger = new Logger(FritzBoxConnectionService.name);
  private readonly boxes = new Map<number, CachedFritzBox>();
  /** Laufende Verbindungsaufbauten, damit parallele Aufrufe nur einmal einloggen. */
  private readonly pending = new Map<number, Promise<FritzBox>>();

  constructor(
    @InjectRepository(AvmLocation)
    private readonly locationRepo: Repository<AvmLocation>,
    private readonly cryptoService: CryptoService,
  ) {}

  async onModuleDestroy(): Promise<void> {
    await Promise.all(
      [...this.boxes.keys()].map((locationId) => this.disconnect(locationId)),
    );
  }

  /**
   * Setzt die Zieltemperatur eines Thermostats oder einer Gruppe (AIN)
   * auf der FRITZ!Box der Location. Erlaubt sind 8–28 °C in
   * 0,5-°C-Schritten.
   */
  async setTemperature(
    locationId: number,
    ain: string,
    temperature: number,
  ): Promise<void> {
    // Leerzeichen in der AIN ("09995 0179707") sind laut AVM optional und
    // werden entfernt, damit sie nicht URL-kodiert übertragen werden müssen.
    const normalizedAin = ain.replace(/\s+/g, '');
    const box = await this.getFritzBox(locationId);

    try {
      await box.thermostats.get(normalizedAin).setTemperature(temperature);
    } catch (error) {
      // Bei Verbindungs-, Session- oder Protokollfehlern die Verbindung
      // verwerfen, damit der nächste Lauf neu verbindet.
      if (
        error instanceof FritzBoxError &&
        !(error instanceof DeviceNotFoundError) &&
        !(error instanceof InvalidTemperatureError) &&
        !(error instanceof DeviceUnavailableError)
      ) {
        this.boxes.delete(locationId);
      }
      throw error;
    }
  }

  /**
   * Liefert die verbundene FRITZ!Box einer Location und baut die
   * Verbindung bei Bedarf (erneut) auf.
   */
  getFritzBox(locationId: number): Promise<FritzBox> {
    const running = this.pending.get(locationId);
    if (running) {
      return running;
    }

    const promise = this.resolveFritzBox(locationId).finally(() => {
      this.pending.delete(locationId);
    });
    this.pending.set(locationId, promise);
    return promise;
  }

  /** Verwirft die gecachte Verbindung; der nächste Zugriff verbindet neu. */
  invalidate(locationId: number): void {
    this.boxes.delete(locationId);
  }

  async disconnect(locationId: number): Promise<void> {
    const cached = this.boxes.get(locationId);
    this.boxes.delete(locationId);
    if (cached) {
      await this.safeDisconnect(cached.box);
    }
  }

  /** Eigene Methode, damit Tests eine FRITZ!Box mit Fake-Transport einsetzen können. */
  protected createFritzBox(config: FritzBoxConfig): FritzBox {
    return new FritzBox(config);
  }

  private async resolveFritzBox(locationId: number): Promise<FritzBox> {
    const config = await this.loadConfig(locationId);
    const fingerprint = [
      config.ahaUrl,
      config.ahaUser,
      config.ahaPassword,
    ].join('\u0000');

    const cached = this.boxes.get(locationId);
    if (
      cached &&
      cached.fingerprint === fingerprint &&
      cached.box.isConnected()
    ) {
      return cached.box;
    }

    if (cached) {
      this.boxes.delete(locationId);
      if (cached.fingerprint !== fingerprint) {
        await this.safeDisconnect(cached.box);
      }
    }

    const box = this.createFritzBox(config);
    await box.connect();
    this.boxes.set(locationId, { fingerprint, box });
    this.logger.log(
      `Mit FRITZ!Box der Location "${config.title}" (#${locationId}) verbunden`,
    );
    return box;
  }

  private async loadConfig(locationId: number): Promise<FritzBoxConfig> {
    const location = await this.locationRepo.findOne({
      where: { id: locationId },
    });

    if (!location) {
      throw new NotFoundException(`AVM Location ${locationId} not found`);
    }

    const url = location.ahaurl?.trim();
    const user = location.ahauser?.trim();

    if (!url || !user || !location.ahapassword) {
      throw new UnprocessableEntityException(
        `AVM Location ${locationId} has no complete AHA configuration (URL, user, password)`,
      );
    }

    return {
      id: `avm-location-${location.id}`,
      title: location.title || `AVM Location ${location.id}`,
      // Fehlendes Schema ergänzen, z. B. "192.168.178.1" -> "http://192.168.178.1".
      ahaUrl: /^https?:\/\//i.test(url) ? url : `http://${url}`,
      ahaUser: user,
      ahaPassword: this.cryptoService.decrypt(location.ahapassword),
    };
  }

  private async safeDisconnect(box: FritzBox): Promise<void> {
    try {
      await box.disconnect();
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      this.logger.warn(
        `Abmelden von FRITZ!Box "${box.config.title}" fehlgeschlagen: ${message}`,
      );
    }
  }
}
