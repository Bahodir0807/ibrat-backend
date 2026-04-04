import { ConflictException, Injectable, NotFoundException } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model } from 'mongoose';
import { Role, RoleDocument } from './schemas/role.schema';
import { CreateRoleDto } from './dto/create-role.dto';
import { UpdateRoleDto } from './dto/update-role.dto';
import { serializeResource, serializeResources } from '../common/serializers/resource.serializer';

@Injectable()
export class RolesService {
  constructor(@InjectModel(Role.name) private readonly roleModel: Model<RoleDocument>) {}

  async create(dto: CreateRoleDto) {
    const exists = await this.roleModel.findOne({ name: dto.name }).lean().exec();
    if (exists) {
      throw new ConflictException(`Role '${dto.name}' already exists`);
    }

    const role = await this.roleModel.create(dto);
    return serializeResource(role);
  }

  async findAll() {
    const roles = await this.roleModel.find().sort({ name: 1 }).exec();
    return serializeResources(roles);
  }

  async findOne(name: string) {
    const role = await this.roleModel.findOne({ name }).exec();
    if (!role) {
      throw new NotFoundException(`Role '${name}' not found`);
    }

    return serializeResource(role);
  }

  async update(name: string, dto: UpdateRoleDto) {
    const role = await this.roleModel.findOneAndUpdate({ name }, dto, { new: true }).exec();
    if (!role) {
      throw new NotFoundException(`Role '${name}' not found`);
    }

    return serializeResource(role);
  }

  async remove(name: string): Promise<boolean> {
    const res = await this.roleModel.findOneAndDelete({ name }).exec();
    if (!res) {
      throw new NotFoundException(`Role '${name}' not found`);
    }

    return true;
  }
}
