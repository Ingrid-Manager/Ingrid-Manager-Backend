import 'reflect-metadata';
import { GUARDS_METADATA } from '@nestjs/common/constants';

import { RoleEnum } from '../roles/roles.enum';
import { RolesGuard } from '../roles/roles.guard';
import { HeatingController } from './heating.controller';

describe('HeatingController', () => {
  it('should require an authenticated user and the roles guard', () => {
    const guards: unknown[] =
      Reflect.getMetadata(GUARDS_METADATA, HeatingController) ?? [];

    expect(guards).toHaveLength(2);
    expect(guards).toContain(RolesGuard);
  });

  it('should only allow admin and verwaltung', () => {
    expect(Reflect.getMetadata('roles', HeatingController)).toEqual([
      RoleEnum.admin,
      RoleEnum.verwaltung,
    ]);
  });
});
