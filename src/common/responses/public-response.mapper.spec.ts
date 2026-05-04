import { Role } from '../../roles/roles.enum';
import { UserStatus } from '../../users/user-status.enum';
import { mapAdminUser, mapPublicResource, mapPublicUser } from './public-response.mapper';

describe('public response mapper', () => {
  it('normalizes nested users and removes sensitive fields', () => {
    const response = mapPublicResource({
      _id: 'course-1',
      name: 'English',
      password: 'secret',
      teacherId: {
        _id: 'teacher-1',
        username: 'teacher',
        firstName: 'Ann',
        lastName: 'Lee',
        role: Role.Teacher,
        email: 'teacher@example.com',
        phoneNumber: '+1000000',
        password: 'hash',
        __v: 0,
      },
      students: [
        {
          _id: 'student-1',
          username: 'student',
          firstName: 'Sam',
          role: Role.Student,
          email: 'student@example.com',
          phoneNumber: '+2000000',
          refreshToken: 'token',
        },
      ],
    });

    expect(response).toEqual({
      id: 'course-1',
      name: 'English',
      teacherId: {
        id: 'teacher-1',
        fullName: 'Ann Lee',
        role: Role.Teacher,
      },
      students: [
        {
          id: 'student-1',
          fullName: 'Sam',
          role: Role.Student,
        },
      ],
    });
    expect(JSON.stringify(response)).not.toContain('_id');
    expect(JSON.stringify(response)).not.toContain('email');
    expect(JSON.stringify(response)).not.toContain('phoneNumber');
    expect(JSON.stringify(response)).not.toContain('password');
    expect(JSON.stringify(response)).not.toContain('refreshToken');
  });

  it('maps top-level users without internal or contact fields', () => {
    const response = mapAdminUser({
      _id: 'user-1',
      username: 'admin',
      firstName: 'A',
      lastName: 'User',
      role: Role.Admin,
      status: UserStatus.Active,
      isActive: true,
      branchIds: ['branch-1'],
      email: 'admin@example.com',
      phoneNumber: '+3000000',
      password: 'hash',
      tokenHash: 'hash',
    });

    expect(response).toMatchObject({
      id: 'user-1',
      username: 'admin',
      fullName: 'A User',
      role: Role.Admin,
      status: UserStatus.Active,
      isActive: true,
      branchIds: ['branch-1'],
    });
    expect(response).not.toHaveProperty('_id');
    expect(response).not.toHaveProperty('email');
    expect(response).not.toHaveProperty('phoneNumber');
    expect(response).not.toHaveProperty('password');
    expect(response).not.toHaveProperty('tokenHash');
  });

  it('keeps nested user shape compact and consistent', () => {
    expect(mapPublicUser({
      _id: 'student-1',
      username: 'fallback-name',
      role: Role.Student,
      avatarUrl: 'https://cdn/avatar.png',
      branchIds: ['branch-1'],
    })).toEqual({
      id: 'student-1',
      fullName: 'fallback-name',
      role: Role.Student,
      avatarUrl: 'https://cdn/avatar.png',
    });
  });
});
