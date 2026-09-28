import { HeatingAction } from './heating-action';

/*
 * Kalendergesteuerte Heizungsregel als reine, zustandslose Domain-Logik.
 *
 * Die Funktionen kennen weder die Datenbank noch die FRITZ!Box: sie bekommen
 * Räume, Termine und den Zeitpunkt `now` übergeben und liefern die daraus
 * resultierenden Heizaktionen (HEAT / COOL) zurück.
 */

export const MS_PER_MINUTE = 60_000;

/* Fenster (Minuten) nach Terminende, in dem abgesenkt wird. */
export const COOL_WINDOW_MINUTES = 5;

/* Fenster (Minuten), in dem ein Folgetermin das Absenken verhindert. */
export const BRIDGE_WINDOW_MINUTES = 90;

export interface HeatingRoom {
  id: number;
  locationId: number;
  /* Vorlaufzeit in Minuten (room.prelim_time) */
  prelimTime: number;
  comfortTemp: number;
  emptyTemp: number;
  heated: boolean;
  avmId: string | null;
}

export interface HeatingEvent {
  id: number;
  roomId: number;
  start: Date;
  end: Date;
}

/*
 * startsIn(event) = event.start - now (in Minuten)
 *
 *   > 0  Termin beginnt in der Zukunft
 *   <= 0 Termin hat bereits begonnen
 */
export function startsIn(event: HeatingEvent, now: Date): number {
  return (event.start.getTime() - now.getTime()) / MS_PER_MINUTE;
}

/*
 * endedIn(event) = now - event.end (in Minuten)
 *
 *   < 0  Termin ist noch nicht beendet
 *   > 0  Termin ist seit endedIn Minuten beendet
 *
 * Hinweis: Die Heiz-/Absenkregeln sind so formuliert, dass sie genau diese
 * Semantik abbilden ("Termin ist noch nicht beendet" bzw. "Absenkung
 * unmittelbar nach Ende des Termins"). Dafür werden die Vergleiche auf
 * endedIn hier mit diesem Vorzeichen ausgewertet.
 */
export function endedIn(event: HeatingEvent, now: Date): number {
  return (now.getTime() - event.end.getTime()) / MS_PER_MINUTE;
}

function hasPrelimTime(room: HeatingRoom): boolean {
  return Number(room.prelimTime) !== 0 && Number.isFinite(room.prelimTime);
}

/*
 * HEAT(e) := r.prelim_time != 0
 *            AND startsIn(e) < r.prelim_time
 *            AND Termin ist noch nicht beendet
 */
export function canHeat(
  room: HeatingRoom,
  event: HeatingEvent,
  now: Date,
): boolean {
  return (
    hasPrelimTime(room) &&
    startsIn(event, now) < room.prelimTime &&
    endedIn(event, now) < 0
  );
}

/*
 * BRIDGE(r) := ∃ e2 im Raum r mit 0 < startsIn(e2) <= 90
 *
 * `events` muss bereits auf die aktiven Termine des Raums (bzw. für
 * BRIDGE_ANY auf die der Location) eingeschränkt sein.
 */
export function isBridged(events: HeatingEvent[], now: Date): boolean {
  return events.some((event) => {
    const minutes = startsIn(event, now);

    return minutes > 0 && minutes <= BRIDGE_WINDOW_MINUTES;
  });
}

/*
 * COOL(e) := r.prelim_time != 0
 *            AND Termin ist seit weniger als 5 Minuten beendet
 *            AND NOT BRIDGE(r)
 */
export function canCool(
  room: HeatingRoom,
  event: HeatingEvent,
  now: Date,
  bridged: boolean,
): boolean {
  const minutesSinceEnd = endedIn(event, now);

  return (
    hasPrelimTime(room) &&
    minutesSinceEnd > 0 &&
    minutesSinceEnd < COOL_WINDOW_MINUTES &&
    !bridged
  );
}

export interface RoomDecision {
  room: HeatingRoom;
  /* e*: der entscheidende Termin (spätester Start aller Kandidaten) */
  event: HeatingEvent | null;
  heat: boolean;
  cool: boolean;
  bridged: boolean;
  action: HeatingAction | null;
  /* Zustand des Raums nach Anwendung der Entscheidung */
  heatedAfter: boolean;
}

