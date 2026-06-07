import { i18nValidationMessage } from 'nestjs-i18n';

export const vMsg = (key: string) => i18nValidationMessage(`validation.${key}`);
