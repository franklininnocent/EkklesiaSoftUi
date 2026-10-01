import { CommonModule } from '@angular/common';
import { Component, DestroyRef, computed, inject, signal } from '@angular/core';
import { ActivatedRoute, Router, RouterModule } from '@angular/router';
import { AuthService } from '@core/services/auth.service';
import {
  ActiveFilter,
  AdvancedSearchPanelComponent,
  SearchField,
} from '@shared/components/advanced-search-panel/advanced-search-panel.component';
import { StatusBadgeComponent, StatusBadgeTone } from '@shared/components/status-badge/status-badge.component';
import { CfEmptyStateComponent } from '@shared/components/cf-empty-state/cf-empty-state.component';
import { LoadingSkeletonComponent } from '@shared/components/loading-skeleton/loading-skeleton.component';
import { PageHeaderComponent } from '@shared/components/page-header/page-header.component';
import { PaginationComponent } from '@shared/components/pagination/pagination.component';
import { DataTableComponent } from '@shared/components/data-table/data-table.component';
import { ListToolbarComponent } from '@shared/components/list-toolbar/list-toolbar.component';
import { AddMassModalComponent } from '../components/add-mass-modal.component';
import { MassCelebrationsViewNavComponent } from '../components/mass-celebrations-view-nav.component';
import { MassCelebrationSummary, MassIntentionsApiService } from '../services/mass-intentions-api.service';
import { formatMassDayTime } from '../utils/mass-celebration-display';
import { orderMassCelebrationsForList } from '../utils/mass-celebration-list-order.util';
import { canScheduleMasses } from '../utils/mass-intentions-auth.util';
import { defaultWeekSundayForMonth } from '../utils/mass-celebrations-nav.util';
import { currentCalendarMonthKey, massCalendarMonthBounds } from '../utils/mass-week.util';

type StatusFilterValue = '' | 'scheduled' | 'cancelled';

/** API max; one month of several daily Masses should fit one page. */
const LIST_PAGE_SIZE = 100;

@Component({
  selector: 'app-mass-celebrations-list-page',
  standalone: true,
  imports: [
    CommonModule,
    RouterModule,
    CfEmptyStateComponent,
    AddMassModalComponent,
    StatusBadgeComponent,
    LoadingSkeletonComponent,
    PaginationComponent,
    DataTableComponent,
    ListToolbarComponent,
    AdvancedSearchPanelComponent,
    MassCelebrationsViewNavComponent,
  ],
  templateUrl: './mass-celebrations-list.page.html',
  styleUrl: './mass-celebrations-list.page.scss',
})
export class MassCelebrationsListPageComponent {
  readonly pageSize = signal(LIST_PAGE_SIZE);

  private readonly api = inject(MassIntentionsApiService);
  private readonly auth = inject(AuthService);
  private readonly route = inject(ActivatedRoute);
  private readonly router = inject(Router);
  private readonly destroyRef = inject(DestroyRef);

  readonly loading = signal(true);
  readonly loaded = signal(false);
  readonly loadError = signal<string | null>(null);
  readonly showAddMass = signal(false);
  readonly items = signal<MassCelebrationSummary[]>([]);
  readonly needsTickFilter = signal(false);
  readonly currentPage = signal(1);
  readonly totalItems = signal(0);
  readonly registerEmpty = signal(false);
  readonly search = signal('');
  readonly statusFilter = signal<StatusFilterValue>('');
  readonly filterCelebratedOn = signal('');
  readonly showAdvancedSearch = signal(false);
  readonly listMonthKey = signal(currentCalendarMonthKey());
  readonly nextUpcomingCelebrationId = signal<string | null>(null);
  readonly parishNowIso = signal<string | null>(null);
  readonly parishTimezone = signal('UTC');

  readonly monthBounds = computed(() => massCalendarMonthBounds(this.listMonthKey()));

