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
import { Subject, takeUntil } from 'rxjs';
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
import {
  MemberSource,
  MemberType,
  MembershipStatus,
  OrganizationMembership,
} from '../../models/ministries.model';
import { MinistriesApiService } from '../../services/ministries-api.service';
import { MemberHistoryDetailModalComponent } from '../member-history-detail-modal/member-history-detail-modal.component';

type StatusFilter = '' | MembershipStatus;
type MemberTypeFilter = '' | MemberType;
type MemberSourceFilter = '' | MemberSource;

@Component({
  selector: 'app-organization-member-history-tab',
  standalone: true,
  imports: [
    CommonModule,
    CfEmptyStateComponent,
    LoadingSkeletonComponent,
    PaginationComponent,
    DataTableComponent,
    ListToolbarComponent,
    AdvancedSearchPanelComponent,
    StatusBadgeComponent,
    MemberHistoryDetailModalComponent,
  ],
  templateUrl: './organization-member-history-tab.component.html',
  styleUrl: './organization-member-history-tab.component.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class OrganizationMemberHistoryTabComponent implements OnInit, OnChanges, OnDestroy {
  private readonly destroy$ = new Subject<void>();
  private readonly api = inject(MinistriesApiService);
  private readonly cdr = inject(ChangeDetectorRef);

  @Input({ required: true }) organizationId!: string;

  members: OrganizationMembership[] = [];
  detailMember: OrganizationMembership | null = null;

  loading = false;
  loaded = false;
  loadError: string | null = null;
  showFilters = false;
  searchFields: SearchField[] = [];

  search = '';
  statusFilter: StatusFilter = '';
  memberTypeFilter: MemberTypeFilter = '';
  memberSourceFilter: MemberSourceFilter = '';

  currentPage = 1;
  perPage = 15;
  totalItems = 0;
  readonly perPageOptions = [10, 15, 20, 50];

  ngOnInit(): void {
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

  get hasActiveFilters(): boolean {
    return !!(
      this.search.trim() ||
      this.statusFilter ||
      this.memberTypeFilter ||
      this.memberSourceFilter
    );
  }

  get drawerFilterCount(): number {
    return [
      this.statusFilter,
      this.memberTypeFilter,
      this.memberSourceFilter,
    ].filter(Boolean).length;
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
    this.currentPage = 1;
    this.loadMembers();
    this.showFilters = false;
    this.cdr.markForCheck();
  }

  onClearAdvancedSearch(): void {
    this.statusFilter = '';
    this.memberTypeFilter = '';
    this.memberSourceFilter = '';
    this.searchFields.forEach((f) => {
      f.value = undefined;
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

  openDetail(member: OrganizationMembership): void {
    this.detailMember = member;
    this.cdr.markForCheck();
  }

  closeDetail(): void {
    this.detailMember = null;
    this.cdr.markForCheck();
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

  statusTone(status: MembershipStatus): StatusBadgeTone {
    return status === 'active' ? 'success' : 'neutral';
  }

  familyDisplay(member: OrganizationMembership): string {
    if (member.member_source !== 'parish') {
      return '—';
    }
    const name = member.family_name?.trim();
    return name ? name : '—';
  }

  formatDate(value: string | null | undefined): string {
    if (!value) {
      return '—';
    }

    const datePart = value.includes('T') ? value.slice(0, 10) : value;
    const match = /^(\d{4})-(\d{2})-(\d{2})$/.exec(datePart);
    if (!match) {
      const parsed = new Date(value);
      if (Number.isNaN(parsed.getTime())) {
        return '—';
      }
      return this.formatDisplayDate(parsed);
    }

    const year = Number(match[1]);
    const monthIndex = Number(match[2]) - 1;
    const day = Number(match[3]);
    const date = new Date(year, monthIndex, day);
    if (
      Number.isNaN(date.getTime()) ||
      date.getFullYear() !== year ||
      date.getMonth() !== monthIndex ||
      date.getDate() !== day
    ) {
      return '—';
    }

    return this.formatDisplayDate(date);
  }

  formatEndDate(member: OrganizationMembership): string {
    return this.formatDate(member.exit_date);
  }

  formatDuration(member: OrganizationMembership): string {
    const start = this.parseDateOnly(member.joined_date);
    const end = this.parseDateOnly(member.exit_date);
    if (!start || !end) {
      return '—';
    }

    if (end.getTime() < start.getTime()) {
      return '—';
    }

    let years = end.getFullYear() - start.getFullYear();
    let months = end.getMonth() - start.getMonth();
    let days = end.getDate() - start.getDate();

    if (days < 0) {
      months -= 1;
      const previousMonth = new Date(end.getFullYear(), end.getMonth(), 0);
      days += previousMonth.getDate();
    }
    if (months < 0) {
      years -= 1;
      months += 12;
    }

    if (years === 0 && months === 0) {
      if (days === 0) {
        return 'Less than a day';
      }
      return days === 1 ? '1 day' : `${days} days`;
    }

    const parts: string[] = [];
    if (years > 0) {
      parts.push(years === 1 ? '1 year' : `${years} years`);
    }
    if (months > 0) {
      parts.push(months === 1 ? '1 month' : `${months} months`);
    }
    return parts.join(' ');
  }

  private formatDisplayDate(date: Date): string {
    const day = String(date.getDate()).padStart(2, '0');
    const month = date.toLocaleDateString('en-GB', { month: 'short' });
    const year = date.getFullYear();
    return `${day} ${month} ${year}`;
  }

  private parseDateOnly(value: string | null | undefined): Date | null {
    if (!value) {
      return null;
    }
    const datePart = value.includes('T') ? value.slice(0, 10) : value;
    const match = /^(\d{4})-(\d{2})-(\d{2})$/.exec(datePart);
    if (!match) {
      return null;
    }
    const year = Number(match[1]);
    const monthIndex = Number(match[2]) - 1;
    const day = Number(match[3]);
    const date = new Date(year, monthIndex, day);
    if (
      Number.isNaN(date.getTime()) ||
      date.getFullYear() !== year ||
      date.getMonth() !== monthIndex ||
      date.getDate() !== day
    ) {
      return null;
    }
    return date;
  }

  private initSearchFields(): void {
    this.searchFields = [
      {
        key: 'statusFilter',
        label: 'Status',
        type: 'select',
        options: [
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
    ];
  }

  private loadMembers(): void {
    if (!this.organizationId) {
      return;
    }

    this.loading = true;
    this.loadError = null;
    this.detailMember = null;
    this.cdr.markForCheck();

    this.api
      .listMembers(this.organizationId, {
        page: this.currentPage,
        per_page: this.perPage,
        search: this.search.trim() || undefined,
        status: this.statusFilter || undefined,
        member_type: this.memberTypeFilter || undefined,
        member_source: this.memberSourceFilter || undefined,
        is_current: false,
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
          this.loadError = 'Could not load member history. Please try again.';
          this.loading = false;
          this.loaded = true;
          this.cdr.markForCheck();
        },
      });
  }
}
