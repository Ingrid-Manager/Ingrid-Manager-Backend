import {
  HeatingEvent,
  HeatingRoom,
  canCool,
  canHeat,
  endedIn,
  evaluateHallway,
  evaluateRoom,
  eventWindow,
  isBridged,
  planHeating,
  planSeasonExit,
  startsIn,
} from './heating-rules';

const NOW = new Date(2026, 0, 15, 20, 0, 0);
const MINUTE = 60_000;

const at = (offsetMinutes: number) =>
  new Date(NOW.getTime() + offsetMinutes * MINUTE);

const room = (overrides: Partial<HeatingRoom> = {}): HeatingRoom => ({
  id: 1,
  locationId: 10,
  prelimTime: 60,
  comfortTemp: 21,
  emptyTemp: 16,
  heated: false,
  avmId: '11111 0000001',
  ...overrides,
});

/*
 * Termin, der `startOffset` Minuten relativ zu NOW beginnt und
 * `duration` Minuten dauert.
 */
const event = (
  id: number,
  startOffset: number,
  duration: number,
  roomId = 1,
): HeatingEvent => ({
  id,
  roomId,
  start: at(startOffset),
  end: at(startOffset + duration),
});

describe('heating rules', () => {
  describe('startsIn / endedIn', () => {
    it('should compute startsIn as start - now in minutes', () => {
      expect(startsIn(event(1, 30, 60), NOW)).toBe(30);
      expect(startsIn(event(1, -15, 60), NOW)).toBe(-15);
    });

    it('should compute endedIn as now - end in minutes', () => {
      // Termin endet in 90 Minuten
      expect(endedIn(event(1, 30, 60), NOW)).toBe(-90);
      // Termin ist seit 2 Minuten beendet
      expect(endedIn(event(1, -62, 60), NOW)).toBe(2);
    });
  });

  describe('HEAT', () => {
    it('should heat when the event starts within the prelim time', () => {
      expect(canHeat(room({ prelimTime: 60 }), event(1, 30, 60), NOW)).toBe(
        true,
      );
    });

    it('should not heat when the event starts outside the prelim time', () => {
      expect(canHeat(room({ prelimTime: 60 }), event(1, 61, 60), NOW)).toBe(
        false,
      );
      // startsIn < prelim_time ist strikt
      expect(canHeat(room({ prelimTime: 60 }), event(1, 60, 60), NOW)).toBe(
        false,
      );
    });

    it('should heat while the event is running', () => {
      expect(canHeat(room(), event(1, -30, 60), NOW)).toBe(true);
    });

    it('should not heat once the event has ended', () => {
      expect(canHeat(room(), event(1, -60, 60), NOW)).toBe(false);
      expect(canHeat(room(), event(1, -70, 60), NOW)).toBe(false);
    });

    it('should never heat rooms without prelim time', () => {
      expect(canHeat(room({ prelimTime: 0 }), event(1, -30, 60), NOW)).toBe(
        false,
      );
    });
  });

  describe('COOL', () => {
    it('should cool right after the event has ended', () => {
      expect(canCool(room(), event(1, -61, 60), NOW, false)).toBe(true);
    });

    it('should cool when the event has just ended', () => {
      // seit 30 Sekunden beendet
      const justEnded: HeatingEvent = {
        id: 1,
        roomId: 1,
        start: at(-60.5),
        end: at(-0.5),
      };

      expect(canCool(room(), justEnded, NOW, false)).toBe(true);
    });

    it('should not cool before the event has ended', () => {
      expect(canCool(room(), event(1, -30, 60), NOW, false)).toBe(false);
      expect(canCool(room(), event(1, -60, 60), NOW, false)).toBe(false);
    });

    it('should not cool five or more minutes after the event', () => {
      expect(canCool(room(), event(1, -65, 60), NOW, false)).toBe(false);
      expect(canCool(room(), event(1, -120, 60), NOW, false)).toBe(false);
    });

    it('should not cool when bridged', () => {
      expect(canCool(room(), event(1, -61, 60), NOW, true)).toBe(false);
    });

    it('should not cool rooms without prelim time', () => {
      expect(
        canCool(room({ prelimTime: 0 }), event(1, -61, 60), NOW, false),
      ).toBe(false);
    });
  });

  describe('BRIDGE', () => {
    it('should bridge a follow-up event in 30 minutes', () => {
      expect(isBridged([event(2, 30, 60)], NOW)).toBe(true);
    });

    it('should bridge a follow-up event in exactly 90 minutes', () => {
      expect(isBridged([event(2, 90, 60)], NOW)).toBe(true);
    });

    it('should not bridge a follow-up event in 91 minutes', () => {
      expect(isBridged([event(2, 91, 60)], NOW)).toBe(false);
    });

    it('should not bridge without a follow-up event', () => {
      expect(isBridged([], NOW)).toBe(false);
      // bereits laufende oder beendete Termine überbrücken nicht
      expect(isBridged([event(1, -61, 60), event(2, -10, 60)], NOW)).toBe(
        false,
      );
    });
  });

  describe('evaluateRoom', () => {
    it('should create a HEAT action to comfort_temp when not heated', () => {
      const decision = evaluateRoom(
        room({ heated: false }),
        [event(1, 30, 60)],
        NOW,
      );

      expect(decision.action).toEqual({
        roomId: 1,
        locationId: 10,
        action: 'HEAT',
        targetTemperature: 21,
        avmId: '11111 0000001',
        eventId: 1,
        reason: 'EVENT_PRELIM',
      });
      expect(decision.heatedAfter).toBe(true);
    });

    it('should not create another HEAT action when already heated', () => {
      const decision = evaluateRoom(
        room({ heated: true }),
        [event(1, 30, 60)],
        NOW,
      );

      expect(decision.heat).toBe(true);
      expect(decision.action).toBeNull();
      expect(decision.heatedAfter).toBe(true);
    });

    it('should not heat an event outside the prelim time', () => {
      const decision = evaluateRoom(room(), [event(1, 120, 60)], NOW);

      expect(decision.action).toBeNull();
      expect(decision.heatedAfter).toBe(false);
    });

    it('should create a COOL action to empty_temp when heated', () => {
      const decision = evaluateRoom(
        room({ heated: true }),
        [event(1, -62, 60)],
        NOW,
      );

      expect(decision.action).toEqual({
        roomId: 1,
        locationId: 10,
        action: 'COOL',
        targetTemperature: 16,
        avmId: '11111 0000001',
        eventId: 1,
        reason: 'EVENT_ENDED',
      });
      expect(decision.heatedAfter).toBe(false);
    });

    it('should not create a COOL action when not heated', () => {
      const decision = evaluateRoom(
        room({ heated: false }),
        [event(1, -62, 60)],
        NOW,
      );

      expect(decision.cool).toBe(true);
      expect(decision.action).toBeNull();
    });

    it('should not cool when a follow-up event starts in 30 minutes', () => {
      const decision = evaluateRoom(
        room({ heated: true, prelimTime: 15 }),
        [event(1, -62, 60), event(2, 30, 60)],
        NOW,
      );

      expect(decision.bridged).toBe(true);
      expect(decision.action).toBeNull();
      expect(decision.heatedAfter).toBe(true);
    });

    it('should not cool when a follow-up event starts in 90 minutes', () => {
      const decision = evaluateRoom(
        room({ heated: true, prelimTime: 15 }),
        [event(1, -62, 60), event(2, 90, 60)],
        NOW,
      );

      expect(decision.bridged).toBe(true);
      expect(decision.action).toBeNull();
    });

    it('should cool when the follow-up event starts in 91 minutes', () => {
      const decision = evaluateRoom(
        room({ heated: true, prelimTime: 15 }),
        [event(1, -62, 60), event(2, 91, 60)],
        NOW,
      );

      expect(decision.bridged).toBe(false);
      expect(decision.action?.action).toBe('COOL');
    });

    it('should ignore follow-up events of other rooms for bridging', () => {
      const decision = evaluateRoom(
        room({ heated: true }),
        [event(1, -62, 60)],
        NOW,
      );

      expect(decision.action?.action).toBe('COOL');
    });

    it('should let the event with the latest start win', () => {
      // e1 ist gerade beendet (COOL-Kandidat), e2 beginnt innerhalb der
      // Vorlaufzeit (HEAT-Kandidat) -> e2 gewinnt.
      const decision = evaluateRoom(
        room({ heated: false, prelimTime: 120 }),
        [event(1, -62, 60), event(2, 100, 60)],
        NOW,
      );

      expect(decision.event?.id).toBe(2);
      expect(decision.action?.action).toBe('HEAT');
      expect(decision.action?.eventId).toBe(2);
    });

    it('should pick the latest start among several heat candidates', () => {
      const decision = evaluateRoom(
        room({ heated: false, prelimTime: 60 }),
        [event(3, 40, 30), event(1, -20, 30), event(2, 10, 20)],
        NOW,
      );

      expect(decision.event?.id).toBe(3);
      expect(decision.action?.eventId).toBe(3);
    });

    it('should never cool while an earlier started event is still running', () => {
      // e1 läuft 09:00-12:00, e2 (10:00-10:30) ist gerade beendet und hat
      // den späteren Start -> trotzdem kein Absenken, solange e1 läuft.
      const decision = evaluateRoom(
        room({ heated: true }),
        [event(1, -60, 180), event(2, -31, 30)],
        NOW,
      );

      expect(decision.heat).toBe(true);
      expect(decision.event?.id).toBe(1);
      expect(decision.action).toBeNull();
      expect(decision.heatedAfter).toBe(true);
    });

    it('should never cool while the next event is within the prelim time', () => {
      // Vorlauf 120 Minuten, Folgetermin in 100 Minuten (außerhalb BRIDGE)
      const decision = evaluateRoom(
        room({ heated: true, prelimTime: 120 }),
        [event(1, -62, 60), event(2, 100, 60)],
        NOW,
      );

      expect(decision.bridged).toBe(false);
      expect(decision.action).toBeNull();
    });
  });

  describe('evaluateRoom fallback (NO_ACTIVE_EVENT)', () => {
    it('should cool a heated room after the cool window was missed', () => {
      // Termin seit 30 Minuten beendet (5-Minuten-Fenster verpasst)
      const decision = evaluateRoom(
        room({ heated: true }),
        [event(1, -90, 60)],
        NOW,
      );

      expect(decision.action).toEqual({
        roomId: 1,
        locationId: 10,
        action: 'COOL',
        targetTemperature: 16,
        avmId: '11111 0000001',
        eventId: null,
        reason: 'NO_ACTIVE_EVENT',
      });
      expect(decision.heatedAfter).toBe(false);
    });

    it('should cool a heated room without any events', () => {
      const decision = evaluateRoom(room({ heated: true }), [], NOW);

      expect(decision.action?.action).toBe('COOL');
      expect(decision.action?.reason).toBe('NO_ACTIVE_EVENT');
    });

    it('should cool when an event ends exactly now', () => {
      const decision = evaluateRoom(
        room({ heated: true }),
        [event(1, -60, 60)],
        NOW,
      );

      expect(decision.action?.action).toBe('COOL');
    });

    it('should prefer the regular COOL reason within the cool window', () => {
      const decision = evaluateRoom(
        room({ heated: true }),
        [event(1, -62, 60)],
        NOW,
      );

      expect(decision.action?.reason).toBe('EVENT_ENDED');
    });

    it('should not cool a heated room while bridged', () => {
      const decision = evaluateRoom(
        room({ heated: true, prelimTime: 15 }),
        [event(2, 45, 60)],
        NOW,
      );

      expect(decision.bridged).toBe(true);
      expect(decision.action).toBeNull();
    });

    it('should not touch rooms without prelim time', () => {
      const decision = evaluateRoom(
        room({ heated: true, prelimTime: 0 }),
        [],
        NOW,
      );

      expect(decision.action).toBeNull();
      expect(decision.heatedAfter).toBe(true);
    });

    it('should not act on rooms that are not heated', () => {
      expect(evaluateRoom(room({ heated: false }), [], NOW).action).toBeNull();
    });
  });

  describe('evaluateHallway', () => {
    const hallway = (overrides: Partial<HeatingRoom> = {}) =>
      room({ id: 99, comfortTemp: 19, emptyTemp: 15, ...overrides });

    it('should heat the hallway when at least one room is heated', () => {
      const decision = evaluateHallway(hallway(), 1, [], NOW);

      expect(decision.action).toEqual(
        expect.objectContaining({
          roomId: 99,
          action: 'HEAT',
          targetTemperature: 19,
          reason: 'HALLWAY_OCCUPIED',
        }),
      );
    });

    it('should not heat the hallway when no room is heated', () => {
      expect(evaluateHallway(hallway(), 0, [], NOW).action).toBeNull();
    });

    it('should not heat the hallway without avm_id', () => {
      expect(
        evaluateHallway(hallway({ avmId: null }), 2, [], NOW).action,
      ).toBeNull();
      expect(
        evaluateHallway(hallway({ avmId: '  ' }), 2, [], NOW).action,
      ).toBeNull();
    });

    it('should not heat the hallway again when already heated', () => {
      expect(
        evaluateHallway(hallway({ heated: true }), 3, [], NOW).action,
      ).toBeNull();
    });

    it('should cool the hallway when it is the only heated room', () => {
      const decision = evaluateHallway(hallway({ heated: true }), 1, [], NOW);

      expect(decision.action).toEqual(
        expect.objectContaining({
          roomId: 99,
          action: 'COOL',
          targetTemperature: 15,
          reason: 'HALLWAY_EMPTY',
        }),
      );
    });

    it('should not cool the hallway when an event starts anywhere in the house', () => {
      const decision = evaluateHallway(
        hallway({ heated: true }),
        1,
        [event(5, 45, 60, 7)],
        NOW,
      );

      expect(decision.bridgedAny).toBe(true);
      expect(decision.action).toBeNull();
    });

    it('should not cool the hallway while other rooms are heated', () => {
      expect(
        evaluateHallway(hallway({ heated: true }), 2, [], NOW).action,
      ).toBeNull();
    });
  });

  describe('planHeating', () => {
    const hallwayRoom = room({
      id: 99,
      avmId: '99999 0000099',
      comfortTemp: 19,
      emptyTemp: 15,
    });

    it('should heat room and hallway in the same run', () => {
      const plan = planHeating({
        now: NOW,
        rooms: [room(), hallwayRoom],
        events: [event(1, 30, 60)],
        hallways: new Map([[10, 99]]),
      });

      expect(plan.actions.map((a) => [a.roomId, a.action])).toEqual([
        [1, 'HEAT'],
        [99, 'HEAT'],
      ]);
    });

    it('should not apply the normal room rule to the hallway', () => {
      const plan = planHeating({
        now: NOW,
        rooms: [hallwayRoom],
        events: [event(1, 30, 60, 99)],
        hallways: new Map([[10, 99]]),
      });

      // kein anderer Raum beheizt -> kein FLOOR_HEAT, auch wenn ein Termin
      // im Flur selbst stattfindet
      expect(plan.actions).toEqual([]);
      expect(plan.roomDecisions).toEqual([]);
    });

    it('should cool the hallway when the last room is cooled', () => {
      const plan = planHeating({
        now: NOW,
        rooms: [room({ heated: true }), { ...hallwayRoom, heated: true }],
        events: [event(1, -62, 60)],
        hallways: new Map([[10, 99]]),
      });

      expect(plan.actions.map((a) => [a.roomId, a.action])).toEqual([
        [1, 'COOL'],
        [99, 'COOL'],
      ]);
    });

    it('should keep the hallway heated when an event of another room follows', () => {
      const plan = planHeating({
        now: NOW,
        rooms: [
          room({ heated: true }),
          room({ id: 2, prelimTime: 30, avmId: '22222' }),
          { ...hallwayRoom, heated: true },
        ],
        events: [event(1, -62, 60), event(2, 60, 60, 2)],
        hallways: new Map([[10, 99]]),
      });

      expect(plan.actions.map((a) => [a.roomId, a.action])).toEqual([
        [1, 'COOL'],
      ]);
    });

    it('should evaluate the hallway rule per location', () => {
      const plan = planHeating({
        now: NOW,
        rooms: [
          room({ id: 1, locationId: 10 }),
          { ...hallwayRoom, id: 99, locationId: 10 },
          room({ id: 2, locationId: 20, avmId: '22222' }),
          { ...hallwayRoom, id: 98, locationId: 20, heated: true },
        ],
        // Termin nur in Location 10; in Location 20 ist nur der Flur beheizt
        events: [event(1, 30, 60, 1)],
        hallways: new Map([
          [10, 99],
          [20, 98],
        ]),
      });

      expect(
        plan.actions.map((a) => [a.locationId, a.roomId, a.action]),
      ).toEqual([
        [10, 1, 'HEAT'],
        [10, 99, 'HEAT'],
        [20, 98, 'COOL'],
      ]);
    });

    it('should not let events of another location bridge the hallway', () => {
      const plan = planHeating({
        now: NOW,
        rooms: [
          room({ id: 3, locationId: 30 }),
          { ...hallwayRoom, id: 98, locationId: 20, heated: true },
        ],
        events: [event(7, 45, 60, 3)],
        hallways: new Map([[20, 98]]),
      });

      expect(plan.actions).toEqual(
        expect.arrayContaining([
          expect.objectContaining({ roomId: 98, action: 'COOL' }),
        ]),
      );
    });

    it('should ignore a hallway mapping that points to another location', () => {
      const plan = planHeating({
        now: NOW,
        rooms: [room({ heated: false }), { ...hallwayRoom, locationId: 20 }],
        events: [event(1, 30, 60)],
        hallways: new Map([[10, 99]]),
      });

      // Raum 99 gehört zu Location 20 und wird daher wie ein normaler Raum
      // behandelt (ohne Termin -> keine Aktion)
      expect(plan.actions.map((a) => a.roomId)).toEqual([1]);
    });

    it('should report events of unknown rooms', () => {
      const plan = planHeating({
        now: NOW,
        rooms: [room()],
        events: [event(1, 30, 60, 1), event(2, 30, 60, 404)],
        hallways: new Map(),
      });

      expect(plan.unknownRoomEventIds).toEqual([2]);
      expect(plan.actions).toHaveLength(1);
    });
  });

  describe('planSeasonExit', () => {
    it('should cool every heated room once', () => {
      const actions = planSeasonExit([
        room({ id: 1, heated: true }),
        room({ id: 2, heated: false }),
        room({ id: 3, heated: true, avmId: null }),
      ]);

      expect(actions.map((a) => [a.roomId, a.action, a.reason])).toEqual([
        [1, 'COOL', 'SEASON_END'],
        [3, 'COOL', 'SEASON_END'],
      ]);
      expect(actions[0].targetTemperature).toBe(16);
    });

    it('should create no actions when nothing is heated', () => {
      expect(planSeasonExit([room({ heated: false })])).toEqual([]);
    });
  });

  describe('eventWindow', () => {
    it('should cover the cool window and the largest look-ahead', () => {
      const window = eventWindow([room({ prelimTime: 180 })], NOW);

      expect(window.from).toEqual(at(-5));
      expect(window.to).toEqual(at(181));
    });

    it('should at least cover the bridge window', () => {
      const window = eventWindow([room({ prelimTime: 30 })], NOW);

      expect(window.to).toEqual(at(91));
    });
  });
});
