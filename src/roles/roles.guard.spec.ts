import { ExecutionContext } from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { Role } from './roles.enum';
import { RolesGuard } from './roles.guard';

describe('RolesGuard', () => {
  const reflector = {
    getAllAndOverride: jest.fn(),
  } as unknown as Reflector;

  let guard: RolesGuard;

  beforeEach(() => {
    jest.clearAllMocks();
    guard = new RolesGuard(reflector);
  });

  function createContext(role?: Role): ExecutionContext {
    return {
      switchToHttp: () => ({
        getRequest: () => ({
          user: role ? { role } : undefined,
        }),
      }),
      getHandler: () => undefined,
      getClass: () => undefined,
    } as unknown as ExecutionContext;
  }

  it('allows routes without role metadata', () => {
    (reflector.getAllAndOverride as jest.Mock).mockReturnValue(undefined);

    expect(guard.canActivate(createContext())).toBe(true);
  });

  it('grants owner full access', () => {
    (reflector.getAllAndOverride as jest.Mock).mockReturnValue([Role.Admin]);

    expect(guard.canActivate(createContext(Role.Owner))).toBe(true);
    expect(guard.canActivate(createContext(Role.Extra))).toBe(false);
  });

  it('matches regular roles exactly', () => {
    (reflector.getAllAndOverride as jest.Mock).mockReturnValue([Role.Admin]);

    expect(guard.canActivate(createContext(Role.Admin))).toBe(true);
    expect(guard.canActivate(createContext(Role.Student))).toBe(false);
  });
});
