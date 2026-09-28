import { Injectable, CanActivate, ExecutionContext } from '@nestjs/common';
import { Reflector } from '@nestjs/core';

@Injectable()
export class RolesGuard implements CanActivate {
  constructor(private reflector: Reflector) {}

  canActivate(context: ExecutionContext): boolean {
    const roles = this.reflector.getAllAndOverride<(number | string)[]>(
      'roles',
      [context.getClass(), context.getHandler()],
    );
    // Ohne (oder mit leerer) @Roles-Angabe wird der Zugriff verweigert,
    // statt mit einem TypeError (HTTP 500) abzubrechen.
    if (!roles?.length) {
      return false;
    }
    const request = context.switchToHttp().getRequest();

    return roles.map(String).includes(String(request.user?.role?.id));
  }
}
