export enum Role {
  Owner = 'owner',
  Admin = 'admin',
  BranchAdmin = 'branch_admin',
  Teacher = 'teacher',
  Manager = 'manager',
  Extra = 'panda',
  Staff = 'staff',
  // TODO(student-portal): legacy auth role kept only for existing student
  // self-service endpoints. Do not expose it in staff/user management.
  Student = 'student',
  Guest = 'guest',
}
