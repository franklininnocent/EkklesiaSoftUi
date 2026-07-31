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

  it('canManageRbac mirrors canAccessRbac', () => {
    const user = { role_name: 'Administrator', tenant_id: 42, permissions: [] } as any;
    (service as any).currentUserSubject.next(user);
    expect(service.canManageRbac(user)).toBe(service.canAccessRbac(user));
  });
});
