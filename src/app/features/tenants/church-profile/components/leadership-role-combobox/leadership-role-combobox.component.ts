import { CommonModule } from '@angular/common';
import {
  ChangeDetectionStrategy,
  ChangeDetectorRef,
  Component,
  ElementRef,
  EventEmitter,
  forwardRef,
  HostListener,
  inject,
  Input,
  OnChanges,
  Output,
  SimpleChanges,
  ViewChild,
} from '@angular/core';
import { ControlValueAccessor, FormsModule, NG_VALUE_ACCESSOR } from '@angular/forms';
import { HttpErrorResponse } from '@angular/common/http';
import {
  LeadershipCategory,
  LEADERSHIP_CATEGORY_OPTIONS,
  LeadershipRoleOption,
} from '@core/models/church/leadership-governance.model';
import { ChurchLeadershipGovernanceService } from '@core/services/church/church-leadership-governance.service';
import { ToastService } from '@core/services/toast.service';
import {
  canonicalizeLeadershipRoleTitle,
  filterRolesByCategory,
  findExactRoleMatch,
  groupLeadershipRoles,
  guessLeadershipRoleCategory,
  LeadershipRoleGroup,
  shouldShowCreateRoleAction,
} from '../../utils/leadership-role-query.util';

@Component({
  selector: 'app-leadership-role-combobox',
  standalone: true,
  imports: [CommonModule, FormsModule],
  templateUrl: './leadership-role-combobox.component.html',
  styleUrl: './leadership-role-combobox.component.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
  providers: [
    {
      provide: NG_VALUE_ACCESSOR,
      useExisting: forwardRef(() => LeadershipRoleComboboxComponent),
      multi: true,
    },
  ],
})
export class LeadershipRoleComboboxComponent implements ControlValueAccessor, OnChanges {
  private readonly api = inject(ChurchLeadershipGovernanceService);
  private readonly toast = inject(ToastService);
  private readonly cdr = inject(ChangeDetectorRef);

  @ViewChild('searchInput') searchInput?: ElementRef<HTMLInputElement>;

  @Input() roles: LeadershipRoleOption[] = [];
  @Input() canCreate = false;
  @Input() invalid = false;
  @Input() inputId = 'leadership_role_combobox';
  @Input() placeholder = 'Select a role';
  @Input() categoryFilter: LeadershipCategory | '' = '';
  @Input() defaultCreateCategory: LeadershipCategory = 'OTHER';

  @Output() roleCreated = new EventEmitter<LeadershipRoleOption>();
  @Output() rolesRefresh = new EventEmitter<LeadershipRoleOption[]>();

  value: string | null = null;
  disabled = false;
  panelOpen = false;
  searchQuery = '';
  highlightedIndex = 0;
  creating = false;
  createCategory: LeadershipCategory = 'OTHER';
  readonly categoryOptions = LEADERSHIP_CATEGORY_OPTIONS;

  private onChange: (value: string | null) => void = () => undefined;
  private onTouched: () => void = () => undefined;

  ngOnChanges(changes: SimpleChanges): void {
    if (changes['roles'] || changes['categoryFilter'] || changes['defaultCreateCategory']) {
      this.cdr.markForCheck();
    }
  }

  get visibleRoles(): LeadershipRoleOption[] {
    return filterRolesByCategory(this.roles, this.categoryFilter, this.value ?? '');
  }

  get selectedRole(): LeadershipRoleOption | undefined {
    return this.roles.find((role) => role.id === this.value) ?? undefined;
  }

  get displayLabel(): string {
    return this.selectedRole?.title ?? this.placeholder;
  }

  get groupedRoles(): LeadershipRoleGroup[] {
    return groupLeadershipRoles(this.visibleRoles, this.searchQuery);
  }

  get flatOptions(): LeadershipRoleOption[] {
    return this.groupedRoles.flatMap((group) => group.roles);
  }

  get showCreateAction(): boolean {
    return shouldShowCreateRoleAction(this.visibleRoles, this.searchQuery, this.canCreate) && !this.creating;
  }

  get createActionLabel(): string {
    const title = canonicalizeLeadershipRoleTitle(this.searchQuery);
    return `Add "${title}" as custom role`;
  }

  get hasVisibleResults(): boolean {
    return this.flatOptions.length > 0;
  }

