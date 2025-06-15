import { Injectable, NotFoundException } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model } from 'mongoose';
import { Role, RoleDocument } from './schemas/role.schema';
import { CreateRoleDto } from './dto/create-role.dto';
import { UpdateRoleDto } from './dto/update-role.dto';

@Injectable()
export class RolesService {
  constructor(@InjectModel(Role.name) private roleModel: Model<RoleDocument>) {}

  async create(dto: CreateRoleDto): Promise<Role> {
    const exists = await this.roleModel.findOne({ name: dto.name });
    if (exists) throw new Error(`Role '${dto.name}' already exists`);
    return this.roleModel.create(dto);
  }

  async findAll(): Promise<Role[]> {
    return this.roleModel.find().lean();
  }

  async findOne(name: string): Promise<Role> {
    const role = await this.roleModel.findOne({ name });
    if (!role) throw new NotFoundException(`Role '${name}' not found`);
    return role;
  }

  async update(name: string, dto: UpdateRoleDto): Promise<Role> {
    const role = await this.roleModel.findOneAndUpdate({ name }, dto, { new: true });
    if (!role) throw new NotFoundException(`Role '${name}' not found`);
    return role;
  }

  async remove(name: string): Promise<void> {
    const res = await this.roleModel.findOneAndDelete({ name });
    if (!res) throw new NotFoundException(`Role '${name}' not found`);
  }
}
