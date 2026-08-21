import { BadRequestException, Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { CalendarEventsService } from '../calendar-events/calendar-events.service';
import { RoomsService } from '../rooms/rooms.service';
import { PdfRendererService } from './pdf-renderer.service';
import { PrintTemplateService } from './print-template.service';
import {
  PrintCalendarDto,
  PrintViewType,
  MAX_PRINTABLE_ROOMS,
} from './dto/print-calendar.dto';
import {
  buildMonthEvents,
  buildWeekEvents,
  buildYearEvents,
  toSafeInlineJson,
  PrintRoom,
} from './print-fullcalendar-data';
import { AllConfigType } from '../config/config.type';
import { CalendarEventFilterDto } from '../calendar-events/application/dto/calendar-event-filter.dto';

interface ResolvedRange {
  start: Date;
  end: Date; // exklusiv
  rangeLabel: string;
}

const TEMPLATE_BY_TYPE: Record<PrintViewType, string> = {
  [PrintViewType.week]: 'print-week',
  [PrintViewType.month]: 'print-month',
  [PrintViewType.year]: 'print-year',
};

/**
 * Woche/Monat: DIN A4 quer (wie in den Original-Vorlagen).
 * Jahr: DIN A3 quer, 4 Seiten (ein Quartal je Seite) — siehe print-year.hbs.
 */
const PDF_OPTIONS_BY_TYPE: Record<
  PrintViewType,
  { format: 'A4' | 'A3'; landscape: boolean }
> = {
  [PrintViewType.week]: { format: 'A4', landscape: true },
  [PrintViewType.month]: { format: 'A4', landscape: true },
  [PrintViewType.year]: { format: 'A3', landscape: true },
};

@Injectable()
export class PrintService {
  constructor(
    private readonly calendarEventsService: CalendarEventsService,
    private readonly roomsService: RoomsService,
    private readonly pdfRenderer: PdfRendererService,
    private readonly templates: PrintTemplateService,
    private readonly configService: ConfigService<AllConfigType>,
  ) {}

  async generateCalendarPdf(dto: PrintCalendarDto): Promise<Buffer> {
    const range = this.resolveRange(dto.type, dto.date);
    const rooms = await this.resolveRooms(dto.roomIds);
    const roomIdSet = new Set(rooms.map((r) => r.id));

    const filter = new CalendarEventFilterDto();
    filter.start = range.start.toISOString();
    filter.end = range.end.toISOString();

    const allEvents = await this.calendarEventsService.findInRange(filter);
    const events = allEvents.filter(
      (event) => event.room_id !== undefined && roomIdSet.has(event.room_id),
    );

    const orgName =
      this.configService.get<string>('ORG_NAME', { infer: true }) ??
      'Ingrid-Manager';

    const baseContext = {
      orgName,
      orgNameJson: toSafeInlineJson(orgName),
      logoUrl: this.configService.get<string>('app.logoURL', { infer: true }),
      rangeLabel: range.rangeLabel,
      printedAt: new Date().toLocaleString('de-DE', {
        dateStyle: 'medium',
        timeStyle: 'short',
      }),
      rooms,
      roomsJson: toSafeInlineJson(rooms),
      year: range.start.getFullYear(),
      initialDateIso: this.toDateOnlyIso(range.start),
    };

    let eventsJson: string;

    switch (dto.type) {
      case PrintViewType.week:
        eventsJson = toSafeInlineJson(buildWeekEvents(events));
        break;
      case PrintViewType.month:
        eventsJson = toSafeInlineJson(buildMonthEvents(events));
        break;
      case PrintViewType.year:
        eventsJson = toSafeInlineJson(buildYearEvents(events));
        break;
      default:
        throw new BadRequestException('Unbekannter Ansichtstyp.');
    }

    // Woche/Monat nutzen FullCalendar; das Bundle wird lokal aus dem
    // npm-Paket geladen (siehe PrintTemplateService) statt per CDN, u. a.
    // damit es exakt zur im Frontend verwendeten Version passt.
    const needsFullCalendar =
      dto.type === PrintViewType.week || dto.type === PrintViewType.month;
    const fullCalendarScript = needsFullCalendar
      ? await this.templates.getFullCalendarScript()
      : '';

    const html = await this.templates.render(TEMPLATE_BY_TYPE[dto.type], {
      ...baseContext,
      eventsJson,
      fullCalendarScript,
    });

    return this.pdfRenderer.renderHtmlToPdf(
      html,
      PDF_OPTIONS_BY_TYPE[dto.type],
    );
  }

  private async resolveRooms(roomIds?: number[]): Promise<PrintRoom[]> {
    const allRooms = await this.roomsService.findNames();

    const rooms = roomIds?.length
      ? allRooms.filter((room) => roomIds.includes(room.id))
      : allRooms;

    if (rooms.length === 0) {
      throw new BadRequestException(
        'Es wurde kein gültiger Raum für den Ausdruck ausgewählt.',
      );
    }

    // Die Validierung im DTO (@ArrayMaxSize) greift nur, wenn roomIds
    // explizit übergeben wurde. Wurde kein roomIds übergeben ("alle
    // Räume drucken"), muss hier zusätzlich geprüft werden, ob die
    // Gesamtanzahl der Räume in der Datenbank das Druck-Limit
    // überschreitet — die Vorlagen (v. a. Jahresansicht) sind für mehr
    // als MAX_PRINTABLE_ROOMS Räume nicht ausgelegt (Legende/Farben).
    if (rooms.length > MAX_PRINTABLE_ROOMS) {
      throw new BadRequestException(
        `Es gibt ${rooms.length} Räume, es können aber maximal ${MAX_PRINTABLE_ROOMS} ` +
          'gleichzeitig gedruckt werden. Bitte gezielt Räume auswählen.',
      );
    }

    return rooms.map((room) => ({
      id: room.id,
      title: room.title,
      color: room.color,
    }));
  }

  private toDateOnlyIso(date: Date): string {
    const y = date.getFullYear();
    const m = String(date.getMonth() + 1).padStart(2, '0');
    const d = String(date.getDate()).padStart(2, '0');
    return `${y}-${m}-${d}`;
  }

  private resolveRange(type: PrintViewType, dateStr: string): ResolvedRange {
    const date = new Date(dateStr);

    if (Number.isNaN(date.getTime())) {
      throw new BadRequestException('Ungültiges Datum übergeben.');
    }

    switch (type) {
      case PrintViewType.week: {
        const start = this.startOfWeek(date);
        const end = new Date(start);
        end.setDate(end.getDate() + 7);
        return {
          start,
          end,
          rangeLabel: `KW ${this.getIsoWeekNumber(start)} · ${start.getFullYear()}`,
        };
      }
      case PrintViewType.month: {
        const start = new Date(date.getFullYear(), date.getMonth(), 1);
        const end = new Date(date.getFullYear(), date.getMonth() + 1, 1);
        return {
          start,
          end,
          rangeLabel: start.toLocaleDateString('de-DE', {
            month: 'long',
            year: 'numeric',
          }),
        };
      }
      case PrintViewType.year: {
        const start = new Date(date.getFullYear(), 0, 1);
        const end = new Date(date.getFullYear() + 1, 0, 1);
        return { start, end, rangeLabel: `${start.getFullYear()}` };
      }
      default:
        throw new BadRequestException('Unbekannter Ansichtstyp.');
    }
  }

  private startOfWeek(date: Date): Date {
    const d = new Date(date);
    const day = (d.getDay() + 6) % 7; // Montag = 0
    d.setHours(0, 0, 0, 0);
    d.setDate(d.getDate() - day);
    return d;
  }

  private getIsoWeekNumber(date: Date): number {
    const d = new Date(
      Date.UTC(date.getFullYear(), date.getMonth(), date.getDate()),
    );
    const dayNum = d.getUTCDay() || 7;
    d.setUTCDate(d.getUTCDate() + 4 - dayNum);
    const yearStart = new Date(Date.UTC(d.getUTCFullYear(), 0, 1));
    return Math.ceil(((d.getTime() - yearStart.getTime()) / 86400000 + 1) / 7);
  }
}
