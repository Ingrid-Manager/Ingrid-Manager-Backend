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
  /*
   * Datei für das ausführliche Fehlerprotokoll der Heizungssteuerung
   * (HEATING_LOG_FILE, Default logs/heating.log). null = abgeschaltet
   * (HEATING_LOG_FILE=false).
   */
  logFile?: string | null;
  /* Maximale Dateigröße vor der Rotation (HEATING_LOG_FILE_MAX_SIZE_MB, Default 10) */
  logFileMaxSizeMb?: number;
};
