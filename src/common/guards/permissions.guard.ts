import {
    Injectable,
    CanActivate,
    ExecutionContext,
    ForbiddenException,
  } from '@nestjs/common';
  import { Reflector } from '@nestjs/core';
  import { PERMISSIONS_KEY } from '../decorators/permissions.decorator';
  import { RolesService } from '../../roles/roles.service';
  
  @Injectable()
  export class PermissionsGuard implements CanActivate {
    constructor(
      private reflector: Reflector,
      private rolesService: RolesService,  
    ) {}
  
    async canActivate(ctx: ExecutionContext): Promise<boolean> {
      const required: string[] =
        this.reflector.get<string[]>(PERMISSIONS_KEY, ctx.getHandler()) || [];
      if (!required.length) {
        return true; 
      }
  
      const req = ctx.switchToHttp().getRequest();
      const user = req.user;
      if (!user) {
        throw new ForbiddenException('Нет пользователя в запросе');
      }
  
      const role = await this.rolesService.findOne(user.role);
      const userPerms = role.permissions;
  
      const hasAll = required.every(p => userPerms.includes(p));
      if (!hasAll) {
        throw new ForbiddenException('Нет права доступа');
      }
  
      return true;
    }
  }
  