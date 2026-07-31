import { isGovernancePermissionName, isHighRiskPermissionName, isManagerTemplatePermissionName } from './rbac-permission.util';

describe('rbac permission utils', () => {
  it('detects governance permissions', () => {
    expect(isGovernancePermissionName('roles.assign')).toBe(true);
    expect(isGovernancePermissionName('church.settings.edit')).toBe(true);
    expect(isGovernancePermissionName('members.view')).toBe(false);
  });

  it('detects high risk permissions', () => {
    expect(isHighRiskPermissionName('members.delete')).toBe(true);
    expect(isHighRiskPermissionName('finance.approve')).toBe(true);
    expect(isHighRiskPermissionName('events.view')).toBe(false);
  });

  it('allows manager template for operational permissions only', () => {
    expect(isManagerTemplatePermissionName('members.create')).toBe(true);
    expect(isManagerTemplatePermissionName('roles.update')).toBe(false);
    expect(isManagerTemplatePermissionName('church.settings.edit')).toBe(false);
    expect(isManagerTemplatePermissionName('members.delete')).toBe(false);
  });
});
