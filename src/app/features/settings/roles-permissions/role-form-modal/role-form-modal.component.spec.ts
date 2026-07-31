import { ComponentFixture, TestBed } from '@angular/core/testing';
import { of, throwError } from 'rxjs';
import { SimpleChange } from '@angular/core';
import { RoleFormModalComponent } from './role-form-modal.component';
import { RolesService } from '@core/services/roles.service';
import { PermissionsService } from '@core/services/permissions.service';
import { AuthService } from '@core/services/auth.service';
import { Permission } from '@core/models';

describe('RoleFormModalComponent safeguards', () => {
  let component: RoleFormModalComponent;
  let fixture: ComponentFixture<RoleFormModalComponent>;
  let rolesServiceMock: {
    createRole: jest.Mock;
    updateRole: jest.Mock;
  };
  let permissionsServiceMock: {
    getPermissions: jest.Mock;
    getPermissionsForRole: jest.Mock;
    bulkAssignToRole: jest.Mock;
  };
  let authServiceMock: {
    hasPermission: jest.Mock;
    isSuperAdmin: jest.Mock;
    isEkklesiaAdmin: jest.Mock;
    canManageRbac: jest.Mock;
  };

  beforeEach(async () => {
    rolesServiceMock = {
      createRole: jest.fn().mockReturnValue(of({ data: { role: { id: 1, name: 'Custom', level: 7 } } })),
      updateRole: jest.fn().mockReturnValue(of({ data: { role: { id: 1, name: 'Administrator', level: 10 } } }))
    };

    permissionsServiceMock = {
      getPermissions: jest.fn().mockReturnValue(of({ data: [] })),
      getPermissionsForRole: jest.fn().mockReturnValue(of({ success: true, data: [] })),
      bulkAssignToRole: jest.fn().mockReturnValue(of({ success: true }))
    };

    authServiceMock = {
      hasPermission: jest.fn().mockReturnValue(true),
      isSuperAdmin: jest.fn().mockReturnValue(false),
      isEkklesiaAdmin: jest.fn().mockReturnValue(false),
      canManageRbac: jest.fn().mockReturnValue(true)
    };

    await TestBed.configureTestingModule({
      imports: [RoleFormModalComponent],
      providers: [
        { provide: RolesService, useValue: rolesServiceMock },
        { provide: PermissionsService, useValue: permissionsServiceMock },
        { provide: AuthService, useValue: authServiceMock }
      ]
    }).compileComponents();

    fixture = TestBed.createComponent(RoleFormModalComponent);
    component = fixture.componentInstance;
  });

  const createPermission = (id: number, module: string, name: string, displayName: string): Permission => ({
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

  it('locks name and level for protected tenant role in edit mode', () => {
    component.tenantMode = true;
    component.role = { id: 7, name: 'Administrator', level: 10, is_custom: true, active: 1 } as any;
    component.show = true;

    component.ngOnChanges({
      show: new SimpleChange(false, true, true),
      role: new SimpleChange(null, component.role, true)
    });

    expect(component.isRoleIdentityLocked()).toBe(true);
    expect(component.roleForm.get('name')?.disabled).toBe(true);
    expect(component.roleForm.get('level')?.disabled).toBe(true);
  });

  it('keeps name and level editable for non-protected tenant role', () => {
    component.tenantMode = true;
    component.role = { id: 8, name: 'Choir Manager', level: 7, is_custom: true, active: 1 } as any;
    component.show = true;

    component.ngOnChanges({
      show: new SimpleChange(false, true, true),
      role: new SimpleChange(null, component.role, true)
    });

    expect(component.isRoleIdentityLocked()).toBe(false);
    expect(component.roleForm.get('name')?.enabled).toBe(true);
    expect(component.roleForm.get('level')?.enabled).toBe(true);
  });

  it('keeps edit form valid for legacy default role levels below 5', () => {
    component.tenantMode = true;
    component.role = { id: 12, name: 'Parish Priest', level: 2, is_custom: false, active: 1 } as any;
    component.show = true;

    component.ngOnChanges({
      show: new SimpleChange(false, true, true),
      role: new SimpleChange(null, component.role, true)
    });

    expect(component.effectiveMinLevel).toBe(2);
    expect(component.roleForm.get('level')?.valid).toBe(true);
    expect(component.roleForm.valid).toBe(true);
  });

  it('preserves protected role identity on submit even if form is tampered', () => {
    component.tenantMode = true;
    component.role = { id: 9, name: 'Administrator', level: 10, is_custom: true, active: 1 } as any;
    component.show = true;

    component.ngOnChanges({
      show: new SimpleChange(false, true, true),
      role: new SimpleChange(null, component.role, true)
    });

    component.roleForm.get('name')?.enable({ emitEvent: false });
    component.roleForm.get('level')?.enable({ emitEvent: false });
    component.roleForm.patchValue({ name: 'Hacked Name', level: 5, description: 'Updated description' });

    component.onSubmit();

    expect(rolesServiceMock.updateRole).toHaveBeenCalledWith(
      9,
      expect.objectContaining({
        name: 'Administrator',
        level: 10
      }),
      { tenantMode: true }
    );
  });

  it('keeps permission selection isolated per checkbox', () => {
    component.permissions = [
      createPermission(1, 'Users', 'users.view', 'View Users'),
      createPermission(2, 'Users', 'users.create', 'Create Users'),
      createPermission(3, 'Members', 'members.view', 'View Members')
    ];
    (component as any).rebuildPermissionsIndex();

    component.togglePermission(1);

    expect(component.isPermissionSelected(1)).toBe(true);
    expect(component.isPermissionSelected(2)).toBe(false);
    expect(component.isPermissionSelected(3)).toBe(false);
    expect(component.selectedPermissionsCount).toBe(1);
    expect(component.isModulePartiallySelected('Users')).toBe(true);
    expect(component.isModuleFullySelected('Members')).toBe(false);
  });

  it('normalizes grouped permission response defensively in component', () => {
    permissionsServiceMock.getPermissions.mockReturnValue(of({
      success: true,
      data: [
        {
          module: 'Users',
          permissions: [
            createPermission(10, 'Users', 'users.view', 'View Users'),
            createPermission(11, 'Users', 'users.create', 'Create Users')
          ]
        },
        {
          module: 'Members',
          permissions: [
            createPermission(20, 'Members', 'members.view', 'View Members')
          ]
        }
      ]
    }));

    component.loadPermissions();

    expect(component.permissions.map((permission) => permission.id)).toEqual([10, 11, 20]);
    expect(component.modules).toEqual(['Members', 'Users']);
    expect(component.permissionsByModule.get('Users')?.length).toBe(2);
    expect(component.permissionsByModule.get('Members')?.length).toBe(1);
  });

  it('maps legacy Authentication module users.* permissions into Users group', () => {
    component.permissions = [
      createPermission(100, 'Authentication', 'users.view', 'View Users'),
      createPermission(101, 'Authentication', 'users.create', 'Create Users')
    ];

    (component as any).rebuildPermissionsIndex();

    expect(component.modules).toContain('Users');
    expect(component.permissionsByModule.get('Users')?.length).toBe(2);
  });

  it('renders human-readable permission text without raw permission code', () => {
    fixture.componentRef.setInput('show', true);
    fixture.detectChanges();

    component.permissions = [
      createPermission(1, 'Users', 'users.view', 'View Users')
    ];
    (component as any).rebuildPermissionsIndex();
    fixture.detectChanges();
    component.permissions = [
      createPermission(1, 'Users', 'users.view', 'View Users')
    ];
    (component as any).rebuildPermissionsIndex();
    fixture.detectChanges();

    const header = (fixture.nativeElement as HTMLElement).querySelector('.permissions-header') as HTMLElement;
    header.click();
    fixture.detectChanges();

    const modalText = (fixture.nativeElement as HTMLElement).textContent || '';
    expect(modalText).toContain('View Users description');
    expect(modalText).not.toContain('users.view');
  });

  it('hides tenant-specific info box in tenant mode', () => {
    component.tenantMode = true;
    fixture.componentRef.setInput('show', true);
    fixture.detectChanges();

    const modalText = (fixture.nativeElement as HTMLElement).textContent || '';
    expect(modalText).not.toContain('Tenant-Specific Role');
    expect(modalText).not.toContain('This role will be created for your tenant only');
  });

  it('shows tenant-specific info box for non-tenant mode', () => {
    component.tenantMode = false;
    fixture.componentRef.setInput('show', true);
    fixture.detectChanges();

    const modalText = (fixture.nativeElement as HTMLElement).textContent || '';
    expect(modalText).toContain('Tenant-Specific Role');
  });

  it('skips permission sync when user cannot assign permissions', () => {
    authServiceMock.hasPermission.mockReturnValue(false);
    authServiceMock.isSuperAdmin.mockReturnValue(false);
    authServiceMock.isEkklesiaAdmin.mockReturnValue(false);

    const savedSpy = jest.spyOn(component.saved, 'emit');

    component.show = true;
    component.ngOnChanges({
      show: new SimpleChange(false, true, true)
    });

    component.selectedPermissionIds = new Set([1, 2]);
    component.roleForm.patchValue({
      name: 'Restricted Operator',
      description: 'Role created without permission assignment privileges',
      level: 6
    });

    component.onSubmit();

    expect(permissionsServiceMock.bulkAssignToRole).not.toHaveBeenCalled();
    expect(savedSpy).toHaveBeenCalledWith(expect.objectContaining({ name: 'Custom' }));
  });

  it('does not show partial failure when permission sync returns 403', () => {
    authServiceMock.hasPermission.mockReturnValue(true);
    permissionsServiceMock.bulkAssignToRole.mockReturnValueOnce(
      throwError(() => ({ status: 403, error: { message: 'Forbidden' } }))
    );

    const savedSpy = jest.spyOn(component.saved, 'emit');
    const closeSpy = jest.spyOn(component, 'close');

    component.show = true;
    component.ngOnChanges({
      show: new SimpleChange(false, true, true)
    });

    component.selectedPermissionIds = new Set([1]);
    component.roleForm.patchValue({
      name: 'Role With Restricted Sync',
      description: 'Should not show sync failure error for 403',
      level: 6
    });

    component.onSubmit();

    expect(savedSpy).toHaveBeenCalledWith(expect.objectContaining({ name: 'Custom' }));
    expect(closeSpy).toHaveBeenCalled();
    expect(component.errorMessage).toBeNull();
  });

  it('computes sticky footer summary counts', () => {
    component.permissions = [
      createPermission(1, 'Users', 'users.view', 'View Users'),
      createPermission(2, 'Finance', 'finance.approve', 'Approve Finance'),
      createPermission(3, 'Members', 'members.create', 'Create Members')
    ];
    (component as any).rebuildPermissionsIndex();
    component.selectedPermissionIds = new Set([1, 2]);

    expect(component.selectedPermissionsCount).toBe(2);
    expect(component.selectedModulesCount).toBe(2);
    expect(component.highRiskSelectedCount).toBe(1);
  });

});

