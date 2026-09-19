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
    if (changes['roles'] && this.value) {
      this.cdr.markForCheck();
    }
  }

  get selectedRole(): LeadershipRoleOption | undefined {
    return this.roles.find((role) => role.id === this.value) ?? undefined;
  }

  get displayLabel(): string {
    return this.selectedRole?.title ?? this.placeholder;
  }

  get groupedRoles(): LeadershipRoleGroup[] {
    return groupLeadershipRoles(this.roles, this.searchQuery);
  }

  get flatOptions(): LeadershipRoleOption[] {
    return this.groupedRoles.flatMap((group) => group.roles);
  }

  get showCreateAction(): boolean {
    return shouldShowCreateRoleAction(this.roles, this.searchQuery, this.canCreate) && !this.creating;
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
    const insideLrc = !!target?.closest('.lrc');
    // #region agent log
    fetch('http://127.0.0.1:7631/ingest/5401a346-7001-4033-9c37-4ee605985cd9',{method:'POST',headers:{'Content-Type':'application/json','X-Debug-Session-Id':'b51fb5'},body:JSON.stringify({sessionId:'b51fb5',location:'leadership-role-combobox.component.ts:onDocumentClick',message:'document click',data:{panelOpen:this.panelOpen,insideLrc,willClose:this.panelOpen&&!insideLrc,targetTag:target?.tagName,targetClass:target?.className?.slice?.(0,80)},timestamp:Date.now(),hypothesisId:'C'})}).catch(()=>{});
    // #endregion
    if (!insideLrc) {
      this.closePanel();
    }
  }

  togglePanel(): void {
    // #region agent log
    fetch('http://127.0.0.1:7631/ingest/5401a346-7001-4033-9c37-4ee605985cd9',{method:'POST',headers:{'Content-Type':'application/json','X-Debug-Session-Id':'b51fb5'},body:JSON.stringify({sessionId:'b51fb5',location:'leadership-role-combobox.component.ts:togglePanel',message:'toggle panel',data:{disabled:this.disabled,panelOpen:this.panelOpen},timestamp:Date.now(),hypothesisId:'B'})}).catch(()=>{});
    // #endregion
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
    this.syncSuggestedCategory();
    // #region agent log
    fetch('http://127.0.0.1:7631/ingest/5401a346-7001-4033-9c37-4ee605985cd9',{method:'POST',headers:{'Content-Type':'application/json','X-Debug-Session-Id':'b51fb5'},body:JSON.stringify({sessionId:'b51fb5',location:'leadership-role-combobox.component.ts:openPanel',message:'panel opened',data:{rolesCount:this.roles.length,flatOptionsCount:this.flatOptions.length,disabled:this.disabled,searchQuery:this.searchQuery},timestamp:Date.now(),hypothesisId:'A'})}).catch(()=>{});
    // #endregion
    this.cdr.markForCheck();
    queueMicrotask(() => {
      this.searchInput?.nativeElement.focus();
      const firstOption = document.querySelector('.lrc__option') as HTMLElement | null;
      if (firstOption) {
        const rect = firstOption.getBoundingClientRect();
        const topEl = document.elementFromPoint(rect.left + rect.width / 2, rect.top + rect.height / 2) as HTMLElement | null;
        // #region agent log
        fetch('http://127.0.0.1:7631/ingest/5401a346-7001-4033-9c37-4ee605985cd9',{method:'POST',headers:{'Content-Type':'application/json','X-Debug-Session-Id':'b51fb5'},body:JSON.stringify({sessionId:'b51fb5',location:'leadership-role-combobox.component.ts:openPanel:elementFromPoint',message:'top element at first option',data:{optionClass:firstOption.className,topTag:topEl?.tagName,topClass:topEl?.className?.slice?.(0,80),isOption:topEl===firstOption||!!topEl?.closest('.lrc__option')},timestamp:Date.now(),hypothesisId:'E'})}).catch(()=>{});
        // #endregion
      }
    });
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
    // #region agent log
    fetch('http://127.0.0.1:7631/ingest/5401a346-7001-4033-9c37-4ee605985cd9',{method:'POST',headers:{'Content-Type':'application/json','X-Debug-Session-Id':'b51fb5'},body:JSON.stringify({sessionId:'b51fb5',location:'leadership-role-combobox.component.ts:selectRole',message:'role selected',data:{roleId:role.id,roleTitle:role.title},timestamp:Date.now(),runId:'post-fix',hypothesisId:'D'})}).catch(()=>{});
    // #endregion
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

    const existing = findExactRoleMatch(this.roles, title);
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
