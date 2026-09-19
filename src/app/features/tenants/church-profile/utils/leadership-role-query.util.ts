import {
  LeadershipAssignment,
  LeadershipCategory,
  LeadershipRoleOption,
} from '@core/models/church/leadership-governance.model';

export interface LeadershipRoleGroup {
  key: 'system' | 'tenant';
  label: string;
  roles: LeadershipRoleOption[];
}

export function canonicalizeLeadershipRoleTitle(title: string): string {
  const trimmed = title.trim();
  if (!trimmed) {
    return '';
  }
  return trimmed.replace(/\s+/g, ' ');
}

export function normalizeLeadershipRoleTitle(title: string): string {
  const canonical = canonicalizeLeadershipRoleTitle(title);
  return canonical ? canonical.toLowerCase() : '';
}

export function findExactRoleMatch(
  roles: LeadershipRoleOption[],
  query: string,
): LeadershipRoleOption | undefined {
  const normalized = normalizeLeadershipRoleTitle(query);
  if (!normalized) {
    return undefined;
  }
  return roles.find((role) => normalizeLeadershipRoleTitle(role.title) === normalized);
}

export function filterRolesByQuery(roles: LeadershipRoleOption[], query: string): LeadershipRoleOption[] {
  const normalized = normalizeLeadershipRoleTitle(query);
  if (!normalized) {
    return roles;
  }
  return roles.filter((role) => normalizeLeadershipRoleTitle(role.title).includes(normalized));
}

export function groupLeadershipRoles(
  roles: LeadershipRoleOption[],
  query = '',
): LeadershipRoleGroup[] {
  const filtered = filterRolesByQuery(roles, query);
  const systemRoles = filtered.filter((role) => role.is_global);
  const tenantRoles = filtered
    .filter((role) => !role.is_global)
    .sort((a, b) => normalizeLeadershipRoleTitle(a.title).localeCompare(normalizeLeadershipRoleTitle(b.title)));

  const groups: LeadershipRoleGroup[] = [];

  if (systemRoles.length) {
    groups.push({ key: 'system', label: 'SYSTEM ROLES', roles: systemRoles });
  }

  if (tenantRoles.length) {
    groups.push({ key: 'tenant', label: 'MY CHURCH ROLES', roles: tenantRoles });
  }

  return groups;
}

export function shouldShowCreateRoleAction(
  roles: LeadershipRoleOption[],
  query: string,
  canCreate: boolean,
): boolean {
  if (!canCreate) {
    return false;
  }
  const display = canonicalizeLeadershipRoleTitle(query);
  if (!display) {
    return false;
  }
  return !findExactRoleMatch(roles, display);
}

export function isParishClergyRoleTitle(title: string): boolean {
  const lower = normalizeLeadershipRoleTitle(title);
  if (!lower) {
    return false;
  }

  return (
    lower.includes('pastor')
    || lower.includes('priest')
    || lower.includes('deacon')
    || lower.includes('vicar')
  );
}

export function isPrimaryParishClergyRoleTitle(title: string): boolean {
  const lower = normalizeLeadershipRoleTitle(title);
  if (!lower) {
    return false;
  }

  if (lower === 'pastor' || lower === 'parochial administrator' || lower === 'parish priest') {
    return true;
  }

  if (
    lower.includes('joint')
    || lower.includes('associate')
    || lower.includes('assistant')
    || lower.includes('vicar')
    || lower.includes('deacon')
  ) {
    return false;
  }

  return lower.includes('pastor') || lower.includes('priest');
}

export function isParishClergyAssignment(
  assignment: Pick<LeadershipAssignment, 'status'> & {
    role?: { title?: string; category?: LeadershipCategory } | null;
  },
): boolean {
  if (assignment.status !== 'active') {
    return false;
  }

  const category = assignment.role?.category;
  if (category === 'PARISH_CLERGY') {
    return true;
  }

  return isParishClergyRoleTitle(assignment.role?.title || '');
}

export function partitionParishClergyAssignments(assignments: LeadershipAssignment[]): {
  primary: LeadershipAssignment | null;
  others: LeadershipAssignment[];
} {
  const clergy = assignments.filter((assignment) => isParishClergyAssignment(assignment));
  const primary =
    clergy.find((assignment) => isPrimaryParishClergyRoleTitle(assignment.role?.title || ''))
    ?? clergy[0]
    ?? null;

  const primaryPersonId = primary?.person?.id ?? null;

  const others = clergy.filter((assignment) => {
    if (!primary) {
      return false;
    }
    if (primaryPersonId && assignment.person?.id) {
      return assignment.person.id !== primaryPersonId;
    }
    return assignment.id !== primary.id;
  });

  return { primary, others };
}

export function guessLeadershipRoleCategory(title: string): LeadershipCategory {
  const lower = normalizeLeadershipRoleTitle(title);
  if (!lower) {
    return 'OTHER';
  }

  if (
    lower.includes('pastor')
    || lower.includes('priest')
    || lower.includes('deacon')
    || lower.includes('vicar')
  ) {
    return 'PARISH_CLERGY';
  }

  if (lower.includes('council') || lower.includes('chair')) {
    return 'PARISH_COUNCIL';
  }

  if (lower.includes('bishop') || lower.includes('archbishop')) {
    return 'CANONICAL_DIOCESAN';
  }

  if (lower.includes('choir') || lower.includes('youth') || lower.includes('ministry')) {
    return 'MINISTRY_PIOUS';
  }

  return 'OTHER';
}
