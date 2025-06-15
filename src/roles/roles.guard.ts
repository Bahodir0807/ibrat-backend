import { Injectable, CanActivate, ExecutionContext } from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { Role } from './roles.enum';

@Injectable()
export class RolesGuard implements CanActivate {
  constructor(private reflector: Reflector) {
    console.log('✅ RolesGuard создан успешно');
  }
  canActivate(context: ExecutionContext): boolean {
    const requiredRoles = this.reflector.getAllAndOverride<Role[]>('roles', [
      context.getHandler(),
      context.getClass(),
    ]);

    if (!requiredRoles || requiredRoles.length === 0) {
      return true; 
    }

    const request = context.switchToHttp().getRequest();
    const user = request.user;

    if (!user || !user.role) {
      return false; 
    }
 
    return requiredRoles.some(role => {
      if (role === Role.Admin && user.role === Role.Owner) return true; 
      return role === user.role;
    });
    console.log('🧑 Роль пользователя:', user.role);
    console.log('🔒 Нужны роли:', requiredRoles);
    console.log('✅ RolesGuard проверка пройдена');
    return true;
  
  }
}
