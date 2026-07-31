import { ComponentFixture, TestBed } from '@angular/core/testing';
import { SimpleChange } from '@angular/core';
import { Permission } from '@core/models';
import { RolePermissionWorkspaceComponent } from './role-permission-workspace.component';

describe('RolePermissionWorkspaceComponent', () => {
  let component: RolePermissionWorkspaceComponent;
  let fixture: ComponentFixture<RolePermissionWorkspaceComponent>;

  const permission = (id: number, module: string, name: string, displayName: string, description?: string): Permission => ({
    id,
    name,
    display_name: displayName,
    description: description ?? displayName,
    module,
    category: null,
    scope: 'tenant',
    tenant_id: 1,
    is_custom: false,
    active: 1,
    created_at: '2026-01-01',
    updated_at: '2026-01-01'
  });

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [RolePermissionWorkspaceComponent]
    }).compileComponents();

    fixture = TestBed.createComponent(RolePermissionWorkspaceComponent);
    component = fixture.componentInstance;

    const users = [
      permission(1, 'Users', 'users.view', 'View Users', 'View user records'),
      permission(2, 'Users', 'users.edit', 'Edit Users', 'Edit user records')
    ];
    const finance = [
      permission(3, 'Finance', 'finance.approve', 'Approve Finance', 'Approve financial records'),
      permission(4, 'Finance', 'finance.delete', 'Delete Finance', 'Delete financial records')
    ];

    component.modules = ['Finance', 'Users'];
    component.permissionsByModule = new Map([
      ['Users', users],
      ['Finance', finance]
    ]);
    component.selectedPermissionIds = new Set<number>();
    component.ngOnChanges({
      modules: new SimpleChange([], component.modules, true)
    });
    fixture.detectChanges();
  });

  it('filters permissions by global search', () => {
    component.debouncedPermissionSearch = 'edit';
    fixture.detectChanges();
    expect(component.rightPanelPermissions).toHaveLength(1);
    expect(component.rightPanelPermissions[0].name).toBe('users.edit');
  });

  it('applies view-only template', () => {
    const emitted: Set<number>[] = [];
    component.selectedPermissionIdsChange.subscribe((value) => emitted.push(value));
    component.applyTemplate('view-only');
    expect(emitted[0].has(1)).toBe(true);
    expect(emitted[0].has(2)).toBe(false);
    expect(emitted[0].has(3)).toBe(false);
  });

  it('marks high-risk permissions in analytics', () => {
    component.selectedPermissionIds = new Set<number>([3, 4]);
    fixture.detectChanges();
    expect(component.highRiskSelectedCount).toBe(2);
    expect(component.sensitiveSelectedCount).toBe(2);
  });

  it('never displays raw permission keys when label exists', () => {
    const label = component.getPermissionLabel(permission(99, 'Events', 'events.create', 'Create Events', 'Create church events'));
    expect(label).toBe('Create church events');
    expect(label).not.toContain('events.create');
  });

  it('supports keyboard selection for permission cards', () => {
    const emitted: Set<number>[] = [];
    component.selectedPermissionIdsChange.subscribe((value) => emitted.push(value));
    component.selectModule('Finance');

    const event = { key: 'Enter', preventDefault: jest.fn() } as unknown as KeyboardEvent;
    component.handlePermissionCardKeydown(event, component.visiblePermissions[0], 0);

    expect(emitted[0].has(3)).toBe(true);
    expect(event.preventDefault).toHaveBeenCalled();
  });

  it('loads more permissions incrementally for large datasets', () => {
    const bulkPermissions: Permission[] = [];
    for (let i = 0; i < 250; i += 1) {
      bulkPermissions.push(permission(1000 + i, 'Users', `users.bulk_${i}.view`, `Bulk ${i}`, `Bulk description ${i}`));
    }
    component.modules = ['Users'];
    component.permissionsByModule = new Map([['Users', bulkPermissions]]);
    component.ngOnChanges({
      modules: new SimpleChange([], component.modules, false)
    });

    expect(component.visiblePermissions.length).toBe(120);
    expect(component.hasMorePermissions).toBe(true);

    component.loadMorePermissions();
    expect(component.visiblePermissions.length).toBe(200);
  });

  it('tracks selected template state and clear behavior', () => {
    const emitted: Set<number>[] = [];
    component.selectedPermissionIdsChange.subscribe((value) => emitted.push(value));

    component.applyTemplate('manager');
    expect(component.isTemplateActive('manager')).toBe(true);

    component.clearAllSelections();
    expect(component.isTemplateActive('manager')).toBe(false);
    expect(emitted[emitted.length - 1].size).toBe(0);
  });

  it('supports module dropdown selection', () => {
    component.onModuleDropdownChange('Users');
    expect(component.activeModule).toBe('Users');
  });

  it('supports keyboard navigation for module tabs', () => {
    component.selectModule('Finance');
    const event = { key: 'ArrowRight', preventDefault: jest.fn() } as unknown as KeyboardEvent;
    component.handleModuleKeydown(event, 'Finance');

    expect(component.activeModule).toBe('Users');
    expect(event.preventDefault).toHaveBeenCalled();
  });

  it('switches to dropdown mode for large module catalogs', () => {
    component.modules = Array.from({ length: 12 }, (_, i) => `Module ${i}`);
    expect(component.useModuleDropdown).toBe(true);
  });

  it('reselects first filtered module when active module is filtered out', () => {
    component.selectModule('Finance');
    component.onModuleSearchInput('us');

    expect(component.activeModule).toBe('Users');
  });

  it('provides contextual empty messages for search state', () => {
    component.debouncedPermissionSearch = 'does-not-exist';
    expect(component.permissionEmptyTitle).toBe('No matching permissions');
    expect(component.permissionEmptyHint).toContain('broader keyword');
  });

  it('uses updated module navigation empty-state hint', () => {
    component.selectModule('');
    expect(component.permissionEmptyHint).toContain('module from navigation');
  });
});

