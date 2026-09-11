/**
 * Tenant Manager Component
 * Compact enterprise list view with dense table (default) and card grid toggle.
 */

import {
  Component,
  OnInit,
  OnDestroy,
  inject,
  ChangeDetectionStrategy,
  ChangeDetectorRef,
  signal,
  computed,
  HostListener,
} from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule, ReactiveFormsModule, FormBuilder, FormGroup } from '@angular/forms';
import { Router } from '@angular/router';
import { TenantCreateModalComponent } from '../tenant-create-modal/tenant-create-modal';
import { TenantService } from '@core/services/tenant.service';
import { ToastService } from '@core/services/toast.service';
import { AuthService } from '@core/services/auth.service';
import { DioceseService } from '@core/services/ecclesiastical/diocese.service';
import {
  Tenant,
  TenantPlan,
  TenantStatisticsResponse,
  TenantTier,
  TenantSubscriptionStatusFilter,
} from '@core/models/tenant.model';
import { Diocese } from '@core/models/ecclesiastical/diocese.model';
import { PaginationComponent } from '@shared/components';
import { ListToolbarComponent } from '@shared/components/list-toolbar/list-toolbar.component';
import { DataTableComponent } from '@shared/components/data-table/data-table.component';
import { StatusBadgeComponent, StatusBadgeTone } from '@shared/components/status-badge/status-badge.component';
import { CfEmptyStateComponent } from '@shared/components/cf-empty-state/cf-empty-state.component';
import { LoadingSkeletonComponent } from '@shared/components/loading-skeleton/loading-skeleton.component';
import {
  AdvancedSearchPanelComponent,
  SearchField,
  ActiveFilter,
} from '@shared/components/advanced-search-panel/advanced-search-panel.component';
import { SortableDirective, SortEvent } from '@shared/directives/sortable.directive';
import { Subject, debounceTime, distinctUntilChanged, takeUntil } from 'rxjs';

export type TenantListView = 'table' | 'card';

