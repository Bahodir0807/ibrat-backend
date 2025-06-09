import { Injectable } from '@nestjs/common';
import { CreateAdminDto } from './dto/create-admin.dto';
import { UpdateAdminDto } from './dto/update-admin.dto';

@Injectable()
export class AdminsService {
  private admins: Array<any> = [];
  private id = 1;

  create(createAdminDto: CreateAdminDto) {
    const admin = { id: String(this.id++), ...createAdminDto };
    this.admins.push(admin);
    return admin;
  }

  findAll() {
    return this.admins;
  }

  findOne(id: string) {
    return this.admins.find(a => a.id === id);
  }

  update(id: string, updateAdminDto: UpdateAdminDto) {
    const admin = this.findOne(id);
    if (admin) Object.assign(admin, updateAdminDto);
    return admin;
  }

  remove(id: string) {
    const idx = this.admins.findIndex(a => a.id === id);
    if (idx !== -1) return this.admins.splice(idx, 1)[0];
    return null;
  }
}