/*
 * Wertet die Heizregel für einen normalen Raum aus.
 *
 * Erfüllen mehrere Termine HEAT oder COOL, gewinnt der Termin mit dem
 * spätesten Start (e*). Nur e* bestimmt die Entscheidung. Eine Aktion wird
 * nur bei einem tatsächlichen Zustandswechsel erzeugt (Idempotenz).
 *
 * Ergänzungen zur Grundregel:
 *
 *   - HEAT hat Vorrang vor COOL: solange ein Termin des Raums läuft bzw.
 *     sich in der Vorlaufzeit befindet, wird nie abgesenkt (e* wird dann
 *     unter den HEAT-Kandidaten bestimmt). Das verhindert ein Absenken
 *     während eines noch laufenden, früher begonnenen Termins.
 *
 *   - Rückfallregel (NO_ACTIVE_EVENT): Ein Raum mit Vorlaufzeit, der noch
 *     als beheizt markiert ist, obwohl weder ein Termin heizt noch ein
 *     Folgetermin überbrückt, wird abgesenkt. Damit bleibt kein Raum
 *     dauerhaft beheizt, wenn das 5-Minuten-Absenkfenster verpasst wurde
 *     (FRITZ!Box/Thermostat nicht erreichbar, Neustart des Backends,
 *     gelöschter oder verschobener Folge- bzw. laufender Termin, manuell
 *     gesetztes `heated`). Ein fehlgeschlagener COOL-Befehl wird so in
 *     jedem Lauf erneut versucht, bis er erfolgreich war.
 */
export function evaluateRoom(
  room: HeatingRoom,
  roomEvents: HeatingEvent[],
  now: Date,
): RoomDecision {
  const bridged = isBridged(roomEvents, now);

  const heatCandidates = roomEvents.filter((event) =>
    canHeat(room, event, now),
  );
  const coolCandidates =
    heatCandidates.length > 0
      ? []
      : roomEvents.filter((event) => canCool(room, event, now, bridged));

  const winner = latestStart(
    heatCandidates.length > 0 ? heatCandidates : coolCandidates,
  );
  const heat = winner !== null && heatCandidates.length > 0;
  const cool = winner !== null && !heat;

  let action: HeatingAction | null = null;

  if (heat && !room.heated) {
    action = {
      roomId: room.id,
      locationId: room.locationId,
      action: 'HEAT',
      targetTemperature: room.comfortTemp,
      avmId: room.avmId,
      eventId: winner.id,
      reason: 'EVENT_PRELIM',
    };
  } else if (cool && room.heated) {
    action = {
      roomId: room.id,
      locationId: room.locationId,
      action: 'COOL',
      targetTemperature: room.emptyTemp,
      avmId: room.avmId,
      eventId: winner.id,
      reason: 'EVENT_ENDED',
    };
  } else if (!heat && !bridged && room.heated && hasPrelimTime(room)) {
    action = {
      roomId: room.id,
      locationId: room.locationId,
      action: 'COOL',
      targetTemperature: room.emptyTemp,
      avmId: room.avmId,
      eventId: null,
      reason: 'NO_ACTIVE_EVENT',
    };
  }

  return {
    room,
    event: winner,
    heat,
    cool,
    bridged,
    action,
    heatedAfter: action ? action.action === 'HEAT' : room.heated,
  };
}

function latestStart(events: HeatingEvent[]): HeatingEvent | null {
  return events.reduce<HeatingEvent | null>(
    (latest, event) =>
      !latest || event.start.getTime() > latest.start.getTime()
        ? event
        : latest,
    null,
  );
}

export interface HallwayDecision {
  hallway: HeatingRoom;
  heatedRoomCount: number;
  bridgedAny: boolean;
  action: HeatingAction | null;
}

function hasAvmId(room: HeatingRoom): boolean {
  return typeof room.avmId === 'string' && room.avmId.trim() !== '';
}

/*
 * Flur-Sonderregel für eine Location.
 *
 *   H          = { r | r.heated = true } (inkl. Flur; ohne Räume ohne
 *                Vorlaufzeit, da diese nicht kalendergesteuert sind)
 *   BRIDGE_ANY = ∃ Termin der Location mit 0 < startsIn <= 90
 *
 *   FLOOR_HEAT := !flur.heated AND |H| > 0 AND flur.avm_id vorhanden
 *   FLOOR_COOL :=  flur.heated AND |H| = 1 AND NOT BRIDGE_ANY
 *
 * `heatedRoomCount` ist |H| und muss den Zustand der übrigen Räume *nach*
 * Auswertung der normalen Heizregeln enthalten.
 */
export function evaluateHallway(
  hallway: HeatingRoom,
  heatedRoomCount: number,
  locationEvents: HeatingEvent[],
  now: Date,
): HallwayDecision {
  const bridgedAny = isBridged(locationEvents, now);
  let action: HeatingAction | null = null;

  if (!hallway.heated && heatedRoomCount > 0 && hasAvmId(hallway)) {
    action = {
      roomId: hallway.id,
      locationId: hallway.locationId,
      action: 'HEAT',
      targetTemperature: hallway.comfortTemp,
      avmId: hallway.avmId,
      eventId: null,
      reason: 'HALLWAY_OCCUPIED',
    };
  } else if (hallway.heated && heatedRoomCount === 1 && !bridgedAny) {
    action = {
      roomId: hallway.id,
      locationId: hallway.locationId,
      action: 'COOL',
      targetTemperature: hallway.emptyTemp,
      avmId: hallway.avmId,
      eventId: null,
      reason: 'HALLWAY_EMPTY',
    };
  }

  return { hallway, heatedRoomCount, bridgedAny, action };
}

