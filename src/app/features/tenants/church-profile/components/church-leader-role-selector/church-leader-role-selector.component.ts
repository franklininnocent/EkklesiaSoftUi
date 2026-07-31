import { CommonModule } from '@angular/common';
import {
  ChangeDetectionStrategy,
  ChangeDetectorRef,
  Component,
  ElementRef,
  forwardRef,
  HostListener,
  inject,
  Input,
  ViewChild
} from '@angular/core';
import { ControlValueAccessor, FormsModule, NG_VALUE_ACCESSOR } from '@angular/forms';
import {
  findLeadershipRole,
  LEADERSHIP_ROLE_CATEGORIES,
  LEADERSHIP_ROLE_OPTIONS,
  LeadershipRoleCategory,
  LeadershipRoleOption
} from '../church-leader-workspace/church-leader-role.config';

interface RoleGroup {
  category: LeadershipRoleCategory | null;
  roles: LeadershipRoleOption[];
}

@Component({
  selector: 'app-church-leader-role-selector',
  standalone: true,
  imports: [CommonModule, FormsModule],
  templateUrl: './church-leader-role-selector.component.html',
  styleUrl: './church-leader-role-selector.component.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
  providers: [
    {
      provide: NG_VALUE_ACCESSOR,
      useExisting: forwardRef(() => ChurchLeaderRoleSelectorComponent),
      multi: true
    }
  ]
})
export class ChurchLeaderRoleSelectorComponent implements ControlValueAccessor {
  private readonly cdr = inject(ChangeDetectorRef);

  @ViewChild('searchInput') searchInput?: ElementRef<HTMLInputElement>;

  @Input() invalid = false;

  readonly categories = LEADERSHIP_ROLE_CATEGORIES;
  readonly allRoles = LEADERSHIP_ROLE_OPTIONS;

  value: string | null = null;
  disabled = false;
  panelOpen = false;
  isChanging = false;
  searchQuery = '';
  highlightedIndex = 0;

  private readonly recentKey = 'church-leader-recent-roles';
  private onChange: (value: string | null) => void = () => undefined;
  private onTouched: () => void = () => undefined;

  get selectedRole(): LeadershipRoleOption | undefined {
    return findLeadershipRole(this.value);
  }

  get showSummary(): boolean {
    return !!this.value && !this.isChanging && !this.panelOpen;
  }

  get showTrigger(): boolean {
    return !this.showSummary && !this.panelOpen;
  }

  get recentRoles(): LeadershipRoleOption[] {
    const stored = this.readRecentValues();
    return stored
      .map((roleValue) => findLeadershipRole(roleValue))
      .filter((role): role is LeadershipRoleOption => !!role)
      .slice(0, 4);
  }

  get filteredRoles(): LeadershipRoleOption[] {
    const query = this.searchQuery.trim().toLowerCase();
    if (!query) {
      return this.allRoles;
    }
    return this.allRoles.filter((role) => (
      role.label.toLowerCase().includes(query) ||
      role.description.toLowerCase().includes(query) ||
      role.value.toLowerCase().includes(query)
    ));
  }

  get flatFilteredRoles(): LeadershipRoleOption[] {
    const recent = !this.searchQuery.trim()
      ? this.recentRoles.filter((role) => this.filteredRoles.some((item) => item.value === role.value))
      : [];
    const recentValues = new Set(recent.map((role) => role.value));
    return [...recent, ...this.filteredRoles.filter((role) => !recentValues.has(role.value))];
  }

  get groupedRoles(): RoleGroup[] {
    const groups: RoleGroup[] = [];
    const recent = !this.searchQuery.trim()
      ? this.recentRoles.filter((role) => this.filteredRoles.some((item) => item.value === role.value))
      : [];

    if (recent.length) {
      groups.push({ category: null, roles: recent });
    }

    for (const category of this.categories) {
      const roles = this.filteredRoles.filter(
        (role) => role.category === category.id && !recent.some((item) => item.value === role.value)
      );
      if (roles.length) {
        groups.push({ category, roles });
      }
    }

    return groups;
  }

