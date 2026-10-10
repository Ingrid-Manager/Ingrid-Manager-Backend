import {
  BadGatewayException,
  Injectable,
  Logger,
  ServiceUnavailableException,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { AllConfigType } from '../config/config.type';
import { isSecureOrLocalUrl } from '../utils/local-host';

export interface RemotePdfRenderOptions {
  landscape?: boolean;
  format?: 'A4' | 'A3';
  /** Wird für den Dateinamen beim Download verwendet (ohne .pdf-Endung). */
  filename?: string;
}

/**
 * Ruft den externen PDF-Render-Server auf (eigener Linux-Server mit
 * vollem Root-Zugriff, dort sauber per apt-get installierte
 * Chromium-Systemabhängigkeiten — siehe pdf-service/ im Repo-Root für den
 * Code des externen Servers und dessen ANLEITUNG.md für die Installation).
 *
 * Das Backend selbst rendert keine PDFs mehr UND leitet sie auch nicht
 * mehr selbst weiter: Es generiert nur noch das HTML (siehe
 * PrintTemplateService), legt es kurzzeitig unter einem einmalig
 * nutzbaren Token ab (PrintHtmlCacheService, abrufbar über
 * PrintHtmlController), bittet den externen Server per HTTP-Aufruf,
 * genau diese URL zu laden und in ein PDF umzuwandeln — und gibt dann
 * NUR die vom PDF-Server gelieferte Download-URL an das Frontend weiter.
 * Das eigentliche PDF fließt dadurch nie durch dieses Backend, sondern
 * wird direkt vom PDF-Server an den Browser der Nutzer:innen ausgeliefert
 * (spart eine komplette Datenübertragung über den ohnehin schon
 * eingeschränkten Backend-Server).
 */
@Injectable()
export class RemotePdfRendererService {
  private readonly logger = new Logger(RemotePdfRendererService.name);

  constructor(private readonly configService: ConfigService<AllConfigType>) {}

  /**
   * Lässt den externen Server das PDF erzeugen und liefert die
   * Download-URL zurück, unter der das fertige PDF DIREKT vom PDF-Server
   * (nicht über dieses Backend) abgerufen werden kann.
   */
  async renderUrlToDownloadUrl(
    url: string,
    options: RemotePdfRenderOptions,
  ): Promise<string> {
    const baseUrl = this.configService.get<string>('app.pdfServiceBaseUrl', {
      infer: true,
    });
    const appKey = this.configService.get<string>('app.pdfServiceAppKey', {
      infer: true,
    });

    if (!baseUrl || !appKey) {
      this.logger.error(
        'PDF_SERVICE_BASE_URL / PDF_SERVICE_APP_KEY sind nicht konfiguriert — ' +
          'die Druckfunktion benötigt den externen PDF-Render-Server (siehe .env).',
      );
      throw new ServiceUnavailableException(
        'Die Druckfunktion ist nicht konfiguriert.',
      );
    }

    // Der App-Key geht als Bearer-Token mit: unverschlüsselt nur zu lokalen
    // bzw. privaten Hosts, sonst ausschließlich per HTTPS.
    if (!isSecureOrLocalUrl(new URL(baseUrl))) {
      this.logger.error(
        `PDF_SERVICE_BASE_URL "${baseUrl}" muss HTTPS verwenden (HTTP ist nur für lokale/private Hosts erlaubt).`,
      );
      throw new ServiceUnavailableException(
        'Die Druckfunktion ist nicht sicher konfiguriert.',
      );
    }

    const renderEndpoint = this.endpoint(baseUrl, 'render');

    let response: globalThis.Response;

    try {
      response = await fetch(renderEndpoint, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${appKey}`,
        },
        body: JSON.stringify({
          url,
          format: options.format ?? 'A4',
          landscape: options.landscape ?? false,
          filename: options.filename ?? 'kalender',
        }),
        // Großzügiges Timeout: Chromium-Start + FullCalendar-Rendering
        // + PDF-Erzeugung sollten deutlich darunter bleiben, aber ein
        // hängender externer Server soll den Request-Handler des
        // Backends nicht unbegrenzt blockieren.
        signal: AbortSignal.timeout(60_000),
      });
    } catch (err) {
      this.logger.error(
        'Externer PDF-Server nicht erreichbar',
        (err as Error)?.stack,
      );
      throw new BadGatewayException(
        'Der PDF-Render-Server ist aktuell nicht erreichbar.',
      );
    }

    if (!response.ok) {
      const body = await response.text().catch(() => '');
      this.logger.error(
        `PDF-Server antwortete mit HTTP ${response.status}: ${body.slice(0, 500)}`,
      );
      throw new BadGatewayException(
        `Der PDF-Render-Server hat mit einem Fehler geantwortet (HTTP ${response.status}).`,
      );
    }

    let json: unknown;
    try {
      json = await response.json();
    } catch (err) {
      this.logger.error(
        'Antwort des PDF-Servers ist kein gültiges JSON',
        (err as Error)?.stack,
      );
      throw new BadGatewayException(
        'Der PDF-Render-Server hat eine ungültige Antwort geliefert.',
      );
    }

    const token =
      json && typeof json === 'object' && 'token' in json
        ? (json as { token: unknown }).token
        : undefined;

    if (typeof token !== 'string' || token.length === 0) {
      this.logger.error(
        `Antwort des PDF-Servers enthält keinen gültigen Token: ${JSON.stringify(json).slice(0, 200)}`,
      );
      throw new BadGatewayException(
        'Der PDF-Render-Server hat keinen gültigen Download-Token geliefert.',
      );
    }

    return this.endpoint(baseUrl, `pdf/${encodeURIComponent(token)}`);
  }

  /*
   * Hängt `path` an die Basis-URL an, ohne einen dort enthaltenen Pfad zu
   * verwerfen ("https://host/pdf" + "render" -> "https://host/pdf/render").
   */
  private endpoint(baseUrl: string, path: string): string {
    const base = baseUrl.endsWith('/') ? baseUrl : `${baseUrl}/`;

    return new URL(path, base).toString();
  }
}
