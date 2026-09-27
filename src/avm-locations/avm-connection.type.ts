/*
 * Entschlüsselte Zugangsdaten der FRITZ!Box einer AVM-Location.
 * Wird ausschließlich im Backend verwendet und niemals über die API
 * ausgeliefert.
 */
export interface AvmConnection {
  locationId: number;
  title: string;
  url: string;
  username: string;
  password: string;
}
