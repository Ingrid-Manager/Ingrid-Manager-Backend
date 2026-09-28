import { getIsoWeek } from './iso-week';

describe('getIsoWeek', () => {
  it('should use the ISO week year around the turn of the year', () => {
    expect(getIsoWeek(new Date(2025, 11, 29))).toEqual({ week: 1, year: 2026 });
    expect(getIsoWeek(new Date(2027, 0, 1))).toEqual({ week: 53, year: 2026 });
    expect(getIsoWeek(new Date(2027, 0, 4))).toEqual({ week: 1, year: 2027 });
    expect(getIsoWeek(new Date(2028, 0, 3))).toEqual({ week: 1, year: 2028 });
  });

  it('should compute regular weeks', () => {
    expect(getIsoWeek(new Date(2026, 8, 28))).toEqual({ week: 40, year: 2026 });
    expect(getIsoWeek(new Date(2027, 5, 7))).toEqual({ week: 23, year: 2027 });
  });
});
