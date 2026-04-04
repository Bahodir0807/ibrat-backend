import { BadRequestException } from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import { verifyPassword } from '../common/password';
import { Role } from '../roles/roles.enum';
import { AuthService } from './auth.service';

jest.mock('../common/password', () => ({
  verifyPassword: jest.fn(),
}));

describe('AuthService', () => {
  const usersService = {
    create: jest.fn(),
    findById: jest.fn(),
    findByUsernameForAuth: jest.fn(),
  };

  const jwtService = {
    sign: jest.fn(() => 'signed-token'),
  } as unknown as JwtService;

  let service: AuthService;

  beforeEach(() => {
    jest.clearAllMocks();
    service = new AuthService(usersService as any, jwtService);
  });

  it('registers guest/student users without double hashing', async () => {
    usersService.create.mockResolvedValue({ id: '1', _id: '1', username: 'demo', role: Role.Student });

    await service.register({
      username: 'demo',
      password: 'secret123',
      role: Role.Student,
    });

    expect(usersService.create).toHaveBeenCalledWith({
      username: 'demo',
      password: 'secret123',
      role: Role.Student,
    });
  });

  it('rejects privileged self-registration roles', async () => {
    await expect(
      service.register({
        username: 'owner',
        password: 'secret123',
        role: Role.Owner,
      } as any),
    ).rejects.toBeInstanceOf(BadRequestException);
  });

  it('validates user passwords against hashed values', async () => {
    usersService.findByUsernameForAuth.mockResolvedValue({
      _id: '42',
      username: 'demo',
      password: 'hashed-password',
      role: Role.Student,
    });
    usersService.findById.mockResolvedValue({
      id: '42',
      _id: '42',
      username: 'demo',
      role: Role.Student,
      isActive: true,
    });
    (verifyPassword as jest.Mock).mockResolvedValue(true);

    const user = await service.validateUser('demo', 'secret123');

    expect(verifyPassword).toHaveBeenCalledWith('secret123', 'hashed-password');
    expect(user).toEqual({
      id: '42',
      _id: '42',
      username: 'demo',
      role: Role.Student,
      isActive: true,
    });
  });

  it('returns null for invalid passwords', async () => {
    usersService.findByUsernameForAuth.mockResolvedValue({
      _id: '42',
      username: 'demo',
      password: 'hashed-password',
      role: Role.Student,
    });
    (verifyPassword as jest.Mock).mockResolvedValue(false);

    const user = await service.validateUser('demo', 'wrong');

    expect(user).toBeNull();
  });

  it('builds a stable JWT payload', async () => {
    const response = await service.login({
      id: '42',
      _id: '42',
      username: 'demo',
      role: Role.Student,
      isActive: true,
    });

    expect(jwtService.sign).toHaveBeenCalledWith({
      username: 'demo',
      sub: '42',
      role: Role.Student,
    });
    expect(response).toEqual({
      token: 'signed-token',
      role: Role.Student,
      user: {
        id: '42',
        _id: '42',
        username: 'demo',
        role: Role.Student,
        isActive: true,
      },
    });
  });
});
