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
};