export interface HeatingPlanInput {
  now: Date;
  rooms: HeatingRoom[];
  events: HeatingEvent[];
  /* Flur-Raum-ID je Location */
  hallways: Map<number, number>;
}

export interface HeatingPlan {
  actions: HeatingAction[];
  roomDecisions: RoomDecision[];
  hallwayDecisions: HallwayDecision[];
  /* Termine, deren roomid keinem bekannten Raum zugeordnet werden kann */
  unknownRoomEventIds: number[];
}

/*
 * Berechnet alle Heizaktionen eines Scheduler-Laufs innerhalb der
 * Heizsaison. Aktionen werden strikt pro Location berechnet; ein Termin
 * oder Raum einer Location beeinflusst niemals eine andere Location.
 */
export function planHeating(input: HeatingPlanInput): HeatingPlan {
  const { now, rooms, events, hallways } = input;

  const roomsById = new Map(rooms.map((room) => [room.id, room]));
  const eventsByRoom = new Map<number, HeatingEvent[]>();
  const eventsByLocation = new Map<number, HeatingEvent[]>();
  const unknownRoomEventIds: number[] = [];

  for (const event of events) {
    const room = roomsById.get(event.roomId);

    if (!room) {
      unknownRoomEventIds.push(event.id);
      continue;
    }

    push(eventsByRoom, room.id, event);
    push(eventsByLocation, room.locationId, event);
  }

  const hallwayIds = new Set<number>();
  for (const [locationId, roomId] of hallways) {
    if (roomsById.get(roomId)?.locationId === locationId) {
      hallwayIds.add(roomId);
    }
  }

  const actions: HeatingAction[] = [];
  const roomDecisions: RoomDecision[] = [];
  const heatedCountByLocation = new Map<number, number>();

  for (const room of rooms) {
    if (hallwayIds.has(room.id)) {
      continue;
    }

    const decision = evaluateRoom(room, eventsByRoom.get(room.id) ?? [], now);
    roomDecisions.push(decision);

    if (decision.action) {
      actions.push(decision.action);
    }

    // Räume ohne Vorlaufzeit sind nicht kalendergesteuert und werden nie
    // abgesenkt; ein (z. B. manuell) als beheizt markierter Raum dieser Art
    // würde den Flur sonst dauerhaft warm halten.
    if (decision.heatedAfter && hasPrelimTime(room)) {
      heatedCountByLocation.set(
        room.locationId,
        (heatedCountByLocation.get(room.locationId) ?? 0) + 1,
      );
    }
  }

  const hallwayDecisions: HallwayDecision[] = [];

  for (const hallwayId of hallwayIds) {
    const hallway = roomsById.get(hallwayId);
    const otherHeated = heatedCountByLocation.get(hallway.locationId) ?? 0;
    // Der Flur zählt in H mit.
    const heatedRoomCount = otherHeated + (hallway.heated ? 1 : 0);

    const decision = evaluateHallway(
      hallway,
      heatedRoomCount,
      eventsByLocation.get(hallway.locationId) ?? [],
      now,
    );
    hallwayDecisions.push(decision);

    if (decision.action) {
      actions.push(decision.action);
    }
  }

  return { actions, roomDecisions, hallwayDecisions, unknownRoomEventIds };
}

/*
 * Einmaliger Absenkvorgang beim Verlassen der Heizsaison: alle noch als
 * beheizt markierten Räume werden auf ihre Absenktemperatur gesetzt. Da die
 * Aktion den persistierten Zustand auf heated = false setzt, erzeugt jeder
 * weitere Lauf außerhalb der Saison keine Aktion mehr (idempotent).
 */
export function planSeasonExit(rooms: HeatingRoom[]): HeatingAction[] {
  return rooms
    .filter((room) => room.heated)
    .map((room) => ({
      roomId: room.id,
      locationId: room.locationId,
      action: 'COOL' as const,
      targetTemperature: room.emptyTemp,
      avmId: room.avmId,
      eventId: null,
      reason: 'SEASON_END' as const,
    }));
}

/*
 * Zeitraum, für den Termine geladen werden müssen: vom Beginn des
 * Absenkfensters bis zur größten Vorlaufzeit bzw. dem Bridging-Fenster.
 */
export function eventWindow(
  rooms: HeatingRoom[],
  now: Date,
): { from: Date; to: Date } {
  const maxPrelim = rooms.reduce(
    (max, room) =>
      Number.isFinite(room.prelimTime) ? Math.max(max, room.prelimTime) : max,
    0,
  );
  const aheadMinutes = Math.max(maxPrelim, BRIDGE_WINDOW_MINUTES) + 1;

  return {
    from: new Date(now.getTime() - COOL_WINDOW_MINUTES * MS_PER_MINUTE),
    to: new Date(now.getTime() + aheadMinutes * MS_PER_MINUTE),
  };
}

function push<K, V>(map: Map<K, V[]>, key: K, value: V) {
  const list = map.get(key);

  if (list) {
    list.push(value);
  } else {
    map.set(key, [value]);
  }
}
