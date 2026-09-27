import {
  HeatingAction,
  HeatingEventInput,
  HeatingRoomInput,
  evaluateHallway,
  evaluateOutOfSeason,
  evaluateRoom,
  hasBridge,
  isInSeason,
} from './heating-rules';

const NOW = new Date('2026-01-15T12:00:00');

function at(minutesFromNow: number): Date {
  return new Date(NOW.getTime() + minutesFromNow * 60_000);
}

function room(overrides: Partial<HeatingRoomInput> = {}): HeatingRoomInput {
  return {
    id: 1,
    title: 'Saal',
    avm_id: '12345 0000001',
    comfort_temp: 21,
    empty_temp: 16,
    prelim_time: 60,
    heated: false,
    locationid: 1,
    ...overrides,
  };
}

function event(
  id: number,
  startMin: number,
  endMin: number,
  roomid = 1,
): HeatingEventInput {
  return {
    id,
    title: `Termin ${id}`,
    roomid,
    start: at(startMin),
    end: at(endMin),
  };
}

describe('heating-rules', () => {
  describe('isInSeason', () => {
    it('gilt ganzjährig, wenn nichts konfiguriert ist', () => {
      expect(isInSeason(NOW, { start: null, end: null })).toBe(true);
    });

    it('unterstützt Fenster über den Jahreswechsel', () => {
      const season = { start: '10-01', end: '04-30' };
      expect(isInSeason(new Date('2026-01-15T12:00:00'), season)).toBe(true);
      expect(isInSeason(new Date('2026-10-01T00:00:00'), season)).toBe(true);
      expect(isInSeason(new Date('2026-04-30T23:59:00'), season)).toBe(true);
      expect(isInSeason(new Date('2026-07-01T12:00:00'), season)).toBe(false);
    });

    it('unterstützt Fenster innerhalb eines Jahres', () => {
      const season = { start: '03-01', end: '05-31' };
      expect(isInSeason(new Date('2026-04-10T12:00:00'), season)).toBe(true);
      expect(isInSeason(new Date('2026-06-01T12:00:00'), season)).toBe(false);
    });
  });

  describe('hasBridge', () => {
    it('erkennt Folgetermine in (0, 90] Minuten', () => {
      expect(hasBridge([event(1, 90, 120)], NOW)).toBe(true);
      expect(hasBridge([event(1, 91, 120)], NOW)).toBe(false);
      expect(hasBridge([event(1, -10, 30)], NOW)).toBe(false);
    });
  });

  describe('evaluateRoom', () => {
    it('heizt innerhalb der Vorlaufzeit auf', () => {
      const result = evaluateRoom(room(), [event(1, 30, 120)], NOW);
      expect(result.action).toBe(HeatingAction.HEAT);
      expect(result.event?.id).toBe(1);
    });

    it('heizt nicht vor Beginn der Vorlaufzeit', () => {
      expect(evaluateRoom(room(), [event(1, 60, 120)], NOW).action).toBeNull();
    });

    it('heizt während eines laufenden Termins auf', () => {
      expect(evaluateRoom(room(), [event(1, -30, 30)], NOW).action).toBe(
        HeatingAction.HEAT,
      );
    });

    it('ist idempotent, wenn bereits beheizt', () => {
      expect(
        evaluateRoom(room({ heated: true }), [event(1, -30, 30)], NOW).action,
      ).toBeNull();
    });

    it('sendet keine Befehle bei prelim_time = 0', () => {
      expect(
        evaluateRoom(room({ prelim_time: 0 }), [event(1, -30, 30)], NOW).action,
      ).toBeNull();
      expect(
        evaluateRoom(
          room({ prelim_time: 0, heated: true }),
          [event(1, -60, -2)],
          NOW,
        ).action,
      ).toBeNull();
    });

    it('senkt innerhalb von 5 Minuten nach Terminende ab', () => {
      const result = evaluateRoom(
        room({ heated: true }),
        [event(1, -60, -2)],
        NOW,
      );
      expect(result.action).toBe(HeatingAction.COOL);
    });

    it('holt das Absenken nach, wenn das 5-Minuten-Fenster verpasst wurde', () => {
      const result = evaluateRoom(room({ heated: true }), [], NOW);
      expect(result.action).toBe(HeatingAction.COOL);
      expect(result.event).toBeNull();
    });

    it('holt das Absenken nicht nach, solange ein Folgetermin überbrückt', () => {
      expect(
        evaluateRoom(
          room({ heated: true, prelim_time: 30 }),
          [event(1, 80, 140)],
          NOW,
        ).action,
      ).toBeNull();
    });

    it('holt das Absenken bei prelim_time = 0 nicht nach', () => {
      expect(
        evaluateRoom(room({ heated: true, prelim_time: 0 }), [], NOW).action,
      ).toBeNull();
    });

    it('senkt nicht ab, wenn in 90 Minuten ein Folgetermin ansteht (Bridging)', () => {
      const result = evaluateRoom(
        room({ heated: true, prelim_time: 30 }),
        [event(1, -60, -2), event(2, 80, 140)],
        NOW,
      );
      expect(result.action).toBeNull();
    });

    it('wählt bei mehreren Treffern den spätesten Terminbeginn', () => {
      // Termin 1 gerade beendet (COOL), Termin 2 in Vorlaufzeit (HEAT)
      const result = evaluateRoom(
        room({ heated: false }),
        [event(1, -60, -2), event(2, 20, 80)],
        NOW,
      );
      expect(result.event?.id).toBe(2);
      expect(result.action).toBe(HeatingAction.HEAT);
    });
  });

  describe('evaluateHallway', () => {
    const hallway = room({ id: 99, title: 'Flur', avm_id: 'grp1' });

    it('heizt, sobald irgendein Raum beheizt ist', () => {
      const rooms = [room({ heated: true }), hallway];
      expect(evaluateHallway(hallway, rooms, [], NOW).action).toBe(
        HeatingAction.HEAT,
      );
    });

    it('heizt nicht ohne avm_id', () => {
      const noAvm = { ...hallway, avm_id: '' };
      const rooms = [room({ heated: true }), noAvm];
      expect(evaluateHallway(noAvm, rooms, [], NOW).action).toBeNull();
    });

    it('senkt ab, wenn nur noch der Flur beheizt ist', () => {
      const heatedHallway = { ...hallway, heated: true };
      const rooms = [room(), heatedHallway];
      expect(evaluateHallway(heatedHallway, rooms, [], NOW).action).toBe(
        HeatingAction.COOL,
      );
    });

    it('senkt nicht ab, wenn in irgendeinem Raum ein Termin bevorsteht', () => {
      const heatedHallway = { ...hallway, heated: true };
      const rooms = [room(), heatedHallway];
      expect(
        evaluateHallway(heatedHallway, rooms, [event(1, 60, 120, 5)], NOW)
          .action,
      ).toBeNull();
    });

    it('bleibt beheizt, solange andere Räume beheizt sind', () => {
      const heatedHallway = { ...hallway, heated: true };
      const rooms = [room({ heated: true }), heatedHallway];
      expect(evaluateHallway(heatedHallway, rooms, [], NOW).action).toBeNull();
    });
  });

  describe('evaluateOutOfSeason', () => {
    it('senkt beheizte Räume einmalig ab', () => {
      expect(evaluateOutOfSeason(room({ heated: true })).action).toBe(
        HeatingAction.COOL,
      );
      expect(evaluateOutOfSeason(room()).action).toBeNull();
    });
  });
});