  /** Upcoming first (asc), past below (desc); next Mass pinned to row 1. */
  readonly displayItems = computed(() =>
    orderMassCelebrationsForList(
      this.items(),
      this.parishNowIso(),
      this.parishTimezone(),
      this.nextUpcomingCelebrationId()
    )
  );

  private nextMassStartTimer: ReturnType<typeof setTimeout> | null = null;
  private nextMassPollTimer: ReturnType<typeof setInterval> | null = null;

  searchFields: SearchField[] = [];

  canScheduleMass(): boolean {
    return canScheduleMasses(this.auth);
  }

  constructor() {
    this.initSearchFields();
    this.destroyRef.onDestroy(() => this.clearNextMassTimers());
    this.route.queryParamMap.subscribe((params) => {
      this.needsTickFilter.set(params.get('needs_tick') === '1');
      this.search.set(params.get('search') ?? '');
      this.statusFilter.set(this.parseStatusFromQuery(params.get('status'), params.has('status')));
      const celebratedOn = params.get('celebrated_on') ?? '';
      this.filterCelebratedOn.set(this.isIsoDate(celebratedOn) ? celebratedOn : '');
      this.currentPage.set(Math.max(1, Number(params.get('page') || 1) || 1));
      const monthParam = params.get('month');
      this.listMonthKey.set(
        monthParam && /^\d{4}-\d{2}$/.test(monthParam) ? monthParam : currentCalendarMonthKey()
      );
      this.syncSearchFieldValues();
      this.reload();
    });
  }

  weekAnchorSunday(): string {
    return defaultWeekSundayForMonth(this.monthBounds().monthKey);
  }

  drawerFilterCount(): number {
    let count = 0;
    if (this.search().trim()) {
      count += 1;
    }
    if (this.statusFilter()) {
      count += 1;
    }
    if (this.filterCelebratedOn()) {
      count += 1;
    }
    if (this.needsTickFilter()) {
      count += 1;
    }
    return count;
  }

  getActiveFilters(): ActiveFilter[] {
    const filters: ActiveFilter[] = [];
    const term = this.search().trim();
    if (term) {
      filters.push({ key: 'search', label: 'Search', value: term, displayValue: term });
    }
    const status = this.statusFilter();
    if (status === 'scheduled') {
      filters.push({ key: 'status', label: 'Status', value: status, displayValue: 'Scheduled' });
    } else if (status === 'cancelled') {
      filters.push({ key: 'status', label: 'Status', value: status, displayValue: 'Cancelled' });
    }
    const day = this.filterCelebratedOn();
    if (day) {
      filters.push({
        key: 'celebrated_on',
        label: 'Mass day',
        value: day,
        displayValue: formatMassDayTime(day, null),
      });
    }
    if (this.needsTickFilter()) {
      filters.push({
        key: 'needs_tick',
        label: 'View',
        value: '1',
        displayValue: 'Needs a tick',
      });
    }
    return filters;
  }

  isEmptyRegister(): boolean {
    return (
      this.registerEmpty() &&
      !this.search().trim() &&
      !this.statusFilter() &&
      !this.filterCelebratedOn() &&
      !this.needsTickFilter()
    );
  }

  resultsSummary(): string {
    const total = this.totalItems();
    const page = this.currentPage();
    const size = this.pageSize();
    if (total <= size) {
      return `${total} Mass${total === 1 ? '' : 'es'}`;
    }
    const from = (page - 1) * size + 1;
    const to = Math.min(page * size, total);
    return `Showing ${from}–${to} of ${total} Masses`;
  }

  openFilters(): void {
    this.syncSearchFieldValues();
    this.showAdvancedSearch.set(true);
  }

  onAdvancedSearch(values: Record<string, unknown>): void {
    const search = String(values['search'] ?? '').trim();
    const status = this.statusFromDrawerValue(String(values['status'] ?? 'all'));
    const rawDate = String(values['celebrated_on'] ?? '');
    const celebratedOn = this.isIsoDate(rawDate) ? rawDate : '';
    this.applyFiltersToRoute({ search, status, celebratedOn });
    this.showAdvancedSearch.set(false);
  }

