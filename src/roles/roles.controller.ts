import { Body, Controller, Delete, Get, Param, Patch, Post, UseGuards, UsePipes, ValidationPipe } from '@nestjs/common';
import { RolesService } from './roles.service';
import { CreateRoleDto } from './dto/create-role.dto';
import { UpdateRoleDto } from './dto/update-role.dto';
import { JwtAuthGuard } from '../common/guards/jwt-auth.guard';
import { RolesGuard } from './roles.guard';
import { Roles } from './roles.decorator';
import { Role } from '../roles/roles.enum';

@Controller('roles')
@UseGuards(JwtAuthGuard, RolesGuard)
export class RolesController {
  constructor(private readonly rolesService: RolesService) {}

  @Post()
  @Roles(Role.Owner)
  @UsePipes(new ValidationPipe({ transform: true, whitelist: true }))
  create(@Body() dto: CreateRoleDto) {
    return this.rolesService.create(dto);
  }

  @Get()
  @Roles(Role.Owner, Role.Admin, Role.Extra)
  findAll() {
    return this.rolesService.findAll();
  }

  @Get(':name')
  @Roles(Role.Owner, Role.Admin, Role.Extra)
  findOne(@Param('name') name: string) {
    return this.rolesService.findOne(name);
  }

  @Patch(':name')
  @Roles(Role.Owner)
  @UsePipes(new ValidationPipe({ transform: true, whitelist: true }))
  update(@Param('name') name: string, @Body() dto: UpdateRoleDto) {
    return this.rolesService.update(name, dto);
  }

  @Delete(':name')
  @Roles(Role.Owner)
  async remove(@Param('name') name: string) {
    await this.rolesService.remove(name);
    return { success: true, message: 'Role deleted successfully' };
  }
}
