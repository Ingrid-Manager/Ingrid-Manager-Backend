import { parseHallwayRoomIds, readHeatingEnv } from './heating.config';

describe('heating config', () => {
  describe('readHeatingEnv', () => {
    it('should treat empty values as not set', () => {
      expect(
        readHeatingEnv({
          HEATING_SEASON_START: '',
          HEATING_SEASON_END: '   ',
          HEATING_HALLWAY_ROOM_ID: '',
          HEATING_SCHEDULER_ENABLED: '',
        }),
      ).toEqual({
        HEATING_SEASON_START: undefined,
        HEATING_SEASON_END: undefined,
        HEATING_HALLWAY_ROOM_ID: undefined,
        HEATING_SCHEDULER_ENABLED: undefined,
      });
    });

    it('should keep and trim configured values', () => {
      expect(
        readHeatingEnv({
          HEATING_SEASON_START: ' 10-01 ',
          HEATING_SEASON_END: '04-30',
          HEATING_HALLWAY_ROOM_ID: '3, 7',
          HEATING_SCHEDULER_ENABLED: 'false',
        }),
      ).toEqual({
        HEATING_SEASON_START: '10-01',
        HEATING_SEASON_END: '04-30',
        HEATING_HALLWAY_ROOM_ID: '3, 7',
        HEATING_SCHEDULER_ENABLED: 'false',
      });
    });

    it('should ignore unrelated variables', () => {
      expect(Object.keys(readHeatingEnv({ DATABASE_PASSWORD: 'x' }))).toEqual([
        'HEATING_SEASON_START',
        'HEATING_SEASON_END',
        'HEATING_HALLWAY_ROOM_ID',
        'HEATING_SCHEDULER_ENABLED',
      ]);
    });
  });

  describe('parseHallwayRoomIds', () => {
    it('should parse a comma separated list of room ids', () => {
      expect(parseHallwayRoomIds('3')).toEqual([3]);
      expect(parseHallwayRoomIds(' 3 , 7,12 ')).toEqual([3, 7, 12]);
    });

    it('should return an empty list when not configured', () => {
      expect(parseHallwayRoomIds(undefined)).toEqual([]);
      expect(parseHallwayRoomIds('')).toEqual([]);
    });
  });
});
