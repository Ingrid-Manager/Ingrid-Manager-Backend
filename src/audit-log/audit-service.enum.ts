/**
 * Grobe fachliche Zuordnung eines Audit-Log-Eintrags zu einem Backend-Modul.
 * Dient primär der Filterung/Kategorisierung im Admin-Frontend (Sortierleiste).
 */
export enum AuditService {
  EVENTS = 'events',
  RESOURCES = 'resources',
  USERS = 'users',
  AUTH = 'auth',
  REORGANIZATION = 'reorganization',
  SYSTEM = 'system',
}
