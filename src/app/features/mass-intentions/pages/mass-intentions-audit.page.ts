import { CommonModule } from '@angular/common';
import { Component, inject, signal } from '@angular/core';
import { RouterModule } from '@angular/router';
import {
  ActiveFilter,
  AdvancedSearchPanelComponent,
  SearchField,
} from '@shared/components/advanced-search-panel/advanced-search-panel.component';
import { CfEmptyStateComponent } from '@shared/components/cf-empty-state/cf-empty-state.component';
import { DataTableComponent } from '@shared/components/data-table/data-table.component';
import { ListToolbarComponent } from '@shared/components/list-toolbar/list-toolbar.component';
import { LoadingSkeletonComponent } from '@shared/components/loading-skeleton/loading-skeleton.component';
import { PageHeaderComponent } from '@shared/components/page-header/page-header.component';
import { PaginationComponent } from '@shared/components/pagination/pagination.component';
import { StatusBadgeComponent } from '@shared/components/status-badge/status-badge.component';
import { MassIntentionsApiService, MassIntentionAuditRow } from '../services/mass-intentions-api.service';
import {
  AUDIT_CATEGORY_FILTER_OPTIONS,
  auditEventCategory,
  auditEventCategoryTone,
  auditEventLabel,
  auditEventTypeFilterOptions,
  auditRelatedLink,
  formatAuditWhen,
} from '../utils/mass-intention-audit-display';
import {
  massIntentionsAuditBackLabel,
  massIntentionsDashboardBackLink,
} from '../utils/mass-intentions-chrome-header.util';

@Component({
  selector: 'app-mass-intentions-audit-page',
  standalone: true,
  imports: [
    CommonModule,
    RouterModule,
    PageHeaderComponent,
    ListToolbarComponent,
    DataTableComponent,
    PaginationComponent,
    LoadingSkeletonComponent,
    CfEmptyStateComponent,
    StatusBadgeComponent,
    AdvancedSearchPanelComponent,
  ],
  templateUrl: './mass-intentions-audit.page.html',
  styleUrl: './mass-intentions-audit.page.scss',
})
export class MassIntentionsAuditPageComponent {
  readonly dashboardBackLink = massIntentionsDashboardBackLink();
  readonly dashboardBackLabel = massIntentionsAuditBackLabel();

  private readonly api = inject(MassIntentionsApiService);

  readonly pageSize = 30;
  readonly loading = signal(true);
  readonly loaded = signal(false);
  readonly loadError = signal<string | null>(null);
  readonly rows = signal<MassIntentionAuditRow[]>([]);
  readonly eventFilter = signal('');
  readonly categoryFilter = signal('');
  readonly eventTypeFilter = signal('');
  readonly showFiltersPanel = signal(false);
  readonly currentPage = signal(1);
  readonly totalItems = signal(0);

  searchFields: SearchField[] = [];

  readonly formatWhen = formatAuditWhen;
  readonly eventLabel = auditEventLabel;
  readonly eventCategory = auditEventCategory;
  readonly eventCategoryTone = auditEventCategoryTone;
  readonly relatedLink = auditRelatedLink;

  constructor() {
    this.initSearchFields();
    this.reload();
  }

  drawerFilterCount(): number {
    return this.getActiveFilters().length;
  }

  getActiveFilters(): ActiveFilter[] {
    const filters: ActiveFilter[] = [];
    const search = this.eventFilter().trim();
    if (search) {
      filters.push({ key: 'search', label: 'Search', value: search, displayValue: search });
    }
    const category = this.categoryFilter().trim();
    if (category) {
      const label =
        AUDIT_CATEGORY_FILTER_OPTIONS.find((o) => o.value === category)?.label ?? category;
      filters.push({ key: 'event_category', label: 'Category', value: category, displayValue: label });
    }
    const eventType = this.eventTypeFilter().trim();
    if (eventType) {
      filters.push({
        key: 'event_type',
        label: 'Event',
        value: eventType,
        displayValue: auditEventLabel(eventType),
      });
    }
    return filters;
  }

  removeFilter(filter: ActiveFilter): void {
    if (filter.key === 'search') {
      this.eventFilter.set('');
    } else if (filter.key === 'event_category') {
      this.categoryFilter.set('');
    } else if (filter.key === 'event_type') {
      this.eventTypeFilter.set('');
    }
    this.currentPage.set(1);
    this.syncSearchFieldValues();
    this.reload();
  }

  clearAllFilters(): void {
    this.clearEventFilter();
  }

  openFilters(): void {
    this.syncSearchFieldValues();
    this.showFiltersPanel.set(true);
  }

  onFiltersApply(values: Record<string, unknown>): void {
    this.categoryFilter.set(String(values['event_category'] ?? '').trim());
    this.eventTypeFilter.set(String(values['event_type'] ?? '').trim());
    this.currentPage.set(1);
    this.showFiltersPanel.set(false);
    this.reload();
  }

  onFiltersClear(): void {
    this.categoryFilter.set('');
    this.eventTypeFilter.set('');
    this.currentPage.set(1);
    this.showFiltersPanel.set(false);
    this.syncSearchFieldValues();
    this.reload();
  }

  resultsSummary(): string {
    const total = this.totalItems();
    if (total === 0) {
      return 'No entries';
    }
    const start = (this.currentPage() - 1) * this.pageSize + 1;
    const end = Math.min(this.currentPage() * this.pageSize, total);
    return `Showing ${start}–${end} of ${total}`;
  }

  onEventFilterChange(value: string): void {
    this.eventFilter.set(value);
    this.currentPage.set(1);
    this.reload();
  }

  clearEventFilter(): void {
    this.eventFilter.set('');
    this.categoryFilter.set('');
    this.eventTypeFilter.set('');
    this.currentPage.set(1);
    this.syncSearchFieldValues();
    this.reload();
  }

  goToPage(page: number): void {
    this.currentPage.set(page);
    this.reload();
  }

  reload(): void {
    this.loading.set(true);
    this.loadError.set(null);
    const params: Record<string, string | number> = {
      per_page: this.pageSize,
      page: this.currentPage(),
    };
    const search = this.eventFilter().trim();
    const panelType = this.eventTypeFilter().trim();
    const typeFilter = panelType || search;
    if (typeFilter) {
      params['event_type'] = typeFilter;
    }
    const category = this.categoryFilter().trim();
    if (category) {
      params['event_category'] = category;
    }
    this.api.listAudits(params).subscribe({
      next: (res) => {
        this.rows.set(res.data ?? []);
        this.totalItems.set(res.total ?? this.rows().length);
        this.loading.set(false);
        this.loaded.set(true);
      },
      error: () => {
        this.loading.set(false);
        this.loaded.set(true);
        this.loadError.set('Could not load the audit log. Try again.');
      },
    });
  }

  private initSearchFields(): void {
    this.searchFields = [
      {
        key: 'event_category',
        label: 'Category',
        type: 'select',
        options: [{ value: '', label: 'All categories' }, ...AUDIT_CATEGORY_FILTER_OPTIONS],
        value: this.categoryFilter(),
      },
      {
        key: 'event_type',
        label: 'Event',
        type: 'select',
        options: [{ value: '', label: 'All events' }, ...auditEventTypeFilterOptions()],
        value: this.eventTypeFilter(),
      },
    ];
  }

  private syncSearchFieldValues(): void {
    for (const field of this.searchFields) {
      if (field.key === 'event_category') {
        field.value = this.categoryFilter();
      }
      if (field.key === 'event_type') {
        field.value = this.eventTypeFilter();
      }
    }
  }
}
