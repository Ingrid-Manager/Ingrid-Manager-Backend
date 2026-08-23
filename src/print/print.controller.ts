import { Body, Controller, Post, UseGuards } from '@nestjs/common';
import { AuthGuard } from '@nestjs/passport';
import { Roles } from '../roles/roles.decorator';
import { RoleEnum } from '../roles/roles.enum';
import { RolesGuard } from '../roles/roles.guard';
import { PrintService } from './print.service';
import { PrintCalendarDto } from './dto/print-calendar.dto';

/**
 * Eigener Controller (statt einer Methode im CalendarEventsController),
 * damit die Druckfunktion als eigenständiges Feature-Modul (src/print/)
 * organisiert ist — analog zu anderen Cross-Cutting-Concerns in diesem
 * Projekt (vgl. src/mail vs. src/mailer). Der Pfad bleibt bewusst unter
 * "calendar-events", da inhaltlich Kalendertermine gedruckt werden
 * (REST-Konvention: Sub-Ressource der eigentlichen Ressource); NestJS
 * erlaubt es problemlos, dass mehrere Controller in unterschiedlichen
 * Modulen zum selben Basis-Pfad beitragen.
 */
@Roles(RoleEnum.admin, RoleEnum.verwaltung, RoleEnum.user, RoleEnum.guest)
@UseGuards(AuthGuard('jwt'), RolesGuard)
@Controller({
  path: 'calendar-events',
  version: '1',
})
export class PrintController {
  constructor(private readonly printService: PrintService) {}

  /**
   * Stößt die PDF-Erzeugung an und liefert die Download-URL zurück, unter
   * der das fertige PDF DIREKT vom externen PDF-Server abrufbar ist (das
   * PDF selbst fließt nicht mehr durch dieses Backend — spart eine
   * komplette Datenübertragung über den ohnehin eingeschränkten
   * Backend-Server).
   *
   * Fehler (z. B. externer PDF-Server nicht erreichbar) werden NICHT hier
   * abgefangen — RemotePdfRendererService wirft dafür bereits passende
   * HttpExceptions (z. B. BadGatewayException → HTTP 502) mit sinnvoller
   * Fehlermeldung. NestJS' eingebaute Fehlerbehandlung übernimmt den Rest.
   */
  @Post('print')
  async printCalendar(
    @Body() dto: PrintCalendarDto,
  ): Promise<{ downloadUrl: string }> {
    const downloadUrl = await this.printService.generateCalendarPdf(dto);
    return { downloadUrl };
  }
}
