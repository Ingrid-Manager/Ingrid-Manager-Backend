export type AppConfig = {
  nodeEnv: string;
  name: string;
  workingDirectory: string;
  frontendDomain?: string;
  backendDomain: string;
  port: number;
  apiPrefix: string;
  fallbackLanguage: string;
  headerLanguage: string;
  logoURL: string;
  iconURL: string;
  /** Basis-URL des externen PDF-Render-Servers, z. B. "https://pdf.ingrid-manager.de" */
  pdfServiceBaseUrl?: string;
  /** Geteiltes Secret zwischen Backend und PDF-Server (beide Richtungen) */
  pdfServiceAppKey?: string;
  /** Kategorie der importierten Ferien (HOLIDAY_CATEGORY_ID, Default 9999) */
  holidayCategoryId?: number;
  /** Raum der importierten Ferien (HOLIDAY_ROOM_ID, Default 9999) */
  holidayRoomId?: number;
};