  groupLabel(group: RoleGroup): string {
    return group.category ? group.category.label : 'Recently used';
  }

  writeValue(value: string | null): void {
    this.value = value || null;
    this.cdr.markForCheck();
  }

  registerOnChange(fn: (value: string | null) => void): void {
    this.onChange = fn;
  }

  registerOnTouched(fn: () => void): void {
    this.onTouched = fn;
  }

  setDisabledState(isDisabled: boolean): void {
    this.disabled = isDisabled;
    this.cdr.markForCheck();
  }

  openPanel(): void {
    if (this.disabled) {
      return;
    }
    this.panelOpen = true;
    this.isChanging = true;
    this.searchQuery = '';
    this.highlightedIndex = 0;
    this.onTouched();
    this.cdr.markForCheck();
    queueMicrotask(() => this.searchInput?.nativeElement.focus());
  }

  closePanel(): void {
    this.panelOpen = false;
    this.isChanging = false;
    this.searchQuery = '';
    this.cdr.markForCheck();
  }

  startChangeRole(): void {
    this.openPanel();
  }

  selectRole(role: LeadershipRoleOption): void {
    this.value = role.value;
    this.onChange(role.value);
    this.onTouched();
    this.rememberRecent(role.value);
    this.closePanel();
    this.cdr.markForCheck();
  }

  onSearchChange(): void {
    this.highlightedIndex = 0;
    this.cdr.markForCheck();
  }

  isHighlighted(role: LeadershipRoleOption): boolean {
    return this.flatFilteredRoles[this.highlightedIndex]?.value === role.value;
  }

  highlightRole(role: LeadershipRoleOption): void {
    const index = this.flatFilteredRoles.findIndex((item) => item.value === role.value);
    if (index >= 0) {
      this.highlightedIndex = index;
      this.cdr.markForCheck();
    }
  }

  onPanelKeydown(event: KeyboardEvent): void {
    const flat = this.flatFilteredRoles;
    if (!flat.length) {
      return;
    }

    if (event.key === 'ArrowDown') {
      event.preventDefault();
      this.highlightedIndex = (this.highlightedIndex + 1) % flat.length;
      this.cdr.markForCheck();
      return;
    }

    if (event.key === 'ArrowUp') {
      event.preventDefault();
      this.highlightedIndex = (this.highlightedIndex - 1 + flat.length) % flat.length;
      this.cdr.markForCheck();
      return;
    }

    if (event.key === 'Enter') {
      event.preventDefault();
      const role = flat[this.highlightedIndex];
      if (role) {
        this.selectRole(role);
      }
      return;
    }

    if (event.key === 'Escape') {
      event.preventDefault();
      this.closePanel();
    }
  }

  @HostListener('document:click', ['$event'])
  onDocumentClick(event: MouseEvent): void {
    if (!this.panelOpen) {
      return;
    }
    const target = event.target as HTMLElement;
    if (!target.closest('.clrs')) {
      this.closePanel();
    }
  }

  summaryDescription(): string {
    return this.selectedRole?.description || 'Custom leadership role';
  }

  summaryIcon(): string {
    return this.selectedRole?.icon || '👤';
  }

  summaryLabel(): string {
    return this.selectedRole?.label || this.value || '';
  }

  private rememberRecent(roleValue: string): void {
    const current = this.readRecentValues().filter((value) => value !== roleValue);
    localStorage.setItem(this.recentKey, JSON.stringify([roleValue, ...current].slice(0, 6)));
  }

  private readRecentValues(): string[] {
    try {
      const raw = localStorage.getItem(this.recentKey);
      if (!raw) {
        return [];
      }
      const parsed = JSON.parse(raw) as unknown;
      return Array.isArray(parsed) ? parsed.filter((item) => typeof item === 'string') : [];
    } catch {
      return [];
    }
  }
}
