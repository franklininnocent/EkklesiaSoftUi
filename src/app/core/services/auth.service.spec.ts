import { TestBed } from '@angular/core/testing';
import { HttpClientTestingModule } from '@angular/common/http/testing';
import { Router } from '@angular/router';
import { AuthService } from './auth.service';
import { PhoneCodeService } from '@core/services/phone-code.service';

describe('AuthService RBAC access helpers', () => {
  let service: AuthService;

  beforeEach(() => {
    TestBed.configureTestingModule({
      imports: [HttpClientTestingModule],
      providers: [
        AuthService,
        { provide: Router, useValue: { navigate: jest.fn() } },
        {
          provide: PhoneCodeService,
          useValue: { setPhoneCode: jest.fn() }
        }
      ]
    });

    service = TestBed.inject(AuthService);
    (service as any).currentUserSubject.next(null);
  });

  it('returns false for RBAC access when user is missing', () => {
    expect(service.canAccessRbac(null)).toBe(false);
  });

  it('allows RBAC access for SuperAdmin users', () => {
    const user = { role_name: 'SuperAdmin', tenant_id: null, permissions: [] } as any;
    (service as any).currentUserSubject.next(user);
    expect(service.canAccessRbac(user)).toBe(true);
  });

  it('allows RBAC access for EkklesiaManager users', () => {
    const user = { role_name: 'EkklesiaManager', tenant_id: null, permissions: [] } as any;
    (service as any).currentUserSubject.next(user);
    expect(service.canAccessRbac(user)).toBe(true);
  });

  it('allows RBAC access for tenant administrators', () => {
    const user = { role_name: 'Administrator', tenant_id: 42, permissions: [] } as any;
    (service as any).currentUserSubject.next(user);
    expect(service.canAccessRbac(user)).toBe(true);
  });

  it('allows RBAC access for multi-role users with Administrator role in roles array', () => {
    const user = {
      role_name: null,
      tenant_id: 42,
      roles: [{ name: 'Reader' }, { name: 'Administrator' }],
      permissions: []
    } as any;
    (service as any).currentUserSubject.next(user);
    expect(service.canAccessRbac(user)).toBe(true);
  });

  it('allows RBAC access for users with RBAC view permission', () => {
    const user = {
      role_name: 'Member',
      tenant_id: 42,
      permissions: [{ name: 'permissions.view' }]
    } as any;
    (service as any).currentUserSubject.next(user);
    expect(service.canAccessRbac(user)).toBe(true);
  });

  it('denies RBAC access for tenant non-admin without RBAC view permissions', () => {
    const user = {
      role_name: 'Member',
      tenant_id: 42,
      permissions: [{ name: 'members.view' }]
    } as any;
    (service as any).currentUserSubject.next(user);
    expect(service.canAccessRbac(user)).toBe(false);
  });

  it('denies RBAC access for non-tenant non-admin user without RBAC view permissions', () => {
    const user = {
      role_name: 'Member',
      tenant_id: null,
      permissions: [{ name: 'members.view' }]
    } as any;
    (service as any).currentUserSubject.next(user);
    expect(service.canAccessRbac(user)).toBe(false);
  });

  it('canManageRbac requires manage capability, not view-only access', () => {
    const viewOnly = {
      role_name: 'Member',
      tenant_id: 42,
      permissions: [{ name: 'roles.view' }]
    } as any;
    (service as any).currentUserSubject.next(viewOnly);
    expect(service.canAccessRbac(viewOnly)).toBe(true);
    expect(service.canManageRbac(viewOnly)).toBe(false);
  });

  it('canManageRbac allows tenant administrators', () => {
    const user = { role_name: 'Administrator', tenant_id: 42, permissions: [] } as any;
    (service as any).currentUserSubject.next(user);
    expect(service.canManageRbac(user)).toBe(true);
  });

  it('does not treat has_ekklesia_role as SuperAdmin or EkklesiaAdmin', () => {
    const user = {
      role_name: 'EkklesiaManager',
      tenant_id: null,
      has_ekklesia_role: true,
      permissions: []
    } as any;
    (service as any).currentUserSubject.next(user);
    expect(service.isSuperAdmin()).toBe(false);
    expect(service.isEkklesiaAdmin()).toBe(false);
  });

  it('denies Tenant Ministries for EkklesiaAdmin without tenant_id or support session', () => {
    const user = { role_name: 'EkklesiaAdmin', tenant_id: null, permissions: [] } as any;
    (service as any).currentUserSubject.next(user);
    expect(service.canAccessMinistries(user)).toBe(false);
    expect(service.canAccessMinistries(user, { hasActiveSupportSession: false })).toBe(false);
  });

  it('allows Tenant Ministries for EkklesiaAdmin with active support session', () => {
    const user = { role_name: 'EkklesiaAdmin', tenant_id: null, permissions: [] } as any;
    (service as any).currentUserSubject.next(user);
    expect(service.canAccessMinistries(user, { hasActiveSupportSession: true })).toBe(true);
  });

  it('allows Tenant Ministries for SuperAdmin with home tenant_id', () => {
    const user = { role_name: 'SuperAdmin', tenant_id: 7, permissions: [] } as any;
    (service as any).currentUserSubject.next(user);
    expect(service.canAccessMinistries(user)).toBe(true);
  });

  it('allows Tenant Ministries for parish Administrator with tenant_id', () => {
    const user = { role_name: 'Administrator', tenant_id: 42, permissions: [] } as any;
    (service as any).currentUserSubject.next(user);
    expect(service.canAccessMinistries(user)).toBe(true);
  });

  it('allows pastoral care for Parish Priest', () => {
    const user = { role_name: 'Parish Priest', tenant_id: 42, permissions: [] } as any;
    expect(service.canAccessPastoral(user)).toBe(true);
  });

  it('denies pastoral care for a member without permissions', () => {
    const user = { role_name: 'Member', tenant_id: 42, permissions: [] } as any;
    expect(service.canAccessPastoral(user)).toBe(false);
  });

  it('allows pastoral care when the user has pastoral.care.view', () => {
    const user = {
      role_name: 'Secretary',
      tenant_id: 42,
      permissions: [{ name: 'pastoral.care.view' }],
    } as any;
    expect(service.canAccessPastoral(user)).toBe(true);
  });
});
