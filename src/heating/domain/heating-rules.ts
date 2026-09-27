/*
 * Heizregel - reine, zustandslose Auswertungslogik.
 *
 * Bewusst ohne Nest-/TypeORM-Abhängigkeiten, damit sich die Regeln
 * isoliert testen lassen. Alle Zeitangaben (startsIn/endedIn,
 * prelim_time, Bridging-/Absenk-Fenster) sind in Minuten.
 */

/** Bridging: Folgetermin innerhalb dieser Zeit -> Raum bleibt beheizt. */
export const BRIDGE_MINUTES = 90;

/** Absenk-Fenster nach Terminende: COOL greift für endedIn in (−5, 0). */
export const COOL_WINDOW_MINUTES = 5;

export enum HeatingAction {
  HEAT = 'heat',
  COOL = 'cool',
}

export interface HeatingRoomInput {
  id: number;
  title: string;
  avm_id?: string | null;
  comfort_temp: number;
  empty_temp: number;
  prelim_time: number;
  heated: boolean;
  locationid: number;
}

export interface HeatingEventInput {
  id: number;
  title: string;
  roomid: number;
  start: Date;
  end: Date;
}

export interface HeatingDecision {
  action: HeatingAction | null;
  /** Ausschlaggebender Termin e* (bzw. null bei Flur/Saison-Ende). */
  event: HeatingEventInput | null;
  reason: string;
}

export interface HeatingSeason {
  start: string | null;
  end: string | null;
}

function minutesBetween(from: Date, to: Date): number {
  return (to.getTime() - from.getTime()) / 60_000;
}

/** Minuten bis zum Terminbeginn (negativ = Termin hat bereits begonnen). */
export function startsIn(event: HeatingEventInput, now: Date): number {
  return minutesBetween(now, event.start);
}

/** Minuten bis zum Terminende (negativ = Termin ist bereits beendet). */
export function endedIn(event: HeatingEventInput, now: Date): number {
  return minutesBetween(now, event.end);
}

function toMonthDay(value: string): number {
  const [month, day] = value.split('-').map((part) => parseInt(part, 10));
  return month * 100 + day;
}

/**
 * IN_SEASON(now): Liegt `now` im (jahresunabhängigen) Saison-Fenster?
 * Unterstützt Fenster über den Jahreswechsel (z. B. 10-01 bis 04-30).
 * Ist Start oder Ende nicht konfiguriert, gilt ganzjährig Saison.
 */
export function isInSeason(now: Date, season: HeatingSeason): boolean {
  if (!season.start || !season.end) {
    return true;
  }

  const today = (now.getMonth() + 1) * 100 + now.getDate();
  const start = toMonthDay(season.start);
  const end = toMonthDay(season.end);

  if (start <= end) {
    return today >= start && today <= end;
  }

  return today >= start || today <= end;
}

/** BRIDGE(r) bzw. BRIDGE_ANY: bevorstehender Termin in max. 90 Minuten. */
export function hasBridge(events: HeatingEventInput[], now: Date): boolean {
  return events.some((event) => {
    const minutes = startsIn(event, now);
    return minutes > 0 && minutes <= BRIDGE_MINUTES;
  });
}

export function isHeat(
  room: HeatingRoomInput,
  event: HeatingEventInput,
  now: Date,
): boolean {
  return (
    room.prelim_time !== 0 &&
    startsIn(event, now) < room.prelim_time &&
    endedIn(event, now) > 0
  );
}

export function isCool(
  room: HeatingRoomInput,
  event: HeatingEventInput,
  now: Date,
  bridge: boolean,
): boolean {
  const minutes = endedIn(event, now);
  return (
    room.prelim_time !== 0 &&
    minutes < 0 &&
    minutes > -COOL_WINDOW_MINUTES &&
    !bridge
  );
}

