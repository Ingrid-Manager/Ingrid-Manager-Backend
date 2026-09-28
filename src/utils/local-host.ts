import { isIP } from 'node:net';

/*
 * Erkennt Hosts, die nicht über das öffentliche Internet erreicht werden:
 * localhost/Loopback, private IPv4-Bereiche (RFC 1918), Link-Local,
 * IPv6 Unique-Local/Link-Local sowie Hostnamen ohne Punkt (z. B.
 * Docker-Dienstnamen) und die FRITZ!Box-Standardadresse "fritz.box".
 * Für solche Ziele wird eine unverschlüsselte HTTP-Verbindung toleriert.
 */
export function isLocalOrPrivateHost(hostname: string): boolean {
  const host = hostname.replace(/^\[|\]$/g, '').toLowerCase();

  if (host === 'localhost' || host.endsWith('.localhost')) {
    return true;
  }

  if (host === 'fritz.box' || host.endsWith('.fritz.box')) {
    return true;
  }

  const ipVersion = isIP(host);

  if (ipVersion === 4) {
    const [a, b] = host.split('.').map(Number);

    return (
      a === 127 ||
      a === 10 ||
      (a === 172 && b >= 16 && b <= 31) ||
      (a === 192 && b === 168) ||
      (a === 169 && b === 254)
    );
  }

  if (ipVersion === 6) {
    return (
      host === '::1' ||
      host.startsWith('fc') ||
      host.startsWith('fd') ||
      host.startsWith('fe80:')
    );
  }

  // Einfache Hostnamen ohne Domain (z. B. "pdf-service" im Docker-Netz)
  return !host.includes('.');
}

/*
 * true, wenn die URL per HTTPS angesprochen wird oder - bei HTTP - auf einen
 * lokalen bzw. privaten Host zeigt.
 */
export function isSecureOrLocalUrl(url: URL): boolean {
  if (url.protocol === 'https:') {
    return true;
  }

  return url.protocol === 'http:' && isLocalOrPrivateHost(url.hostname);
}
