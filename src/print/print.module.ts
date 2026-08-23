import { Module } from '@nestjs/common';
import { CalendarEventsModule } from '../calendar-events/calendar-events.module';
import { RoomsModule } from '../rooms/rooms.module';
import { PrintController } from './print.controller';
import { PrintHtmlController } from './print-html.controller';
import { PrintService } from './print.service';
import { RemotePdfRendererService } from './remote-pdf-renderer.service';
import { PrintHtmlCacheService } from './print-html-cache.service';
import { PrintTemplateService } from './print-template.service';

/**
 * Eigenständiges Feature-Modul für die Kalender-Druckfunktion. Das PDF
 * wird NICHT mehr lokal per Puppeteer/Chromium in diesem Backend erzeugt
 * — stattdessen generiert dieses Modul nur noch das HTML (siehe
 * PrintTemplateService), legt es kurzzeitig unter einem einmalig
 * nutzbaren Token ab (PrintHtmlCacheService, abrufbar über
 * PrintHtmlController) und lässt einen externen, dedizierten Linux-
 * Server mit vollem Root-Zugriff die eigentliche PDF-Erzeugung
 * übernehmen (siehe RemotePdfRendererService sowie pdf-service/ im
 * Repo-Root für den Code des externen Servers).
 *
 * Grund für die Auslagerung: Auf dem (Shared-Hosting-)Server dieses
 * Backends fehlt der Root-Zugriff, um Chromiums Linux-Systemabhängig-
 * keiten sauber zu installieren.
 *
 * Importiert CalendarEventsModule und RoomsModule, um an die
 * benötigten Termine/Räume zu kommen, statt deren Logik zu duplizieren.
 */
@Module({
  imports: [CalendarEventsModule, RoomsModule],
  controllers: [PrintController, PrintHtmlController],
  providers: [
    PrintService,
    RemotePdfRendererService,
    PrintHtmlCacheService,
    PrintTemplateService,
  ],
})
export class PrintModule {}
