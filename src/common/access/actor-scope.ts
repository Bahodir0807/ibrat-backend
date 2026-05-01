import { ForbiddenException, NotFoundException } from '@nestjs/common';
import { Types } from 'mongoose';
import { AuthenticatedUser } from '../types/authenticated-user.type';
import { Role } from '../../roles/roles.enum';

export type BranchScopedResource = {
  branchIds?: string[];
};

export function normalizeBranchIds(branchIds?: string[]): string[] {
  return [...new Set((branchIds ?? [])
    .filter((branchId): branchId is string => typeof branchId === 'string')
    .map(branchId => branchId.trim())
    .filter(branchId => branchId.length > 0))];
}

export function isSystemWideRole(role?: Role): boolean {
  return role === Role.Owner || role === Role.Extra;
}

export function isBranchAdminRole(role?: Role): boolean {
  return role === Role.Admin;
}

export function ensureActorBranchScope(actor: AuthenticatedUser): string[] {
  const branchIds = normalizeBranchIds(actor.branchIds);
  if (!isSystemWideRole(actor.role) && branchIds.length === 0) {
    throw new ForbiddenException('User has no assigned branch scope');
  }

  return branchIds;
}

export function hasBranchOverlap(actorBranchIds: string[], targetBranchIds?: string[]): boolean {
  const normalizedTarget = normalizeBranchIds(targetBranchIds);
  return normalizedTarget.some(branchId => actorBranchIds.includes(branchId));
}

export function assertBranchOverlapOrNotFound(
  actor: AuthenticatedUser,
  resource: BranchScopedResource,
  message = 'Resource not found',
): void {
  if (isSystemWideRole(actor.role)) {
    return;
  }

  const actorBranches = ensureActorBranchScope(actor);
  if (!hasBranchOverlap(actorBranches, resource.branchIds)) {
    throw new NotFoundException(message);
  }
}

export function toObjectIds(ids: string[]): Types.ObjectId[] {
  return ids.filter(id => Types.ObjectId.isValid(id)).map(id => new Types.ObjectId(id));
}
