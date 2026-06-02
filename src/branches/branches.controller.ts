import {
  Body,
  Controller,
  Get,
  Param,
  Patch,
  Query,
  Request,
} from '@nestjs/common';
import { Roles } from '../roles/roles.decorator';
import { Role } from '../roles/roles.enum';
import { AuthenticatedUser } from '../common/types/authenticated-user.type';
import { BranchesService } from './branches.service';
import { BranchesListQueryDto } from './dto/branches-list-query.dto';
import { IdParamDto } from '../common/dto/id-param.dto';
import { UpdateBranchDto } from './dto/update-branch.dto';

@Controller('branches')
export class BranchesController {
  constructor(private readonly branchesService: BranchesService) {}

  @Get()
  @Roles(Role.Owner, Role.Admin, Role.Teacher, Role.Extra)
  findAll(@Query() query: BranchesListQueryDto, @Request() req) {
    return this.branchesService.findAllForActor(
      query,
      req.user as AuthenticatedUser,
    );
  }

  @Get(':id')
  @Roles(Role.Owner, Role.Admin, Role.Teacher, Role.Extra)
  findOne(@Param() params: IdParamDto, @Request() req) {
    return this.branchesService.findByIdForActor(
      params.id,
      req.user as AuthenticatedUser,
    );
  }

  @Patch(':id')
  @Roles(Role.Owner, Role.Extra)
  update(
    @Param() params: IdParamDto,
    @Body() dto: UpdateBranchDto,
    @Request() req,
  ) {
    return this.branchesService.updateForActor(
      params.id,
      dto,
      req.user as AuthenticatedUser,
    );
  }
}
