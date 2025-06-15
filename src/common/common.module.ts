import { Module } from '@nestjs/common';
import { RolesService } from '../roles/roles.service';
import { PermissionsGuard } from './guards/permissions.guard';

@Module({
  providers: [RolesService, PermissionsGuard],
  exports: [ PermissionsGuard],
})
export class CommonModule {}
