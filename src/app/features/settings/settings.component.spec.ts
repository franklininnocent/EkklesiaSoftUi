import { TestBed } from '@angular/core/testing';
import { of } from 'rxjs';
import { SettingsComponent } from './settings.component';
import { Store } from '@ngrx/store';
import { AuthService } from '@core/services';

describe('SettingsComponent (role-based visibility)', () => {
  let component: SettingsComponent;
  let authServiceMock: {
    hasAnyPermission: jest.Mock<boolean, [string[]]>;
    canAccessRbac: jest.Mock<boolean, [any]>;
  };

  const createComponentWithUser = (user: any | null) => {
    authServiceMock = {
      hasAnyPermission: jest.fn().mockReturnValue(false),
      canAccessRbac: jest.fn().mockImplementation((targetUser: any) => {
        if (!targetUser) return false;
        const roleName = targetUser.role_name || targetUser.role?.name || '';
        if (targetUser.is_admin === true || targetUser.is_super_admin === true) return true;
        if (['SuperAdmin', 'EkklesiaAdmin', 'EkklesiaManager', 'Church Administrator', 'Administrator'].includes(roleName)) return true;
        return !!targetUser.permissions?.some((p: any) => ['roles.view', 'permissions.view'].includes(p.name));
      })
    };

    TestBed.configureTestingModule({
      imports: [SettingsComponent],
      providers: [
        {
          provide: Store,
          useValue: {
            select: () => of(user)
          }
        },
        { provide: AuthService, useValue: authServiceMock }
      ]
    });
    const fixture = TestBed.createComponent(SettingsComponent);
    component = fixture.componentInstance;
    fixture.detectChanges();
    return { fixture };
  };

  const tenantUser = {
    id: 'u1',
    email: 'tenant@example.com',
    tenant_id: 101,
    role_name: 'Administrator',
    permissions: [{ name: 'roles.view' }]
  };

  const ekklesiaAdmin = {
    id: 'u2',
    email: 'sysadmin@example.com',
    tenant_id: null,
    role_name: 'EkklesiaAdmin',
    is_admin: true
  };

  const superAdminByFlag = {
    id: 'u3',
    email: 'super@example.com',
    tenant_id: null,
    is_super_admin: true
  };

  const tenantAdminNoPermission = {
    id: 'u4',
    email: 'tenant-noperm@example.com',
    tenant_id: 202,
    role_name: 'Administrator',
    permissions: []
  };

  const churchAdminNoPermission = {
    id: 'u6',
    email: 'church-admin@example.com',
    tenant_id: 204,
    role_name: 'Church Administrator',
    permissions: []
  };

  const tenantNonAdminNoPermission = {
    id: 'u7',
    email: 'tenant-user@example.com',
    tenant_id: 205,
    role_name: 'Member',
    permissions: []
  };

  const tenantMultiRoleWithPermission = {
    id: 'u5',
    email: 'tenant-multirole@example.com',
    tenant_id: 203,
    role_name: null,
    roles: [{ name: 'Reader' }, { name: 'Administrator' }],
    permissions: [{ name: 'permissions.view' }]
  };

  it('hasEkklesiaRole() should be false for any user with tenant_id', () => {
    createComponentWithUser(tenantUser);
    expect(component.hasEkklesiaRole(tenantUser as any)).toBe(false);
  });

  it('hasEkklesiaRole() should be true for ekklesia roles without tenant', () => {
    createComponentWithUser(ekklesiaAdmin);
    expect(component.hasEkklesiaRole(ekklesiaAdmin as any)).toBe(true);
  });

  it('canManageRoles() allows EkklesiaAdmin and tenant Administrator with view permission', () => {
    createComponentWithUser(null);
    expect(component.canManageRoles(ekklesiaAdmin as any)).toBe(true);
    expect(component.canManageRoles(tenantUser as any)).toBe(true);
    expect(authServiceMock.canAccessRbac).toHaveBeenCalledWith(ekklesiaAdmin as any);
    expect(authServiceMock.canAccessRbac).toHaveBeenCalledWith(tenantUser as any);
  });

  it('canManageRoles() allows tenant admin role even without explicit permission payload', () => {
    createComponentWithUser(null);
    expect(component.canManageRoles(tenantAdminNoPermission as any)).toBe(true);
    expect(component.canManageRoles(churchAdminNoPermission as any)).toBe(true);
    expect(authServiceMock.canAccessRbac).toHaveBeenCalledWith(tenantAdminNoPermission as any);
    expect(authServiceMock.canAccessRbac).toHaveBeenCalledWith(churchAdminNoPermission as any);
  });

  it('canManageRoles() supports multi-role user payload', () => {
    createComponentWithUser(null);
    expect(component.canManageRoles(tenantMultiRoleWithPermission as any)).toBe(true);
    expect(authServiceMock.canAccessRbac).toHaveBeenCalledWith(tenantMultiRoleWithPermission as any);
  });

  it('canManageRoles() denies tenant non-admin without RBAC view permissions', () => {
    createComponentWithUser(null);
    expect(component.canManageRoles(tenantNonAdminNoPermission as any)).toBe(false);
    expect(authServiceMock.canAccessRbac).toHaveBeenCalledWith(tenantNonAdminNoPermission as any);
  });

  it('isSuperAdmin() true for is_admin or is_super_admin flags and ekklesia admin role', () => {
    createComponentWithUser(null);
    expect(component.isSuperAdmin(superAdminByFlag as any)).toBe(true);
    expect(component.isSuperAdmin(ekklesiaAdmin as any)).toBe(true);
  });

  it('shouldDisplaySection() gates Ekklesia-only sections for tenant users', () => {
    createComponentWithUser(null);
    const ecclesSection = { requiresEkklesiaRole: true } as any;
    const tenantOnlySection = { requiresTenantAccess: true } as any;

    expect(component.shouldDisplaySection(ecclesSection, tenantUser as any)).toBe(false);
    expect(component.shouldDisplaySection(tenantOnlySection, tenantUser as any)).toBe(true);
    expect(component.shouldDisplaySection(tenantOnlySection, ekklesiaAdmin as any)).toBe(false);
  });

  it('getVisibleSections() returns different sets for tenant vs ekklesia admin', () => {
    createComponentWithUser(null);
    const tenantVisible = component.getVisibleSections(tenantUser as any);
    const ekklesiaVisible = component.getVisibleSections(ekklesiaAdmin as any);

    // Tenant should not see ecclesiastical sections
    expect(tenantVisible.find(s => s.title === 'Ecclesiastical Data')).toBeUndefined();
    expect(tenantVisible.find(s => s.title === 'Sacrament Types')).toBeUndefined();

    // Ekklesia admin should see ecclesiastical sections but not tenant-only Sacraments
    expect(ekklesiaVisible.find(s => s.title === 'Ecclesiastical Data')).toBeDefined();
    expect(ekklesiaVisible.find(s => s.title === 'Sacrament Types')).toBeDefined();
    expect(ekklesiaVisible.find(s => s.title === 'Sacraments')).toBeUndefined();
  });

  it('shows Roles & Permissions card for tenant admin with RBAC view permission', () => {
    createComponentWithUser(tenantUser);
    const visible = component.getVisibleSections(tenantUser as any);
    expect(visible.find(s => s.title === 'Roles & Permissions')).toBeDefined();
  });

  it('hides Roles & Permissions card for tenant non-admin without RBAC view permission', () => {
    createComponentWithUser(tenantNonAdminNoPermission);
    const visible = component.getVisibleSections(tenantNonAdminNoPermission as any);
    expect(visible.find(s => s.title === 'Roles & Permissions')).toBeUndefined();
  });
});


