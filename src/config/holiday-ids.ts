import { ConfigService } from '@nestjs/config';

/*
 * Kategorie und (versteckter) Raum, unter denen importierte Feiertage und
 * Schulferien als Hintergrundtermine gespeichert werden. Standardmäßig die
 * bisher fest verdrahtete ID 9999; über HOLIDAY_CATEGORY_ID bzw.
 * HOLIDAY_ROOM_ID lassen sich stattdessen reguläre IDs verwenden (eine
 * explizit eingefügte ID 9999 setzt den AUTO_INCREMENT der Tabelle hoch).
 */
export const DEFAULT_HOLIDAY_CATEGORY_ID = 9999;
export const DEFAULT_HOLIDAY_ROOM_ID = 9999;

const positiveInt = (value: unknown, fallback: number): number =>
  typeof value === 'number' && Number.isInteger(value) && value > 0
    ? value
    : fallback;

export function resolveHolidayIds(configService: ConfigService): {
  categoryId: number;
  roomId: number;
} {
  return {
    categoryId: positiveInt(
      configService.get<number>('app.holidayCategoryId', { infer: true }),
      DEFAULT_HOLIDAY_CATEGORY_ID,
    ),
    roomId: positiveInt(
      configService.get<number>('app.holidayRoomId', { infer: true }),
      DEFAULT_HOLIDAY_ROOM_ID,
    ),
  };
}
