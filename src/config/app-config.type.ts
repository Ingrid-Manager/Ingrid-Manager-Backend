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
  /** Secret für Anfragen des Backends an den PDF-Server (Bearer-Token) */
  pdfServiceAppKey?: string;
  /**
   * Optionales eigenes Secret für den Rückruf des PDF-Servers (X-App-Key).
   * Ohne Angabe gilt pdfServiceAppKey für beide Richtungen.
   */
  pdfServiceCallbackKey?: string;
  /** Für CORS zugelassene Origins (APP_CORS_ORIGINS bzw. FRONTEND_DOMAIN) */
  corsOrigins: string[];
  /** Swagger unter /docs bereitstellen (APP_SWAGGER_ENABLED) */
  swaggerEnabled: boolean;
};
