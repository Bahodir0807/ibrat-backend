import { BadRequestException } from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import { verifyPassword } from '../common/password';
import { Role } from '../roles/roles.enum';
import { AuthService } from './auth.service';
import { UserStatus } from '../users/user-status.enum';

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
    signAsync: jest.fn(),
    verifyAsync: jest.fn(),
    decode: jest.fn(),
  } as unknown as JwtService;

  const appConfigService = {
    jwtSecret: 'access-secret',
    jwtExpiresIn: '15m',
    jwtRefreshSecret: 'refresh-secret',
    jwtRefreshExpiresIn: '7d',
  };

  const authSessionModel = {
    create: jest.fn(),
  };

  let service: AuthService;

  beforeEach(() => {
    jest.clearAllMocks();
    service = new AuthService(
      usersService as any,
      jwtService,
      appConfigService as any,
      authSessionModel as any,
    );
  });

  it('registers guest/student users without double hashing', async () => {
    usersService.create.mockResolvedValue({
      id: '1',
      _id: '1',
      username: 'demo',
      role: Role.Student,
      status: UserStatus.Active,
      branchIds: [],
    });

    await service.register({
      username: 'demo',
      password: 'secret123',
      role: Role.Student,
    });

    expect(usersService.create).toHaveBeenCalledWith({
      username: 'demo',
      password: 'secret123',
      role: Role.Student,
      status: UserStatus.Active,
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
      isActive: true,
      status: UserStatus.Active,
    });
    usersService.findById.mockResolvedValue({
      id: '42',
      _id: '42',
      username: 'demo',
      role: Role.Student,
      status: UserStatus.Active,
      isActive: true,
      branchIds: [],
    });
    (verifyPassword as jest.Mock).mockResolvedValue(true);

    const user = await service.validateUser('demo', 'secret123');

    expect(verifyPassword).toHaveBeenCalledWith('secret123', 'hashed-password');
    expect(user).toEqual({
      id: '42',
      _id: '42',
      username: 'demo',
      role: Role.Student,
      status: UserStatus.Active,
      isActive: true,
      branchIds: [],
    });
  });

  it('returns null for invalid passwords', async () => {
    usersService.findByUsernameForAuth.mockResolvedValue({
      _id: '42',
      username: 'demo',
      password: 'hashed-password',
      role: Role.Student,
      isActive: true,
      status: UserStatus.Active,
    });
    (verifyPassword as jest.Mock).mockResolvedValue(false);

    const user = await service.validateUser('demo', 'wrong');

    expect(user).toBeNull();
  });

  it('builds access and refresh tokens on login', async () => {
    (jwtService.signAsync as jest.Mock)
      .mockResolvedValueOnce('signed-access-token')
      .mockResolvedValueOnce('signed-refresh-token');
    (jwtService.decode as jest.Mock).mockReturnValue({ jti: 'refresh-id-1' });

    const response = await service.login({
      id: '42',
      username: 'demo',
      role: Role.Student,
      status: UserStatus.Active,
      isActive: true,
      branchIds: [],
    });

    expect(jwtService.signAsync).toHaveBeenNthCalledWith(
      1,
      {
        username: 'demo',
        sub: '42',
        role: Role.Student,
        status: UserStatus.Active,
        branchIds: [],
        type: 'access',
      },
      expect.objectContaining({ secret: 'access-secret', expiresIn: '15m' }),
    );
    expect(jwtService.signAsync).toHaveBeenNthCalledWith(
      2,
      expect.objectContaining({
        username: 'demo',
        sub: '42',
        role: Role.Student,
        status: UserStatus.Active,
        branchIds: [],
        type: 'refresh',
      }),
      expect.objectContaining({ secret: 'refresh-secret', expiresIn: '7d' }),
    );
    expect(response).toEqual(
      expect.objectContaining({
        accessToken: 'signed-access-token',
        refreshToken: 'signed-refresh-token',
        token: 'signed-access-token',
        tokenType: 'Bearer',
        user: expect.objectContaining({
          id: '42',
          username: 'demo',
          role: Role.Student,
          status: UserStatus.Active,
        }),
      }),
    );
    expect(authSessionModel.create).toHaveBeenCalled();
  });
});
