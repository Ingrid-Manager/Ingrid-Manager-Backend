import { I18nContext } from 'nestjs-i18n';

export const t = (key: string) => {
  return I18nContext.current()?.t(key) ?? key;
};
