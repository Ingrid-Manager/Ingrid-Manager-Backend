import { Injectable, Logger, OnModuleDestroy } from '@nestjs/common';
import { randomBytes } from 'node:crypto';

interface CacheEntry {
  html: string;
  expiresAt: number;
}

/**
 * Legt generiertes Druck-HTML kurzzeitig unter einem kryptografisch
 * zufälligen Token ab, damit der externe PDF-Render-Server es per HTTP
 * abrufen kann (siehe PrintHtmlController).
 *
 * Sicherheitseigenschaften:
 * - Token: 256 Bit Zufall (32 Byte über crypto.randomBytes), praktisch
 *   nicht erratbar.
 * - Einmalig nutzbar: `consume()` löscht den Eintrag sofort nach dem
 *   ersten erfolgreichen Abruf — ein abgefangener Token ist danach
 *   wertlos.
 * - Kurze Lebensdauer (Standard 2 Minuten): selbst ein nie abgerufener
 *   Token verschwindet von selbst.
 *
 * Robustheit: Jeder Eintrag kann durch das eingebettete FullCalendar-
 * Bundle mehrere hundert KB groß sein (Woche/Monat-Vorlagen). Ohne
 * Begrenzung könnte ein Burst gleichzeitiger Druckanfragen (z. B. wenn
 * der externe PDF-Server gerade nicht erreichbar ist und die Einträge
 * sich anhäufen, bevor sie abgeholt/durch Ablauf entfernt werden) den
 * Arbeitsspeicher spürbar belasten. Deshalb zusätzlich zur TTL eine
 * harte Obergrenze an gleichzeitig gespeicherten Einträgen — wird sie
 * überschritten, fliegt der älteste Eintrag raus (auch wenn er noch
 * nicht abgelaufen war). Außerdem läuft die Bereinigung nicht nur
 * beim nächsten store()-Aufruf, sondern zusätzlich periodisch, damit
 * abgelaufene Einträge auch ganz ohne neue Druckaufträge verschwinden.
 *
 * Läuft rein im Arbeitsspeicher dieses Node-Prozesses. Bei mehreren
 * Backend-Instanzen hinter einem Load-Balancer müsste das durch einen
 * geteilten Store (z. B. Redis) ersetzt werden — für den aktuellen
 * Single-Instance-Betrieb ausreichend.
 */
@Injectable()
export class PrintHtmlCacheService implements OnModuleDestroy {
  private readonly logger = new Logger(PrintHtmlCacheService.name);
  private readonly cache = new Map<string, CacheEntry>();
  private readonly ttlMs = 2 * 60 * 1000; // 2 Minuten
  private readonly maxEntries = 100;
  private readonly cleanupInterval = setInterval(
    () => this.cleanupExpired(),
    30 * 1000,
  );

  store(html: string): string {
    this.cleanupExpired();
    this.evictOldestIfOverCapacity();

    const token = randomBytes(32).toString('hex');
    this.cache.set(token, { html, expiresAt: Date.now() + this.ttlMs });
    return token;
  }

  /**
   * Liefert das HTML zum Token und löscht ihn sofort (einmalig nutzbar).
   * Gibt `null` zurück, wenn der Token unbekannt, bereits verwendet oder
   * abgelaufen ist.
   */
  consume(token: string): string | null {
    const entry = this.cache.get(token);
    this.cache.delete(token);

    if (!entry) {
      return null;
    }

    if (Date.now() > entry.expiresAt) {
      return null;
    }

    return entry.html;
  }

  private cleanupExpired(): void {
    const now = Date.now();
    for (const [token, entry] of this.cache.entries()) {
      if (now > entry.expiresAt) {
        this.cache.delete(token);
      }
    }
  }

  private evictOldestIfOverCapacity(): void {
    if (this.cache.size < this.maxEntries) {
      return;
    }

    // Map behält die Einfüge-Reihenfolge — der erste Schlüssel ist damit
    // automatisch der älteste Eintrag.
    const oldestToken = this.cache.keys().next().value;
    if (oldestToken !== undefined) {
      this.cache.delete(oldestToken);
      this.logger.warn(
        `Cache-Obergrenze (${this.maxEntries}) erreicht — ältester Eintrag verworfen.`,
      );
    }
  }

  onModuleDestroy(): void {
    clearInterval(this.cleanupInterval);
  }
}
