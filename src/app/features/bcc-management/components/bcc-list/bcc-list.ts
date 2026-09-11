import { Component, OnInit, OnDestroy, ChangeDetectionStrategy, ChangeDetectorRef, inject } from '@angular/core';
import { CommonModule } from '@angular/common';
import { ActivatedRoute, Router } from '@angular/router';
import { FormsModule, ReactiveFormsModule, FormBuilder, FormGroup } from '@angular/forms';
import { Subject, debounceTime, takeUntil, distinctUntilChanged, filter, map } from 'rxjs';
import { ToastService } from '@core/services/toast.service';
import { AuthService } from '@core/services/auth.service';
import { SupportSessionService } from '@features/support-center/services/support-session.service';
import { BCCService } from '../../../../core/services/bcc.service';
import { BCC, BCCStatistics } from '../../../../core/models/family.model';
import { BCCFormComponent } from '../bcc-form/bcc-form';
import { BccDetailModalComponent } from '../bcc-detail-modal/bcc-detail-modal.component';
import { AdvancedSearchPanelComponent, SearchField, ActiveFilter } from '@shared/components/advanced-search-panel/advanced-search-panel.component';
import { PaginationComponent } from '@shared/components/pagination/pagination.component';
import { PageHeaderComponent } from '@shared/components/page-header/page-header.component';
import { ListToolbarComponent } from '@shared/components/list-toolbar/list-toolbar.component';
import { DataTableComponent } from '@shared/components/data-table/data-table.component';
import { StatusBadgeComponent, StatusBadgeTone } from '@shared/components/status-badge/status-badge.component';
import { CfEmptyStateComponent } from '@shared/components/cf-empty-state/cf-empty-state.component';
import { LoadingSkeletonComponent } from '@shared/components/loading-skeleton/loading-skeleton.component';
import { BccSubNavComponent } from '../bcc-sub-nav/bcc-sub-nav.component';
import { SubscriptionAccessService } from '@core/services/subscription-access.service';
import { DisableWhenReadOnlyDirective } from '@shared/directives/disable-when-read-only.directive';

@Component({
  selector: 'app-bcc-list',
  standalone: true,
  imports: [
    CommonModule,
    FormsModule,
    ReactiveFormsModule,
    BCCFormComponent,
    BccDetailModalComponent,
    AdvancedSearchPanelComponent,
    PaginationComponent,
    PageHeaderComponent,
    ListToolbarComponent,
    DataTableComponent,
    StatusBadgeComponent,
    CfEmptyStateComponent,
    LoadingSkeletonComponent,
    BccSubNavComponent,
    DisableWhenReadOnlyDirective,
  ],
  templateUrl: './bcc-list.html',
  styleUrls: ['./bcc-list.scss'],
  changeDetection: ChangeDetectionStrategy.OnPush
})
export class BCCListComponent implements OnInit, OnDestroy {
  private destroy$ = new Subject<void>();
  private cdr = inject(ChangeDetectorRef);
  private readonly subscriptionAccess = inject(SubscriptionAccessService);
  private readonly supportSessions = inject(SupportSessionService);

  bccs: BCC[] = [];
  statistics: BCCStatistics | null = null;

  currentPage = 1;
  totalPages = 1;
  totalRecords = 0;
  perPage = 20;
  perPageOptions = [10, 20, 50, 100];

  loading = false;
  loaded = false;
  error: string | null = null;
  showForm = false;
  selectedBCC: BCC | null = null;
  showDetailModal = false;
  detailBCC: BCC | null = null;
  loadingDetail = false;

  filterForm: FormGroup;
  searchTerm = '';

  showAdvancedSearch = false;
  searchFields: SearchField[] = [];

  Math = Math;
  Object = Object;

  constructor(
    private bccService: BCCService,
    private fb: FormBuilder,
    private toastService: ToastService,
    private authService: AuthService,
    private router: Router,
    private route: ActivatedRoute,
  ) {
    this.filterForm = this.fb.group({
      search: [''],
      status: [''],
      has_space: [''],
      meeting_day: [''],
      sort_by: ['created_at'],
      sort_order: ['desc']
    });
  }

