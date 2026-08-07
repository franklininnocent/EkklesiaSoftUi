import { CommonModule } from '@angular/common';
import {
  ChangeDetectionStrategy,
  ChangeDetectorRef,
  Component,
  Input,
  OnChanges,
  OnDestroy,
  OnInit,
  SimpleChanges,
  inject,
} from '@angular/core';
import { FormsModule } from '@angular/forms';
import { Subject, takeUntil } from 'rxjs';
import { AuthService } from '@core/services/auth.service';
import { ToastService } from '@core/services/toast.service';
import { CfEmptyStateComponent } from '@shared/components/cf-empty-state/cf-empty-state.component';
import { LoadingSkeletonComponent } from '@shared/components/loading-skeleton/loading-skeleton.component';
import { PaginationComponent } from '@shared/components/pagination/pagination.component';
import { DataTableComponent } from '@shared/components/data-table/data-table.component';
import { ListToolbarComponent } from '@shared/components/list-toolbar/list-toolbar.component';
import {
  AdvancedSearchPanelComponent,
  SearchField,
} from '@shared/components/advanced-search-panel/advanced-search-panel.component';
import { StatusBadgeComponent, StatusBadgeTone } from '@shared/components/status-badge/status-badge.component';
import { ActionBarComponent, ActionBarItem } from '@shared/components/action-bar/action-bar.component';
import {
  MemberSource,
  MemberType,
  MembershipStatus,
  Organization,
  OrganizationMembership,
} from '../../models/ministries.model';
import { MinistriesApiService } from '../../services/ministries-api.service';
import { EnrollMemberModalComponent } from '../enroll-member-modal/enroll-member-modal.component';
import { MembershipStatusModalComponent } from '../membership-status-modal/membership-status-modal.component';
import { ReEnrollMemberModalComponent } from '../re-enroll-member-modal/re-enroll-member-modal.component';

type StatusFilter = '' | MembershipStatus;
type MemberTypeFilter = '' | MemberType;
type MemberSourceFilter = '' | MemberSource;

