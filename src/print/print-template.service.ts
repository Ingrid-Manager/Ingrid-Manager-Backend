import { Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import Handlebars from 'handlebars';
import fs from 'node:fs/promises';
import path from 'node:path';
import { AllConfigType } from '../config/config.type';

/**
 * Lädt und kompiliert die Handlebars-Druckvorlagen (Woche/Monat/Jahr).
 * Folgt demselben Muster wie MailerService (siehe src/mailer), nur dass
 * hier fertiges HTML für Puppeteer statt für den Mailversand erzeugt wird.
 *
 * Lädt außerdem das FullCalendar-Bundle für die Woche/Monat-Vorlagen aus
 * dem lokal installierten npm-Paket (statt per CDN zur Laufzeit) und
 * bettet es direkt in die erzeugte HTML-Seite ein:
 *  - Version bleibt exakt synchron mit der im Frontend verwendeten
 *    Version (siehe package.json: "fullcalendar").
 *  - Der Server braucht beim Drucken keinen Internetzugriff mehr auf
 *    cdn.jsdelivr.net (bessere Zuverlässigkeit, kein Supply-Chain-Risiko
 *    durch ein zur Laufzeit nachgeladenes Drittanbieter-Skript).
 */
@Injectable()
export class PrintTemplateService {
  private readonly compiled = new Map<string, Handlebars.TemplateDelegate>();
  private fullCalendarScriptCache: string | null = null;

  constructor(private readonly configService: ConfigService<AllConfigType>) {}

  private templatePath(name: string): string {
    return path.join(
      this.configService.getOrThrow('app.workingDirectory', { infer: true }),
      'src',
      'print',
      'templates',
      `${name}.hbs`,
    );
  }

  private fullCalendarBundlePath(): string {
    return path.join(
      this.configService.getOrThrow('app.workingDirectory', { infer: true }),
      'node_modules',
      'fullcalendar',
      'index.global.min.js',
    );
  }

  /**
   * Liefert den Inhalt des lokal installierten FullCalendar-Bundles
   * (einmalig gelesen, danach aus dem Cache). Wird von den Woche-/
   * Monat-Vorlagen per {{{fullCalendarScript}}} direkt in ein
   * <script>-Tag eingebettet statt per CDN geladen.
   */
  async getFullCalendarScript(): Promise<string> {
    if (this.fullCalendarScriptCache === null) {
      const raw = await fs.readFile(this.fullCalendarBundlePath(), 'utf-8');

      // Defensive Absicherung, unabhängig von der konkreten Bundle-Version:
      // Enthielte das Bundle irgendwo (z. B. in einem String-Literal oder
      // Kommentar) die Zeichenfolge "</script", würde das unser
      // umschließendes <script>-Tag vorzeitig schließen und die Seite
      // kaputt machen. Aktuell (v6.1.20) kommt das nicht vor, aber ein
      // künftiges Versions-Update könnte das ändern — das hier verhindert
      // es unabhängig davon zuverlässig (Standardtechnik beim Einbetten
      // von Drittanbieter-Skripten).
      this.fullCalendarScriptCache = raw.replace(/<\/script/gi, '<\\/script');
    }
    return this.fullCalendarScriptCache;
  }

  async render(
    name: string,
    context: Record<string, unknown>,
  ): Promise<string> {
    let template = this.compiled.get(name);

    if (!template) {
      const raw = await fs.readFile(this.templatePath(name), 'utf-8');
      template = Handlebars.compile(raw, { strict: false });
      this.compiled.set(name, template);
    }

    return template(context);
  }
}