  writeValue(value: string | null): void {
    this.value = value;
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

  @HostListener('document:click', ['$event'])
  onDocumentClick(event: MouseEvent): void {
    const target = event.target as HTMLElement | null;
    if (!target?.closest('.lrc')) {
      this.closePanel();
    }
  }

  togglePanel(): void {
    if (this.disabled) {
      return;
    }
    this.panelOpen ? this.closePanel() : this.openPanel();
  }

  openPanel(): void {
    if (this.disabled) {
      return;
    }
    this.panelOpen = true;
    this.searchQuery = this.selectedRole?.title ?? '';
    this.highlightedIndex = 0;
    this.createCategory = this.defaultCreateCategory;
    if (this.searchQuery.trim()) {
      this.syncSuggestedCategory();
    }
    this.cdr.markForCheck();
    queueMicrotask(() => this.searchInput?.nativeElement.focus());
  }

  closePanel(): void {
    if (!this.panelOpen) {
      return;
    }
    this.panelOpen = false;
    this.onTouched();
    this.cdr.markForCheck();
  }

  onSearchChange(): void {
    this.highlightedIndex = 0;
    this.syncSuggestedCategory();
    this.cdr.markForCheck();
  }

  onCreateCategoryChange(): void {
    this.cdr.markForCheck();
  }

  selectRole(role: LeadershipRoleOption, event?: Event): void {
    event?.preventDefault();
    this.value = role.id;
    this.onChange(role.id);
    this.onTouched();
    this.closePanel();
    this.cdr.markForCheck();
  }

  createCustomRole(event?: Event): void {
    event?.preventDefault();
    const title = canonicalizeLeadershipRoleTitle(this.searchQuery);
    if (!title || this.creating || !this.canCreate) {
      return;
    }

    const existing = findExactRoleMatch(this.visibleRoles, title);
    if (existing) {
      this.selectRole(existing);
      return;
    }

    this.creating = true;
    this.cdr.markForCheck();

    this.api.createRole({ title, category: this.createCategory }).subscribe({
      next: (response) => {
        const created = response.data;
        const nextRoles = [...this.roles.filter((role) => role.id !== created.id), created];
        this.roles = nextRoles;
        this.rolesRefresh.emit(nextRoles);
        this.roleCreated.emit(created);
        this.selectRole(created);
        this.toast.success(
          `${created.title} is now available for this church.`,
          'Custom role added',
        );
        this.creating = false;
        this.cdr.markForCheck();
      },
      error: (error: unknown) => {
        this.creating = false;
        if (error instanceof HttpErrorResponse && error.status === 409 && error.error?.code === 'ROLE_ALREADY_EXISTS') {
          this.refreshRolesAndSelect(title);
          this.toast.warning(
            `"${title}" is already available and has been selected.`,
            'Role already exists',
          );
          this.cdr.markForCheck();
          return;
        }
        const message = error instanceof HttpErrorResponse
          ? error.error?.message || 'Could not create custom role.'
          : 'Could not create custom role.';
        this.toast.error(message);
        this.cdr.markForCheck();
      },
    });
  }

  onPanelKeydown(event: KeyboardEvent): void {
    const actionableCount = this.flatOptions.length + (this.showCreateAction ? 1 : 0);
    if (!actionableCount) {
      if (event.key === 'Escape') {
        event.preventDefault();
        this.closePanel();
      }
      return;
    }

    if (event.key === 'ArrowDown') {
      event.preventDefault();
      this.highlightedIndex = (this.highlightedIndex + 1) % actionableCount;
      this.cdr.markForCheck();
      return;
    }

    if (event.key === 'ArrowUp') {
      event.preventDefault();
      this.highlightedIndex = (this.highlightedIndex - 1 + actionableCount) % actionableCount;
      this.cdr.markForCheck();
      return;
    }

    if (event.key === 'Enter') {
      event.preventDefault();
      if (this.highlightedIndex < this.flatOptions.length) {
        this.selectRole(this.flatOptions[this.highlightedIndex]);
      } else if (this.showCreateAction) {
        this.createCustomRole();
      }
      return;
    }

    if (event.key === 'Escape') {
      event.preventDefault();
      this.closePanel();
    }
  }

  isHighlighted(role: LeadershipRoleOption): boolean {
    const index = this.flatOptions.findIndex((item) => item.id === role.id);
    return index === this.highlightedIndex;
  }

  isCreateHighlighted(): boolean {
    return this.showCreateAction && this.highlightedIndex === this.flatOptions.length;
  }

  highlightRole(role: LeadershipRoleOption): void {
    const index = this.flatOptions.findIndex((item) => item.id === role.id);
    if (index >= 0) {
      this.highlightedIndex = index;
      this.cdr.markForCheck();
    }
  }

  highlightCreateAction(): void {
    if (this.showCreateAction) {
      this.highlightedIndex = this.flatOptions.length;
      this.cdr.markForCheck();
    }
  }

  private syncSuggestedCategory(): void {
    const title = canonicalizeLeadershipRoleTitle(this.searchQuery);
    this.createCategory = guessLeadershipRoleCategory(title);
  }

  private refreshRolesAndSelect(title: string): void {
    this.api.listRoles().subscribe({
      next: (response) => {
        this.roles = response.data;
        this.rolesRefresh.emit(response.data);
        const match = findExactRoleMatch(response.data, title);
        if (match) {
          this.selectRole(match);
        }
        this.cdr.markForCheck();
      },
    });
  }
}