@Component({
  selector: 'app-organization-members-tab',
  standalone: true,
  imports: [
    CommonModule,
    FormsModule,
    CfEmptyStateComponent,
    LoadingSkeletonComponent,
    PaginationComponent,
    DataTableComponent,
    ListToolbarComponent,
    AdvancedSearchPanelComponent,
    StatusBadgeComponent,
    ActionBarComponent,
    EnrollMemberModalComponent,
    MembershipStatusModalComponent,
    ReEnrollMemberModalComponent,
  ],
  templateUrl: './organization-members-tab.component.html',
  styleUrl: './organization-members-tab.component.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class OrganizationMembersTabComponent implements OnInit, OnChanges, OnDestroy {
  private readonly destroy$ = new Subject<void>();
  private readonly api = inject(MinistriesApiService);
  private readonly authService = inject(AuthService);
  private readonly toastService = inject(ToastService);
  private readonly cdr = inject(ChangeDetectorRef);

  @Input({ required: true }) organizationId!: string;
  @Input({ required: true }) organizationStatus!: Organization['status'];

  members: OrganizationMembership[] = [];

  loading = false;
  loaded = false;
  loadError: string | null = null;
  showEnrollModal = false;
  statusMember: OrganizationMembership | null = null;
  reEnrollMember: OrganizationMembership | null = null;
  canManageMembers = false;
  showFilters = false;
  searchFields: SearchField[] = [];

  search = '';
  statusFilter: StatusFilter = '';
  memberTypeFilter: MemberTypeFilter = '';
  memberSourceFilter: MemberSourceFilter = '';
  showCurrentOnly = true;

  currentPage = 1;
  perPage = 15;
  totalItems = 0;
  readonly perPageOptions = [10, 15, 20, 50];

  ngOnInit(): void {
    this.canManageMembers = this.authService.hasPermission('ministries.manage_members');
    this.initSearchFields();
    this.loadMembers();
  }

  ngOnChanges(changes: SimpleChanges): void {
    if (changes['organizationId'] && !changes['organizationId'].firstChange) {
      this.currentPage = 1;
      this.loadMembers();
    }
  }

  ngOnDestroy(): void {
    this.destroy$.next();
    this.destroy$.complete();
  }

  get isInactiveOrganization(): boolean {
    return this.organizationStatus === 'inactive';
  }

  get canEnroll(): boolean {
    return this.canManageMembers && !this.isInactiveOrganization;
  }

  get canShowActions(): boolean {
    return this.canManageMembers && !this.isInactiveOrganization;
  }

  get hasActiveFilters(): boolean {
    return !!(
      this.search.trim() ||
      this.statusFilter ||
      this.memberTypeFilter ||
      this.memberSourceFilter ||
      !this.showCurrentOnly
    );
  }

  get drawerFilterCount(): number {
    return [
      this.statusFilter,
      this.memberTypeFilter,
      this.memberSourceFilter,
      this.showCurrentOnly ? '' : 'all',
    ].filter(Boolean).length;
  }

  openEnrollModal(): void {
    if (!this.canEnroll) {
      return;
    }
    this.showEnrollModal = true;
    this.cdr.markForCheck();
  }

  closeEnrollModal(): void {
    this.showEnrollModal = false;
    this.cdr.markForCheck();
  }

  onMemberEnrolled(): void {
    this.showEnrollModal = false;
    this.currentPage = 1;
    this.toastService.success('Member enrolled successfully.');
    this.loadMembers();
    this.cdr.markForCheck();
  }

  canChangeMemberStatus(member: OrganizationMembership): boolean {
    return this.canShowActions && member.is_current;
  }

  canReEnrollMember(member: OrganizationMembership): boolean {
    return this.canShowActions && !member.is_current;
  }

  openStatusModal(member: OrganizationMembership): void {
    if (!this.canChangeMemberStatus(member)) {
      return;
    }
    this.statusMember = member;
    this.cdr.markForCheck();
  }

  closeStatusModal(): void {
    this.statusMember = null;
    this.cdr.markForCheck();
  }

  onMemberStatusUpdated(): void {
    this.statusMember = null;
    this.toastService.success('Membership status updated.');
    this.loadMembers();
    this.cdr.markForCheck();
  }

  openReEnrollModal(member: OrganizationMembership): void {
    if (!this.canReEnrollMember(member)) {
      return;
    }
    this.reEnrollMember = member;
    this.cdr.markForCheck();
  }

  closeReEnrollModal(): void {
    this.reEnrollMember = null;
    this.cdr.markForCheck();
  }

  onMemberReEnrolled(): void {
    this.reEnrollMember = null;
    this.currentPage = 1;
    this.showCurrentOnly = true;
    this.toastService.success('Member re-enrolled successfully.');
    this.loadMembers();
    this.cdr.markForCheck();
  }

  onToolbarSearch(value: string): void {
    this.search = value;
    this.currentPage = 1;
    this.loadMembers();
    this.cdr.markForCheck();
  }

  onAdvancedSearch(values: { [key: string]: unknown }): void {
    this.statusFilter = ((values['statusFilter'] as string) || '') as StatusFilter;
    this.memberTypeFilter = ((values['memberTypeFilter'] as string) || '') as MemberTypeFilter;
    this.memberSourceFilter = ((values['memberSourceFilter'] as string) || '') as MemberSourceFilter;
    this.showCurrentOnly = values['showCurrentOnly'] !== false;
    this.currentPage = 1;
    this.loadMembers();
    this.showFilters = false;
    this.cdr.markForCheck();
  }

  onClearAdvancedSearch(): void {
    this.statusFilter = '';
    this.memberTypeFilter = '';
    this.memberSourceFilter = '';
    this.showCurrentOnly = true;
    this.searchFields.forEach((f) => {
      f.value = f.key === 'showCurrentOnly' ? true : undefined;
    });
    this.currentPage = 1;
    this.loadMembers();
    this.cdr.markForCheck();
  }

  onPageChange(page: number): void {
    this.currentPage = page;
    this.loadMembers();
  }

  onPageSizeChange(size: number): void {
    this.perPage = size;
    this.currentPage = 1;
    this.loadMembers();
  }

  retryLoad(): void {
    this.loadMembers();
  }

  sourceLabel(source: MemberSource): string {
    return source === 'parish' ? 'Parish' : 'Guest';
  }

  typeLabel(type: MemberType): string {
    switch (type) {
      case 'regular':
        return 'Regular';
      case 'honorary':
        return 'Honorary';
      case 'life':
        return 'Life';
      case 'junior':
        return 'Junior';
      default:
        return type;
    }
  }

  statusLabel(status: MembershipStatus): string {
    switch (status) {
      case 'active':
        return 'Active';
      case 'inactive':
        return 'Inactive';
      case 'suspended':
        return 'Suspended';
      case 'resigned':
        return 'Resigned';
      case 'exited':
        return 'Exited';
      case 'deceased':
        return 'Deceased';
      default:
        return status;
    }
  }

  formatDate(value: string | null | undefined): string {
    if (!value) {
      return '—';
    }

    const date = new Date(`${value}T00:00:00`);
    if (Number.isNaN(date.getTime())) {
      return value;
    }

    return date.toLocaleDateString(undefined, {
      year: 'numeric',
      month: 'short',
      day: 'numeric',
    });
  }

  statusTone(status: MembershipStatus): StatusBadgeTone {
    return status === 'active' ? 'success' : 'neutral';
  }

  rowActions(member: OrganizationMembership): ActionBarItem[] {
    return [
      { id: 'status', label: 'Change status', hidden: !this.canChangeMemberStatus(member) },
      { id: 're-enroll', label: 'Re-enroll', hidden: !this.canReEnrollMember(member) },
    ];
  }

  onRowAction(actionId: string, member: OrganizationMembership): void {
    if (actionId === 'status') {
      this.openStatusModal(member);
    } else if (actionId === 're-enroll') {
      this.openReEnrollModal(member);
    }
  }

  familyDisplay(member: OrganizationMembership): string {
    if (member.member_source !== 'parish') {
      return '—';
    }
    const name = member.family_name?.trim();
    return name ? name : '—';
  }

  private initSearchFields(): void {
    this.searchFields = [
      {
        key: 'statusFilter',
        label: 'Status',
        type: 'select',
        options: [
          { value: 'active', label: 'Active' },
          { value: 'inactive', label: 'Inactive' },
          { value: 'suspended', label: 'Suspended' },
          { value: 'resigned', label: 'Resigned' },
          { value: 'exited', label: 'Exited' },
          { value: 'deceased', label: 'Deceased' },
        ],
        value: this.statusFilter || undefined,
      },
      {
        key: 'memberTypeFilter',
        label: 'Member type',
        type: 'select',
        options: [
          { value: 'regular', label: 'Regular' },
          { value: 'honorary', label: 'Honorary' },
          { value: 'life', label: 'Life' },
          { value: 'junior', label: 'Junior' },
        ],
        value: this.memberTypeFilter || undefined,
      },
      {
        key: 'memberSourceFilter',
        label: 'Source',
        type: 'select',
        options: [
          { value: 'parish', label: 'Parish' },
          { value: 'guest', label: 'Guest' },
        ],
        value: this.memberSourceFilter || undefined,
      },
      {
        key: 'showCurrentOnly',
        label: 'Current members only',
        type: 'boolean',
        value: this.showCurrentOnly,
      },
    ];
  }

  private loadMembers(): void {
    if (!this.organizationId) {
      return;
    }

    this.loading = true;
    this.loadError = null;
    this.cdr.markForCheck();

    this.api
      .listMembers(this.organizationId, {
        page: this.currentPage,
        per_page: this.perPage,
        search: this.search.trim() || undefined,
        status: this.statusFilter || undefined,
        member_type: this.memberTypeFilter || undefined,
        member_source: this.memberSourceFilter || undefined,
        is_current: this.showCurrentOnly ? true : undefined,
      })
      .pipe(takeUntil(this.destroy$))
      .subscribe({
        next: (response) => {
          this.members = response.data;
          this.totalItems = response.meta?.total ?? 0;
          this.loading = false;
          this.loaded = true;
          this.cdr.markForCheck();
        },
        error: () => {
          this.loadError = 'Could not load members. Please try again.';
          this.loading = false;
          this.loaded = true;
          this.cdr.markForCheck();
        },
      });
  }
}
