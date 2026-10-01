import {
  ChangeDetectionStrategy,
  ChangeDetectorRef,
  Component,
  OnDestroy,
  OnInit,
  inject,
} from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { ActivatedRoute, Router } from '@angular/router';
import { Subject, debounceTime, distinctUntilChanged, takeUntil } from 'rxjs';
import { BCCService } from '@core/services/bcc.service';
import { BCC } from '@core/models/family.model';
import { PageHeaderComponent } from '@shared/components/page-header/page-header.component';
import { CfActionIconComponent } from '@shared/components/cf-action-icon/cf-action-icon.component';
import { ListToolbarComponent } from '@shared/components/list-toolbar/list-toolbar.component';
import { DataTableComponent } from '@shared/components/data-table/data-table.component';
import { PaginationComponent } from '@shared/components';
import { CfEmptyStateComponent } from '@shared/components/cf-empty-state/cf-empty-state.component';
import { LoadingSkeletonComponent } from '@shared/components/loading-skeleton/loading-skeleton.component';
import { AdvancedSearchPanelComponent, ActiveFilter, SearchField } from '@shared/components/advanced-search-panel/advanced-search-panel.component';
import { SortableDirective, SortEvent } from '@shared/directives/sortable.directive';
import { cfFormatDate } from '@shared/utils/cf-intl.util';
import {
  MemberCelebrationItem,
  MemberCelebrationListType,
  MemberService,
} from '../services/member.service';

type CelebrationTab = MemberCelebrationListType;

