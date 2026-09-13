import { TestBed } from '@angular/core/testing';
import { NavMenuService } from './nav-menu.service';
import { AuthService } from './auth.service';
import { ApplicationContextService } from './application-context.service';
import { SubscriptionAccessService } from './subscription-access.service';
import { SupportSessionService } from '@features/support-center/services/support-session.service';

describe('NavMenuService', () => {
  let service: NavMenuService;
  let authMock: Partial<AuthService>;
  let appContextMock: Partial<ApplicationContextService>;

  beforeEach(() => {
    authMock = {
      isPlatformActor: jest.fn(),
      canManageTenants: jest.fn(),
      canAccessSupportCenter: jest.fn(),
      canAccessApplicationAccess: jest.fn(),
      canAccessSupport: jest.fn(),
      canAccessRbac: jest.fn(),
      canAccessBcc: jest.fn(),
      canAccessDonations: jest.fn(),
      canAccessMinistries: jest.fn(),
      hasTenantPermission: jest.fn().mockReturnValue(false),
      hasPermission: jest.fn().mockReturnValue(false),
      isTenantAdmin: jest.fn().mockReturnValue(false),
      isSuperAdmin: jest.fn().mockReturnValue(false),
      isEkklesiaAdmin: jest.fn().mockReturnValue(false),
    };
    appContextMock = {
      resolveNavigationSnapshot: jest.fn(),
      hasSupportTenantContext: jest.fn(),
    };

    TestBed.configureTestingModule({
      providers: [
        NavMenuService,
        { provide: AuthService, useValue: authMock },
        { provide: ApplicationContextService, useValue: appContextMock },
        {
          provide: SupportSessionService,
          useValue: { sessionId: null },
        },
        {
          provide: SubscriptionAccessService,
          useValue: { canViewGatedModules: jest.fn().mockReturnValue(true) },
        },
      ],
    });

    service = TestBed.inject(NavMenuService);
  });

  it('hides Ekklesia menus for tenant administrator', () => {
    const tenantAdmin = { tenant_id: 5, role_name: 'Administrator' } as any;
    (authMock.isPlatformActor as jest.Mock).mockReturnValue(false);
    (appContextMock.resolveNavigationSnapshot as jest.Mock).mockReturnValue({
      actorKind: 'tenant',
      application: 'TENANT',
      supportActive: false,
      targetTenantId: 5,
    });

    expect(service.isVisible('tenants', tenantAdmin)).toBe(false);
    expect(service.isVisible('support-center', tenantAdmin)).toBe(false);
    expect(service.isVisible('application-access', tenantAdmin)).toBe(false);
    expect(service.isVisible('platform-ministries', tenantAdmin)).toBe(false);
    expect(service.isVisible('families', tenantAdmin)).toBe(true);
  });

  it('shows Ekklesia platform menus for platform admin without support overlay', () => {
    const admin = { tenant_id: null, has_ekklesia_role: true, role_name: 'EkklesiaAdmin' } as any;
    (authMock.isPlatformActor as jest.Mock).mockReturnValue(true);
    (authMock.canManageTenants as jest.Mock).mockReturnValue(true);
    (authMock.canAccessSupportCenter as jest.Mock).mockReturnValue(true);
    (authMock.canAccessApplicationAccess as jest.Mock).mockReturnValue(true);
    (appContextMock.resolveNavigationSnapshot as jest.Mock).mockReturnValue({
      actorKind: 'platform',
      application: 'EKKLESIA',
      supportActive: false,
      targetTenantId: null,
    });

    expect(service.isVisible('tenants', admin)).toBe(true);
    expect(service.isVisible('support-center', admin)).toBe(true);
    expect(service.isVisible('application-access', admin)).toBe(true);
    expect(service.isVisible('families', admin)).toBe(false);
  });

  it('keeps Ekklesia platform menus and hides parish menus during active support session', () => {
    const admin = { tenant_id: null, has_ekklesia_role: true, role_name: 'EkklesiaAdmin' } as any;
    (authMock.isPlatformActor as jest.Mock).mockReturnValue(true);
    (authMock.canManageTenants as jest.Mock).mockReturnValue(true);
    (authMock.canAccessSupportCenter as jest.Mock).mockReturnValue(true);
    (authMock.canAccessApplicationAccess as jest.Mock).mockReturnValue(true);
    (appContextMock.resolveNavigationSnapshot as jest.Mock).mockReturnValue({
      actorKind: 'platform',
      application: 'EKKLESIA',
      supportActive: true,
      targetTenantId: 10,
    });

    expect(service.isVisible('tenants', admin)).toBe(true);
    expect(service.isVisible('platform-ministries', admin)).toBe(true);
    expect(service.isVisible('application-access', admin)).toBe(true);
    expect(service.isVisible('support-center', admin)).toBe(true);
    expect(service.isVisible('families', admin)).toBe(false);
    expect(service.isVisible('church-profile', admin)).toBe(false);
  });

  it('exposes parish workspace links in support banner for platform admin with active session', () => {
    const admin = { tenant_id: null, has_ekklesia_role: true, role_name: 'EkklesiaAdmin' } as any;
    (authMock.isPlatformActor as jest.Mock).mockReturnValue(true);
    (authMock.canAccessBcc as jest.Mock).mockReturnValue(true);
    (authMock.canAccessDonations as jest.Mock).mockReturnValue(true);
    (authMock.canAccessMinistries as jest.Mock).mockReturnValue(true);
    (authMock.canAccessRbac as jest.Mock).mockReturnValue(true);
    (appContextMock.hasSupportTenantContext as jest.Mock).mockReturnValue(true);

    const links = service.getSupportParishWorkspaceLinks(admin);
    const labels = links.map((link) => link.label);

    expect(labels).toContain('Church Profile');
    expect(labels).toContain('Families');
    expect(labels).toContain('Members');
    expect(labels).toContain('Donations');
    expect(labels).toContain('Ministries');
    expect(labels).toContain('Roles & Permissions');
    (appContextMock.resolveNavigationSnapshot as jest.Mock).mockReturnValue({
      actorKind: 'platform',
      application: 'EKKLESIA',
      supportActive: true,
      targetTenantId: 10,
    });
    expect(service.isVisible('families', admin)).toBe(false);
  });

  it('shows diocesan bishop sidebar item when bishop permissions are granted', () => {
    const tenantUser = { tenant_id: 5, role_name: 'Administrator' } as any;
    (authMock.isPlatformActor as jest.Mock).mockReturnValue(false);
    (authMock.hasTenantPermission as jest.Mock).mockImplementation(
      (permission: string) => permission === 'bishops.view'
    );
    (appContextMock.resolveNavigationSnapshot as jest.Mock).mockReturnValue({
      actorKind: 'tenant',
      application: 'TENANT',
      supportActive: false,
      targetTenantId: 5,
    });

    expect(service.isVisible('church-profile-diocesan', tenantUser)).toBe(true);
  });

  it('hides diocesan bishop sidebar item without bishop permissions', () => {
    const tenantUser = { tenant_id: 5, role_name: 'Administrator' } as any;
    (authMock.hasTenantPermission as jest.Mock).mockReturnValue(false);

    expect(service.isVisible('church-profile-diocesan', tenantUser)).toBe(false);
  });

  it('shows edit profile sidebar item when church profile can be edited', () => {
    const tenantUser = { tenant_id: 5, role_name: 'Administrator' } as any;
    (authMock.isPlatformActor as jest.Mock).mockReturnValue(false);
    (authMock.hasPermission as jest.Mock).mockImplementation(
      (permission: string) => permission === 'church.settings.edit'
    );
    (appContextMock.resolveNavigationSnapshot as jest.Mock).mockReturnValue({
      actorKind: 'tenant',
      application: 'TENANT',
      supportActive: false,
      targetTenantId: 5,
    });

    expect(service.isVisible('church-profile-edit', tenantUser)).toBe(true);
  });

  it('hides edit profile sidebar item without edit permissions', () => {
    const tenantUser = { tenant_id: 5, role_name: 'Viewer', is_primary_admin: false } as any;
    (authMock.hasPermission as jest.Mock).mockReturnValue(false);
    (authMock.isTenantAdmin as jest.Mock).mockReturnValue(false);

    expect(service.isVisible('church-profile-edit', tenantUser)).toBe(false);
  });
});
