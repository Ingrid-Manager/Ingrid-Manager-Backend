export type HeatingConfig = {
  /** Automatische Auswertung per Cron (jede Minute) aktiv? */
  enabled: boolean;
  /** Start der Heizsaison im Format MM-DD, null = ganzjährig. */
  seasonStart: string | null;
  /** Ende der Heizsaison im Format MM-DD, null = ganzjährig. */
  seasonEnd: string | null;
  /** room.id des Flurs (Sonderregel), null = keine Flur-Sonderregel. */
  hallwayRoomId: number | null;
};