@Component({
  selector: 'app-member-celebrations-page',
  standalone: true,
  imports: [
    CommonModule,
    FormsModule,
    PageHeaderComponent,
    CfActionIconComponent,
    ListToolbarComponent,
    DataTableComponent,
    PaginationComponent,
    CfEmptyStateComponent,
    LoadingSkeletonComponent,
    AdvancedSearchPanelComponent,
    SortableDirective,
  ],
  templateUrl: './member-celebrations.page.html',
  styleUrl: './member-celebrations.page.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class MemberCelebrationsPageComponent implements OnInit, OnDestroy {
  private destroy$ = new Subject<void>();
  private searchChanges$ = new Subject<string>();
  private cdr = inject(ChangeDetectorRef);
  private loadRequestId = 0;
  /** User-applied celebration date range (distinct from parish week `from`/`to` in the URL). */
  private explicitEventDateFilter = false;

  readonly tabs: { id: CelebrationTab; label: string }[] = [
    { id: 'birthdays', label: 'Birthdays' },
    { id: 'anniversaries', label: 'Wedding Anniversaries' },
  ];

  activeTab: CelebrationTab = 'birthdays';
  windowLabel = '';

  items: MemberCelebrationItem[] = [];
  bccs: BCC[] = [];

  loading = false;
  loaded = false;
  error: string | null = null;
  forbidden = false;

  searchTerm = '';
  selectedBccId = '';
  windowFrom = '';
  windowTo = '';
  selectedEventDateFrom = '';
  selectedEventDateTo = '';
  showAdvancedSearch = false;
  searchFields: SearchField[] = [];

  currentPage = 1;
  totalPages = 1;
  totalRecords = 0;
  perPage = 20;
  perPageOptions = [10, 20, 50, 100];

  sortColumn: 'event_date' | 'name' | 'family_name' | 'bcc_name' = 'event_date';
  sortDirection: 'asc' | 'desc' = 'asc';
  headerSortColumn = '';
  headerSortDirection: 'asc' | 'desc' | null = null;

  constructor(
    private memberService: MemberService,
    private bccService: BCCService,
    readonly router: Router,
    private route: ActivatedRoute
  ) {}

  get pageSubtitle(): string {
    if (this.windowLabel) {
      return `Celebrations · ${this.windowLabel}`;
    }
    return 'Birthdays and wedding anniversaries for the parish week';
  }

  get emptyStateTitle(): string {
    const type = this.activeTab === 'birthdays' ? 'birthdays' : 'anniversaries';
    if (this.windowLabel) {
      return `No ${type} in ${this.windowLabel}`;
    }
    return `No ${type} in this parish week`;
  }

  ngOnInit(): void {
    this.initializeSearchFields();
    this.loadBccs();

    this.searchChanges$
      .pipe(debounceTime(300), distinctUntilChanged(), takeUntil(this.destroy$))
      .subscribe(() => {
        this.currentPage = 1;
        this.loadItems();
      });

    this.route.queryParamMap.pipe(takeUntil(this.destroy$)).subscribe((params) => {
      const tab = params.get('tab');
      if (tab === 'anniversaries' || tab === 'birthdays') {
        this.activeTab = tab;
      }
      this.currentPage = Math.max(1, Number(params.get('page') || 1));
      this.perPage = Math.max(10, Number(params.get('per_page') || 20));
      this.searchTerm = params.get('search') || '';
      this.selectedBccId = params.get('bcc_id') || '';
      this.windowFrom = params.get('from') || '';
      this.windowTo = params.get('to') || '';
      this.selectedEventDateFrom = params.get('event_date_from') || '';
      this.selectedEventDateTo = params.get('event_date_to') || '';

      const legacyDate = params.get('event_date');
      if (legacyDate && !params.get('event_date_from')) {
        this.selectedEventDateFrom = legacyDate;
        this.selectedEventDateTo = legacyDate;
      }
      this.explicitEventDateFilter = !!(
        params.get('event_date_from') ||
        params.get('event_date_to') ||
        legacyDate
      );

      const sortBy = params.get('sort_by');
      if (sortBy === 'name' || sortBy === 'family_name' || sortBy === 'bcc_name' || sortBy === 'event_date') {
        this.sortColumn = sortBy;
      }
      const sortOrder = params.get('sort_order');
      if (sortOrder === 'asc' || sortOrder === 'desc') {
        this.sortDirection = sortOrder;
      }
      this.syncSearchFieldsWithFilters();
      this.loadItems();
    });
  }

  ngOnDestroy(): void {
    this.destroy$.next();
    this.destroy$.complete();
  }

  selectTab(tab: CelebrationTab): void {
    if (this.activeTab === tab) {
      return;
    }
    this.activeTab = tab;
    this.currentPage = 1;
    this.headerSortColumn = '';
    this.headerSortDirection = null;
    this.syncQueryParams();
  }

  onListSearchChange(value: string): void {
    this.searchTerm = value;
    this.searchChanges$.next(value);
  }

  openAdvancedSearch(): void {
    this.syncSearchFieldsWithFilters();
    this.showAdvancedSearch = true;
  }

  onAdvancedSearch(searchValues: { [key: string]: unknown }): void {
    if ('bcc_id' in searchValues) {
      this.selectedBccId = (searchValues['bcc_id'] as string) || '';
    }
    if ('event_date_from' in searchValues) {
      this.selectedEventDateFrom = (searchValues['event_date_from'] as string) || '';
    }
    if ('event_date_to' in searchValues) {
      this.selectedEventDateTo = (searchValues['event_date_to'] as string) || '';
    }
    if ('event_date_from' in searchValues || 'event_date_to' in searchValues) {
      this.explicitEventDateFilter = !!(this.selectedEventDateFrom || this.selectedEventDateTo);
    }
    if (this.selectedEventDateFrom && this.selectedEventDateTo) {
      this.windowFrom = this.selectedEventDateFrom;
      this.windowTo = this.selectedEventDateTo;
    }
    this.syncSearchFieldsWithFilters();
    this.showAdvancedSearch = false;
    this.currentPage = 1;
    this.syncQueryParams();
  }

  onClearAdvancedSearch(): void {
    this.selectedBccId = '';
    this.explicitEventDateFilter = false;
    this.resetToDefaultParishWeek();
    this.syncSearchFieldsWithFilters();
    this.currentPage = 1;
    this.syncQueryParams();
  }

  getActiveFilterCount(): number {
    let count = 0;
    if (this.selectedBccId) {
      count++;
    }
    if (this.explicitEventDateFilter && (this.selectedEventDateFrom || this.selectedEventDateTo)) {
      count++;
    }
    return count;
  }

  getActiveFilters(): ActiveFilter[] {
    const filters: ActiveFilter[] = [];
    if (this.selectedBccId) {
      const bcc = this.bccs.find((b) => b.id === this.selectedBccId);
      filters.push({
        key: 'bcc_id',
        label: 'BCC',
        value: this.selectedBccId,
        displayValue: bcc?.name || this.selectedBccId,
      });
    }
    if (!this.explicitEventDateFilter) {
      return filters;
    }
    if (this.selectedEventDateFrom && this.selectedEventDateTo) {
      filters.push({
        key: 'event_date_range',
        label: 'Celebration dates',
        value: `${this.selectedEventDateFrom}:${this.selectedEventDateTo}`,
        displayValue: `${cfFormatDate(this.selectedEventDateFrom)} – ${cfFormatDate(this.selectedEventDateTo)}`,
      });
    } else if (this.selectedEventDateFrom) {
      filters.push({
        key: 'event_date_from',
        label: 'Celebration from',
        value: this.selectedEventDateFrom,
        displayValue: cfFormatDate(this.selectedEventDateFrom),
      });
    } else if (this.selectedEventDateTo) {
      filters.push({
        key: 'event_date_to',
        label: 'Celebration to',
        value: this.selectedEventDateTo,
        displayValue: cfFormatDate(this.selectedEventDateTo),
      });
    }
    return filters;
  }

  removeFilter(filter: ActiveFilter, event?: Event): void {
    event?.stopPropagation();
    event?.preventDefault();
    if (filter.key === 'bcc_id') {
      this.selectedBccId = '';
    }
    if (filter.key === 'event_date_range' || filter.key === 'event_date_from' || filter.key === 'event_date_to') {
      this.explicitEventDateFilter = false;
      this.resetToDefaultParishWeek();
    }
    const field = this.searchFields.find((f) => f.key === filter.key || (filter.key === 'event_date_range' && f.key.startsWith('event_date_')));
    if (field) {
      field.value = undefined;
    }
    if (filter.key === 'event_date_range') {
      this.searchFields
        .filter((f) => f.key === 'event_date_from' || f.key === 'event_date_to')
        .forEach((f) => {
          f.value = undefined;
        });
    }
    this.syncSearchFieldsWithFilters();
    this.currentPage = 1;
    this.syncQueryParams();
    this.cdr.markForCheck();
  }

  clearAllFilters(): void {
    this.selectedBccId = '';
    this.explicitEventDateFilter = false;
    this.resetToDefaultParishWeek();
    this.syncSearchFieldsWithFilters();
    this.currentPage = 1;
    this.syncQueryParams();
  }

  onSort(event: SortEvent): void {
    this.headerSortColumn = event.column;
    this.headerSortDirection = event.direction;
    this.sortColumn = event.column as typeof this.sortColumn;
    this.sortDirection = event.direction ?? 'asc';
    this.currentPage = 1;
    this.syncQueryParams();
  }

  onPageChange(page: number): void {
    this.currentPage = page;
    this.syncQueryParams();
  }

  onPerPageChange(perPage: number): void {
    this.perPage = perPage;
    this.currentPage = 1;
    this.syncQueryParams();
  }

  openFamily(item: MemberCelebrationItem): void {
    if (item.family_id) {
      void this.router.navigate(['/families', item.family_id]);
    }
  }

  loadItems(): void {
    const requestId = ++this.loadRequestId;
    this.loading = true;
    this.error = null;
    this.forbidden = false;
    this.cdr.markForCheck();

    this.memberService
      .getCelebrationsList({
        type: this.activeTab,
        from: this.windowFrom || undefined,
        to: this.windowTo || undefined,
        search: this.searchTerm.trim() || undefined,
        bcc_id: this.selectedBccId || undefined,
        event_date_from: this.explicitEventDateFilter ? this.selectedEventDateFrom || undefined : undefined,
        event_date_to: this.explicitEventDateFilter ? this.selectedEventDateTo || undefined : undefined,
        sort_by: this.sortColumn,
        sort_order: this.sortDirection,
        page: this.currentPage,
        per_page: this.perPage,
      })
      .pipe(takeUntil(this.destroy$))
      .subscribe({
        next: (response) => {
          if (requestId !== this.loadRequestId) {
            return;
          }

          const ok =
            response.success !== false &&
            (Array.isArray(response.data) || typeof response.total === 'number');

          if (ok) {
            this.items = Array.isArray(response.data) ? response.data : [];
            this.windowLabel = response.window?.label ?? '';
            this.totalRecords = response.total ?? this.items.length;
            this.currentPage = response.current_page ?? 1;
            this.totalPages = response.last_page ?? 1;
            this.perPage = response.per_page ?? this.perPage;
            this.loaded = true;
            this.loading = false;
            this.ensureWindowQueryParams(response.window?.start, response.window?.end);
          } else {
            this.error = 'Could not load celebrations right now.';
            this.loading = false;
          }
          this.cdr.markForCheck();
        },
        error: (err) => {
          if (requestId !== this.loadRequestId) {
            return;
          }
          this.forbidden = err?.status === 403;
          this.error = this.forbidden
            ? 'Member celebrations require Families view permission.'
            : 'Could not load celebrations right now.';
          this.loading = false;
          this.cdr.markForCheck();
        },
      });
  }

  private loadBccs(): void {
    this.bccService
      .getBCCs({ status: 'active' })
      .pipe(takeUntil(this.destroy$))
      .subscribe({
        next: (response) => {
          if (response.success && response.data) {
            this.bccs = response.data;
            this.initializeSearchFields();
            this.cdr.markForCheck();
          }
        },
      });
  }

  private resetToDefaultParishWeek(): void {
    this.windowFrom = '';
    this.windowTo = '';
    this.selectedEventDateFrom = '';
    this.selectedEventDateTo = '';
  }

  private ensureWindowQueryParams(start?: string, end?: string): void {
    if (!start || !end) {
      return;
    }
    const windowUnchanged = this.windowFrom === start && this.windowTo === end;
    this.windowFrom = start;
    this.windowTo = end;
    if (windowUnchanged) {
      return;
    }
    void this.router.navigate([], {
      relativeTo: this.route,
      queryParams: this.buildListQueryParams({ from: start, to: end }),
      queryParamsHandling: 'merge',
      replaceUrl: true,
    });
  }

  private buildListQueryParams(
    overrides: Partial<Record<string, string | number | null>> = {}
  ): Record<string, string | number | null> {
    return {
      tab: this.activeTab,
      page: this.currentPage,
      per_page: this.perPage,
      search: this.searchTerm.trim() || null,
      bcc_id: this.selectedBccId || null,
      from: this.windowFrom || null,
      to: this.windowTo || null,
      event_date_from: this.explicitEventDateFilter ? this.selectedEventDateFrom || null : null,
      event_date_to: this.explicitEventDateFilter ? this.selectedEventDateTo || null : null,
      event_date: null,
      sort_by: this.sortColumn,
      sort_order: this.sortDirection,
      ...overrides,
    };
  }

  private syncQueryParams(): void {
    void this.router.navigate([], {
      relativeTo: this.route,
      queryParams: this.buildListQueryParams(),
      queryParamsHandling: 'merge',
    });
  }

  private initializeSearchFields(): void {
    this.searchFields = [
      {
        key: 'bcc_id',
        label: 'BCC',
        type: 'select',
        value: this.selectedBccId,
        options: this.bccs.map((bcc) => ({ value: bcc.id, label: bcc.name })),
      },
      {
        key: 'event_date_from',
        label: 'Celebration from',
        type: 'date',
        value: this.selectedEventDateFrom,
      },
      {
        key: 'event_date_to',
        label: 'Celebration to',
        type: 'date',
        value: this.selectedEventDateTo,
      },
    ];
  }

  private syncSearchFieldsWithFilters(): void {
    const bccField = this.searchFields.find((f) => f.key === 'bcc_id');
    if (bccField) {
      bccField.value = this.selectedBccId;
      bccField.options = this.bccs.map((bcc) => ({ value: bcc.id, label: bcc.name }));
    }
    const fromField = this.searchFields.find((f) => f.key === 'event_date_from');
    if (fromField) {
      fromField.value = this.selectedEventDateFrom;
    }
    const toField = this.searchFields.find((f) => f.key === 'event_date_to');
    if (toField) {
      toField.value = this.selectedEventDateTo;
    }
  }
}
