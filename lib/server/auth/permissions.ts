import {
  ApiError,
} from '@/lib/server/http/api-response';

import {
  type WorkspaceRole,
} from '@/lib/server/workspace-service';

const roleRank:
  Record<WorkspaceRole, number> = {
  operator: 10,
  supervisor: 20,
  admin: 30,
};

export function roleAtLeast(
  actual: WorkspaceRole,
  required: WorkspaceRole
): boolean {
  return (
    roleRank[actual] >=
    roleRank[required]
  );
}

export function requireWorkspaceRole(
  actual: WorkspaceRole,
  required: WorkspaceRole
): void {
  if (
    !roleAtLeast(
      actual,
      required
    )
  ) {
    throw new ApiError(
      403,
      'INSUFFICIENT_ROLE',
      `This action requires ${required} workspace access.`
    );
  }
}
