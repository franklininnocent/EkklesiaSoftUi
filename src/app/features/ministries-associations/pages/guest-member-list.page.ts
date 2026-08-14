import { CommonModule } from '@angular/common';
import {
  ChangeDetectionStrategy,
  ChangeDetectorRef,
  Component,
  OnDestroy,
  OnInit,
  inject,
} from '@angular/core';
import { FormsModule } from '@angular/forms';
import { Subject, takeUntil } from 'rxjs';
import { AuthService } from '@core/services/auth.service';
import { ToastService } from '@core/services/toast.service';
import { CfEmptyStateComponent } from '@shared/components/cf-empty-state/cf-empty-state.component';
import { LoadingSkeletonComponent } from '@shared/components/loading-skeleton/loading-skeleton.component';
import { PaginationComponent } from '@shared/components/pagination/pagination.component';
import {
  AdvancedSearchPanelComponent,
  SearchField,
} from '@shared/components/advanced-search-panel/advanced-search-panel.component';
import { PageHeaderComponent } from '@shared/components/page-header/page-header.component';
import { ListToolbarComponent } from '@shared/components/list-toolbar/list-toolbar.component';
import { DataTableComponent } from '@shared/components/data-table/data-table.component';
import { StatusBadgeComponent } from '@shared/components/status-badge/status-badge.component';
import {
  ActionBarComponent,
  ActionBarItem,
} from '@shared/components/action-bar/action-bar.component';
import { GuestMemberFormModalComponent } from '../components/guest-member-form-modal/guest-member-form-modal.component';
import { LinkParishionerModalComponent } from '../components/link-parishioner-modal/link-parishioner-modal.component';
import { MinistriesSubNavComponent } from '../components/ministries-sub-nav/ministries-sub-nav.component';
import { GuestMember, GuestType } from '../models/ministries.model';
import { MinistriesApiService } from '../services/ministries-api.service';

type LinkedFilter = '' | 'linked' | 'unlinked';

