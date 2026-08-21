import { Injectable, Logger, OnModuleDestroy } from '@nestjs/common';
import puppeteer, { Browser } from 'puppeteer-core';
import chromium from '@sparticuz/chromium';

export interface PdfRenderOptions {
  landscape?: boolean;
  format?: 'A4' | 'A3';
}

/**
 * Kapselt den Headless-Chromium-Zugriff über Puppeteer.
 *
 * Nutzt ausschließlich @sparticuz/chromium (kein optionaler Fallback-Pfad
 * auf ein anderes/lokal installiertes Chromium) — ein eigentlich für
 * AWS Lambda gebautes, selbstenthaltenes Chromium-Bundle, das die auf
 * schlanken Linux-Hosting-Umgebungen ohne Root-Zugriff häufig fehlenden
 * Systembibliotheken (z. B. libnspr4.so, libnss3.so) selbst mitbringt,
 * statt sie vom Betriebssystem vorauszusetzen.
 *
 * WICHTIG: Die enthaltene Chromium-Binary ist Linux-only. Dieser Service
 * lässt sich damit nur auf einem Linux-Zielsystem tatsächlich ausführen
 * (z. B. dem Produktionsserver), nicht direkt auf einer lokalen
 * Windows-Entwicklungsumgebung.
 *
 * Der Browser wird beim ersten Aufruf einmalig gestartet und danach
 * für alle weiteren PDF-Generierungen wiederverwendet, da das Starten
 * eines neuen Chromium-Prozesses vergleichsweise teuer ist (mehrere
 * hundert ms). Für jeden Druckauftrag wird lediglich ein neuer Tab
 * (Page) geöffnet und nach Gebrauch wieder geschlossen.
 */
@Injectable()
export class PdfRendererService implements OnModuleDestroy {
  private readonly logger = new Logger(PdfRendererService.name);
  private browserPromise: Promise<Browser> | null = null;

  private async launchBrowser(): Promise<Browser> {
    return puppeteer.launch({
      headless: true,
      executablePath: await chromium.executablePath(),
      args: chromium.args,
      defaultViewport: null,
    });
  }

  private async getBrowser(): Promise<Browser> {
    if (!this.browserPromise) {
      this.browserPromise = this.launchBrowser().catch((err) => {
        // Bei Fehlschlag darf die nächste Anfrage einen neuen Versuch starten
        this.browserPromise = null;
        throw err;
      });

      const browser = await this.browserPromise;
      browser.on('disconnected', () => {
        this.logger.warn(
          'Chromium-Instanz getrennt, wird bei Bedarf neu gestartet.',
        );
        this.browserPromise = null;
      });
    }

    return this.browserPromise;
  }

  async renderHtmlToPdf(
    html: string,
    options: PdfRenderOptions = {},
  ): Promise<Buffer> {
    const browser = await this.getBrowser();
    const page = await browser.newPage();

    try {
      // Die Vorlagen unterscheiden zwischen Bildschirm- und Druckdarstellung
      // via @media print (u. a. wird die "Als PDF drucken"-Toolbar dort
      // ausgeblendet). page.pdf() emulliert das zwar i. d. R. automatisch,
      // wir setzen es hier aber explizit, um uns nicht auf Standardverhalten
      // einer bestimmten Puppeteer-/Chromium-Version verlassen zu müssen.
      await page.emulateMediaType('print');

      // waitUntil: 'load' wartet, bis auch extern via <script src> geladene
      // Ressourcen (z. B. das FullCalendar-Skript von CDN in Woche/Monat)
      // vollständig geladen sind, bevor render() aufgerufen wird.
      await page.setContent(html, {
        waitUntil: 'load',
        timeout: 30000,
      });

      // Kurze zusätzliche Pause, damit FullCalendars eigener render()-Aufruf
      // (der erst im DOMContentLoaded-Handler des Templates läuft) sicher
      // abgeschlossen ist, bevor das PDF erzeugt wird.
      await new Promise((resolve) => setTimeout(resolve, 300));

      const pdfUint8 = await page.pdf({
        format: options.format ?? 'A4',
        landscape: options.landscape ?? false,
        printBackground: true,
        preferCSSPageSize: false,
        margin: {
          top: '10mm',
          bottom: '10mm',
          left: '8mm',
          right: '8mm',
        },
      });

      return Buffer.from(pdfUint8);
    } finally {
      await page.close();
    }
  }

  async onModuleDestroy(): Promise<void> {
    if (this.browserPromise) {
      try {
        const browser = await this.browserPromise;
        await browser.close();
      } catch (err) {
        this.logger.error('Fehler beim Schließen von Chromium', err as Error);
      }
    }
  }
}
