import {
  ChangeDetectionStrategy,
  ChangeDetectorRef,
  Component,
  Input,
  OnChanges,
  OnDestroy,
  SimpleChanges,
  inject,
} from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { RouterModule } from '@angular/router';
import { Subject, takeUntil } from 'rxjs';
import {
  AdvancedSearchPanelComponent,
  SearchField,
} from '@shared/components/advanced-search-panel/advanced-search-panel.component';
import { CfEmptyStateComponent } from '@shared/components/cf-empty-state/cf-empty-state.component';
import { DataTableComponent } from '@shared/components/data-table/data-table.component';
import { ListToolbarComponent } from '@shared/components/list-toolbar/list-toolbar.component';
import { LoadingSkeletonComponent } from '@shared/components/loading-skeleton/loading-skeleton.component';
import { StatusBadgeComponent, StatusBadgeTone } from '@shared/components/status-badge/status-badge.component';
import { CfCurrencyPipe } from '@shared/pipes/cf-currency.pipe';
import { CatalogPlan, PageMeta, PlanTenantRow } from '../../models/subscription-admin.models';
import { SubscriptionAdminService, subscriptionErrorMessage } from '../../services/subscription-admin.service';

const PER_PAGE = 25;

@Component({
  selector: 'app-plan-tenants-panel',
  standalone: true,
  imports: [
    CommonModule,
    FormsModule,
    RouterModule,
    AdvancedSearchPanelComponent,
    CfEmptyStateComponent,
    DataTableComponent,
    ListToolbarComponent,
    LoadingSkeletonComponent,
    StatusBadgeComponent,
    CfCurrencyPipe,
  ],
  templateUrl: './plan-tenants-panel.component.html',
  styleUrls: ['../../styles/subscription-admin.scss'],
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class PlanTenantsPanelComponent implements OnChanges, OnDestroy {
  private readonly api = inject(SubscriptionAdminService);
  private readonly cdr = inject(ChangeDetectorRef);
  private readonly destroy$ = new Subject<void>();
  private readonly reload$ = new Subject<void>();

  @Input({ required: true }) plan!: CatalogPlan;

  rows: PlanTenantRow[] = [];
  meta: PageMeta | null = null;
  loading = false;
  error: string | null = null;
  versionId: number | null = null;
  search = '';
  page = 1;
  showFilters = false;
  filterFields: SearchField[] = [];

  ngOnChanges(changes: SimpleChanges): void {
    if (changes['plan']) {
      this.buildFilterFields();
    }
    if (changes['plan'] && changes['plan'].previousValue?.id !== changes['plan'].currentValue?.id) {
      this.page = 1;
      this.load();
    }
  }

  ngOnDestroy(): void {
    this.reload$.next();
    this.destroy$.next();
    this.destroy$.complete();
  }

  get activeFilterCount(): number {
    return this.versionId ? 1 : 0;
  }

  get hasActiveFilters(): boolean {
    return !!this.search.trim() || this.versionId !== null;
  }

  onSearchFromToolbar(value: string): void {
    this.search = value;
    this.page = 1;
    this.load();
    this.cdr.markForCheck();
  }

  onFiltersApplied(values: { [key: string]: unknown }): void {
    const raw = values['version_id'];
    this.versionId = raw ? Number(raw) : null;
    this.syncFilterFieldValues();
    this.page = 1;
    this.load();
    this.showFilters = false;
    this.cdr.markForCheck();
  }

  onFiltersCleared(): void {
    this.versionId = null;
    this.syncFilterFieldValues();
    this.page = 1;
    this.load();
    this.cdr.markForCheck();
  }

  clearAllFilters(): void {
    this.search = '';
    this.versionId = null;
    this.syncFilterFieldValues();
    this.page = 1;
    this.load();
    this.cdr.markForCheck();
  }

  goTo(page: number): void {
    if (!this.meta || page < 1 || page > this.meta.last_page) return;
    this.page = page;
    this.load();
  }

  lifecycleTone(status: string | null): StatusBadgeTone {
    switch (status) {
      case 'ACTIVE':
      case 'LIFETIME':
        return 'success';
      case 'TRIAL':
        return 'info';
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

  lifecycleLabel(status: string | null): string {
    if (!status) return 'Unknown';
    return status.charAt(0) + status.slice(1).toLowerCase().replace(/_/g, ' ');
  }

  load(): void {
    this.reload$.next();
    this.loading = true;
    this.error = null;
    this.cdr.markForCheck();
    this.api
      .planTenants(this.plan.id, { versionId: this.versionId, search: this.search, page: this.page, perPage: PER_PAGE })
      .pipe(takeUntil(this.reload$), takeUntil(this.destroy$))
      .subscribe({
        next: (res) => {
          this.rows = res.data;
          this.meta = res.meta;
          this.loading = false;
          this.cdr.markForCheck();
        },
        error: (err) => {
          this.error = subscriptionErrorMessage(err, 'Unable to load churches on this plan.');
          this.loading = false;
          this.cdr.markForCheck();
        },
      });
  }

  private buildFilterFields(): void {
    const versions = this.plan.versions ?? [];
    this.filterFields = [
      {
        key: 'version_id',
        label: 'Version',
        type: 'select',
        options: [
          { value: '', label: 'All versions' },
          ...versions.map((version) => ({
            value: String(version.id),
            label: `Version ${version.version_number} (${version.tenant_count ?? 0})`,
          })),
        ],
        value: this.versionId ? String(this.versionId) : '',
      },
    ];
  }

  private syncFilterFieldValues(): void {
    const versionField = this.filterFields.find((field) => field.key === 'version_id');
    if (versionField) {
      versionField.value = this.versionId ? String(this.versionId) : '';
    }
  }
}
