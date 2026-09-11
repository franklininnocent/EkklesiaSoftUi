import {
  ChangeDetectionStrategy,
  ChangeDetectorRef,
  Component,
  OnDestroy,
  OnInit,
  computed,
  inject,
  signal,
} from '@angular/core';
import { CommonModule } from '@angular/common';
import { HttpErrorResponse } from '@angular/common/http';
import { Subject, finalize, takeUntil } from 'rxjs';
import { PageHeaderComponent } from '@shared/components/page-header/page-header.component';
import { CfEmptyStateComponent } from '@shared/components/cf-empty-state/cf-empty-state.component';
import { SectionCardComponent } from '@shared/components/section-card/section-card.component';
import { TabStripComponent, TabStripItem } from '@shared/components/tab-strip/tab-strip.component';
import { ListToolbarComponent } from '@shared/components/list-toolbar/list-toolbar.component';
import { AdvancedSearchPanelComponent, SearchField } from '@shared/components/advanced-search-panel/advanced-search-panel.component';
import { DataTableComponent } from '@shared/components/data-table/data-table.component';
import { PaginationComponent } from '@shared/components/pagination/pagination.component';
import { LoadingSkeletonComponent } from '@shared/components/loading-skeleton/loading-skeleton.component';
import { StatusBadgeComponent } from '@shared/components/status-badge/status-badge.component';
import { AuthService } from '@core/services/auth.service';
import { ApplicationAccessInvestigationModalComponent } from '../components/application-access-investigation-modal/application-access-investigation-modal.component';
import { ApplicationAccessLiveFeedComponent } from '../components/application-access-live-feed/application-access-live-feed.component';
import { ToastService } from '@core/services/toast.service';
import { ApplicationAccessApiService } from '../services/application-access-api.service';
import { ApplicationAccessStreamService } from '../services/application-access-stream.service';
import {
  ApplicationAccessDashboard,
  ApplicationAccessDashboardKpis,
  ApplicationAccessEvent,
  ApplicationAccessSession,
} from '../models/application-access.model';
import {
  ApplicationAccessFilterState,
  ApplicationAccessGridTab,
  EMPTY_APPLICATION_ACCESS_FILTERS,
  buildApplicationAccessListParams,
  countActiveApplicationAccessFilters,
} from '../utils/application-access-filters.util';
import {
  authorizationResultLabel,
  authorizationResultTone,
  contextLabel,
  identityLabel,
  riskTone,
  sessionStatusLabel,
  sessionStatusTone,
} from '../utils/application-access-labels.util';

interface KpiTile {
  key: keyof ApplicationAccessDashboardKpis;
  label: string;
}

