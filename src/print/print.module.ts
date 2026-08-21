import { Module } from '@nestjs/common';
import { CalendarEventsModule } from '../calendar-events/calendar-events.module';
import { RoomsModule } from '../rooms/rooms.module';
import { PrintController } from './print.controller';
import { PrintService } from './print.service';
import { PdfRendererService } from './pdf-renderer.service';
import { PrintTemplateService } from './print-template.service';

/**
 * Eigenständiges Feature-Modul für die Kalender-Druckfunktion (PDF via
 * Headless Chromium/Puppeteer) — analog zu anderen Cross-Cutting-Concerns
 * in diesem Projekt, die ebenfalls als eigene Top-Level-Module unter
 * src/ organisiert sind (vgl. src/mailer als generische
 * E-Mail-Versand-Infrastruktur, unabhängig davon, WER E-Mails
 * versendet).
 *
 * Importiert CalendarEventsModule und RoomsModule, um an die
 * benötigten Termine/Räume zu kommen, statt deren Logik zu duplizieren.
 */
@Module({
  imports: [CalendarEventsModule, RoomsModule],
  controllers: [PrintController],
  providers: [PrintService, PdfRendererService, PrintTemplateService],
})
export class PrintModule {}
