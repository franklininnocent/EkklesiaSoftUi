import { ComponentFixture, TestBed } from '@angular/core/testing';
import { of } from 'rxjs';
import { AssignPermissionsModalComponent } from './assign-permissions-modal.component';
import { PermissionsService } from '@core/services/permissions.service';
import { ToastService } from '@core/services/toast.service';
import { AuthService } from '@core/services/auth.service';
import { SimpleChange } from '@angular/core';

describe('AssignPermissionsModalComponent', () => {
  let component: AssignPermissionsModalComponent;
  let fixture: ComponentFixture<AssignPermissionsModalComponent>;

  const createPermission = (
    id: number,
    module: string,
    name: string,
    displayName: string,
    overrides: Partial<any> = {}
  ): any => ({
    id,
    name,
    display_name: displayName,
    module,
    category: 'general',
    description: `${displayName} description`,
    is_custom: false,
    active: 1,
    created_at: '2026-01-01T00:00:00Z',
    updated_at: '2026-01-01T00:00:00Z',
    ...overrides
  });

  const seedPermissions = (): void => {
    component.allPermissions = [
      createPermission(1, 'Families', 'families.view', 'Family View'),
      createPermission(2, 'Families', 'families.create', 'Family Create'),
      createPermission(3, 'Donations', 'donations.view', 'Donation View', { category: 'donations' }),
      createPermission(4, 'Donations', 'donations.manage', 'Donation Manage', { category: 'donations' })
    ];
    (component as any).groupPermissionsByModule();
    component.applyFilters();
  };

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [AssignPermissionsModalComponent],
      providers: [
        {
          provide: PermissionsService,
          useValue: {
            getPermissions: jest.fn().mockReturnValue(of({ data: [] })),
            getPermissionsForRole: jest.fn().mockReturnValue(of({ data: [] })),
            bulkAssignToRole: jest.fn().mockReturnValue(of({ success: true }))
          }
        },
        {
          provide: ToastService,
          useValue: {
            info: jest.fn(),
            warning: jest.fn(),
            success: jest.fn(),
            error: jest.fn()
          }
        },
        {
          provide: AuthService,
          useValue: {
            isSuperAdmin: jest.fn().mockReturnValue(false)
          }
        }
      ]
    }).compileComponents();

    fixture = TestBed.createComponent(AssignPermissionsModalComponent);
    component = fixture.componentInstance;
  });

  it('detects missing required admin permissions for protected tenant role', () => {
    component.tenantMode = true;
    component.role = { id: 10, name: 'Administrator' } as any;
    component.allPermissions = [
      { id: 1, name: 'roles.view' } as any,
      { id: 2, name: 'roles.create' } as any
    ];
    component.selectedPermissionIds = new Set([1]);

    expect(component.hasAdminPermissionConflict()).toBe(true);
    expect(component.getMissingRequiredAdminPermissions()).toEqual(
      expect.arrayContaining(['roles.create', 'roles.update', 'roles.delete'])
    );
  });

  it('passes safeguard check when protected role has all required permissions', () => {
    component.tenantMode = true;
    component.role = { id: 11, name: 'Church Administrator' } as any;
    component.allPermissions = [
      { id: 1, name: 'roles.view' } as any,
      { id: 2, name: 'roles.create' } as any,
      { id: 3, name: 'roles.update' } as any,
      { id: 4, name: 'roles.delete' } as any,
      { id: 5, name: 'permissions.assign' } as any,
      { id: 6, name: 'roles.assign' } as any,
      { id: 7, name: 'users.view' } as any,
      { id: 8, name: 'users.update' } as any
    ];
    component.selectedPermissionIds = new Set([1, 2, 3, 4, 5, 6, 7, 8]);

    expect(component.hasAdminPermissionConflict()).toBe(false);
    expect(component.getMissingRequiredAdminPermissions()).toEqual([]);
  });

  it('treats protected classification as protected even for non-legacy role name', () => {
    component.tenantMode = true;
    component.role = { id: 12, name: 'Governance Role', role_classification: 'protected_system' } as any;
    component.allPermissions = [
      { id: 1, name: 'roles.view' } as any
    ];
    component.selectedPermissionIds = new Set([1]);

    expect(component.isProtectedTenantRole()).toBe(true);
    expect(component.hasAdminPermissionConflict()).toBe(true);
  });

  it('returns expected risk level for key modules', () => {
    expect(component.getModuleRiskLevel('Users')).toBe('high');
    expect(component.getModuleRiskLevel('Donations')).toBe('medium');
    expect(component.getModuleRiskLevel('Events')).toBe('low');
  });

  it('normalizes grouped permission response and keeps isolated selection', async () => {
    const permissionsService = TestBed.inject(PermissionsService) as any;
    permissionsService.getPermissions.mockReturnValue(of({
      success: true,
      data: [
        {
          module: 'Users',
          permissions: [
            createPermission(1, 'Users', 'users.view', 'View Users'),
            createPermission(2, 'Users', 'users.create', 'Create Users')
          ]
        },
        {
          module: 'Members',
          permissions: [
            createPermission(3, 'Members', 'members.view', 'View Members')
          ]
        }
      ]
    }));

    component.role = { id: 1, name: 'Editor' } as any;
    component.show = true;
    component.ngOnChanges({
      show: new SimpleChange(false, true, true)
    });

    await Promise.resolve();
    await Promise.resolve();

    expect(component.allPermissions.map((permission: any) => permission.id)).toEqual([1, 2, 3]);
    expect(component.permissionGroups.length).toBe(2);

    const usersPermission = component.allPermissions.find((permission: any) => permission.id === 1);
    const membersPermission = component.allPermissions.find((permission: any) => permission.id === 3);
    expect(usersPermission).toBeTruthy();
    expect(membersPermission).toBeTruthy();
    component.togglePermission(usersPermission!);

    expect(component.selectedPermissionIds.has(1)).toBe(true);
    expect(component.selectedPermissionIds.has(2)).toBe(false);
    expect(component.selectedPermissionIds.has(3)).toBe(false);

    component.togglePermission(membersPermission!);
    expect(component.selectedPermissionIds.has(1)).toBe(true);
    expect(component.selectedPermissionIds.has(3)).toBe(true);
  });

  it('maps legacy Authentication module users.* permissions into Users group', async () => {
    const permissionsService = TestBed.inject(PermissionsService) as any;
    permissionsService.getPermissions.mockReturnValue(of({
      success: true,
      data: [
        createPermission(11, 'Authentication', 'users.view', 'View Users'),
        createPermission(12, 'Authentication', 'users.create', 'Create Users')
      ]
    }));

    component.role = { id: 1, name: 'Editor' } as any;
    component.show = true;
    component.ngOnChanges({
      show: new SimpleChange(false, true, true)
    });

    await Promise.resolve();
    await Promise.resolve();

    const usersGroup = component.permissionGroups.find((group) => group.module === 'Users');
    expect(usersGroup).toBeTruthy();
    expect(usersGroup?.permissions.length).toBe(2);
  });

  describe('search and filters', () => {
    beforeEach(() => {
      seedPermissions();
    });

    it('searches permissions by name case-insensitively', () => {
      component.onSearchChange('FAMILY');
      expect(component.filteredPermissionCount).toBe(2);
      expect(component.filteredGroups[0].module).toBe('Families');
    });

    it('searches permissions by description', () => {
      component.onSearchChange('donation view description');
      expect(component.filteredPermissionCount).toBe(1);
      expect(component.filteredGroups[0].permissions[0].name).toBe('donations.view');
    });

    it('searches permissions by module metadata', () => {
      component.onSearchChange('donations');
      expect(component.filteredPermissionCount).toBe(2);
    });

    it('clears search and restores full result set', () => {
      component.onSearchChange('family');
      expect(component.filteredPermissionCount).toBe(2);
      component.clearSearch();
      expect(component.filteredPermissionCount).toBe(4);
    });

    it('filters by module', () => {
      component.onAdvancedSearch({ module: 'Families' });
      expect(component.filteredPermissionCount).toBe(2);
      expect(component.getActiveFilterCount()).toBe(1);
    });

    it('filters by action type', () => {
      component.onAdvancedSearch({ action: 'view' });
      expect(component.filteredPermissionCount).toBe(2);
    });

    it('filters by assignment state', () => {
      component.selectedPermissionIds = new Set([1, 3]);
      component.onAdvancedSearch({ assignment: 'assigned' });
      expect(component.filteredPermissionCount).toBe(2);
    });

    it('combines search and drawer filters', () => {
      component.onSearchChange('family');
      component.onAdvancedSearch({ action: 'create' });
      expect(component.filteredPermissionCount).toBe(1);
      expect(component.filteredGroups[0].permissions[0].name).toBe('families.create');
    });

    it('shows empty filtered groups when no permissions match', () => {
      component.onSearchChange('nonexistent-permission');
      expect(component.filteredGroups.length).toBe(0);
      expect(component.filteredPermissionCount).toBe(0);
    });

    it('clears all filters and search together', () => {
      component.onSearchChange('family');
      component.onAdvancedSearch({ module: 'Families', action: 'view' });
      component.clearAllFilters();
      expect(component.searchQuery).toBe('');
      expect(component.getActiveFilterCount()).toBe(0);
      expect(component.filteredPermissionCount).toBe(4);
    });

    it('preserves search and filters after assignment toggle', () => {
      component.onSearchChange('family');
      component.onAdvancedSearch({ action: 'view' });
      const permission = component.allPermissions.find((item) => item.id === 1)!;

      component.togglePermission(permission);

      expect(component.searchQuery).toBe('family');
      expect(component.actionFilter).toBe('view');
      expect(component.filteredPermissionCount).toBe(1);
      expect(component.selectedPermissionIds.has(1)).toBe(true);
    });

    it('removes a single active filter chip', () => {
      component.onAdvancedSearch({ module: 'Families', action: 'view' });
      component.removeFilter(component.getActiveFilters()[0]);
      expect(component.moduleFilter).toBe('');
      expect(component.filteredPermissionCount).toBe(2);
    });
  });
});