/**
 * Regel für einen normalen Raum.
 *
 * @param roomEvents aktive Termine (nicht gelöscht, kein Hintergrund)
 *                   ausschließlich dieses Raums
 */
export function evaluateRoom(
  room: HeatingRoomInput,
  roomEvents: HeatingEventInput[],
  now: Date,
): HeatingDecision {
  const bridge = hasBridge(roomEvents, now);

  const candidates = roomEvents.filter(
    (event) => isHeat(room, event, now) || isCool(room, event, now, bridge),
  );

  if (candidates.length === 0) {
    // Sicherheitsnetz: Das reguläre Absenken greift nur in den ersten
    // 5 Minuten nach Terminende. Ist der Raum danach noch beheizt (z. B.
    // weil die Fritzbox nicht erreichbar war, das Backend neu gestartet
    // wurde oder ein überbrückender Folgetermin entfernt wurde) und steht
    // weder ein laufender noch ein anstehender Termin an, wird das
    // Absenken nachgeholt.
    if (room.heated && room.prelim_time !== 0 && !bridge) {
      return {
        action: HeatingAction.COOL,
        event: null,
        reason: 'Kein laufender oder anstehender Termin (Absenken nachgeholt)',
      };
    }
    return { action: null, event: null, reason: 'Kein zutreffender Termin' };
  }

  // Prioritätsregel: spätester Terminbeginn gewinnt -> e*
  const winner = candidates.reduce((latest, event) =>
    event.start.getTime() > latest.start.getTime() ? event : latest,
  );

  if (isHeat(room, winner, now)) {
    return room.heated
      ? { action: null, event: winner, reason: 'Bereits beheizt' }
      : {
          action: HeatingAction.HEAT,
          event: winner,
          reason: `Termin "${winner.title}" beginnt innerhalb der Vorlaufzeit bzw. läuft`,
        };
  }

  return room.heated
    ? {
        action: HeatingAction.COOL,
        event: winner,
        reason: `Termin "${winner.title}" ist beendet, kein Folgetermin in ${BRIDGE_MINUTES} Minuten`,
      }
    : { action: null, event: winner, reason: 'Bereits abgesenkt' };
}

/**
 * Sonderregel für den Flur.
 *
 * @param rooms     alle Räume inkl. Flur mit ihrem aktuellen `heated`-Stand
 *                  (d. h. nach Auswertung der normalen Räume)
 * @param allEvents aktive Termine aller Räume (für BRIDGE_ANY)
 */
export function evaluateHallway(
  hallway: HeatingRoomInput,
  rooms: HeatingRoomInput[],
  allEvents: HeatingEventInput[],
  now: Date,
): HeatingDecision {
  const heatedCount = rooms.filter((room) => room.heated).length;
  const hasAvmId = !!hallway.avm_id && hallway.avm_id.trim() !== '';

  if (!hallway.heated && heatedCount > 0 && hasAvmId) {
    return {
      action: HeatingAction.HEAT,
      event: null,
      reason: `${heatedCount} Raum/Räume beheizt`,
    };
  }

  if (hallway.heated && heatedCount === 1 && !hasBridge(allEvents, now)) {
    return {
      action: HeatingAction.COOL,
      event: null,
      reason: 'Flur ist der einzige beheizte Raum, kein Termin in Kürze',
    };
  }

  return { action: null, event: null, reason: 'Keine Änderung' };
}

/**
 * Außerhalb der Saison: einmaliger Absenk-Befehl für noch beheizte Räume
 * (Season-Exit). Durch den `heated`-Zustand ist das idempotent - danach
 * werden keine weiteren Befehle mehr gesendet.
 */
export function evaluateOutOfSeason(room: HeatingRoomInput): HeatingDecision {
  return room.heated
    ? {
        action: HeatingAction.COOL,
        event: null,
        reason: 'Heizsaison beendet (Season-Exit)',
      }
    : { action: null, event: null, reason: 'Außerhalb der Heizsaison' };
}
