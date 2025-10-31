import { TestBed } from '@angular/core/testing';
import { of } from 'rxjs';
import { SettingsComponent } from './settings.component';
import { Store } from '@ngrx/store';

describe('SettingsComponent (role-based visibility)', () => {
  let component: SettingsComponent;

  const createComponentWithUser = (user: any | null) => {
    TestBed.configureTestingModule({
      imports: [SettingsComponent],
      providers: [
        {
          provide: Store,
          useValue: {
            select: () => of(user)
          }
        }
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

  it('hasEkklesiaRole() should be false for any user with tenant_id', () => {
    createComponentWithUser(tenantUser);
    expect(component.hasEkklesiaRole(tenantUser as any)).toBe(false);
  });

  it('hasEkklesiaRole() should be true for ekklesia roles without tenant', () => {
    createComponentWithUser(ekklesiaAdmin);
    expect(component.hasEkklesiaRole(ekklesiaAdmin as any)).toBe(true);
  });

  it('canManageRoles() allows EkklesiaAdmin and tenant Administrator with tenant_id', () => {
    createComponentWithUser(null);
    expect(component.canManageRoles(ekklesiaAdmin as any)).toBe(true);
    expect(component.canManageRoles(tenantUser as any)).toBe(true);
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
});