@Component({
  selector: 'app-application-access-page',
  standalone: true,
  imports: [
    CommonModule,
    PageHeaderComponent,
    CfEmptyStateComponent,
    SectionCardComponent,
    TabStripComponent,
    ListToolbarComponent,
    AdvancedSearchPanelComponent,
    DataTableComponent,
    PaginationComponent,
    LoadingSkeletonComponent,
    StatusBadgeComponent,
    ApplicationAccessInvestigationModalComponent,
    ApplicationAccessLiveFeedComponent,
  ],
  templateUrl: './application-access.page.html',
  styleUrl: './application-access.page.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class ApplicationAccessPage implements OnInit, OnDestroy {
  private readonly api = inject(ApplicationAccessApiService);
  private readonly auth = inject(AuthService);
  private readonly stream = inject(ApplicationAccessStreamService);
  private readonly toast = inject(ToastService);
  private readonly cdr = inject(ChangeDetectorRef);
  private readonly destroy$ = new Subject<void>();

  readonly canView = this.auth.canAccessApplicationAccess();
  readonly canExport = this.auth.hasPermission('application_access.export') || this.auth.isSuperAdmin();

  readonly kpiTiles: KpiTile[] = [
    { key: 'active_sessions', label: 'Signed in now' },
    { key: 'failed_sign_ins_15m', label: 'Failed sign-ins (15m)' },
    { key: 'blocked_attempts_15m', label: 'Blocked attempts (15m)' },
    { key: 'support_sessions', label: 'Support sessions' },
    { key: 'needs_attention_15m', label: 'Needs attention' },
  ];

  readonly tabs: TabStripItem[] = [
    { id: 'sessions', label: 'Sessions', domId: 'aa-tab-sessions', ariaControls: 'aa-panel-sessions' },
    { id: 'events', label: 'Activity', domId: 'aa-tab-events', ariaControls: 'aa-panel-events' },
  ];

  readonly dashboardLoading = signal(true);
  readonly dashboardError = signal<string | null>(null);
  readonly dashboard = signal<ApplicationAccessDashboard | null>(null);

  readonly activeTab = signal<ApplicationAccessGridTab>('sessions');
  readonly sessions = signal<ApplicationAccessSession[]>([]);
  readonly events = signal<ApplicationAccessEvent[]>([]);
  readonly gridLoading = signal(false);
  readonly gridLoaded = signal(false);
  readonly gridError = signal<string | null>(null);
  readonly total = signal(0);
  readonly page = signal(1);
  readonly perPage = signal(25);
  readonly searchTerm = signal('');
  readonly showFilters = signal(false);
  readonly filters = signal<ApplicationAccessFilterState>({ ...EMPTY_APPLICATION_ACCESS_FILTERS });
  readonly investigationSessionId = signal<string | null>(null);
  readonly exporting = signal(false);

  readonly filterCount = computed(() =>
    countActiveApplicationAccessFilters(this.filters(), this.activeTab())
  );

  searchFields: SearchField[] = [];

  ngOnInit(): void {
    if (!this.canView) {
      return;
    }

    this.initSearchFields();
    this.loadDashboard();
    this.loadGrid();
    this.stream.connect();
  }

  ngOnDestroy(): void {
    this.stream.disconnect();
    this.destroy$.next();
    this.destroy$.complete();
  }

  metricValue(kpis: ApplicationAccessDashboardKpis, key: keyof ApplicationAccessDashboardKpis): string {
    const value = kpis[key];
    return value === null || value === undefined ? '—' : String(value);
  }

  needsAttention(kpis: ApplicationAccessDashboardKpis | null | undefined): number {
    return kpis?.needs_attention_15m ?? 0;
  }

  onTabChange(tabId: string): void {
    if (tabId !== 'sessions' && tabId !== 'events') {
      return;
    }

    this.activeTab.set(tabId);
    this.page.set(1);
    this.searchTerm.set('');
    this.filters.set({ ...EMPTY_APPLICATION_ACCESS_FILTERS });
    this.initSearchFields();
    this.loadGrid();
  }

  onSearchChange(value: string): void {
    this.searchTerm.set(value);
    this.filters.update((current) => ({ ...current, q: value }));
    this.page.set(1);
    this.loadGrid();
  }

  openFilters(): void {
    this.syncSearchFieldValues();
    this.showFilters.set(true);
    this.cdr.markForCheck();
  }

  onAdvancedSearch(values: Record<string, unknown>): void {
    this.filters.update((current) => ({
      ...current,
      status: String(values['status'] ?? ''),
      identity_type: String(values['identity_type'] ?? ''),
      access_context: String(values['access_context'] ?? ''),
      ip_address: String(values['ip_address'] ?? ''),
      event_type: String(values['event_type'] ?? ''),
      authorization_result: String(values['authorization_result'] ?? ''),
      started_from: String(values['started_from'] ?? ''),
      started_to: String(values['started_to'] ?? ''),
    }));
    this.page.set(1);
    this.showFilters.set(false);
    this.loadGrid();
  }

  onClearAdvancedSearch(): void {
    this.filters.update((current) => ({
      ...current,
      status: '',
      identity_type: '',
      access_context: '',
      ip_address: '',
      event_type: '',
      authorization_result: '',
      started_from: '',
      started_to: '',
    }));
    this.syncSearchFieldValues();
    this.page.set(1);
    this.loadGrid();
  }

  onPageChange(nextPage: number): void {
    this.page.set(nextPage);
    this.loadGrid();
  }

  onPageSizeChange(nextSize: number): void {
    this.perPage.set(nextSize);
    this.page.set(1);
    this.loadGrid();
  }

  reviewAttentionEvents(): void {
    this.onTabChange('events');
    this.filters.update((current) => ({ ...current, authorization_result: 'denied' }));
    this.syncSearchFieldValues();
    this.page.set(1);
    this.loadGrid();
  }

  sessionIdentity(session: ApplicationAccessSession): string {
    return session.user?.name || session.user?.email || identityLabel(session.identity_type);
  }

  sessionTenant(session: ApplicationAccessSession): string {
    const tenantId = session.tenant_id ?? session.user?.tenant_id;
    return tenantId ? `Parish #${tenantId}` : 'Platform';
  }

  sessionLocation(session: ApplicationAccessSession): string {
    const parts = [session.city, session.country].filter(Boolean);
    return parts.length ? parts.join(', ') : '—';
  }

  eventSummary(event: ApplicationAccessEvent): string {
    const route = event.normalized_route || event.route_name || '—';
    return `${event.event_type} · ${route}`;
  }

  openInvestigation(session: ApplicationAccessSession): void {
    this.investigationSessionId.set(session.id);
    this.cdr.markForCheck();
  }

  openInvestigationFromEvent(event: ApplicationAccessEvent): void {
    if (!event.access_session_id) {
      return;
    }

    this.investigationSessionId.set(event.access_session_id);
    this.cdr.markForCheck();
  }

  closeInvestigation(): void {
    this.investigationSessionId.set(null);
    this.cdr.markForCheck();
  }

  onInvestigationSessionUpdated(session: ApplicationAccessSession): void {
    this.sessions.update((rows) => rows.map((row) => (row.id === session.id ? session : row)));
    this.loadDashboard();
    this.cdr.markForCheck();
  }

  exportSessions(): void {
    if (!this.canExport || this.activeTab() !== 'sessions') {
      return;
    }

    this.exporting.set(true);
    const params = buildApplicationAccessListParams(
      'sessions',
      { ...this.filters(), q: this.searchTerm() },
      1,
      5000
    );

    this.api
      .exportSessions(params)
      .pipe(
        finalize(() => {
          this.exporting.set(false);
          this.cdr.markForCheck();
        }),
        takeUntil(this.destroy$)
      )
      .subscribe({
        next: (blob) => {
          const url = URL.createObjectURL(blob);
          const anchor = document.createElement('a');
          anchor.href = url;
          anchor.download = 'application-access-sessions.csv';
          anchor.click();
          URL.revokeObjectURL(url);
          this.toast.success('Session export started.');
        },
        error: (error: HttpErrorResponse) => {
          this.toast.error(this.readError(error, 'Could not export sessions.'));
        },
      });
  }

  retryDashboard(): void {
    this.loadDashboard();
  }

  retryGrid(): void {
    this.loadGrid();
  }

  identityLabel = identityLabel;
  contextLabel = contextLabel;
  sessionStatusLabel = sessionStatusLabel;
  sessionStatusTone = sessionStatusTone;
  riskTone = riskTone;
  authorizationResultLabel = authorizationResultLabel;
  authorizationResultTone = authorizationResultTone;

  private loadDashboard(): void {
    this.dashboardLoading.set(true);
    this.dashboardError.set(null);

    this.api
      .getDashboard()
      .pipe(
        finalize(() => {
          this.dashboardLoading.set(false);
          this.cdr.markForCheck();
        }),
        takeUntil(this.destroy$)
      )
      .subscribe({
        next: (dashboard) => this.dashboard.set(dashboard),
        error: (error: HttpErrorResponse) => {
          this.dashboardError.set(this.readError(error, 'Could not load dashboard metrics.'));
        },
      });
  }

  private loadGrid(): void {
    this.gridLoading.set(true);
    this.gridError.set(null);

    const params = buildApplicationAccessListParams(
      this.activeTab(),
      { ...this.filters(), q: this.searchTerm() },
      this.page(),
      this.perPage()
    );

    const onComplete = (): void => {
      this.gridLoading.set(false);
      this.gridLoaded.set(true);
      this.cdr.markForCheck();
    };

    if (this.activeTab() === 'sessions') {
      this.api
        .listSessions(params)
        .pipe(finalize(onComplete), takeUntil(this.destroy$))
        .subscribe({
          next: (response) => {
            this.sessions.set(response.data);
            this.total.set(response.meta?.total ?? response.data.length);
          },
          error: (error: HttpErrorResponse) => {
            this.gridError.set(this.readError(error, 'Could not load activity.'));
          },
        });
      return;
    }

    this.api
      .listEvents(params)
      .pipe(finalize(onComplete), takeUntil(this.destroy$))
      .subscribe({
        next: (response) => {
          this.events.set(response.data);
          this.total.set(response.meta?.total ?? response.data.length);
        },
        error: (error: HttpErrorResponse) => {
          this.gridError.set(this.readError(error, 'Could not load activity.'));
        },
      });
  }

  private initSearchFields(): void {
    const filters = this.filters();

    if (this.activeTab() === 'sessions') {
      this.searchFields = [
        {
          key: 'status',
          label: 'Session status',
          type: 'select',
          group: 'Session',
          value: filters.status,
          options: [
            { value: '', label: 'Any status' },
            { value: 'ACTIVE', label: 'Signed in' },
            { value: 'IDLE', label: 'Idle' },
            { value: 'ENDED', label: 'Signed out' },
            { value: 'EXPIRED', label: 'Expired' },
            { value: 'REVOKED', label: 'Revoked' },
          ],
        },
        {
          key: 'identity_type',
          label: 'Identity',
          type: 'select',
          group: 'Session',
          value: filters.identity_type,
          options: [
            { value: '', label: 'Any identity' },
            { value: 'EKKLESIA_USER', label: 'Ekklesia user' },
            { value: 'AUTHENTICATED_TENANT_USER', label: 'Parish user' },
            { value: 'SUPPORT_OPERATOR', label: 'Support operator' },
            { value: 'SUPER_ADMIN', label: 'Super Admin' },
            { value: 'ANONYMOUS_VISITOR', label: 'Visitor' },
          ],
        },
        {
          key: 'access_context',
          label: 'Area',
          type: 'select',
          group: 'Session',
          value: filters.access_context,
          options: [
            { value: '', label: 'Any area' },
            { value: 'EKKLESIA', label: 'Ekklesia' },
            { value: 'TENANT', label: 'Parish' },
            { value: 'SUPPORT', label: 'Support' },
            { value: 'AUTHENTICATION', label: 'Sign-in' },
            { value: 'API', label: 'API' },
          ],
        },
        {
          key: 'ip_address',
          label: 'IP address',
          type: 'text',
          group: 'Network',
          value: filters.ip_address,
          placeholder: '203.0.113.10',
        },
        {
          key: 'started_from',
          label: 'From date',
          type: 'date',
          group: 'Time',
          value: filters.started_from,
        },
        {
          key: 'started_to',
          label: 'To date',
          type: 'date',
          group: 'Time',
          value: filters.started_to,
        },
      ];
      return;
    }

    this.searchFields = [
      {
        key: 'event_type',
        label: 'Activity type',
        type: 'select',
        group: 'Activity',
        value: filters.event_type,
        options: [
          { value: '', label: 'Any activity' },
          { value: 'VIEW', label: 'View' },
          { value: 'LOGIN', label: 'Sign-in' },
          { value: 'LOGOUT', label: 'Sign-out' },
          { value: 'ACCESS_DENIED', label: 'Access denied' },
          { value: 'AUTH_FAILURE', label: 'Auth failure' },
        ],
      },
      {
        key: 'authorization_result',
        label: 'Result',
        type: 'select',
        group: 'Activity',
        value: filters.authorization_result,
        options: [
          { value: '', label: 'Any result' },
          { value: 'allowed', label: 'Allowed' },
          { value: 'denied', label: 'Blocked' },
        ],
      },
      {
        key: 'ip_address',
        label: 'IP address',
        type: 'text',
        group: 'Network',
        value: filters.ip_address,
      },
      {
        key: 'started_from',
        label: 'From date',
        type: 'date',
        group: 'Time',
        value: filters.started_from,
      },
      {
        key: 'started_to',
        label: 'To date',
        type: 'date',
        group: 'Time',
        value: filters.started_to,
      },
    ];
  }

  private syncSearchFieldValues(): void {
    const filters = this.filters();
    this.searchFields = this.searchFields.map((field) => ({
      ...field,
      value: filters[field.key as keyof ApplicationAccessFilterState] ?? '',
    }));
  }

  private readError(error: HttpErrorResponse, fallback: string): string {
    return error.error?.message || error.message || fallback;
  }
}
