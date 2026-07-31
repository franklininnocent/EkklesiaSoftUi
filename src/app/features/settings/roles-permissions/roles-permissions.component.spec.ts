import { ChangeDetectorRef } from '@angular/core';
import { of } from 'rxjs';
import { RolesPermissionsComponent } from './roles-permissions.component';

describe('RolesPermissionsComponent', () => {
  const createComponent = (overrides?: { currentUser?: any; isTenantAdmin?: boolean; isSuperAdmin?: boolean; isEkklesiaAdmin?: boolean; hasPermission?: boolean }) => {
    const rolesServiceMock = {
      getRoles: jest.fn().mockReturnValue(of({ data: [] })),
      deleteRole: jest.fn().mockReturnValue(of({})),
      toggleRoleStatus: jest.fn().mockReturnValue(of({}))
    };
    const permissionsServiceMock = {
      getPermissions: jest.fn().mockReturnValue(of({ data: [] })),
      deletePermission: jest.fn().mockReturnValue(of({}))
    };
    const usersServiceMock = {
      getUsers: jest.fn().mockReturnValue(of({ data: [] })),
      assignRoles: jest.fn().mockReturnValue(of({}))
    };
    const toastServiceMock = {
      success: jest.fn(),
      error: jest.fn(),
      warning: jest.fn()
    };
    const authServiceMock = {
      currentUserValue: overrides?.currentUser ?? null,
      currentUser$: of(overrides?.currentUser ?? null),
      isSuperAdmin: jest.fn().mockReturnValue(overrides?.isSuperAdmin ?? false),
      isEkklesiaAdmin: jest.fn().mockReturnValue(overrides?.isEkklesiaAdmin ?? false),
      isTenantAdmin: jest.fn().mockReturnValue(overrides?.isTenantAdmin ?? false),
      hasPermission: jest.fn().mockReturnValue(overrides?.hasPermission ?? false),
      canManageRbac: jest.fn().mockReturnValue((overrides?.isTenantAdmin ?? false) || (overrides?.isSuperAdmin ?? false) || (overrides?.isEkklesiaAdmin ?? false))
    };
    const cdrMock = {
      detectChanges: jest.fn(),
      markForCheck: jest.fn()
    } as unknown as ChangeDetectorRef;

    return new RolesPermissionsComponent(
      rolesServiceMock as any,
      permissionsServiceMock as any,
      usersServiceMock as any,
      toastServiceMock as any,
      authServiceMock as any,
      cdrMock
    );
  };

  it('blocks permission CRUD in tenant mode', () => {
    const component = createComponent({ currentUser: { tenant_id: 10 }, isTenantAdmin: true, hasPermission: true });
    component.isTenantMode = true;

    expect(component.canCreatePermission()).toBe(false);
    expect(component.canUpdatePermission()).toBe(false);
    expect(component.canDeletePermission()).toBe(false);
  });

  it('protects Administrator and Church Administrator in tenant mode', () => {
    const component = createComponent({ currentUser: { tenant_id: 10 }, isTenantAdmin: true });
    component.isTenantMode = true;

    expect(component.isProtectedTenantRole({ name: 'Administrator' } as any)).toBe(true);
    expect(component.isProtectedTenantRole({ name: 'Church Administrator' } as any)).toBe(true);
    expect(component.isProtectedTenantRole({ name: 'Parish Priest' } as any)).toBe(false);
  });

  it('prevents editing/deleting protected role rows', () => {
    const component = createComponent({ currentUser: { tenant_id: 10 }, isTenantAdmin: true });
    component.isTenantMode = true;

    const protectedRole = { name: 'Administrator', is_custom: true } as any;
    const customRole = { name: 'Volunteer', is_custom: true } as any;

    expect(component.canEditRoleRow(protectedRole)).toBe(false);
    expect(component.canDeleteRoleRow(protectedRole)).toBe(false);
    expect(component.canEditRoleRow(customRole)).toBe(true);
    expect(component.canDeleteRoleRow(customRole)).toBe(true);
  });

  it('allows manage roles for tenant administrators and platform admins', () => {
    const tenantAdmin = createComponent({ currentUser: { tenant_id: 10, role_name: 'Administrator' }, isTenantAdmin: true });
    const platformAdmin = createComponent({ currentUser: { tenant_id: null, role_name: 'SuperAdmin' }, isSuperAdmin: true });

    expect(tenantAdmin.canManageRoles()).toBe(true);
    expect(platformAdmin.canManageRoles()).toBe(true);
  });

  it('returns friendly validation message for 422 API errors', () => {
    const component = createComponent({ currentUser: { tenant_id: 10 }, isTenantAdmin: true });
    const message = (component as any).getFriendlyErrorMessage({
      status: 422,
      error: { errors: { name: ['Role name is required.'] } }
    }, 'fallback');

    expect(message).toBe('Role name is required.');
  });
});