@Component({
  selector: 'app-tenant-manager',
  standalone: true,
  imports: [
    CommonModule,
    FormsModule,
    ReactiveFormsModule,
    TenantCreateModalComponent,
    PaginationComponent,
    ListToolbarComponent,
    DataTableComponent,
    StatusBadgeComponent,
    CfEmptyStateComponent,
    LoadingSkeletonComponent,
    AdvancedSearchPanelComponent,
    SortableDirective,
  ],
  templateUrl: './tenant-manager.html',
  styleUrls: ['./tenant-manager.scss'],
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class TenantManagerComponent implements OnInit, OnDestroy {
  private tenantService = inject(TenantService);
  private toastService = inject(ToastService);
  public authService = inject(AuthService);
  private router = inject(Router);
  private fb = inject(FormBuilder);
  private dioceseService = inject(DioceseService);
  private destroy$ = new Subject<void>();
  private cdr = inject(ChangeDetectorRef);

  readonly currentView = signal<TenantListView>('card');
  readonly showCreateModal = signal(false);
  readonly showAdvancedSearch = signal(false);
  readonly tenants = signal<Tenant[]>([]);
  readonly statistics = signal<TenantStatisticsResponse['data'] | null>(null);
  readonly loading = signal(false);
  readonly loaded = signal(false);
  readonly error = signal<string | null>(null);
  readonly currentPage = signal(1);
  readonly pageSize = signal(20);
  readonly filteredTotal = signal(0);
  readonly searchTerm = signal('');
  readonly selectedTenantIds = signal<Set<number>>(new Set());

  readonly pageSizeOptions: number[] = [10, 20, 50, 100];

  archdioceses: Diocese[] = [];
  searchFields: SearchField[] = [];
  filterForm: FormGroup;

  sortColumn = 'created_at';
  sortDirection: 'asc' | 'desc' = 'desc';

  readonly totalTenants = computed(() => this.statistics()?.total_tenants ?? this.filteredTotal());
  readonly activeTenants = computed(() => this.statistics()?.active_tenants ?? 0);
  readonly suspendedTenants = computed(() => this.statistics()?.inactive_tenants ?? 0);
  readonly inTrialTenants = computed(() => this.statistics()?.in_trial ?? 0);

  readonly hasActiveFiltersOrSearch = computed(
    () => this.getActiveFilterCount() > 0 || this.searchTerm().trim().length > 0
  );

  readonly allSelected = computed(() => {
    const rows = this.tenants();
    const selected = this.selectedTenantIds();
    return rows.length > 0 && rows.every((tenant) => selected.has(tenant.id));
  });

  constructor() {
    this.filterForm = this.fb.group({
      search: [''],
      active: [''],
      plan: [''],
      tenant_tier: [''],
      archdiocese_id: [''],
      subscription_status: [''],
      sort_by: ['created_at'],
      sort_order: ['desc'],
    });
  }

  ngOnInit(): void {
    this.initializeSearchFields();
    this.loadArchdioceses();
    this.loadStatistics();
    this.setupSearchDebounce();
    this.loadTenants();
  }

  ngOnDestroy(): void {
    this.destroy$.next();
    this.destroy$.complete();
  }

  @HostListener('document:keydown.escape')
  onEscapeKey(): void {
    if (this.searchTerm().trim()) {
      this.clearSearch();
    }
  }

  setView(view: TenantListView): void {
    this.currentView.set(view);
  }

  onSort(event: SortEvent): void {
    if (!event.direction) {
      return;
    }

    this.sortColumn = event.column;
    this.sortDirection = event.direction;
    this.filterForm.patchValue({
      sort_by: event.column,
      sort_order: event.direction,
    });
    this.currentPage.set(1);
    this.loadTenants();
  }

  getSortDirection(column: string): 'asc' | 'desc' | null {
    return this.sortColumn === column ? this.sortDirection : null;
  }

  loadTenants(): void {
    this.loading.set(true);
    this.error.set(null);

    if (!this.tenantService || typeof (this.tenantService as any).listTenants !== 'function') {
      this.loading.set(false);
      return;
    }

    const params = this.buildListParams();

    this.tenantService
      .listTenants(params)
      .pipe(takeUntil(this.destroy$))
      .subscribe({
        next: (response) => {
          if (response.success && response.data) {
            this.tenants.set(response.data);
            this.filteredTotal.set(response.pagination?.total ?? response.total ?? response.data.length);
            if (response.pagination?.current_page) {
              this.currentPage.set(response.pagination.current_page);
            }
            this.selectedTenantIds.set(new Set());
          }
          this.loading.set(false);
          this.loaded.set(true);
          this.cdr.markForCheck();
        },
        error: (err) => {
          this.error.set(err.message || 'Failed to load tenants');
          this.loading.set(false);
          this.loaded.set(true);
          this.cdr.markForCheck();
        },
      });
  }

  private buildListParams() {
    const formValue = this.filterForm.value;
    const params: Record<string, string | number> = {
      page: this.currentPage(),
      per_page: this.pageSize(),
      sort_by: formValue.sort_by || this.sortColumn,
      sort_order: formValue.sort_order || this.sortDirection,
    };

    const search = (formValue.search || '').trim();
    if (search) {
      params['search'] = search;
    }
    if (formValue.active !== '' && formValue.active !== null && formValue.active !== undefined) {
      params['active'] = Number(formValue.active);
    }
    if (formValue.plan) {
      params['plan'] = formValue.plan;
    }
    if (formValue.tenant_tier) {
      params['tenant_tier'] = formValue.tenant_tier;
    }
    if (formValue.archdiocese_id) {
      params['archdiocese_id'] = Number(formValue.archdiocese_id);
    }
    if (formValue.subscription_status) {
      params['subscription_status'] = formValue.subscription_status;
    }

    return params;
  }

  private loadStatistics(): void {
    if (!this.tenantService || typeof (this.tenantService as any).getStatistics !== 'function') {
      return;
    }

    this.tenantService
      .getStatistics()
      .pipe(takeUntil(this.destroy$))
      .subscribe({
        next: (response) => {
          if (response.success && response.data) {
            this.statistics.set(response.data);
          }
          this.cdr.markForCheck();
        },
        error: () => {
          this.cdr.markForCheck();
        },
      });
  }

  private loadArchdioceses(): void {
    this.dioceseService
      .getArchdioceses()
      .pipe(takeUntil(this.destroy$))
      .subscribe({
        next: (response) => {
          this.archdioceses = response.data ?? [];
          const field = this.searchFields.find((row) => row.key === 'archdiocese_id');
          if (field) {
            field.options = this.archdioceses.map((archdiocese) => ({
              value: archdiocese.id,
              label: archdiocese.name,
            }));
          }
          this.cdr.markForCheck();
        },
        error: () => {
          this.cdr.markForCheck();
        },
      });
  }

  private setupSearchDebounce(): void {
    this.filterForm
      .get('search')
      ?.valueChanges.pipe(debounceTime(300), distinctUntilChanged(), takeUntil(this.destroy$))
      .subscribe(() => {
        this.currentPage.set(1);
        this.loadTenants();
        this.cdr.markForCheck();
      });
  }

  private initializeSearchFields(): void {
    this.searchFields = [
      {
        key: 'active',
        label: 'Status',
        type: 'select',
        options: [
          { value: '1', label: 'Active' },
          { value: '0', label: 'Inactive' },
        ],
        value: this.filterForm.get('active')?.value,
      },
      {
        key: 'plan',
        label: 'Plan',
        type: 'select',
        options: [
          { value: 'free', label: 'Free' },
          { value: 'basic', label: 'Basic' },
          { value: 'premium', label: 'Premium' },
          { value: 'enterprise', label: 'Enterprise' },
        ],
        value: this.filterForm.get('plan')?.value,
      },
      {
        key: 'tenant_tier',
        label: 'Tier',
        type: 'select',
        options: [
          { value: 'platform', label: 'Platform' },
          { value: 'diocese', label: 'Diocese' },
          { value: 'parish', label: 'Parish' },
          { value: 'branch', label: 'Branch' },
        ],
        value: this.filterForm.get('tenant_tier')?.value,
      },
      {
        key: 'archdiocese_id',
        label: 'Diocese',
        type: 'select',
        options: [],
        value: this.filterForm.get('archdiocese_id')?.value,
      },
      {
        key: 'subscription_status',
        label: 'Subscription',
        type: 'select',
        options: [
          { value: 'trial', label: 'In trial' },
          { value: 'subscribed', label: 'Subscribed' },
          { value: 'grace', label: 'In grace period' },
          { value: 'suspended', label: 'Suspended' },
          { value: 'expired', label: 'Expired (read-only)' },
        ],
        value: this.filterForm.get('subscription_status')?.value,
      },
    ];
  }

  private syncSearchFieldValues(): void {
    const values = this.filterForm.value;
    this.searchFields.forEach((field) => {
      field.value = values[field.key] || undefined;
    });
  }

  onListSearchChange(value: string): void {
    this.searchTerm.set(value ?? '');
    this.filterForm.patchValue({ search: this.searchTerm() });
  }

  clearSearch(): void {
    this.searchTerm.set('');
    this.filterForm.patchValue({ search: '' });
    this.currentPage.set(1);
    this.loadTenants();
  }

  onAdvancedSearch(searchValues: Record<string, unknown>): void {
    this.filterForm.patchValue({
      active: searchValues['active'] || '',
      plan: searchValues['plan'] || '',
      tenant_tier: searchValues['tenant_tier'] || '',
      archdiocese_id: searchValues['archdiocese_id'] || '',
      subscription_status: searchValues['subscription_status'] || '',
    });
    this.syncSearchFieldValues();
    this.currentPage.set(1);
    this.loadTenants();
    this.showAdvancedSearch.set(false);
  }

  onClearAdvancedSearch(): void {
    this.filterForm.patchValue({
      active: '',
      plan: '',
      tenant_tier: '',
      archdiocese_id: '',
      subscription_status: '',
    });
    this.searchFields.forEach((field) => {
      field.value = undefined;
    });
    this.currentPage.set(1);
    this.loadTenants();
  }

  getActiveFilterCount(): number {
    return this.getActiveFilters().length;
  }

  getActiveFilters(): ActiveFilter[] {
    const filters: ActiveFilter[] = [];
    const values = this.filterForm.value;

    if (values.active !== '' && values.active !== null && values.active !== undefined) {
      filters.push({
        key: 'active',
        label: 'Status',
        value: values.active,
        displayValue: values.active === '1' || values.active === 1 ? 'Active' : 'Inactive',
      });
    }

    if (values.plan) {
      const planLabels: Record<TenantPlan, string> = {
        free: 'Free',
        basic: 'Basic',
        premium: 'Premium',
        enterprise: 'Enterprise',
      };
      filters.push({
        key: 'plan',
        label: 'Plan',
        value: values.plan,
        displayValue: planLabels[values.plan as TenantPlan] || values.plan,
      });
    }

    if (values.tenant_tier) {
      const tierLabels: Record<TenantTier, string> = {
        platform: 'Platform',
        diocese: 'Diocese',
        parish: 'Parish',
        branch: 'Branch',
      };
      filters.push({
        key: 'tenant_tier',
        label: 'Tier',
        value: values.tenant_tier,
        displayValue: tierLabels[values.tenant_tier as TenantTier] || values.tenant_tier,
      });
    }

    if (values.archdiocese_id) {
      const archdiocese = this.archdioceses.find((row) => row.id === Number(values.archdiocese_id));
      filters.push({
        key: 'archdiocese_id',
        label: 'Diocese',
        value: values.archdiocese_id,
        displayValue: archdiocese?.name || String(values.archdiocese_id),
      });
    }

    if (values.subscription_status) {
      const statusLabels: Record<TenantSubscriptionStatusFilter, string> = {
        trial: 'In trial',
        subscribed: 'Subscribed',
        grace: 'In grace period',
        suspended: 'Suspended',
        expired: 'Expired (read-only)',
      };
      filters.push({
        key: 'subscription_status',
        label: 'Subscription',
        value: values.subscription_status,
        displayValue:
          statusLabels[values.subscription_status as TenantSubscriptionStatusFilter] ||
          values.subscription_status,
      });
    }

    return filters;
  }

  removeFilter(filter: ActiveFilter): void {
    this.filterForm.patchValue({ [filter.key]: '' });
    const field = this.searchFields.find((row) => row.key === filter.key);
    if (field) {
      field.value = undefined;
    }
    this.currentPage.set(1);
    this.loadTenants();
  }

  clearAllFilters(): void {
    this.onClearAdvancedSearch();
  }

  clearSearchAndFilters(): void {
    this.clearSearch();
    this.onClearAdvancedSearch();
  }

  onPageChange(page: number): void {
    this.currentPage.set(page);
    this.loadTenants();
    this.cdr.markForCheck();
  }

  onPageSizeChange(size: number): void {
    this.pageSize.set(size);
    this.currentPage.set(1);
    this.loadTenants();
    this.cdr.markForCheck();
  }

  openCreateModal(): void {
    this.showCreateModal.set(true);
  }

  closeCreateModal(): void {
    this.showCreateModal.set(false);
  }

  onTenantCreated(): void {
    this.loadTenants();
    this.loadStatistics();
    this.closeCreateModal();
  }

  toggleSelectAll(checked: boolean): void {
    if (checked) {
      this.selectedTenantIds.set(new Set(this.tenants().map((tenant) => tenant.id)));
      return;
    }
    this.selectedTenantIds.set(new Set());
  }

  toggleTenantSelection(tenantId: number, checked: boolean): void {
    const next = new Set(this.selectedTenantIds());
    if (checked) {
      next.add(tenantId);
    } else {
      next.delete(tenantId);
    }
    this.selectedTenantIds.set(next);
  }

  isTenantSelected(tenantId: number): boolean {
    return this.selectedTenantIds().has(tenantId);
  }

  getStatusLabel(tenant: Tenant): string {
    if (tenant.subscription_status) {
      return this.formatSubscriptionStatus(tenant.subscription_status);
    }
    if (tenant.subscription_suspended_at) {
      return 'Suspended';
    }
    return tenant.active === 1 ? 'Active' : 'Inactive';
  }

  getStatusTone(tenant: Tenant): StatusBadgeTone {
    if (tenant.subscription_status) {
      return this.subscriptionStatusTone(tenant.subscription_status);
    }
    if (tenant.subscription_suspended_at) {
      return 'critical';
    }
    return tenant.active === 1 ? 'success' : 'neutral';
  }

  getHealthLabel(tenant: Tenant): string {
    if (tenant.subscription_status === 'EXPIRED' || tenant.subscription_status === 'SUSPENDED') {
      return 'At risk';
    }
    if (tenant.subscription_status === 'GRACE_PERIOD' || tenant.subscription_status === 'EXPIRING') {
      return 'Attention';
    }
    if (tenant.subscription_suspended_at) {
      return 'At risk';
    }
    if (tenant.trial_ends_at && new Date(tenant.trial_ends_at) > new Date()) {
      return 'Trialing';
    }
    if (tenant.active === 1) {
      return 'Healthy';
    }
    return 'Attention';
  }

  getHealthTone(tenant: Tenant): 'healthy' | 'attention' | 'risk' {
    if (tenant.subscription_status === 'EXPIRED' || tenant.subscription_status === 'SUSPENDED') {
      return 'risk';
    }
    if (tenant.subscription_status === 'GRACE_PERIOD' || tenant.subscription_status === 'EXPIRING') {
      return 'attention';
    }
    if (tenant.subscription_suspended_at) {
      return 'risk';
    }
    if (tenant.trial_ends_at && new Date(tenant.trial_ends_at) > new Date()) {
      return 'attention';
    }
    if (tenant.active === 1) {
      return 'healthy';
    }
    return 'attention';
  }

  formatSubscriptionStatus(status: string | null | undefined): string {
    if (!status) {
      return '—';
    }
    const labels: Record<string, string> = {
      TRIAL: 'In trial',
      ACTIVE: 'Active',
      LIFETIME: 'Lifetime',
      EXPIRING: 'Expiring soon',
      GRACE_PERIOD: 'Grace period',
      EXPIRED: 'Expired (read-only)',
      SUSPENDED: 'Suspended',
    };
    return labels[status] || status;
  }

  subscriptionStatusTone(status: string | null | undefined): StatusBadgeTone {
    switch (status) {
      case 'ACTIVE':
      case 'LIFETIME':
      case 'TRIAL':
        return 'success';
      case 'EXPIRING':
      case 'GRACE_PERIOD':
        return 'warning';
      case 'EXPIRED':
      case 'SUSPENDED':
        return 'critical';
      default:
        return 'neutral';
    }
  }

  getActiveUserCount(tenant: Tenant): string {
    const count =
      tenant.active_users_count ??
      tenant.users_count ??
      tenant.users?.filter((user) => user.active === 1).length ??
      tenant.users?.length ??
      tenant.membership_count;

    if (count == null || count === undefined) {
      return tenant.max_users ? `0/${tenant.max_users}` : '0';
    }

    const limit = tenant.max_users ? `/${tenant.max_users}` : '';
    return `${count}${limit}`;
  }

  formatPlan(plan: TenantPlan): string {
    const labels: Record<TenantPlan, string> = {
      free: 'Free',
      basic: 'Basic',
      premium: 'Premium',
      enterprise: 'Enterprise',
    };
    return labels[plan] || plan;
  }

  formatTier(tier?: TenantTier | null): string {
    if (!tier) {
      return '—';
    }
    const labels: Record<TenantTier, string> = {
      platform: 'Platform',
      diocese: 'Diocese',
      parish: 'Parish',
      branch: 'Branch',
    };
    return labels[tier] || tier;
  }

  formatDate(dateString: string): string {
    return new Date(dateString).toLocaleDateString('en-US', {
      year: 'numeric',
      month: 'short',
      day: 'numeric',
    });
  }

  formatShortDate(dateString: string): string {
    return new Date(dateString).toLocaleDateString('en-US', {
      year: 'numeric',
      month: 'short',
    });
  }

  isInTrial(tenant: Tenant): boolean {
    return !!tenant.trial_ends_at && new Date(tenant.trial_ends_at) > new Date();
  }

  getPlanExpiryDate(tenant: Tenant): string | null {
    if (this.isInTrial(tenant)) {
      return tenant.trial_ends_at ?? null;
    }
    return tenant.subscription_ends_at ?? null;
  }

  getPlanExpiryLabel(tenant: Tenant): string {
    return this.isInTrial(tenant) ? 'Trial ends' : 'Expires';
  }

  formatPlanExpiry(tenant: Tenant): string {
    const expiryDate = this.getPlanExpiryDate(tenant);
    if (!expiryDate) {
      return 'No expiry';
    }
    return this.formatDate(expiryDate);
  }

  retryLoad(): void {
    this.loadTenants();
  }

  getTenantDomain(tenant: Tenant): string {
    return tenant.domain || tenant.slug;
  }

  getTenantLogoUrl(logoUrl: string): string {
    if (!logoUrl?.trim()) {
      return '';
    }

    const trimmed = logoUrl.trim();
    if (trimmed.startsWith('http://') || trimmed.startsWith('https://')) {
      return trimmed;
    }

    return '';
  }

  onLogoError(event: Event): void {
    const imgElement = event.target as HTMLImageElement;
    if (imgElement?.parentElement) {
      imgElement.style.display = 'none';
    }
  }

  manageTenant(tenant: Tenant): void {
    this.router.navigate(['/tenants', tenant.id]);
  }

  onCardKeydown(event: KeyboardEvent, tenant: Tenant, index: number): void {
    const cards = document.querySelectorAll<HTMLElement>('.tenant-manager__card');
    if (event.key === 'Enter') {
      this.manageTenant(tenant);
      return;
    }
    if (event.key === 'ArrowRight' || event.key === 'ArrowDown') {
      event.preventDefault();
      cards[Math.min(index + 1, cards.length - 1)]?.focus();
    }
    if (event.key === 'ArrowLeft' || event.key === 'ArrowUp') {
      event.preventDefault();
      cards[Math.max(index - 1, 0)]?.focus();
    }
  }
}