  get isTenantAdmin(): boolean {
    return this.authService.isTenantAdmin();
  }

  get hasActiveFiltersOrSearch(): boolean {
    return this.getActiveFilterCount() > 0 || this.searchTerm.trim().length > 0;
  }

  ngOnInit(): void {
    this.initializeSearchFields();
    this.tryLoadParishData();
    this.supportSessions.session$
      .pipe(
        map((session) => session?.id ?? null),
        distinctUntilChanged(),
        filter((id) => id !== null),
        takeUntil(this.destroy$)
      )
      .subscribe(() => this.tryLoadParishData());
    this.setupSearchDebounce();

    this.route.queryParamMap.pipe(takeUntil(this.destroy$)).subscribe((params) => {
      if (params.get('create') === '1' && this.authService.hasPermission('bcc.create')) {
        this.createBCC();
        void this.router.navigate([], {
          relativeTo: this.route,
          queryParams: { create: null },
          queryParamsHandling: 'merge',
          replaceUrl: true,
        });
      }
    });
  }

  initializeSearchFields(): void {
    this.searchFields = [
      {
        key: 'status',
        label: 'Status',
        type: 'select',
        options: [
          { value: 'active', label: 'Active' },
          { value: 'inactive', label: 'Inactive' }
        ],
        value: this.filterForm.get('status')?.value
      },
      {
        key: 'has_space',
        label: 'Has Space Available',
        type: 'select',
        options: [
          { value: '1', label: 'Yes' },
          { value: '0', label: 'No' }
        ],
        value: this.filterForm.get('has_space')?.value
      },
      {
        key: 'meeting_day',
        label: 'Meeting Day',
        type: 'select',
        options: [
          { value: 'Monday', label: 'Monday' },
          { value: 'Tuesday', label: 'Tuesday' },
          { value: 'Wednesday', label: 'Wednesday' },
          { value: 'Thursday', label: 'Thursday' },
          { value: 'Friday', label: 'Friday' },
          { value: 'Saturday', label: 'Saturday' },
          { value: 'Sunday', label: 'Sunday' }
        ],
        value: this.filterForm.get('meeting_day')?.value
      }
    ];
  }

  ngOnDestroy(): void {
    this.destroy$.next();
    this.destroy$.complete();
  }

  private setupSearchDebounce(): void {
    this.filterForm.get('search')?.valueChanges
      .pipe(
        debounceTime(300),
        distinctUntilChanged(),
        takeUntil(this.destroy$)
      )
      .subscribe(() => {
        this.currentPage = 1;
        this.loadBCCs();
        this.cdr.markForCheck();
      });
  }

  private tryLoadParishData(): void {
    if (!this.authService.hasParishContext()) {
      return;
    }

    this.loadReferenceData();
    this.loadStatistics();
    this.loadBCCs();
  }

  private loadReferenceData(): void {}

  private loadStatistics(): void {
    if (!this.authService.hasParishContext()) {
      return;
    }

    this.bccService.getStatistics()
      .pipe(takeUntil(this.destroy$))
      .subscribe({
        next: (response) => {
          if (response.success && response.data) {
            this.statistics = response.data;
          }
          this.cdr.markForCheck();
        },
        error: (error) => {
          console.error('Failed to load statistics', error);
          this.cdr.markForCheck();
        }
      });
  }

