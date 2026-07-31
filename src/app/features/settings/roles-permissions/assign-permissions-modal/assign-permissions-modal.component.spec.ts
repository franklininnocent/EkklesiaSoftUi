import { ComponentFixture, TestBed } from '@angular/core/testing';
import { of } from 'rxjs';
import { AssignPermissionsModalComponent } from './assign-permissions-modal.component';
import { PermissionsService } from '@core/services/permissions.service';
import { ToastService } from '@core/services/toast.service';
import { AuthService } from '@core/services/auth.service';
import { SimpleChange } from '@angular/core';

describe('AssignPermissionsModalComponent safeguards', () => {
  let component: AssignPermissionsModalComponent;
  let fixture: ComponentFixture<AssignPermissionsModalComponent>;

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

  const createPermission = (id: number, module: string, name: string, displayName: string): any => ({
    id,
    name,
    display_name: displayName,
    module,
    category: 'general',
    description: `${displayName} description`,
    is_custom: false,
    active: 1,
    created_at: '2026-01-01T00:00:00Z',
    updated_at: '2026-01-01T00:00:00Z'
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
});

