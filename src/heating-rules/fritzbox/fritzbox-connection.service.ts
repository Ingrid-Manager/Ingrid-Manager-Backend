import { createHash } from 'crypto';
import { Inject, Injectable, Logger, OnModuleDestroy } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';

import { AvmLocation } from '../../avm-locations/infrastructure/relational/persistence/entities/avm-location.entity';
import { CryptoService } from '../../crypto/crypto.service';
import {
  AuthenticationError,
  ConfigurationError,
  ConnectionError,
  FritzBox,
  FritzBoxConfig,
  SessionError,
  TimeoutError,
} from '../../libs/fritzbox-aha/index.js';

/**
 * Injection-Token für die Erzeugung einer FRITZ!Box-Instanz. Tests tauschen
 * hierüber den HTTP-Transport aus (`new FritzBox(config, transport)`).
 */
export const FRITZBOX_FACTORY = Symbol('FRITZBOX_FACTORY');

export type FritzBoxFactory = (config: FritzBoxConfig) => FritzBox;

export const defaultFritzBoxFactory: FritzBoxFactory = (config) =>
  new FritzBox(config);

/**
 * Nach einer fehlgeschlagenen Anmeldung wird mit denselben Zugangsdaten
 * erst nach dieser Wartezeit erneut angemeldet. Die FRITZ!Box verlängert
 * ihre Login-Sperre (BlockTime) bei jedem Fehlversuch, ein minütlicher
 * Heizlauf würde sie sonst dauerhaft aussperren.
 */
export const AUTH_FAILURE_COOLDOWN_MS = 5 * 60_000;

/**
 * Ist die FRITZ!Box nicht erreichbar, schlagen weitere Verbindungsversuche
 * für diese Zeit sofort fehl. Sonst wartet ein Heizlauf für jeden Raum
 * derselben Location erneut alle Timeouts und Wiederholungen ab.
 */
export const CONNECT_FAILURE_COOLDOWN_MS = 30_000;

interface ConnectionEntry {
  fingerprint: string;
  connection: Promise<FritzBox>;
  box?: FritzBox;
}

interface ConnectFailure {
  kind: 'auth' | 'network';
  fingerprint: string;
  until: number;
  message: string;
}

/**
 * Hält pro AVM-Location (`avmlocation`) genau eine FRITZ!Box-Verbindung.
 *
 * - Parallele Aufrufe für dieselbe Location teilen sich eine Anmeldung.
 * - Ändern sich URL, Benutzer oder Passwort der Location, wird die alte
 *   Verbindung verworfen und neu angemeldet.
 * - Nach Verbindungs- oder Sitzungsfehlern wird die Verbindung verworfen,
 *   der nächste Aufruf meldet sich neu an.
 * - Scheitert der Verbindungsaufbau, wird es mit denselben Zugangsdaten
 *   erst nach einer Wartezeit erneut versucht (Anmeldefehler 5 min,
 *   Netzwerkfehler 30 s).
 *
 * Abgelaufene Sitzungen (HTTP 403) erneuert bereits der AHA-Client selbst.
 */
@Injectable()
export class FritzboxConnectionService implements OnModuleDestroy {
  private readonly logger = new Logger(FritzboxConnectionService.name);
  private readonly connections = new Map<number, ConnectionEntry>();
  private readonly failures = new Map<number, ConnectFailure>();

  constructor(
    @InjectRepository(AvmLocation)
    private readonly locationRepo: Repository<AvmLocation>,
    private readonly cryptoService: CryptoService,
    @Inject(FRITZBOX_FACTORY)
    private readonly createFritzBox: FritzBoxFactory,
  ) {}

  /**
   * Führt `fn` mit der Verbindung der Location aus. Bei Verbindungs- oder
   * Anmeldefehlern wird die Verbindung verworfen und der Fehler
   * weitergereicht.
   */
  async withConnection<T>(
    locationId: number,
    fn: (box: FritzBox) => Promise<T>,
  ): Promise<T> {
    const box = await this.getConnection(locationId);
    try {
      return await fn(box);
    } catch (error) {
      this.handleFailure(locationId, box, error);
      throw error;
    }
  }

