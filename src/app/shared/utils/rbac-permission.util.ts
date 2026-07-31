const GOVERNANCE_PERMISSION_TOKENS = [
  'roles.',
  'permissions.',
  'users.',
  'church.settings.',
  'settings.',
  'security.',
  'integration.',
  'integrations.',
  'subscription.',
  'billing.',
  'tenants.',
  'pope.',
  'system.configure'
];

const HIGH_RISK_PERMISSION_TOKENS = [
  '.delete',
  '.force-delete',
  'finance.approve',
  'users.assign',
  'roles.assign',
  'permissions.assign',
  'church.settings.',
  'billing.',
  'subscription.',
  'security.',
  'integration.',
  'integrations.',
  'system.configure',
  'settings.manage'
];

export function isGovernancePermissionName(permissionName: string): boolean {
  const normalized = (permissionName || '').toLowerCase();
  return GOVERNANCE_PERMISSION_TOKENS.some((token) => normalized.includes(token));
}

export function isHighRiskPermissionName(permissionName: string): boolean {
  const normalized = (permissionName || '').toLowerCase();
  return HIGH_RISK_PERMISSION_TOKENS.some((token) => normalized.includes(token));
}

export function isManagerTemplatePermissionName(permissionName: string): boolean {
  const normalized = (permissionName || '').toLowerCase();
  const allow = ['.view', '.list', '.read', '.create', '.edit', '.update'];
  const allowMatch = allow.some((item) => normalized.includes(item));
  return allowMatch && !isGovernancePermissionName(normalized) && !normalized.includes('.delete') && !normalized.includes('.force-delete') && !normalized.includes('.restore');
}
