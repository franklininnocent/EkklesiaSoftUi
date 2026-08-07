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
import {
  AdvancedSearchPanelComponent,
  SearchField,
} from '@shared/components/advanced-search-panel/advanced-search-panel.component';
import { ListToolbarComponent } from '@shared/components/list-toolbar/list-toolbar.component';
import { DataTableComponent } from '@shared/components/data-table/data-table.component';
import { MinistriesAuditLogEntry } from '../../models/ministries.model';
import { MinistriesApiService } from '../../services/ministries-api.service';

@Component({
  selector: 'app-audit-log-panel',
  standalone: true,
  imports: [
    CommonModule,
    CfEmptyStateComponent,
    LoadingSkeletonComponent,
    PaginationComponent,
    AdvancedSearchPanelComponent,
    ListToolbarComponent,
    DataTableComponent,
  ],
  templateUrl: './audit-log-panel.component.html',
  styleUrl: './audit-log-panel.component.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class AuditLogPanelComponent implements OnInit, OnChanges, OnDestroy {
  private readonly destroy$ = new Subject<void>();
  private readonly api = inject(MinistriesApiService);
  private readonly cdr = inject(ChangeDetectorRef);

  /** When set, loads organization-scoped audit logs. */
  @Input() organizationId: string | null = null;
  /**
   * When false, the host page owns the ListToolbar (Audit Log page header).
   * Embedded usages (organization detail) keep the in-panel toolbar.
   */
  @Input() showToolbar = true;

  entries: MinistriesAuditLogEntry[] = [];

  loading = false;
  loaded = false;
  loadError: string | null = null;

  actionType = '';
  entityType = '';
  dateFrom = '';
  dateTo = '';

  currentPage = 1;
  perPage = 15;
  totalItems = 0;
  readonly perPageOptions = [10, 15, 20, 50];

  showFilters = false;
  searchFields: SearchField[] = [];

  readonly actionTypeOptions: Array<{ value: string; label: string }> = [
    { value: 'organization.created', label: 'Organization created' },
    { value: 'organization.updated', label: 'Organization updated' },
    { value: 'organization.status_changed', label: 'Organization status changed' },
    { value: 'organization.deleted', label: 'Organization deleted' },
    { value: 'organization.restored', label: 'Organization restored' },
    { value: 'membership.enrolled', label: 'Member enrolled' },
    { value: 'membership.status_changed', label: 'Membership status changed' },
    { value: 'membership.re_enrolled', label: 'Member re-enrolled' },
    { value: 'guest_member.created', label: 'Guest created' },
    { value: 'guest_member.updated', label: 'Guest updated' },
    { value: 'guest_member.linked_to_parishioner', label: 'Guest linked' },
    { value: 'leadership.assigned', label: 'Leadership assigned' },
    { value: 'leadership.terminated', label: 'Leadership terminated' },
    { value: 'leadership.handover', label: 'Leadership handed over' },
    { value: 'category.created', label: 'Category created' },
    { value: 'category.updated', label: 'Category updated' },
    { value: 'category.status_changed', label: 'Category status changed' },
    { value: 'category.defaults_seeded', label: 'Category defaults seeded' },
    { value: 'type.created', label: 'Type created' },
    { value: 'type.updated', label: 'Type updated' },
    { value: 'type.status_changed', label: 'Type status changed' },
    { value: 'type.defaults_seeded', label: 'Type defaults seeded' },
    { value: 'position.created', label: 'Position created' },
    { value: 'position.updated', label: 'Position updated' },
    { value: 'position.status_changed', label: 'Position status changed' },
    { value: 'position.defaults_seeded', label: 'Position defaults seeded' },
    { value: 'census_cascade.membership_exited', label: 'Census membership exit' },
    { value: 'census_cascade.leadership_vacated', label: 'Census leadership vacated' },
  ];

  readonly entityTypeOptions: Array<{ value: string; label: string }> = [
    { value: 'organization', label: 'Organization' },
    { value: 'membership', label: 'Membership' },
    { value: 'guest_member', label: 'Guest member' },
    { value: 'leadership_term', label: 'Leadership term' },
    { value: 'organization_category', label: 'Category' },
    { value: 'organization_type', label: 'Type' },
    { value: 'position', label: 'Position' },
  ];

  ngOnInit(): void {
    this.initSearchFields();
    this.loadEntries();
  }

  ngOnChanges(changes: SimpleChanges): void {
    if (changes['organizationId'] && !changes['organizationId'].firstChange) {
      this.currentPage = 1;
      this.loadEntries();
    }
  }

  ngOnDestroy(): void {
    this.destroy$.next();
    this.destroy$.complete();
  }

  get hasActiveFilters(): boolean {
    return !!(this.actionType || this.entityType || this.dateFrom || this.dateTo);
  }

  get drawerFilterCount(): number {
    return [this.actionType, this.entityType, this.dateFrom, this.dateTo].filter(Boolean).length;
  }

  openFilters(): void {
    this.showFilters = true;
    this.cdr.markForCheck();
  }

  onPageChange(page: number): void {
    this.currentPage = page;
    this.loadEntries();
  }

  onPageSizeChange(size: number): void {
    this.perPage = size;
    this.currentPage = 1;
    this.loadEntries();
  }

  retryLoad(): void {
    this.loadEntries();
  }

  onAdvancedSearch(values: { [key: string]: unknown }): void {
    this.actionType = (values['actionType'] as string) || '';
    this.entityType = (values['entityType'] as string) || '';
    this.dateFrom = (values['dateFrom'] as string) || '';
    this.dateTo = (values['dateTo'] as string) || '';
    this.currentPage = 1;
    this.loadEntries();
    this.showFilters = false;
    this.cdr.markForCheck();
  }

  onClearAdvancedSearch(): void {
    this.actionType = '';
    this.entityType = '';
    this.dateFrom = '';
    this.dateTo = '';
    this.searchFields.forEach((f) => (f.value = undefined));
    this.currentPage = 1;
    this.loadEntries();
    this.cdr.markForCheck();
  }

  actionLabel(entry: MinistriesAuditLogEntry): string {
    const key = entry.action_type || entry.event;
    return this.actionTypeOptions.find((option) => option.value === key)?.label ?? key;
  }

  entityLabel(entry: MinistriesAuditLogEntry): string {
    const key = entry.entity_type || entry.target_type;
    return this.entityTypeOptions.find((option) => option.value === key)?.label ?? (key || '—');
  }

  actorLabel(entry: MinistriesAuditLogEntry): string {
    return entry.actor_name?.trim() || '—';
  }

  formatDateTime(value: string | null | undefined): string {
    if (!value) {
      return '—';
    }
    const date = new Date(value);
    if (Number.isNaN(date.getTime())) {
      return value;
    }
    return date.toLocaleString(undefined, {
      year: 'numeric',
      month: 'short',
      day: 'numeric',
      hour: 'numeric',
      minute: '2-digit',
    });
  }

  private initSearchFields(): void {
    this.searchFields = [
      {
        key: 'actionType',
        label: 'Action',
        type: 'select',
        options: this.actionTypeOptions,
        value: this.actionType || undefined,
      },
      {
        key: 'entityType',
        label: 'Entity type',
        type: 'select',
        options: this.entityTypeOptions,
        value: this.entityType || undefined,
      },
      {
        key: 'dateFrom',
        label: 'From date',
        type: 'date',
        value: this.dateFrom || undefined,
      },
      {
        key: 'dateTo',
        label: 'To date',
        type: 'date',
        value: this.dateTo || undefined,
      },
    ];
  }

  private loadEntries(): void {
    this.loading = true;
    this.loadError = null;
    this.cdr.markForCheck();

    const params = {
      page: this.currentPage,
      per_page: this.perPage,
      action_type: this.actionType || undefined,
      entity_type: this.entityType || undefined,
      date_from: this.dateFrom || undefined,
      date_to: this.dateTo || undefined,
    };

    const request$ = this.organizationId
      ? this.api.listOrganizationAuditLogs(this.organizationId, params)
      : this.api.listAuditLogs(params);

    request$.pipe(takeUntil(this.destroy$)).subscribe({
      next: (response) => {
        this.entries = response.data ?? [];
        this.totalItems = response.meta?.total ?? 0;
        this.loading = false;
        this.loaded = true;
        this.cdr.markForCheck();
      },
      error: () => {
        this.loadError = 'Could not load audit log. Please try again.';
        this.loading = false;
        this.loaded = true;
        this.cdr.markForCheck();
      },
    });
  }
}
