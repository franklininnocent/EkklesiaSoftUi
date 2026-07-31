import { isProtectedRoleDefinition } from './rbac-role.util';

describe('rbac role utils', () => {
  it('returns false for null role', () => {
    expect(isProtectedRoleDefinition(null as any)).toBe(false);
  });

  it('returns true for protected_system classification', () => {
    expect(isProtectedRoleDefinition({ role_classification: 'protected_system', name: 'Anything' } as any)).toBe(true);
  });

  it('returns true for legacy protected role names', () => {
    expect(isProtectedRoleDefinition({ name: 'Administrator' } as any)).toBe(true);
    expect(isProtectedRoleDefinition({ name: 'Church Administrator' } as any)).toBe(true);
    expect(isProtectedRoleDefinition({ name: 'Super Admin' } as any)).toBe(true);
  });

  it('returns false for default/custom role names', () => {
    expect(isProtectedRoleDefinition({ name: 'Parish Priest', role_classification: 'default_template' } as any)).toBe(false);
    expect(isProtectedRoleDefinition({ name: 'Volunteer', role_classification: 'custom' } as any)).toBe(false);
  });
});
