import { ExecutionContext } from '@nestjs/common';
import { Reflector } from '@nestjs/core';

import { RolesGuard } from './roles.guard';
import { RoleEnum } from './roles.enum';

describe('RolesGuard', () => {
  const contextFor = (
    roles: unknown,
    user: { role?: { id: number } } | undefined,
  ): { context: ExecutionContext; reflector: Reflector } => {
    const handler = () => undefined;
    class TestController {}

    const reflector = {
      getAllAndOverride: jest.fn(() => roles),
    } as unknown as Reflector;

    const context = {
      getClass: () => TestController,
      getHandler: () => handler,
      switchToHttp: () => ({ getRequest: () => ({ user }) }),
    } as unknown as ExecutionContext;

    return { context, reflector };
  };

  it('should deny access instead of throwing when no roles are defined', () => {
    const { context, reflector } = contextFor(undefined, {
      role: { id: RoleEnum.admin },
    });

    expect(new RolesGuard(reflector).canActivate(context)).toBe(false);
  });

  it('should deny access when an empty role list is defined', () => {
    const { context, reflector } = contextFor([], {
      role: { id: RoleEnum.admin },
    });

    expect(new RolesGuard(reflector).canActivate(context)).toBe(false);
  });

  it('should allow users with one of the required roles', () => {
    const { context, reflector } = contextFor(
      [RoleEnum.admin, RoleEnum.verwaltung],
      { role: { id: RoleEnum.verwaltung } },
    );

    expect(new RolesGuard(reflector).canActivate(context)).toBe(true);
  });

  it('should deny users without one of the required roles', () => {
    const { context, reflector } = contextFor([RoleEnum.admin], {
      role: { id: RoleEnum.user },
    });

    expect(new RolesGuard(reflector).canActivate(context)).toBe(false);
  });

  it('should deny requests without an authenticated user', () => {
    const { context, reflector } = contextFor([RoleEnum.admin], undefined);

    expect(new RolesGuard(reflector).canActivate(context)).toBe(false);
  });
});
