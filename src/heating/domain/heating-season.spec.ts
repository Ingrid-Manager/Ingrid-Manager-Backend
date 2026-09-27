import {
  HeatingSeason,
  isInSeason,
  parseHeatingSeason,
  parseMonthDay,
} from './heating-season';

const localDate = (year: number, month: number, day: number) =>
  new Date(year, month - 1, day, 12, 0, 0);

describe('heating season', () => {
  describe('parseMonthDay', () => {
    it('should parse a valid MM-DD value', () => {
      expect(parseMonthDay('10-01')).toEqual({ month: 10, day: 1 });
      expect(parseMonthDay(' 04-30 ')).toEqual({ month: 4, day: 30 });
      expect(parseMonthDay('02-29')).toEqual({ month: 2, day: 29 });
    });

    it('should reject missing or malformed values', () => {
      expect(parseMonthDay(undefined)).toBeNull();
      expect(parseMonthDay('')).toBeNull();
      expect(parseMonthDay('2026-10-01')).toBeNull();
      expect(parseMonthDay('1-5')).toBeNull();
      expect(parseMonthDay('13-01')).toBeNull();
      expect(parseMonthDay('00-10')).toBeNull();
      expect(parseMonthDay('04-31')).toBeNull();
      expect(parseMonthDay('02-30')).toBeNull();
    });

    it('should require both season boundaries', () => {
      expect(parseHeatingSeason('10-01', undefined)).toBeNull();
      expect(parseHeatingSeason(undefined, '04-30')).toBeNull();
      expect(parseHeatingSeason('10-01', '04-30')).toEqual({
        start: { month: 10, day: 1 },
        end: { month: 4, day: 30 },
      });
    });
  });

  describe('isInSeason across the turn of the year (10-01 .. 04-30)', () => {
    const season: HeatingSeason = parseHeatingSeason('10-01', '04-30');

    it('should be in season within the season', () => {
      expect(isInSeason(localDate(2026, 12, 24), season)).toBe(true);
      expect(isInSeason(localDate(2027, 1, 15), season)).toBe(true);
      expect(isInSeason(localDate(2026, 11, 1), season)).toBe(true);
    });

    it('should treat both boundaries as inclusive', () => {
      expect(isInSeason(localDate(2026, 10, 1), season)).toBe(true);
      expect(isInSeason(localDate(2027, 4, 30), season)).toBe(true);
      expect(isInSeason(new Date(2026, 9, 1, 0, 0, 0), season)).toBe(true);
      expect(isInSeason(new Date(2027, 3, 30, 23, 59, 59), season)).toBe(true);
    });

    it('should be out of season outside the season', () => {
      expect(isInSeason(localDate(2026, 9, 30), season)).toBe(false);
      expect(isInSeason(localDate(2027, 5, 1), season)).toBe(false);
      expect(isInSeason(localDate(2026, 7, 15), season)).toBe(false);
    });

    it('should work year independently', () => {
      for (const year of [2025, 2026, 2027, 2028]) {
        expect(isInSeason(localDate(year, 1, 1), season)).toBe(true);
        expect(isInSeason(localDate(year, 6, 1), season)).toBe(false);
      }
    });

    it('should handle leap days', () => {
      expect(isInSeason(localDate(2028, 2, 29), season)).toBe(true);
    });
  });

  describe('isInSeason within one calendar year (03-01 .. 05-31)', () => {
    const season: HeatingSeason = parseHeatingSeason('03-01', '05-31');

    it('should be in season between start and end', () => {
      expect(isInSeason(localDate(2026, 3, 1), season)).toBe(true);
      expect(isInSeason(localDate(2026, 4, 15), season)).toBe(true);
      expect(isInSeason(localDate(2026, 5, 31), season)).toBe(true);
    });

    it('should be out of season before start and after end', () => {
      expect(isInSeason(localDate(2026, 2, 28), season)).toBe(false);
      expect(isInSeason(localDate(2026, 6, 1), season)).toBe(false);
      expect(isInSeason(localDate(2026, 12, 1), season)).toBe(false);
    });
  });
});
