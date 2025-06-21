import { Injectable, CanActivate, ExecutionContext } from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { Role } from './roles.enum';

@Injectable()
export class RolesGuard implements CanActivate {
  constructor(private reflector: Reflector) {}

  canActivate(context: ExecutionContext): boolean {
    const requiredRoles = this.reflector.getAllAndOverride<Role[]>('roles', [
      context.getHandler(),
      context.getClass(),
    ]);

    const request = context.switchToHttp().getRequest();
    const user = request.user;

    console.log('🔐 Required Roles:', requiredRoles);

    if (!requiredRoles || requiredRoles.length === 0) {
      console.log('✅ Доступ разрешён: роли не требуются');
      return true;
    }

    if (!user || !user.role) {
      console.log('❌ Доступ запрещён: нет пользователя или роли');
      return false;
    }

    const userRole = user.role.toLowerCase();

    if (userRole === Role.Extra) {
      console.log('🛡️ EXTRA: полный доступ');
      return true;
    }

    const hasAccess = requiredRoles.some(role => {
      const requiredRole = role.toLowerCase();

      if (requiredRole === Role.Owner && userRole === Role.Owner) return true;

      return requiredRole === userRole;
    });

    console.log(hasAccess ? '✅ Доступ разрешён' : '❌ Доступ запрещён');
    return hasAccess;
  }
}
