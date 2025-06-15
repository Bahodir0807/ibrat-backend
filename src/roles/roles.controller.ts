import { Controller, Get, Post, Body, Param, Patch, Delete, UseGuards } from '@nestjs/common';
import { RolesService } from './roles.service';
import { CreateRoleDto } from './dto/create-role.dto';
import { UpdateRoleDto } from './dto/update-role.dto';
import { JwtAuthGuard } from '../common/guards/jwt-auth.guard';
import { RolesGuard } from './roles.guard';
import { Roles } from '../common/decorators/roles.decorator';
import { Role } from '../roles/roles.enum'; 

@Controller('roles')
@UseGuards(JwtAuthGuard, RolesGuard)
export class RolesController {
  constructor(private readonly rolesService: RolesService) {}

  @Post()
  @Roles(Role.Owner) 
  create(@Body() dto: CreateRoleDto) {
    return this.rolesService.create(dto);
  }

  @Get()
  @Roles(Role.Owner, Role.Admin) 
  findAll() {
    return this.rolesService.findAll();
  }

  @Get(':name')
  @Roles(Role.Owner, Role.Admin) 
  findOne(@Param('name') name: string) {
    return this.rolesService.findOne(name);
  }

  @Patch(':name')
  @Roles(Role.Owner) 
  update(@Param('name') name: string, @Body() dto: UpdateRoleDto) {
    return this.rolesService.update(name, dto);
  }

  @Delete(':name')
  @Roles(Role.Owner) 
  remove(@Param('name') name: string) {
    return this.rolesService.remove(name);
  }
}