  onClearAdvancedSearch(): void {
    this.applyFiltersToRoute({ search: '', status: '', celebratedOn: '', clearNeedsTick: true });
    this.showAdvancedSearch.set(false);
  }

  removeFilter(filter: ActiveFilter): void {
    if (filter.key === 'search') {
      this.applyFiltersToRoute({ search: '' });
      return;
    }
    if (filter.key === 'status') {
      this.applyFiltersToRoute({ status: '' });
      return;
    }
    if (filter.key === 'celebrated_on') {
      this.applyFiltersToRoute({ celebratedOn: '' });
      return;
    }
    if (filter.key === 'needs_tick') {
      this.applyFiltersToRoute({ clearNeedsTick: true });
    }
  }

  clearAllFilters(): void {
    void this.router.navigate([], {
      relativeTo: this.route,
      queryParams: {
        search: null,
        status: null,
        celebrated_on: null,
        needs_tick: null,
        page: null,
      },
      queryParamsHandling: 'merge',
      replaceUrl: true,
    });
  }

  dayTime(row: MassCelebrationSummary): string {
    return formatMassDayTime(row.celebrated_on, row.celebrated_at);
  }

  isNextUpcomingMass(row: MassCelebrationSummary): boolean {
    const nextId = this.nextUpcomingCelebrationId();
    return nextId !== null && row.id === nextId;
  }

  nextMassRowLabel(row: MassCelebrationSummary): string {
    return `Next Mass: ${this.dayTime(row)}`;
  }

  massStatusLabel(status?: string): string {
    if (status === 'cancelled') {
      return 'Cancelled';
    }
    if (status === 'scheduled') {
      return 'Scheduled';
    }
    return status ?? '—';
  }

  massStatusTone(status?: string): StatusBadgeTone {
    if (status === 'cancelled') {
      return 'neutral';
    }
    return 'info';
  }

  goToPage(page: number): void {
    void this.router.navigate([], {
      relativeTo: this.route,
      queryParams: { page: page > 1 ? page : null },
      queryParamsHandling: 'merge',
      replaceUrl: true,
    });
  }

  reload(): void {
    this.loading.set(true);
    this.loadError.set(null);
    const { from, to } = this.monthBounds();
    const params: Record<string, string | number> = {
      from,
      to,
      per_page: this.pageSize(),
      page: this.currentPage(),
    };
    if (this.needsTickFilter()) {
      params['needs_tick'] = 1;
    }
    const status = this.statusFilter();
    if (status) {
      params['status'] = status;
      if (status === 'cancelled') {
        params['include_cancelled'] = 1;
      }
    }
    const search = this.search().trim();
    if (search) {
      params['search'] = search;
    }
    if (this.filterCelebratedOn()) {
      params['celebrated_on'] = this.filterCelebratedOn();
    }
    this.api.listCelebrations(params).subscribe({
      next: (res) => {
        this.items.set(res.data ?? []);
        this.totalItems.set(res.total ?? this.items().length);
        if (res.current_page) {
          this.currentPage.set(res.current_page);
        }
        this.applyNextUpcomingMeta(res.meta);
        this.loading.set(false);
        this.loaded.set(true);
        if (
          !this.search().trim() &&
          !this.statusFilter() &&
          !this.filterCelebratedOn() &&
          !this.needsTickFilter() &&
          this.currentPage() === 1
        ) {
          this.registerEmpty.set((res.total ?? 0) === 0);
        }
      },
      error: () => {
        this.loading.set(false);
        this.loaded.set(true);
        this.loadError.set('Could not load Masses. Check your connection and try again.');
      },
    });
  }

