export type HeatingConfig = {
  /* Beginn der Heizsaison im Format MM-DD (HEATING_SEASON_START) */
  seasonStart?: string;
  /* Ende der Heizsaison im Format MM-DD (HEATING_SEASON_END) */
  seasonEnd?: string;
  /*
   * Raum-IDs der Flure (HEATING_HALLWAY_ROOM_ID, kommagetrennt). Über die
   * locationid des Raums ist jeder Flur eindeutig einer Location
   * zugeordnet; pro Location ist höchstens ein Flur zulässig.
   */
  hallwayRoomIds: number[];
  /* Minütlicher Scheduler aktiv? (HEATING_SCHEDULER_ENABLED, Default true) */
  schedulerEnabled: boolean;
};