@Component({
  selector: 'app-guest-member-list-page',
  standalone: true,
  imports: [
    CommonModule,
    FormsModule,
    CfEmptyStateComponent,
    LoadingSkeletonComponent,
    PaginationComponent,
    AdvancedSearchPanelComponent,
    PageHeaderComponent,
    ListToolbarComponent,
    DataTableComponent,
    StatusBadgeComponent,
    ActionBarComponent,
    GuestMemberFormModalComponent,
    LinkParishionerModalComponent,
    MinistriesSubNavComponent,
  ],
  templateUrl: './guest-member-list.page.html',
  styleUrl: './guest-member-list.page.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class GuestMemberListPageComponent implements OnInit, OnDestroy {
  private readonly destroy$ = new Subject<void>();
  private readonly api = inject(MinistriesApiService);
  private readonly authService = inject(AuthService);
  private readonly toastService = inject(ToastService);
  private readonly cdr = inject(ChangeDetectorRef);

  guests: GuestMember[] = [];

  loading = false;
  loaded = false;
  loadError: string | null = null;

  search = '';
  guestTypeFilter: '' | GuestType = '';
  linkedFilter: LinkedFilter = '';

  currentPage = 1;
  perPage = 15;
  totalItems = 0;
  readonly perPageOptions = [10, 15, 20, 50];

  canManage = false;
  showGuestFormModal = false;
  editingGuestId: string | null = null;
  linkingGuest: GuestMember | null = null;
  showFilters = false;

  searchFields: SearchField[] = [];

  readonly guestTypeOptions: Array<{ value: GuestType; label: string }> = [
    { value: 'supporter', label: 'Supporter' },
    { value: 'volunteer', label: 'Volunteer' },
    { value: 'benefactor', label: 'Benefactor' },
    { value: 'advisor', label: 'Advisor' },
    { value: 'resource_person', label: 'Resource person' },
  ];

  ngOnInit(): void {
    this.canManage = this.authService.hasPermission('ministries.manage_members');
    this.initSearchFields();
    this.loadGuests();
  }

  ngOnDestroy(): void {
    this.destroy$.next();
    this.destroy$.complete();
  }

  get hasActiveFilters(): boolean {
    return !!(this.search.trim() || this.guestTypeFilter || this.linkedFilter);
  }

  get drawerFilterCount(): number {
    return [this.guestTypeFilter, this.linkedFilter].filter(Boolean).length;
  }

  onSearchChange(value: string): void {
    this.search = value;
    this.currentPage = 1;
    this.loadGuests();
  }

  onPageChange(page: number): void {
    this.currentPage = page;
    this.loadGuests();
  }

  onPageSizeChange(size: number): void {
    this.perPage = size;
    this.currentPage = 1;
    this.loadGuests();
  }

  retryLoad(): void {
    this.loadGuests();
  }

  displayName(guest: GuestMember): string {
    return guest.display_name?.trim() || `${guest.first_name} ${guest.last_name}`.trim();
  }

  linkedParishionerLabel(guest: GuestMember): string {
    return guest.linked_parishioner?.display_name?.trim() || 'Not linked';
  }

  isLinked(guest: GuestMember): boolean {
    return !!guest.linked_family_member_id;
  }

  formatDate(value: string | null | undefined): string {
    if (!value) {
      return '—';
    }

    const date = new Date(value);
    if (Number.isNaN(date.getTime())) {
      return value;
    }

    return date.toLocaleDateString(undefined, {
      year: 'numeric',
      month: 'short',
      day: 'numeric',
    });
  }

  rowActions(guest: GuestMember): ActionBarItem[] {
    return [
      { id: 'edit', label: 'Edit', tier: 'secondary' },
      {
        id: 'link',
        label: 'Link to parishioner',
        tier: 'secondary',
        hidden: this.isLinked(guest),
      },
    ];
  }

  onRowAction(actionId: string, guest: GuestMember): void {
    if (actionId === 'edit') {
      this.openEditModal(guest);
      return;
    }
    if (actionId === 'link') {
      this.openLinkModal(guest);
    }
  }

  openCreateModal(): void {
    if (!this.canManage) {
      return;
    }
    this.editingGuestId = null;
    this.showGuestFormModal = true;
    this.cdr.markForCheck();
  }

  openEditModal(guest: GuestMember): void {
    if (!this.canManage) {
      return;
    }
    this.editingGuestId = guest.id;
    this.showGuestFormModal = true;
    this.cdr.markForCheck();
  }

  closeGuestFormModal(): void {
    this.showGuestFormModal = false;
    this.editingGuestId = null;
    this.cdr.markForCheck();
  }

  onGuestSaved(): void {
    const wasEdit = !!this.editingGuestId;
    this.showGuestFormModal = false;
    this.editingGuestId = null;
    this.toastService.success(wasEdit ? 'Guest updated.' : 'Guest added.');
    if (!wasEdit) {
      this.currentPage = 1;
    }
    this.loadGuests();
    this.cdr.markForCheck();
  }

  openLinkModal(guest: GuestMember): void {
    if (!this.canManage || this.isLinked(guest)) {
      return;
    }
    this.linkingGuest = guest;
    this.cdr.markForCheck();
  }

  closeLinkModal(): void {
    this.linkingGuest = null;
    this.cdr.markForCheck();
  }

  onGuestLinked(): void {
    this.linkingGuest = null;
    this.toastService.success('Guest linked to parishioner.');
    this.loadGuests();
    this.cdr.markForCheck();
  }

  onAdvancedSearch(values: { [key: string]: unknown }): void {
    this.guestTypeFilter = ((values['guestTypeFilter'] as string) || '') as '' | GuestType;
    this.linkedFilter = ((values['linkedFilter'] as LinkedFilter) || '') as LinkedFilter;
    this.currentPage = 1;
    this.loadGuests();
    this.showFilters = false;
    this.cdr.markForCheck();
  }

  onClearAdvancedSearch(): void {
    this.guestTypeFilter = '';
    this.linkedFilter = '';
    this.searchFields.forEach((f) => (f.value = undefined));
    this.currentPage = 1;
    this.loadGuests();
    this.cdr.markForCheck();
  }

  private initSearchFields(): void {
    this.searchFields = [
      {
        key: 'guestTypeFilter',
        label: 'Guest type',
        type: 'select',
        options: this.guestTypeOptions.map((o) => ({ value: o.value, label: o.label })),
        value: this.guestTypeFilter || undefined,
      },
      {
        key: 'linkedFilter',
        label: 'Link status',
        type: 'select',
        options: [
          { value: 'linked', label: 'Linked' },
          { value: 'unlinked', label: 'Not linked' },
        ],
        value: this.linkedFilter || undefined,
      },
    ];
  }

  private loadGuests(): void {
    this.loading = true;
    this.loadError = null;
    this.cdr.markForCheck();

    this.api
      .listGuestMembers({
        page: this.currentPage,
        per_page: this.perPage,
        search: this.search.trim() || undefined,
        guest_type: this.guestTypeFilter || undefined,
        has_linked_parishioner:
          this.linkedFilter === 'linked'
            ? true
            : this.linkedFilter === 'unlinked'
              ? false
              : undefined,
      })
      .pipe(takeUntil(this.destroy$))
      .subscribe({
        next: (response) => {
          this.guests = response.data;
          this.totalItems = response.meta?.total ?? 0;
          this.loading = false;
          this.loaded = true;
          this.cdr.markForCheck();
        },
        error: () => {
          this.loadError = 'Could not load guest members. Please try again.';
          this.loading = false;
          this.loaded = true;
          this.cdr.markForCheck();
        },
      });
  }
}
