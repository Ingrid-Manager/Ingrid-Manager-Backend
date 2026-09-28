import {
  FALLBACK_ROOM_COLOR,
  buildWeekEvents,
  contrastTextColor,
  sanitizeHexColor,
  toSafeInlineJson,
} from './print-fullcalendar-data';
import { CalendarEventResponseDto } from '../calendar-events/application/dto/calendar-event-response.dto';

describe('print-fullcalendar-data', () => {
  describe('sanitizeHexColor', () => {
    it('should keep valid hex colors', () => {
      expect(sanitizeHexColor('#1a2B3c')).toBe('#1a2B3c');
      expect(sanitizeHexColor('#abc')).toBe('#abc');
      expect(sanitizeHexColor('#abcd')).toBe('#abcd');
      expect(sanitizeHexColor('11223344')).toBe('#11223344');
    });

    it('should replace everything else with the fallback color', () => {
      expect(sanitizeHexColor('red;background:url(http://intern/)')).toBe(
        FALLBACK_ROOM_COLOR,
      );
      expect(sanitizeHexColor('#12345')).toBe(FALLBACK_ROOM_COLOR);
      expect(sanitizeHexColor('')).toBe(FALLBACK_ROOM_COLOR);
      expect(sanitizeHexColor(null)).toBe(FALLBACK_ROOM_COLOR);
      expect(sanitizeHexColor(undefined)).toBe(FALLBACK_ROOM_COLOR);
    });
  });

  describe('contrastTextColor', () => {
    it('should pick black on light and white on dark colors', () => {
      expect(contrastTextColor('#ffffff')).toBe('#000000');
      expect(contrastTextColor('#000000')).toBe('#ffffff');
    });
  });

  describe('toSafeInlineJson', () => {
    it('should not allow closing the surrounding script tag', () => {
      expect(toSafeInlineJson({ title: '</script><b>' })).not.toContain('<');
    });
  });

  describe('buildWeekEvents', () => {
    it('should only pass sanitized room colors to the template', () => {
      const [event] = buildWeekEvents([
        {
          title: 'Probe',
          start: new Date(2026, 8, 28, 10, 0),
          end: new Date(2026, 8, 28, 11, 0),
          allDay: false,
          color: 'red;background:url(http://intern/)',
          room_title: 'Saal',
        } as unknown as CalendarEventResponseDto,
      ]);

      expect(event.extendedProps).toEqual({
        roomColor: FALLBACK_ROOM_COLOR,
        roomTextColor: contrastTextColor(FALLBACK_ROOM_COLOR),
        roomTitle: 'Saal',
      });
    });
  });
});