  loadBCCs(): void {
    if (!this.authService.hasParishContext()) {
      return;
    }

    this.loading = true;
    this.error = null;
    this.cdr.markForCheck();

    const filters: Record<string, unknown> = {
      ...this.filterForm.value,
      page: this.currentPage,
      per_page: this.perPage
    };

    Object.keys(filters).forEach(key => {
      if (filters[key] === '' || filters[key] === null) {
        delete filters[key];
      }
    });

    this.bccService.getBCCs(filters)
      .pipe(takeUntil(this.destroy$))
      .subscribe({
        next: (response) => {
          this.bccs = response.data;
          this.currentPage = response.current_page;
          this.totalPages = response.last_page;
          this.totalRecords = response.total;
          this.loading = false;
          this.loaded = true;
          this.cdr.markForCheck();
        },
        error: (error) => {
          this.error = 'Failed to load BCCs. Please try again.';
          this.loading = false;
          this.loaded = true;
          console.error('Error loading BCCs:', error);
          this.cdr.markForCheck();
        }
      });
  }

  onListSearchChange(value: string): void {
    this.searchTerm = value ?? '';
    this.filterForm.patchValue({ search: this.searchTerm });
  }

  onAdvancedSearch(searchValues: { [key: string]: any }): void {
    this.filterForm.patchValue({
      status: searchValues['status'] || '',
      has_space: searchValues['has_space'] || '',
      meeting_day: searchValues['meeting_day'] || ''
    });
    this.currentPage = 1;
    this.loadBCCs();
    this.showAdvancedSearch = false;
  }

  onClearAdvancedSearch(): void {
    this.filterForm.patchValue({
      status: '',
      has_space: '',
      meeting_day: ''
    });
    this.searchFields.forEach(field => {
      field.value = undefined;
    });
    this.currentPage = 1;
    this.loadBCCs();
  }

  getActiveFilters(): ActiveFilter[] {
    const filters: ActiveFilter[] = [];
    const values = this.filterForm.value;

    if (values.status) {
      filters.push({
        key: 'status',
        label: 'Status',
        value: values.status,
        displayValue: values.status.charAt(0).toUpperCase() + values.status.slice(1)
      });
    }

    if (values.has_space) {
      filters.push({
        key: 'has_space',
        label: 'Has Space',
        value: values.has_space,
        displayValue: values.has_space === '1' ? 'Yes' : 'No'
      });
    }

    if (values.meeting_day) {
      filters.push({
        key: 'meeting_day',
        label: 'Meeting Day',
        value: values.meeting_day,
        displayValue: values.meeting_day
      });
    }

    return filters;
  }

  getActiveFilterCount(): number {
    return this.getActiveFilters().length;
  }

  removeFilter(filter: ActiveFilter): void {
    this.filterForm.patchValue({ [filter.key]: '' });

    const field = this.searchFields.find(f => f.key === filter.key);
    if (field) {
      field.value = undefined;
    }

    this.currentPage = 1;
    this.loadBCCs();
  }

  clearAllFilters(): void {
    this.filterForm.reset({
      search: '',
      status: '',
      has_space: '',
      meeting_day: '',
      sort_by: 'created_at',
      sort_order: 'desc'
    });
    this.searchTerm = '';
    this.searchFields.forEach(field => {
      field.value = undefined;
    });
    this.currentPage = 1;
    this.loadBCCs();
  }

  onPageChange(page: number): void {
    this.currentPage = page;
    this.loadBCCs();
  }

  onPageSizeChange(pageSize: number): void {
    this.perPage = pageSize;
    this.currentPage = 1;
    this.loadBCCs();
  }

  sortBy(column: string): void {
    const currentSort = this.filterForm.get('sort_by')?.value;
    const currentOrder = this.filterForm.get('sort_order')?.value;

    if (currentSort === column) {
      this.filterForm.patchValue({
        sort_order: currentOrder === 'asc' ? 'desc' : 'asc'
      });
    } else {
      this.filterForm.patchValue({
        sort_by: column,
        sort_order: 'asc'
      });
    }

    this.loadBCCs();
  }

  getSortIcon(column: string): string {
    const currentSort = this.filterForm.get('sort_by')?.value;
    const currentOrder = this.filterForm.get('sort_order')?.value;

    if (currentSort !== column) return '↕';
    return currentOrder === 'asc' ? '↑' : '↓';
  }

