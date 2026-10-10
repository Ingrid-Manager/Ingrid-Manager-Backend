import { registerDecorator, ValidationOptions } from 'class-validator';

import { isSecureOrLocalUrl } from '../../utils/local-host';

/*
 * Zulässige FRITZ!Box-Adresse: HTTPS oder - weil die FRITZ!Box im lokalen
 * Netz meist nur ein selbstsigniertes Zertifikat hat - HTTP zu einer
 * lokalen bzw. privaten Adresse. Über HTTP an einen öffentlichen Host
 * würde die Session-ID (SID) im Klartext übertragen.
 */
export function isAllowedFritzBoxUrl(value: unknown): boolean {
  if (typeof value !== 'string') {
    return false;
  }

  let url: URL;

  try {
    url = new URL(value);
  } catch {
    return false;
  }

  return isSecureOrLocalUrl(url);
}

export function IsFritzBoxUrl(validationOptions?: ValidationOptions) {
  return (object: object, propertyName: string) => {
    registerDecorator({
      name: 'isFritzBoxUrl',
      target: object.constructor,
      propertyName,
      options: {
        message: `${propertyName} muss eine HTTPS-URL sein (HTTP ist nur für lokale bzw. private Adressen erlaubt)`,
        ...validationOptions,
      },
      validator: {
        validate: (value: unknown) => isAllowedFritzBoxUrl(value),
      },
    });
  };
}