  private applyNextUpcomingMeta(meta?: {
    next_upcoming_celebration_id?: string | null;
    next_upcoming_starts_at?: string | null;
    parish_timezone?: string | null;
    parish_now?: string | null;
  }): void {
    this.nextUpcomingCelebrationId.set(meta?.next_upcoming_celebration_id ?? null);
    this.parishTimezone.set(meta?.parish_timezone?.trim() || 'UTC');
    this.parishNowIso.set(meta?.parish_now ?? null);
    this.scheduleNextMassRefresh(meta?.next_upcoming_starts_at ?? null);
  }

  private scheduleNextMassRefresh(startsAt: string | null): void {
    this.clearNextMassTimers();
    if (!startsAt) {
      return;
    }
    const startMs = Date.parse(startsAt);
    if (!Number.isFinite(startMs)) {
      return;
    }
    const delay = startMs - Date.now();
    if (delay > 0 && delay < 48 * 60 * 60 * 1000) {
      this.nextMassStartTimer = setTimeout(() => this.reload(), delay + 750);
    }
    this.nextMassPollTimer = setInterval(() => this.reload(), 5 * 60 * 1000);
  }

  private clearNextMassTimers(): void {
    if (this.nextMassStartTimer !== null) {
      clearTimeout(this.nextMassStartTimer);
      this.nextMassStartTimer = null;
    }
    if (this.nextMassPollTimer !== null) {
      clearInterval(this.nextMassPollTimer);
      this.nextMassPollTimer = null;
    }
  }

  private applyFiltersToRoute(partial: {
    search?: string;
    status?: StatusFilterValue;
    celebratedOn?: string;
    clearNeedsTick?: boolean;
  }): void {
    const search = partial.search !== undefined ? partial.search : this.search().trim();
    const status = partial.status !== undefined ? partial.status : this.statusFilter();
    const celebratedOn =
      partial.celebratedOn !== undefined ? partial.celebratedOn : this.filterCelebratedOn();
    void this.router.navigate([], {
      relativeTo: this.route,
      queryParams: {
        search: search || null,
        status: status || null,
        celebrated_on: celebratedOn || null,
        needs_tick: partial.clearNeedsTick ? null : this.needsTickFilter() ? '1' : null,
        page: null,
      },
      queryParamsHandling: 'merge',
      replaceUrl: true,
    });
  }

  private parseStatusFromQuery(value: string | null, hasParam: boolean): StatusFilterValue {
    if (!hasParam || value === 'all' || value === '') {
      return '';
    }
    if (value === 'scheduled' || value === 'cancelled') {
      return value;
    }
    return '';
  }

  private statusFromDrawerValue(raw: string): StatusFilterValue {
    if (raw === 'scheduled' || raw === 'cancelled') {
      return raw;
    }
    return '';
  }

  private statusDrawerValue(): string {
    const status = this.statusFilter();
    return status || 'all';
  }

  private isIsoDate(value: string): boolean {
    return /^\d{4}-\d{2}-\d{2}$/.test(value);
  }

  private initSearchFields(): void {
    this.searchFields = [
      {
        key: 'search',
        label: 'Search',
        type: 'text',
        group: 'Find a Mass',
        placeholder: 'Place, priest, or keyword…',
        value: this.search().trim() || undefined,
      },
      {
        key: 'celebrated_on',
        label: 'Mass day',
        type: 'date',
        group: 'Refine',
        value: this.filterCelebratedOn() || undefined,
      },
      {
        key: 'status',
        label: 'Status',
        type: 'select',
        group: 'Refine',
        value: this.statusDrawerValue(),
        options: [
          { value: 'all', label: 'All statuses' },
          { value: 'scheduled', label: 'Scheduled' },
          { value: 'cancelled', label: 'Cancelled' },
        ],
      },
    ];
  }

  private syncSearchFieldValues(): void {
    this.searchFields = this.searchFields.map((field) => {
      if (field.key === 'search') {
        return { ...field, value: this.search().trim() || undefined };
      }
      if (field.key === 'celebrated_on') {
        return { ...field, value: this.filterCelebratedOn() || undefined };
      }
      if (field.key === 'status') {
        return { ...field, value: this.statusDrawerValue() };
      }
      return field;
    });
  }
}