  /** Liefert die (ggf. neu aufgebaute) Verbindung der Location. */
  async getConnection(locationId: number): Promise<FritzBox> {
    const location = await this.locationRepo.findOne({
      where: { id: locationId },
    });

    if (!location) {
      throw new ConfigurationError(
        `AVM-Location #${locationId} existiert nicht`,
      );
    }

    const ahaUrl = location.ahaurl?.trim();
    const ahaUser = location.ahauser?.trim();
    const encryptedPassword = location.ahapassword;

    if (!ahaUrl || !ahaUser || !encryptedPassword) {
      throw new ConfigurationError(
        `AVM-Location #${locationId} hat keine vollständigen FRITZ!Box-Zugangsdaten (URL, Benutzer, Passwort)`,
      );
    }

    const fingerprint = createHash('sha256')
      .update(JSON.stringify([ahaUrl, ahaUser, encryptedPassword]))
      .digest('hex');

    // Ab hier kein await, bis der neue Eintrag gesetzt ist: Parallele
    // Aufrufe sehen so denselben Eintrag und melden sich nur einmal an.
    const existing = this.connections.get(locationId);
    if (existing?.fingerprint === fingerprint) {
      return existing.connection;
    }

    if (existing) {
      this.logger.log(
        `Zugangsdaten von AVM-Location #${locationId} geändert, verbinde neu`,
      );
      this.connections.delete(locationId);
      this.disconnectInBackground(existing.connection);
    }

    const failure = this.failures.get(locationId);
    if (failure?.fingerprint === fingerprint && failure.until > Date.now()) {
      const message = `${failure.message} (nächster Versuch ab ${new Date(failure.until).toISOString()} oder nach Änderung der Zugangsdaten)`;
      throw failure.kind === 'auth'
        ? new AuthenticationError(message)
        : new ConnectionError(message);
    }
    this.failures.delete(locationId);

    const entry: ConnectionEntry = {
      fingerprint,
      connection: this.connect(locationId, location.title, {
        ahaUrl,
        ahaUser,
        encryptedPassword,
      }),
    };
    this.connections.set(locationId, entry);

    try {
      entry.box = await entry.connection;
      return entry.box;
    } catch (error) {
      if (this.connections.get(locationId) === entry) {
        this.connections.delete(locationId);
      }
      this.rememberFailure(locationId, fingerprint, error);
      throw error;
    }
  }

  async onModuleDestroy(): Promise<void> {
    const entries = [...this.connections.values()];
    this.connections.clear();
    await Promise.all(
      entries.map((entry) => this.disconnect(entry.connection)),
    );
  }

  private async connect(
    locationId: number,
    title: string,
    credentials: {
      ahaUrl: string;
      ahaUser: string;
      encryptedPassword: string;
    },
  ): Promise<FritzBox> {
    const box = this.createFritzBox({
      id: `avm-location-${locationId}`,
      title: title?.trim() || `AVM-Location #${locationId}`,
      ahaUrl: credentials.ahaUrl,
      ahaUser: credentials.ahaUser,
      ahaPassword: this.cryptoService.decrypt(credentials.encryptedPassword),
    });

    await box.connect();
    this.logger.log(`Mit FRITZ!Box von AVM-Location #${locationId} verbunden`);
    return box;
  }

  private handleFailure(locationId: number, box: FritzBox, error: unknown) {
    if (!isConnectionFailure(error)) {
      return;
    }

    const entry = this.connections.get(locationId);
    if (entry?.box !== box) {
      return;
    }

    this.logger.warn(
      `Verbindung zu AVM-Location #${locationId} verworfen (${(error as Error).name}), nächster Aufruf verbindet neu`,
    );
    this.connections.delete(locationId);
    if (error instanceof AuthenticationError) {
      // Anmeldung beim Erneuern einer abgelaufenen Sitzung fehlgeschlagen.
      this.rememberFailure(locationId, entry.fingerprint, error);
    }
    this.disconnectInBackground(entry.connection);
  }

  private rememberFailure(
    locationId: number,
    fingerprint: string,
    error: unknown,
  ) {
    const kind =
      error instanceof AuthenticationError
        ? 'auth'
        : error instanceof ConnectionError || error instanceof TimeoutError
          ? 'network'
          : null;
    if (!kind) {
      return;
    }

    this.failures.set(locationId, {
      kind,
      fingerprint,
      until:
        Date.now() +
        (kind === 'auth'
          ? AUTH_FAILURE_COOLDOWN_MS
          : CONNECT_FAILURE_COOLDOWN_MS),
      message: (error as Error).message,
    });
  }

  private disconnectInBackground(connection: Promise<FritzBox>) {
    void this.disconnect(connection);
  }

  private async disconnect(connection: Promise<FritzBox>): Promise<void> {
    try {
      const box = await connection;
      await box.disconnect();
    } catch (error) {
      this.logger.debug(
        `Abmelden von der FRITZ!Box fehlgeschlagen: ${(error as Error)?.message ?? String(error)}`,
      );
    }
  }
}

function isConnectionFailure(error: unknown): boolean {
  return (
    error instanceof ConnectionError ||
    error instanceof TimeoutError ||
    error instanceof SessionError ||
    error instanceof AuthenticationError
  );
}
