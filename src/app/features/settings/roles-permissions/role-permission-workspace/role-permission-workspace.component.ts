import { ChangeDetectionStrategy, Component, EventEmitter, Input, OnChanges, OnDestroy, Output, SimpleChanges } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { Permission } from '@core/models';
import { isGovernancePermissionName, isHighRiskPermissionName, isManagerTemplatePermissionName } from '@shared/utils/rbac-permission.util';

type PermissionTemplate = 'view-only' | 'manager' | 'administrator';
interface TemplateOption {
  key: PermissionTemplate;
  label: string;
  description: string;
}

@Component({
  selector: 'app-role-permission-workspace',
  standalone: true,
  imports: [CommonModule, FormsModule],
  templateUrl: './role-permission-workspace.component.html',
  styleUrl: './role-permission-workspace.component.scss',
  changeDetection: ChangeDetectionStrategy.OnPush
})
export class RolePermissionWorkspaceComponent implements OnChanges, OnDestroy {
  @Input() modules: string[] = [];
  @Input() permissionsByModule: Map<string, Permission[]> = new Map<string, Permission[]>();
  @Input() selectedPermissionIds: Set<number> = new Set<number>();
  @Input() disabled = false;
  @Input() showSummary = true;

  @Output() selectedPermissionIdsChange = new EventEmitter<Set<number>>();

  moduleSearch = '';
  permissionSearch = '';
  debouncedPermissionSearch = '';
  activeModule = '';
  focusedPermissionIndex = -1;
  selectedTemplate: PermissionTemplate | null = null;
  private permissionSearchDebounceTimer: ReturnType<typeof setTimeout> | null = null;
  private readonly baseVisibleLimit = 120;
  private readonly visibleStep = 80;
  visibleLimit = this.baseVisibleLimit;

  ngOnChanges(changes: SimpleChanges): void {
    if (changes['modules'] || changes['permissionsByModule']) {
      this.ensureActiveModule();
    }
  }

  ngOnDestroy(): void {
    if (this.permissionSearchDebounceTimer) {
      clearTimeout(this.permissionSearchDebounceTimer);
      this.permissionSearchDebounceTimer = null;
    }
  }

  get totalPermissions(): number {
    return this.allPermissions.length;
  }

  get selectedCount(): number {
    return this.selectedPermissionIds.size;
  }

  get selectedModulesCount(): number {
    return this.modules.filter((module) => this.getModuleSelectedCount(module) > 0).length;
  }

  get highRiskSelectedCount(): number {
    return this.allPermissions.filter((permission) =>
      this.selectedPermissionIds.has(permission.id) && this.isHighRiskPermission(permission)
    ).length;
  }

  get administrativeSelectedCount(): number {
    return this.allPermissions.filter((permission) =>
      this.selectedPermissionIds.has(permission.id) && this.isAdministrativePermission(permission)
    ).length;
  }

  get sensitiveSelectedCount(): number {
    return this.allPermissions.filter((permission) =>
      this.selectedPermissionIds.has(permission.id) && this.isSensitivePermission(permission)
    ).length;
  }

  get filteredModules(): string[] {
    const query = this.moduleSearch.trim().toLowerCase();
    if (!query) {
      return this.modules;
    }

    return this.modules.filter((module) => module.toLowerCase().includes(query));
  }

  get useModuleDropdown(): boolean {
    return this.modules.length > 10 || this.getViewportWidth() <= 900;
  }

  get isPermissionSearchMode(): boolean {
    return this.debouncedPermissionSearch.trim().length > 0;
  }

  get rightPanelTitle(): string {
    if (this.isPermissionSearchMode) {
      return 'Search Results';
    }
    return this.activeModule || 'Permissions';
  }

  get rightPanelPermissions(): Permission[] {
    const query = this.debouncedPermissionSearch.trim().toLowerCase();
    if (!query) {
      return this.permissionsByModule.get(this.activeModule) || [];
    }

    return this.allPermissions.filter((permission) => {
      const label = this.getPermissionLabel(permission).toLowerCase();
      const displayName = permission.display_name?.toLowerCase() || '';
      return label.includes(query) || displayName.includes(query);
    });
  }

  get visiblePermissions(): Permission[] {
    return this.rightPanelPermissions.slice(0, this.visibleLimit);
  }

  get hasMorePermissions(): boolean {
    return this.rightPanelPermissions.length > this.visibleLimit;
  }

  get visibleResultsSummary(): string {
    const total = this.rightPanelPermissions.length;
    const visible = this.visiblePermissions.length;
    if (total === 0) {
      return 'No permissions found';
    }
    if (visible >= total) {
      return `${total} permission${total > 1 ? 's' : ''}`;
    }
    return `Showing ${visible} of ${total} permissions`;
  }

  get hasModuleResults(): boolean {
    return this.filteredModules.length > 0;
  }