  statusTone(status: string | undefined): StatusBadgeTone {
    switch (status) {
      case 'active':
        return 'success';
      case 'suspended':
        return 'warning';
      case 'inactive':
      default:
        return 'neutral';
    }
  }

  viewBCC(bcc: BCC): void {
    void this.router.navigate(['/bccs', bcc.id]);
  }

  loadBCCDetail(bccId: string): void {
    this.loadingDetail = true;
    this.cdr.markForCheck();
    this.bccService.getBCC(bccId)
      .pipe(takeUntil(this.destroy$))
      .subscribe({
        next: (response) => {
          if (response.success && response.data) {
            this.detailBCC = response.data;
          }
          this.loadingDetail = false;
          this.cdr.markForCheck();
        },
        error: (error) => {
          console.error('Error loading BCC details:', error);
          this.loadingDetail = false;
          this.toastService.error('Failed to load BCC details', 'Error');
          this.cdr.markForCheck();
        }
      });
  }

  closeDetailModal(): void {
    this.showDetailModal = false;
    this.detailBCC = null;
    this.loadingDetail = false;
    this.cdr.markForCheck();
  }

  onDetailEdit(bcc: BCC): void {
    this.closeDetailModal();
    this.editBCC(bcc);
  }

  editBCC(bcc: BCC): void {
    if (this.subscriptionAccess.isReadOnly()) {
      this.toastService.warning('Read-only mode: renew subscription to edit BCCs.', 'Read-only');
      return;
    }
    this.selectedBCC = bcc;
    this.showForm = true;
  }

  createBCC(): void {
    if (this.subscriptionAccess.isReadOnly()) {
      this.toastService.warning('Read-only mode: renew subscription to add BCCs.', 'Read-only');
      return;
    }
    this.selectedBCC = null;
    this.showForm = true;
  }

  deleteBCC(bcc: BCC): void {
    if (this.subscriptionAccess.isReadOnly()) {
      this.toastService.warning('Read-only mode: renew subscription to delete BCCs.', 'Read-only');
      return;
    }
    if (!this.isTenantAdmin) {
      this.toastService.error('Only Tenant Administrators can delete BCCs.', 'Permission Denied', 5000);
      return;
    }

    const bccName = bcc.name || bcc.bcc_code || 'this BCC';
    const familyCount = bcc.families?.length || 0;
    const warningMessage = familyCount > 0
      ? `Are you sure you want to delete ${bccName}? This will unassign ${familyCount} family/families from this BCC. This action cannot be undone.`
      : `Are you sure you want to delete ${bccName}? This action cannot be undone.`;

    if (!confirm(warningMessage)) {
      return;
    }

    this.loading = true;
    this.cdr.markForCheck();

    this.bccService.deleteBCC(bcc.id)
      .pipe(takeUntil(this.destroy$))
      .subscribe({
        next: (response) => {
          if (response.success) {
            this.toastService.success('BCC deleted successfully', 'Success', 4000);
            this.loadBCCs();
            this.loadStatistics();
          } else {
            this.toastService.error(response.message || 'Failed to delete BCC', 'Error', 5000);
          }
          this.loading = false;
          this.cdr.markForCheck();
        },
        error: (err) => {
          console.error('Error deleting BCC:', err);
          this.toastService.error(err.error?.message || 'Failed to delete BCC', 'Error', 6000);
          this.loading = false;
          this.cdr.markForCheck();
        }
      });
  }

  onFormSave(_bcc: BCC): void {
    this.showForm = false;
    this.selectedBCC = null;
    this.loadBCCs();
    this.loadStatistics();
    this.toastService.success('BCC saved successfully!', 'Success');
  }

  onFormCancel(): void {
    this.showForm = false;
    this.selectedBCC = null;
  }

  getCapacityPercentage(bcc: BCC): number {
    void (bcc.current_family_count || 0);
    return 0;
  }

  getCapacityClass(percentage: number): string {
    if (percentage >= 90) return 'capacity-high';
    if (percentage >= 70) return 'capacity-medium';
    return 'capacity-low';
  }
}
