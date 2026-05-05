import { ExecutionContext } from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { Role } from './roles.enum';
import { RolesGuard } from './roles.guard';

function contextWithRole(role: Role): ExecutionContext {
  return {
    getHandler: jest.fn(),
    getClass: jest.fn(),
    switchToHttp: jest.fn(() => ({
      getRequest: jest.fn(() => ({ user: { role } })),
    })),
  } as unknown as ExecutionContext;
}

describe('RolesGuard', () => {
  it('allows routes without role metadata', () => {
    const reflector = {
      getAllAndOverride: jest.fn(() => undefined),
    } as unknown as Reflector;
    const guard = new RolesGuard(reflector);

    expect(guard.canActivate(contextWithRole(Role.Student))).toBe(true);
  });

  it.each([Role.Admin, Role.Owner, Role.Extra])(
    'allows %s through role-restricted endpoints as a full-access role',
    (role) => {
      const reflector = {
        getAllAndOverride: jest.fn(() => [Role.Owner]),
      } as unknown as Reflector;
      const guard = new RolesGuard(reflector);

      expect(guard.canActivate(contextWithRole(role))).toBe(true);
    },
  );

  it('does not allow scoped roles through unrelated role requirements', () => {
    const reflector = {
      getAllAndOverride: jest.fn(() => [Role.Admin]),
    } as unknown as Reflector;
    const guard = new RolesGuard(reflector);

    expect(guard.canActivate(contextWithRole(Role.Student))).toBe(false);
  });

  it('matches regular roles exactly', () => {
    const reflector = {
      getAllAndOverride: jest.fn(() => [Role.Teacher]),
    } as unknown as Reflector;
    const guard = new RolesGuard(reflector);

    expect(guard.canActivate(contextWithRole(Role.Teacher))).toBe(true);
    expect(guard.canActivate(contextWithRole(Role.Student))).toBe(false);
  });
});