  get permissionEmptyTitle(): string {
    if (this.isPermissionSearchMode) {
      return 'No matching permissions';
    }
    if (!this.activeModule) {
      return 'No module selected';
    }
    return 'No permissions available';
  }

  get permissionEmptyHint(): string {
    if (this.isPermissionSearchMode) {
      return 'Try a broader keyword or clear the search to view all permissions.';
    }
    if (!this.activeModule) {
      return 'Select a module from navigation to view assignable permissions.';
    }
    return `The ${this.activeModule} module has no assignable permissions right now.`;
  }

  get templateOptions(): TemplateOption[] {
    return [
      {
        key: 'view-only',
        label: 'View Only',
        description: 'Read/list visibility across modules'
      },
      {
        key: 'manager',
        label: 'Manager',
        description: 'Operational create and edit permissions'
      },
      {
        key: 'administrator',
        label: 'Administrator',
        description: 'Full access including sensitive operations'
      }
    ];
  }

  get selectedCoveragePercentage(): number {
    if (this.totalPermissions === 0) {
      return 0;
    }
    return Math.round((this.selectedCount / this.totalPermissions) * 100);
  }

  selectModule(module: string): void {
    this.activeModule = module;
    this.focusedPermissionIndex = -1;
    this.resetVisibleLimit();
  }

  onModuleSearchInput(value: string): void {
    this.moduleSearch = value;

    const filtered = this.filteredModules;
    if (filtered.length === 0) {
      this.activeModule = '';
      this.focusedPermissionIndex = -1;
      return;
    }

    if (!filtered.includes(this.activeModule)) {
      this.selectModule(filtered[0]);
    }
  }

  onPermissionSearchInput(value: string): void {
    this.permissionSearch = value;
    if (this.permissionSearchDebounceTimer) {
      clearTimeout(this.permissionSearchDebounceTimer);
    }

    this.permissionSearchDebounceTimer = setTimeout(() => {
      this.debouncedPermissionSearch = this.permissionSearch;
      this.focusedPermissionIndex = -1;
      this.resetVisibleLimit();
    }, 180);
  }

  loadMorePermissions(): void {
    this.visibleLimit += this.visibleStep;
  }

  clearAllSelections(): void {
    if (this.disabled) {
      return;
    }
    this.selectedTemplate = null;
    this.emitSelection(new Set<number>());
  }

  togglePermission(permissionId: number): void {
    if (this.disabled) {
      return;
    }

    const next = new Set(this.selectedPermissionIds);
    if (next.has(permissionId)) {
      next.delete(permissionId);
    } else {
      next.add(permissionId);
    }
    this.emitSelection(next);
  }

  handleModuleKeydown(event: KeyboardEvent, module: string): void {
    if (event.key === 'Enter' || event.key === ' ') {
      event.preventDefault();
      this.selectModule(module);
      return;
    }

    if (!['ArrowLeft', 'ArrowRight', 'ArrowDown', 'ArrowUp'].includes(event.key)) {
      return;
    }
    event.preventDefault();

    const modules = this.filteredModules;
    const currentIndex = modules.findIndex((item) => item === module);
    if (currentIndex === -1) {
      return;
    }

    const direction = event.key === 'ArrowRight' || event.key === 'ArrowDown' ? 1 : -1;
    const nextIndex = Math.max(0, Math.min(modules.length - 1, currentIndex + direction));
    this.selectModule(modules[nextIndex]);
  }

  onModuleDropdownChange(module: string): void {
    this.selectModule(module);
  }

  handlePermissionCardKeydown(event: KeyboardEvent, permission: Permission, index: number): void {
    if (event.key === 'Enter' || event.key === ' ') {
      event.preventDefault();
      this.togglePermission(permission.id);
      return;
    }

    if (!['ArrowRight', 'ArrowLeft', 'ArrowDown', 'ArrowUp'].includes(event.key)) {
      return;
    }
    event.preventDefault();

    const columnCount = this.getPermissionGridColumnCount();
    let nextIndex = index;
    if (event.key === 'ArrowRight') {
      nextIndex = Math.min(this.visiblePermissions.length - 1, index + 1);
    } else if (event.key === 'ArrowLeft') {
      nextIndex = Math.max(0, index - 1);
    } else if (event.key === 'ArrowDown') {
      nextIndex = Math.min(this.visiblePermissions.length - 1, index + columnCount);
    } else if (event.key === 'ArrowUp') {
      nextIndex = Math.max(0, index - columnCount);
    }
    this.focusedPermissionIndex = nextIndex;
  }

  toggleModulePermissions(module: string): void {
    if (this.disabled) {
      return;
    }

    const modulePermissions = this.permissionsByModule.get(module) || [];
    const allSelected = modulePermissions.length > 0 && modulePermissions.every((permission) => this.selectedPermissionIds.has(permission.id));
    const next = new Set(this.selectedPermissionIds);

    if (allSelected) {
      modulePermissions.forEach((permission) => next.delete(permission.id));
    } else {
      modulePermissions.forEach((permission) => next.add(permission.id));
    }

    this.emitSelection(next);
  }

