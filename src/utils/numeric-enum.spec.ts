import { RoleEnum } from '../roles/roles.enum';
import { isNumericEnumValue } from './numeric-enum';

describe('isNumericEnumValue', () => {
  it('should accept numeric enum values as number or digit string', () => {
    expect(isNumericEnumValue(RoleEnum, RoleEnum.admin)).toBe(true);
    expect(isNumericEnumValue(RoleEnum, '4')).toBe(true);
  });

  it('should reject enum member names', () => {
    expect(isNumericEnumValue(RoleEnum, 'admin')).toBe(false);
    expect(isNumericEnumValue(RoleEnum, 'verwaltung')).toBe(false);
  });

  it('should reject unknown or non-numeric values', () => {
    expect(isNumericEnumValue(RoleEnum, 99)).toBe(false);
    expect(isNumericEnumValue(RoleEnum, true)).toBe(false);
    expect(isNumericEnumValue(RoleEnum, '')).toBe(false);
    expect(isNumericEnumValue(RoleEnum, '1.5')).toBe(false);
    expect(isNumericEnumValue(RoleEnum, null)).toBe(false);
  });
});
