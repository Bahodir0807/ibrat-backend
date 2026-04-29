import { Body, Controller, Delete, Get, Param, Patch, Post, Query } from '@nestjs/common';
import { RolesService } from './roles.service';
import { CreateRoleDto } from './dto/create-role.dto';
import { UpdateRoleDto } from './dto/update-role.dto';
import { Roles } from './roles.decorator';
import { Role } from '../roles/roles.enum';
import { NameParamDto } from '../common/dto/name-param.dto';
import { RolesListQueryDto } from './dto/roles-list-query.dto';

@Controller('roles')
export class RolesController {
  constructor(private readonly rolesService: RolesService) {}

  @Post()
  @Roles(Role.Owner)
  create(@Body() dto: CreateRoleDto) {
    return this.rolesService.create(dto);
  }

  @Get()
  @Roles(Role.Owner, Role.Extra)
  findAll(@Query() query: RolesListQueryDto) {
    return this.rolesService.findAll(query);
  }

  @Get(':name')
  @Roles(Role.Owner, Role.Extra)
  findOne(@Param() params: NameParamDto) {
    return this.rolesService.findOne(params.name);
  }

  @Patch(':name')
  @Roles(Role.Owner)
  update(@Param() params: NameParamDto, @Body() dto: UpdateRoleDto) {
    return this.rolesService.update(params.name, dto);
  }

  @Delete(':name')
  @Roles(Role.Owner)
  async remove(@Param() params: NameParamDto) {
    await this.rolesService.remove(params.name);
    return { message: 'Role deleted successfully' };
  }
}