  selectAllVisible(): void {
    if (this.disabled) {
      return;
    }

    const next = new Set(this.selectedPermissionIds);
    this.rightPanelPermissions.forEach((permission) => next.add(permission.id));
    this.emitSelection(next);
  }

  clearAllVisible(): void {
    if (this.disabled) {
      return;
    }

    const next = new Set(this.selectedPermissionIds);
    this.rightPanelPermissions.forEach((permission) => next.delete(permission.id));
    this.emitSelection(next);
  }

  applyTemplate(template: PermissionTemplate): void {
    if (this.disabled) {
      return;
    }

    this.selectedTemplate = template;

    if (template === 'administrator') {
      this.emitSelection(new Set(this.allPermissions.map((permission) => permission.id)));
      return;
    }

    const next = new Set<number>();
    this.allPermissions.forEach((permission) => {
      const permissionName = permission.name.toLowerCase();
      if (template === 'view-only' && this.isViewPermission(permissionName)) {
        next.add(permission.id);
      }
      if (template === 'manager' && this.isManagerTemplatePermission(permissionName)) {
        next.add(permission.id);
      }
    });
    this.emitSelection(next);
  }

  isTemplateActive(template: PermissionTemplate): boolean {
    return this.selectedTemplate === template;
  }

  isPermissionSelected(permissionId: number): boolean {
    return this.selectedPermissionIds.has(permissionId);
  }

  isModuleFullySelected(module: string): boolean {
    const modulePermissions = this.permissionsByModule.get(module) || [];
    return modulePermissions.length > 0 && modulePermissions.every((permission) => this.selectedPermissionIds.has(permission.id));
  }

  isModulePartiallySelected(module: string): boolean {
    const modulePermissions = this.permissionsByModule.get(module) || [];
    const selectedCount = modulePermissions.filter((permission) => this.selectedPermissionIds.has(permission.id)).length;
    return selectedCount > 0 && selectedCount < modulePermissions.length;
  }

  getModuleSelectedCount(module: string): number {
    const modulePermissions = this.permissionsByModule.get(module) || [];
    return modulePermissions.filter((permission) => this.selectedPermissionIds.has(permission.id)).length;
  }

  getPermissionLabel(permission: Permission): string {
    const description = permission.description?.trim();
    if (description) {
      return description;
    }
    const displayName = permission.display_name?.trim();
    if (displayName) {
      return displayName;
    }
    return this.humanizePermissionName(permission.name);
  }

  getPermissionMeta(permission: Permission): string {
    if (this.isHighRiskPermission(permission)) {
      return 'High Risk';
    }
    if (this.isAdministrativePermission(permission)) {
      return 'Administrative';
    }
    if (this.isSensitivePermission(permission)) {
      return 'Sensitive';
    }
    return 'Standard';
  }

  trackByModule(_index: number, module: string): string {
    return module;
  }

  trackByPermission(_index: number, permission: Permission): number {
    return permission.id;
  }

  private get allPermissions(): Permission[] {
    return this.modules.flatMap((module) => this.permissionsByModule.get(module) || []);
  }

  private emitSelection(next: Set<number>): void {
    this.selectedPermissionIdsChange.emit(next);
  }

  private ensureActiveModule(): void {
    if (this.activeModule && this.modules.includes(this.activeModule)) {
      return;
    }
    this.activeModule = this.modules[0] || '';
    this.focusedPermissionIndex = -1;
    this.resetVisibleLimit();
  }

  private resetVisibleLimit(): void {
    this.visibleLimit = this.baseVisibleLimit;
  }

  private getPermissionGridColumnCount(): number {
    if (typeof window === 'undefined') {
      return 1;
    }
    return window.innerWidth <= 1024 ? 1 : 3;
  }

  private getViewportWidth(): number {
    if (typeof window === 'undefined') {
      return 1200;
    }
    return window.innerWidth;
  }

  private humanizePermissionName(name: string): string {
    return name
      .replace(/[._]/g, ' ')
      .replace(/\s+/g, ' ')
      .trim()
      .replace(/\b\w/g, (char) => char.toUpperCase());
  }

  private isViewPermission(permissionName: string): boolean {
    return permissionName.endsWith('.view') || permissionName.includes('.list') || permissionName.includes('.read');
  }

  private isManagerTemplatePermission(permissionName: string): boolean {
    return isManagerTemplatePermissionName(permissionName);
  }

  private isHighRiskPermission(permission: Permission): boolean {
    return isHighRiskPermissionName(permission.name);
  }

  private isAdministrativePermission(permission: Permission): boolean {
    return isGovernancePermissionName(permission.name);
  }

  private isSensitivePermission(permission: Permission): boolean {
    const name = permission.name.toLowerCase();
    return ['finance', 'donation', 'payroll', 'audit', '.delete'].some((token) => name.includes(token));
  }
}

