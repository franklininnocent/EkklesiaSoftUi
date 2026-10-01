/**
 * Dashboard version 3.0 — executive Overview (single API) + Operations tab.
 * Restore Version 2.0 from: ./v2.0/ (see v2.0/VERSION.md). Version 1.0: ./v1.0/.
 */
import { Component, inject, OnInit, OnDestroy, ChangeDetectionStrategy, ChangeDetectorRef } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { Router } from '@angular/router';
import { Store } from '@ngrx/store';
import { Observable, Subject, of } from 'rxjs';
import { catchError, distinctUntilChanged, filter, map, switchMap, take, takeUntil } from 'rxjs/operators';

import { AppState } from '@core/store';
import { User } from '@core/models';
import { FamilyStatistics } from '@core/models/family.model';
import { selectCurrentUser } from '@core/store/auth/auth.selectors';
import { FamilyService } from '@core/services/family.service';
import { AuthService } from '@core/services/auth.service';
import { DonationsService } from '@features/donations/services/donations.service';
import { OperationsDashboardSummary } from '@features/donations/models/donation.model';
import { TenantService } from '@core/services/tenant.service';
import { TenantStatisticsResponse } from '@core/models/tenant.model';
import { SupportSessionService } from '@features/support-center/services/support-session.service';
import { cfFormatDate,  cfFormatMoney } from '@shared/utils/cf-intl.util';
import { PastoralCareService } from '@features/pastoral-care/services/pastoral-care.service';
import { CfDatePipe } from '@shared/pipes/cf-date.pipe';
import {
  PastoralCareAlert,
  PastoralCareRequest,
  PastoralCareStaff,
} from '@features/pastoral-care/models/pastoral-care.model';
import { ExecutiveDashboardService } from './services/executive-dashboard.service';
import {
  ExecBlock,
  ExecMetric,
  ExecutiveDashboardPayload,
  ExecutiveCelebrationsData,
  ExecutiveSectionState,
  ExecutiveStewardshipData,
} from './models/executive-dashboard.model';
import { MemberAgeDistributionChartComponent } from '@features/members/components/member-age-distribution-chart/member-age-distribution-chart.component';
import { ExecutiveDueScheduleChartComponent } from './components/executive-due-schedule-chart.component';
import { memberAgeChartSlices } from '@features/members/utils/member-age-groups.util';
import { MemberAgeChartSlice, MemberDashboardSummary } from '@features/members/models/member-dashboard.model';
import { QuickCollectService } from '@features/donations/services/quick-collect.service';
import { CfBrandLoaderComponent } from '@shared/components/cf-brand-loader/cf-brand-loader.component';
import {
  attentionLabel,
  FinancialSnapshotLink,
  navigateExecutiveDrilldown,
  navigateFinancialSnapshot,
  quickActionLabel,
} from './utils/dashboard-drilldown.util';

export type DashboardTab = 'overview' | 'operations';

interface HeroKpi {
  id: string;
  label: string;
  value: string;
  sublabel: string;
  change: string;
  trend: 'up' | 'down' | 'neutral';
  accent: 'forest' | 'indigo' | 'amber' | 'slate';
  sparkline: number[];
}

export type FinancialHubState = 'unauthorized' | 'loading' | 'ready' | 'error';
export type DataLoadState = 'idle' | 'loading' | 'ready' | 'error';

interface GivingChannelRow {
  channel: string;
  amount: string;
  share: number;
}

const PAYMENT_METHOD_LABELS: Record<string, string> = {
  cash: 'Cash',
  bank_transfer: 'Bank transfer',
  cheque: 'Cheque',
  online_placeholder: 'Online',
  adjustment: 'Adjustment',
};

@Component({
  selector: 'app-dashboard',
  standalone: true,
  imports: [
    CfDatePipe,
    CommonModule,
    FormsModule,
    MemberAgeDistributionChartComponent,
    ExecutiveDueScheduleChartComponent,
    CfBrandLoaderComponent,
  ],
  templateUrl: './dashboard.component.html',
  styleUrl: './dashboard.component.scss',
  changeDetection: ChangeDetectionStrategy.OnPush
})
export class DashboardComponent implements OnInit, OnDestroy {
  private store = inject(Store<AppState>);
  private familyService = inject(FamilyService);
  private authService = inject(AuthService);
  private supportSessions = inject(SupportSessionService);
  private donationsService = inject(DonationsService);
  private pastoralCare = inject(PastoralCareService);
  private tenantService = inject(TenantService);
  private router = inject(Router);
  private cdr = inject(ChangeDetectorRef);
  private executiveDashboard = inject(ExecutiveDashboardService);
  private quickCollect = inject(QuickCollectService);
  private destroy$ = new Subject<void>();

  tenantExecutiveMode = false;
  executive: ExecutiveDashboardPayload | null = null;
  executiveLoadState: DataLoadState = 'idle';
  private cachedExecutiveBlocks: ExecBlock[] = [];
  private cachedExecutiveColumns: ExecBlock[][] = [[], []];

  currentUser$: Observable<User | null>;
  today = new Date();

  heroKpis: HeroKpi[] = [];
  registryState: DataLoadState = 'idle';
  platformStatsState: DataLoadState = 'idle';
  platformStats: TenantStatisticsResponse['data'] | null = null;
  private platformStatsUserId: number | null = null;
  familyStats: FamilyStatistics | null = null;
  activeFamilies = 0;
  activeMembers = 0;
  membersCreatedThisMonth = 0;

  careAlerts: PastoralCareAlert[] = [];
  pastoralTasks: PastoralCareRequest[] = [];
  pastoralStaff: PastoralCareStaff[] = [];
  assigningTaskId: string | null = null;
  selectedAssigneeId: number | null = null;
  assigningBusy = false;
  canViewPastoral = false;
  canAssignPastoral = false;
  pastoralLoaded = false;
  loadingPastoral = false;
  pastoralError = false;

  financialHubState: FinancialHubState = 'unauthorized';
  operationsSummary: OperationsDashboardSummary | null = null;
  loadingFinancial = false;

  totalBCCs = 0;
  totalMembers = 0;
  totalFamilies = 0;

  canViewFinancial = false;

  private readonly financialLoad$ = new Subject<void>();

  /** Dashboard v2.0 tab state — default Overview. */
  activeTab: DashboardTab = 'overview';
  /** True after Operations is opened once; keeps panel mounted for the session. */
  operationsVisited = false;
  readonly dashboardTabs: DashboardTab[] = ['overview', 'operations'];
  readonly dashboardTabLabels: Record<DashboardTab, string> = {
    overview: 'Overview',
    operations: 'Operations',
  };
  readonly dashboardTabHints: Record<DashboardTab, string> = {
    overview: 'Parish summary',
    operations: 'Follow-up work',
  };

  constructor() {
    this.currentUser$ = this.store.select(selectCurrentUser);
  }

  ngOnInit(): void {
    this.setupFinancialHubLoader();

    this.supportSessions.session$
      .pipe(
        map((session) => session?.id ?? null),
        distinctUntilChanged(),
        filter((id) => id !== null),
        takeUntil(this.destroy$)
      )
      .subscribe(() => {
        this.store.select(selectCurrentUser).pipe(take(1)).subscribe((user) => {
          this.refreshDashboardAccess(user);
        });
      });

    // Wait for auth user (post-login store is briefly null until loadUserSuccess).
    // Keep listening so late user hydration still triggers data loads without refresh.
    this.store
      .select(selectCurrentUser)
      .pipe(
        distinctUntilChanged(
          (a, b) => a?.id === b?.id && a?.tenant_id === b?.tenant_id
        ),
        takeUntil(this.destroy$)
      )
      .subscribe((user) => {
        // Wait for hydrated user — a null emission must not wipe in-flight/loaded dashboard data.
        if (!user) {
          return;
        }
        this.refreshDashboardAccess(user);
        this.cdr.markForCheck();
      });
  }

  private refreshDashboardAccess(user: User | null): void {
    const isTenantActor = !!user?.tenant_id && !this.authService.isPlatformActor(user);
    const hasActiveSupportSession = !!user && this.authService.isPlatformActor(user) && !!this.supportSessions.sessionId;
    const hasTenantContext = !!user?.tenant_id || hasActiveSupportSession;

    this.tenantExecutiveMode = hasTenantContext;

    if (hasTenantContext) {
      this.platformStats = null;
      this.platformStatsState = 'idle';
      this.platformStatsUserId = null;
      this.loadExecutiveDashboard();
    } else if (user && this.authService.canManageTenants(user)) {
      this.registryState = 'idle';
      this.loadPlatformStatistics(user.id);
    } else {
      this.platformStats = null;
      this.platformStatsState = 'idle';
      this.platformStatsUserId = null;
      this.registryState = 'idle';
      this.rebuildHeroKpis();
    }

    this.canViewFinancial = hasTenantContext && this.authService.canAccessDonations(user, { hasActiveSupportSession });
    if (this.canViewFinancial && this.operationsVisited) {
      this.loadOperationsDashboard();
    } else if (!this.canViewFinancial) {
      this.financialHubState = 'unauthorized';
      this.operationsSummary = null;
      this.loadingFinancial = false;
      this.rebuildHeroKpis();
    }
    this.canViewPastoral = isTenantActor && this.authService.canAccessPastoral(user);
    this.canAssignPastoral = this.authService.hasPermission('pastoral.care.assign');
    if (this.operationsVisited) {
      this.loadOperationsScopedData();
    }
    this.cdr.markForCheck();
  }

  ngOnDestroy(): void {
    this.destroy$.next();
    this.destroy$.complete();
  }

  selectTab(tab: DashboardTab): void {
    if (this.activeTab === tab) {
      return;
    }
    this.activeTab = tab;
    if (tab === 'operations') {
      this.operationsVisited = true;
      if (this.canViewFinancial) {
        this.loadOperationsDashboard();
      }
      this.ensureOperationsDataLoaded();
    }
    this.cdr.markForCheck();
  }

  onDashboardTabKeydown(event: KeyboardEvent): void {
    const key = event.key;
    if (key !== 'ArrowLeft' && key !== 'ArrowRight' && key !== 'Home' && key !== 'End') {
      return;
    }

    event.preventDefault();
    const tabs = this.dashboardTabs;
    const currentIndex = tabs.indexOf(this.activeTab);
    let nextIndex = currentIndex;

    if (key === 'ArrowLeft') {
      nextIndex = currentIndex <= 0 ? tabs.length - 1 : currentIndex - 1;
    } else if (key === 'ArrowRight') {
      nextIndex = currentIndex >= tabs.length - 1 ? 0 : currentIndex + 1;
    } else if (key === 'Home') {
      nextIndex = 0;
    } else {
      nextIndex = tabs.length - 1;
    }

    const nextTab = tabs[nextIndex];
    this.selectTab(nextTab);
    queueMicrotask(() => {
      document.getElementById(this.dashboardTabId(nextTab))?.focus();
    });
  }

  /** Fetch Operations-only APIs when needed; skip payloads already cached this session. */
  private ensureOperationsDataLoaded(): void {
    this.loadOperationsScopedData();
  }

  private loadOperationsScopedData(): void {
    if (this.canViewPastoral && !this.pastoralLoaded && !this.loadingPastoral) {
      this.loadPastoralWorkflow();
    }
  }

  retryPastoralWorkflow(): void {
    this.pastoralLoaded = false;
    this.loadPastoralWorkflow();
  }

  dashboardTabId(tab: DashboardTab): string {
    return `cd-dashboard-tab-${tab}`;
  }

  dashboardPanelId(tab: DashboardTab): string {
    return `cd-dashboard-panel-${tab}`;
  }

  loadFamilyStatistics(): void {
    this.registryState = 'loading';
    this.rebuildHeroKpis();
    this.cdr.markForCheck();

    this.familyService.getStatistics()
      .pipe(takeUntil(this.destroy$))
      .subscribe({
        next: (response) => {
          if (response.success && response.data) {
            this.familyStats = response.data;
            this.totalFamilies = response.data.total_families ?? 0;
            this.totalMembers = response.data.total_members ?? 0;
            this.activeFamilies = response.data.active_families ?? 0;
            this.activeMembers = response.data.active_members ?? 0;
            this.membersCreatedThisMonth = response.data.members_created_this_month ?? 0;
            this.registryState = 'ready';
          } else {
            this.registryState = 'error';
          }
          this.rebuildHeroKpis();
          this.cdr.markForCheck();
        },
        error: (err) => {
          this.registryState = 'error';
          this.rebuildHeroKpis();
          this.cdr.markForCheck();
        }
      });
  }

  retryRegistry(): void {
    if (this.tenantExecutiveMode) {
      this.loadExecutiveDashboard();
      return;
    }
    this.loadFamilyStatistics();
  }

  retryExecutiveDashboard(): void {
    this.loadExecutiveDashboard();
  }

  loadExecutiveDashboard(): void {
    this.executiveLoadState = 'loading';
    this.registryState = 'loading';
    this.executive = null;
    this.cachedExecutiveBlocks = [];
    this.cachedExecutiveColumns = [[], []];
    this.cdr.markForCheck();

    this.executiveDashboard
      .getExecutive()
      .pipe(takeUntil(this.destroy$))
      .subscribe({
        next: (data) => {
          this.executive = data;
          this.executiveLoadState = 'ready';
          const snapState = data.snapshot?.state;
          if (snapState === 'error') {
            this.registryState = 'error';
          } else if (snapState === 'forbidden') {
            this.registryState = 'idle';
          } else {
            this.registryState = 'ready';
            this.syncRegistryFromExecutive(data);
          }
          this.rebuildExecutiveBlocksCache();
          this.cdr.markForCheck();
        },
        error: () => {
          this.executiveLoadState = 'error';
          this.registryState = 'error';
          this.cachedExecutiveBlocks = [];
          this.cachedExecutiveColumns = [[], []];
          this.cdr.markForCheck();
        },
      });
  }

  private syncRegistryFromExecutive(payload: ExecutiveDashboardPayload): void {
    const cards = payload.snapshot?.data?.cards as Record<string, Record<string, number>> | undefined;
    if (!cards) {
      return;
    }
    const families = cards['families'];
    if (families && families['total_families'] !== undefined) {
      this.totalFamilies = families['total_families'];
      this.activeFamilies = families['active_families'] ?? 0;
    }
    const members = cards['members'];
    if (members && members['total_members'] !== undefined) {
      this.totalMembers = members['total_members'];
      this.activeMembers = members['active_members'] ?? 0;
      this.membersCreatedThisMonth = members['members_added_this_month'] ?? 0;
    }
    const lifeGroups = cards['life_groups'];
    if (lifeGroups && lifeGroups['active_bccs'] !== undefined) {
      this.totalBCCs = lifeGroups['active_bccs'];
    }
  }

  executiveBlocks(): ExecBlock[] {
    return this.cachedExecutiveBlocks;
  }

  private rebuildExecutiveBlocksCache(): void {
    if (this.executiveLoadState !== 'ready' || !this.executive) {
      this.cachedExecutiveBlocks = [];
      this.cachedExecutiveColumns = [[], []];
      return;
    }

    const blocks: ExecBlock[] = [];
    this.pushPeopleBlock(blocks);
    this.pushFinanceBlock(blocks);
    this.pushCommunityBlock(blocks);
    this.pushMinistryBlock(blocks);
    this.pushSacramentsBlock(blocks);
    this.pushMassIntentionsBlock(blocks);
    this.pushWorshipBlock(blocks);
    this.pushPastoralBlock(blocks);
    this.cachedExecutiveBlocks = blocks;
    this.cachedExecutiveColumns = this.buildExecutiveColumns(blocks);
  }

  executiveColumns(): ExecBlock[][] {
    return this.cachedExecutiveColumns;
  }

  private buildExecutiveColumns(blocks: ExecBlock[]): ExecBlock[][] {
    const columns: ExecBlock[][] = [[], []];
    const occupied = new Set<string>();
    const columnCount = 2;
    let cursor = 0;

    const finance = blocks.find((block) => block.key === 'finance');
    if (finance) {
      columns[1].push(finance);
      occupied.add('0,1');
    }

    const pastoral = blocks.find((block) => block.key === 'pastoral');

    for (const block of blocks) {
      if (block.key === 'finance' || block.key === 'pastoral') {
        continue;
      }
      while (occupied.has(`${Math.floor(cursor / columnCount)},${cursor % columnCount}`)) {
        cursor += 1;
      }
      const row = Math.floor(cursor / columnCount);
      const column = cursor % columnCount;
      occupied.add(`${row},${column}`);
      columns[column].push(block);
      cursor += 1;
    }

    if (pastoral) {
      columns[0].push(pastoral);
    }

    return columns;
  }

  metricToneClass(metric: ExecMetric): string {
    return metric.tone ? `cd-financial-metric--${metric.tone}` : '';
  }

  openExecMetric(metric: ExecMetric): void {
    if (metric.financialLink) {
      this.openFinancialSnapshot(metric.financialLink);
      return;
    }
    if (metric.route) {
      void this.router.navigate([metric.route], metric.query ? { queryParams: metric.query } : undefined);
      return;
    }
    if (metric.drilldown) {
      this.openExecutiveDrilldown(metric.drilldown);
    }
  }

  executiveSnapshotCards(): Record<string, Record<string, unknown>> {
    return (this.executive?.snapshot?.data?.cards ?? {}) as Record<string, Record<string, unknown>>;
  }

  executiveSectionState(section: keyof ExecutiveDashboardPayload): ExecutiveSectionState | 'loading' {
    if (this.executiveLoadState === 'loading' || this.executiveLoadState === 'idle') {
      return 'loading';
    }
    if (this.executiveLoadState === 'error' || !this.executive) {
      return 'error';
    }
    return this.executive[section]?.state ?? 'error';
  }

  openExecutiveDrilldown(key: string): void {
    navigateExecutiveDrilldown(this.router, this.quickCollect, key, () => {
      this.selectTab('operations');
    });
  }

  executiveAttentionLabel(key: string, count: number): string {
    return attentionLabel(key, count);
  }

  executiveQuickActionLabel(key: string): string {
    return quickActionLabel(key);
  }

  formatExecutiveDateTime(iso: string | null | undefined): string {
    if (!iso) {
      return '—';
    }
    const date = new Date(iso);
    if (Number.isNaN(date.getTime())) {
      return '—';
    }
    return cfFormatDate(date, 'datetime') || '—';
  }

  snapshotMetric(card: Record<string, unknown>, field: string): number {
    return Number(card[field] ?? 0);
  }

  snapshotText(card: Record<string, unknown>, field: string): string {
    const value = card[field];
    return value === null || value === undefined ? '' : String(value);
  }

  financialSnapshot(): ExecutiveStewardshipData | null {
    if (this.executiveSectionState('stewardship') !== 'ready') {
      return null;
    }
    return this.executive?.stewardship?.data ?? null;
  }

  openFinancialSnapshot(link: FinancialSnapshotLink): void {
    const snapshot = this.financialSnapshot();
    if (!snapshot) {
      return;
    }
    navigateFinancialSnapshot(this.router, link, snapshot);
  }

  financialGrowthLabel(snapshot: ExecutiveStewardshipData): string {
    const range = this.financialDateRange(snapshot.comparison_start, snapshot.comparison_end);
    if (snapshot.growth_pct === null || snapshot.growth_pct === undefined) {
      return range ? `No comparable period last month (${range})` : 'No comparable period last month';
    }
    const word = snapshot.growth_pct > 0 ? 'Up' : snapshot.growth_pct < 0 ? 'Down' : 'Flat';
    const change = `${word} ${Math.abs(snapshot.growth_pct)}%`;
    return range ? `${change} versus ${range}` : change;
  }

  financialGrowthDirection(snapshot: ExecutiveStewardshipData): 'up' | 'down' | 'flat' | 'none' {
    if (snapshot.growth_pct === null || snapshot.growth_pct === undefined) {
      return 'none';
    }
    if (snapshot.growth_pct > 0) {
      return 'up';
    }
    if (snapshot.growth_pct < 0) {
      return 'down';
    }
    return 'flat';
  }

  financialComparisonHint(snapshot: ExecutiveStewardshipData): string {
    return this.financialDateRange(snapshot.comparison_start, snapshot.comparison_end);
  }

  financialFamilyCount(count: number): string {
    return count === 1 ? '1 family' : `${count} families`;
  }

  financialAsOfLabel(snapshot: ExecutiveStewardshipData): string {
    const asOf = cfFormatDate(snapshot.as_of, 'date');
    const year = snapshot.financial_year ? ` · Fiscal year ${snapshot.financial_year}` : '';
    return asOf ? `As of ${asOf}${year}` : year.replace(/^ · /, '');
  }

  private financialDateRange(start: string, end: string): string {
    const startLabel = cfFormatDate(start, 'date');
    const endLabel = cfFormatDate(end, 'date');
    if (startLabel && endLabel) {
      return `${startLabel} – ${endLabel}`;
    }
    return startLabel || endLabel;
  }

  private coverageTone(percent: number): ExecMetric['tone'] {
    if (!Number.isFinite(percent)) {
      return 'slate';
    }
    if (percent >= 75) {
      return 'forest';
    }
    if (percent >= 40) {
      return 'info';
    }
    return 'amber';
  }

  private pushPeopleBlock(blocks: ExecBlock[]): void {
    const cards = this.executiveSnapshotCards();
    const families = cards['families'];
    const members = cards['members'];
    const celebrations = this.executive?.celebrations;
    const hasDirectory = !!families || !!members;
    const celebrationsVisible = celebrations && celebrations.state !== 'forbidden';
    if (!hasDirectory && !celebrationsVisible) {
      return;
    }
    if (families?.['error'] || members?.['error'] || celebrations?.state === 'error' && !hasDirectory) {
      blocks.push(this.errorBlock('people', 'People executive summary', 'Open directory', 'families.directory'));
      return;
    }
    if (!hasDirectory && celebrations?.state === 'error') {
      blocks.push(this.errorBlock('people', 'People executive summary', 'Open directory', 'members.directory'));
      return;
    }

    const metrics: ExecMetric[] = [];
    if (families && !families['error']) {
      metrics.push({
        label: 'Active families',
        value: this.formatCount(families['active_families']),
        hint: `${this.formatCount(families['total_families'])} total · active`,
        drilldown: 'families.directory',
        tone: 'indigo',
      });
    }
    if (members && !members['error']) {
      metrics.push({
        label: 'Active members',
        value: this.formatCount(members['active_members']),
        hint: `${this.formatCount(members['total_members'])} total · ${this.formatCount(members['members_added_this_month'])} records added this month`,
        drilldown: 'members.directory',
        tone: 'info',
      });
    }
    if (celebrations?.state === 'ready' && celebrations.data) {
      const weekQuery = this.celebrationsWeekQuery(celebrations.data);
      metrics.push({
        label: 'Birthdays',
        value: this.formatCount(celebrations.data.birthdays_count),
        hint: celebrations.data.week_label || 'This week',
        route: '/members/celebrations',
        query: { tab: 'birthdays', ...weekQuery },
        tone: (celebrations.data.birthdays_count ?? 0) > 0 ? 'forest' : 'slate',
      });
      metrics.push({
        label: 'Anniversaries',
        value: this.formatCount(celebrations.data.anniversaries_count),
        hint: celebrations.data.week_label || 'This week',
        route: '/members/celebrations',
        query: { tab: 'anniversaries', ...weekQuery },
        tone: (celebrations.data.anniversaries_count ?? 0) > 0 ? 'amber' : 'slate',
      });
    }
    if (!metrics.length) {
      return;
    }

    let memberAgeChart: MemberAgeChartSlice[] | undefined;
    if (members && !members['error'] && members['age_groups']) {
      const slices = memberAgeChartSlices(members['age_groups'] as MemberDashboardSummary['demographics']['age_groups']);
      if (slices.length) {
        memberAgeChart = slices;
      }
    }

    blocks.push({
      key: 'people',
      title: 'People executive summary',
      openLabel: 'Open members',
      openDrilldown: 'members.list',
      state: 'ready',
      metrics,
      memberAgeChart,
    });
  }

  private pushCommunityBlock(blocks: ExecBlock[]): void {
    const card = this.executiveSnapshotCards()['life_groups'];
    if (!card) {
      return;
    }
    if (card['error']) {
      blocks.push(this.errorBlock('community', 'Community executive summary', 'Open BCC', 'bcc.home'));
      return;
    }
    const coverage = card['household_coverage_percent'];
    const metrics: ExecMetric[] = [
      {
        label: 'BCC',
        value: this.formatCount(card['active_bccs']),
        hint: 'Active communities',
        drilldown: 'bcc.home',
        tone: 'forest',
      },
    ];
    if (card['families_connected'] !== undefined && card['families_connected'] !== null) {
      metrics.push({
        label: 'Families connected',
        value: this.formatCount(card['families_connected']),
        hint: 'In a BCC',
        drilldown: 'bcc.home',
        tone: 'indigo',
      });
    }
    if (coverage === null || coverage === undefined) {
      metrics.push({
        label: 'Coverage',
        value: '—',
        hint: 'Parish families',
        drilldown: 'bcc.home',
        tone: 'slate',
      });
    } else {
      metrics.push({
        label: 'Coverage',
        value: `${coverage}%`,
        hint: `${coverage}% of all families assigned to a BCC`,
        drilldown: 'bcc.home',
        tone: this.coverageTone(Number(coverage)),
      });
    }
    blocks.push({
      key: 'community',
      title: 'Community executive summary',
      openLabel: 'Open BCC',
      openDrilldown: 'bcc.home',
      state: 'ready',
      metrics,
    });
  }

  private pushMinistryBlock(blocks: ExecBlock[]): void {
    const card = this.executiveSnapshotCards()['ministries'];
    if (!card) {
      return;
    }
    if (card['error']) {
      blocks.push(this.errorBlock('ministry', 'Ministry executive summary', 'Open ministries', 'ministries.home'));
      return;
    }
    blocks.push({
      key: 'ministry',
      title: 'Ministry executive summary',
      openLabel: 'Open ministries',
      openDrilldown: 'ministries.home',
      state: 'ready',
      metrics: this.buildMinistryExecutiveSummary(card),
    });
  }

  private buildMinistryExecutiveSummary(card: Record<string, unknown>): ExecMetric[] {
    const metrics: ExecMetric[] = [];
    const groupsByType = this.ministryGroupRows(card['groups_by_type']);
    const totalGroups = Number(card['active_groups_total']);
    const hasTypeBreakdown = groupsByType.length > 0;

    if (hasTypeBreakdown) {
      const activeTotal = Number.isFinite(totalGroups)
        ? totalGroups
        : groupsByType.reduce((sum, row) => sum + row.count, 0);
      metrics.push({
        label: 'Active groups',
        value: this.formatCount(activeTotal),
        hint: 'Organizations currently active',
        drilldown: 'ministries.home',
        tone: 'indigo',
      });

      const typeMetrics = this.ministryTypeMetrics(groupsByType);
      metrics.push(...typeMetrics);
    } else {
      metrics.push(
        {
          label: 'Ministries',
          value: this.formatCount(card['active_ministries']),
          hint: 'Active',
          drilldown: 'ministries.home',
          tone: 'indigo',
        },
        {
          label: 'Associations',
          value: this.formatCount(card['active_associations']),
          hint: `${this.formatCount(card['active_other'])} other orgs`,
          drilldown: 'ministries.home',
          tone: 'info',
        }
      );
    }

    metrics.push(
      {
        label: 'Active members',
        value: this.formatCount(card['active_memberships']),
        hint: 'Current memberships',
        drilldown: 'ministries.home',
        tone: 'forest',
      },
      {
        label: 'Vacancies',
        value: this.formatCount(card['vacancies']),
        hint: `${this.formatCount(card['expiring_soon_count'])} leadership terms end within 30 days`,
        drilldown: 'ministries.home',
        tone: Number(card['vacancies'] ?? 0) > 0 || Number(card['expiring_soon_count'] ?? 0) > 0 ? 'amber' : 'forest',
      }
    );

    return metrics;
  }

  private ministryGroupRows(raw: unknown): Array<{ code: string; name: string; count: number }> {
    if (!Array.isArray(raw)) {
      return [];
    }
    return raw
      .map((row) => {
        if (!row || typeof row !== 'object') {
          return null;
        }
        const record = row as Record<string, unknown>;
        const name = String(record['name'] ?? record['code'] ?? '').trim();
        const code = String(record['code'] ?? '').trim();
        const count = Number(record['count'] ?? 0);
        if (!name) {
          return null;
        }
        return { code, name, count: Number.isFinite(count) ? count : 0 };
      })
      .filter((row): row is { code: string; name: string; count: number } => row !== null);
  }

  private ministryTypeMetrics(groupsByType: Array<{ code: string; name: string; count: number }>): ExecMetric[] {
    const rollupCodes = new Set(['orphan_type', 'uncategorized']);
    const nonzero = groupsByType.filter((row) => row.count > 0);
    const primary = nonzero.filter((row) => !rollupCodes.has(row.code));
    const maxVisible = 7;
    const visible = primary.slice(0, maxVisible);
    const hidden = primary.slice(maxVisible);
    const tones: ExecMetric['tone'][] = ['info', 'slate', 'forest', 'indigo', 'amber', 'stew-sky', 'stew-teal'];

    const metrics = visible.map((row, index) => ({
      label: row.name,
      value: this.formatCount(row.count),
      hint: 'Active groups',
      drilldown: 'ministries.home',
      tone: tones[index % tones.length],
    }));

    if (hidden.length > 0) {
      const extra = hidden.reduce((sum, row) => sum + row.count, 0);
      metrics.push({
        label: 'More group types',
        value: this.formatCount(extra),
        hint: `${hidden.length} additional types`,
        drilldown: 'ministries.home',
        tone: 'slate',
      });
    }

    const rollup = nonzero.find((row) => row.code === 'orphan_type');
    if (rollup) {
      metrics.push({
        label: rollup.name,
        value: this.formatCount(rollup.count),
        hint: 'Active groups',
        drilldown: 'ministries.home',
        tone: 'slate',
      });
    }

    const unassigned = nonzero.find((row) => row.code === 'uncategorized');
    if (unassigned) {
      metrics.push({
        label: unassigned.name,
        value: this.formatCount(unassigned.count),
        hint: 'Set type in Ministries',
        drilldown: 'ministries.home',
        tone: 'amber',
      });
    }

    return metrics;
  }

  private pushSacramentsBlock(blocks: ExecBlock[]): void {
    const card = this.executiveSnapshotCards()['sacraments'];
    if (!card) {
      return;
    }
    if (card['error']) {
      blocks.push(this.errorBlock('sacraments', 'Sacraments executive summary', 'Open sacraments', 'sacraments.home'));
      return;
    }
    const period = this.snapshotText(card, 'period_label') || 'All time';
    blocks.push({
      key: 'sacraments',
      title: 'Sacraments executive summary',
      openLabel: 'Open sacraments',
      openDrilldown: 'sacraments.home',
      state: 'ready',
      context: this.snapshotSacramentContext(card),
      metrics: [
        {
          label: 'In period',
          value: this.formatCount(card['total_period']),
          hint: period,
          drilldown: 'sacraments.home',
          tone: 'indigo',
        },
        {
          label: 'This month',
          value: this.formatCount(card['this_month']),
          hint: 'Administered this month',
          drilldown: 'sacraments.home',
          tone: Number(card['this_month'] ?? 0) > 0 ? 'forest' : 'info',
        },
      ],
    });
  }

  private pushFinanceBlock(blocks: ExecBlock[]): void {
    const state = this.executive?.stewardship?.state;
    if (!state || state === 'forbidden') {
      return;
    }
    if (state === 'error') {
      blocks.push(this.errorBlock('finance', 'Financial executive summary', 'Open Financial Dashboard', 'donations.home'));
      return;
    }
    if (state === 'unavailable') {
      blocks.push({
        key: 'finance',
        title: 'Financial executive summary',
        openLabel: 'Open Financial Dashboard',
        openDrilldown: 'donations.home',
        state: 'unavailable',
        unavailableMessage: 'Giving figures are unavailable until the church currency is set.',
        metrics: [],
      });
      return;
    }
    const snap = this.executive?.stewardship?.data;
    if (!snap) {
      blocks.push(this.errorBlock('finance', 'Financial executive summary', 'Open Financial Dashboard', 'donations.home'));
      return;
    }
    const installments = snap.project_installments_open !== null && snap.project_installments_open > 0
      ? `Project installments: ${cfFormatMoney(snap.project_installments_open, snap.currency_code)} (not included above)`
      : 'Collectable open balances';
    const dueScheduleChart = (snap.due_schedule ?? []).filter((slice) => Number(slice.amount) > 0);
    blocks.push({
      key: 'finance',
      title: 'Financial executive summary',
      openLabel: 'Open Financial Dashboard',
      openDrilldown: 'donations.home',
      state: 'ready',
      context: `${this.financialAsOfLabel(snap)}${snap.giving_health_label ? ` · Giving health: ${snap.giving_health_label}` : ''}`,
      metrics: [
        {
          label: 'Collected this month',
          value: cfFormatMoney(snap.collected, snap.currency_code),
          hint: 'Succeeded payments · month to date',
          compare: this.financialGrowthLabel(snap),
          trend: this.financialGrowthDirection(snap),
          financialLink: 'donations.payments.month',
          tone: 'stew-teal',
        },
        {
          label: 'Same days last month',
          value: cfFormatMoney(snap.comparison_collected, snap.currency_code),
          hint: this.financialComparisonHint(snap),
          financialLink: 'donations.payments.comparison',
          tone: 'stew-violet',
        },
        {
          label: 'Outstanding contributions',
          value: cfFormatMoney(snap.outstanding_contributions, snap.currency_code),
          hint: installments,
          financialLink: 'donations.dues',
          tone: Number(snap.outstanding_contributions) > 0 ? 'stew-gold' : 'stew-teal',
        },
        {
          label: 'Overdue',
          value: cfFormatMoney(snap.overdue_amount, snap.currency_code),
          hint: `Past due date · ${this.financialFamilyCount(snap.overdue_families)}`,
          financialLink: 'donations.dues.overdue',
          tone: Number(snap.overdue_amount) > 0 ? 'critical' : 'stew-teal',
        },
      ],
      dueScheduleChart,
    });
  }

  private pushMassIntentionsBlock(blocks: ExecBlock[]): void {
    const section = this.executive?.mass_intentions;
    if (!section || section.state === 'forbidden') {
      return;
    }
    if (section.state !== 'ready' || !section.data) {
      blocks.push(this.errorBlock('mass-intentions', 'Mass intentions executive summary', 'Open Mass intentions', 'mass.home'));
      return;
    }
    const data = section.data;
    blocks.push({
      key: 'mass-intentions',
      title: 'Mass intentions executive summary',
      openLabel: 'Open Mass intentions',
      openDrilldown: 'mass.home',
      state: 'ready',
      metrics: [
        {
          label: 'Open',
          value: this.formatCount(data.open),
          hint: 'Active on the register',
          route: '/mass-intentions/intentions',
          query: { status: 'open' },
          tone: Number(data.open) > 0 ? 'indigo' : 'slate',
        },
        {
          label: 'Registered this month',
          value: this.formatCount(data.registered_this_month),
          hint: 'New intentions this month',
          route: '/mass-intentions/intentions',
          query: { status: 'all', created_from: data.registered_from, created_to: data.registered_to },
          tone: Number(data.registered_this_month) > 0 ? 'forest' : 'info',
        },
        {
          label: 'Needs a Mass',
          value: this.formatCount(data.needs_a_mass),
          hint: 'Open intentions without a Mass',
          drilldown: 'mass.needs_a_mass',
          tone: Number(data.needs_a_mass) > 0 ? 'amber' : 'forest',
        },
        {
          label: 'Needs a tick',
          value: this.formatCount(data.needs_a_tick),
          hint: 'Celebrations waiting to be marked',
          drilldown: 'mass.needs_a_tick',
          tone: Number(data.needs_a_tick) > 0 ? 'amber' : 'forest',
        },
      ],
    });
  }

  private pushWorshipBlock(blocks: ExecBlock[]): void {
    const section = this.executive?.worship;
    if (!section || section.state === 'forbidden') {
      return;
    }
    if (section.state !== 'ready' || !section.data) {
      blocks.push(this.errorBlock('worship', 'Worship executive summary', 'Open Mass intentions', 'mass.home'));
      return;
    }
    const worship = section.data;
    blocks.push({
      key: 'worship',
      title: 'Worship executive summary',
      openLabel: 'Open Mass intentions',
      openDrilldown: 'mass.home',
      state: 'ready',
      metrics: [
        {
          label: 'Next Mass',
          value: worship.next_mass ? this.formatExecutiveDateTime(worship.next_mass.starts_at) : 'None scheduled',
          hint: worship.next_mass ? 'Upcoming celebration' : 'No upcoming Mass is scheduled.',
          drilldown: 'mass.home',
          tone: worship.next_mass ? 'forest' : 'amber',
        },
        {
          label: 'This week',
          value: this.formatCount(worship.this_week_masses),
          hint: 'Sunday–Saturday on the calendar',
          route: '/mass-intentions/masses/week',
          tone: Number(worship.this_week_masses) > 0 ? 'info' : 'slate',
        },
      ],
    });
  }

  private pushPastoralBlock(blocks: ExecBlock[]): void {
    const section = this.executive?.pastoral;
    if (!section || section.state === 'forbidden') {
      return;
    }
    if (section.state !== 'ready' || !section.data) {
      blocks.push(this.errorBlock('pastoral', 'Pastoral executive summary', 'Open pastoral care', 'dashboard.operations'));
      return;
    }
    blocks.push({
      key: 'pastoral',
      title: 'Pastoral executive summary',
      openLabel: 'Open pastoral care',
      openDrilldown: 'dashboard.operations',
      state: 'ready',
      metrics: [
        {
          label: 'Open requests',
          value: this.formatCount(section.data.open_count),
          hint: 'Waiting to be assigned',
          drilldown: 'dashboard.operations',
          tone: Number(section.data.open_count) > 0 ? 'amber' : 'forest',
        },
        {
          label: 'Assigned',
          value: this.formatCount(section.data.assigned_count),
          hint: 'Follow-ups in progress',
          drilldown: 'dashboard.operations',
          tone: Number(section.data.assigned_count) > 0 ? 'indigo' : 'slate',
        },
      ],
    });
  }

  private errorBlock(key: string, title: string, openLabel: string, openDrilldown: string): ExecBlock {
    return { key, title, openLabel, openDrilldown, state: 'error', metrics: [] };
  }

  private formatCount(value: unknown): string {
    const count = Number(value);
    if (!Number.isFinite(count)) {
      return '—';
    }
    return count.toLocaleString();
  }

  private celebrationsWeekQuery(data: ExecutiveCelebrationsData): Record<string, string> {
    const query: Record<string, string> = {};
    if (data.week_start) {
      query['from'] = data.week_start;
    }
    if (data.week_end) {
      query['to'] = data.week_end;
    }
    if (data.week_start && data.week_end) {
      query['event_date_from'] = data.week_start;
      query['event_date_to'] = data.week_end;
    }
    return query;
  }

  snapshotSacramentContext(card: Record<string, unknown>): string {
    const period = this.snapshotText(card, 'period_label');
    const types = card['top_types'];
    if (!Array.isArray(types) || types.length === 0) {
      return period || 'This month';
    }
    const labels = types
      .slice(0, 3)
      .map((row: Record<string, unknown>) => {
        const name = (row['name'] ?? row['label'] ?? row['code'] ?? 'Type') as string;
        const count = Number(row['count'] ?? 0);
        return `${name} (${count.toLocaleString()})`;
      });
    const more = this.snapshotMetric(card, 'more_types_count');
    let detail = labels.join(', ');
    if (more > 0) {
      detail += `, and ${more.toLocaleString()} more`;
    }
    return period ? `${period} · ${detail}` : detail;
  }

  retryPlatformStatistics(): void {
    const userId = this.platformStatsUserId;
    this.platformStatsUserId = null;
    this.platformStatsState = 'idle';
    if (userId != null) {
      this.loadPlatformStatistics(userId);
    }
  }

  private loadPlatformStatistics(userId: number): void {
    if (
      this.platformStatsUserId === userId
      && (this.platformStatsState === 'loading' || this.platformStatsState === 'ready')
    ) {
      return;
    }

    this.platformStatsUserId = userId;
    this.platformStatsState = 'loading';
    this.rebuildHeroKpis();
    this.cdr.markForCheck();

    this.tenantService.getStatistics()
      .pipe(takeUntil(this.destroy$))
      .subscribe({
        next: (response) => {
          if (response.success && response.data) {
            this.platformStats = response.data;
            this.platformStatsState = 'ready';
          } else {
            this.platformStats = null;
            this.platformStatsState = 'error';
          }
          this.rebuildHeroKpis();
          this.cdr.markForCheck();
        },
        error: (err) => {
          this.platformStats = null;
          this.platformStatsState = 'error';
          this.rebuildHeroKpis();
          this.cdr.markForCheck();
        },
      });
  }

  private setupFinancialHubLoader(): void {
    this.financialLoad$.pipe(
      switchMap(() => {
        this.loadingFinancial = true;
        this.financialHubState = 'loading';
        this.operationsSummary = null;
        this.rebuildHeroKpis();
        this.cdr.markForCheck();

        return this.donationsService.getOperationsDashboard().pipe(
          map((response) => ({ ok: true as const, data: response.data ?? null })),
          catchError((error) => of({
            ok: false as const,
            status: error?.status ?? 0,
          }))
        );
      }),
      takeUntil(this.destroy$)
    ).subscribe((result) => {
      this.loadingFinancial = false;

      if (!result.ok) {
        this.operationsSummary = null;
        this.financialHubState = result.status === 403 ? 'unauthorized' : 'error';
        this.rebuildHeroKpis();
        this.cdr.markForCheck();
        return;
      }

      if (!result.data?.financial) {
        this.operationsSummary = null;
        this.financialHubState = 'error';
        this.rebuildHeroKpis();
        this.cdr.markForCheck();
        return;
      }

      this.operationsSummary = result.data;
      this.financialHubState = 'ready';
      this.applyFinancialSnapshot(result.data);
      this.rebuildHeroKpis();
      this.cdr.markForCheck();
    });
  }

  loadOperationsDashboard(): void {
    if (!this.canViewFinancial) {
      this.financialHubState = 'unauthorized';
      return;
    }
    this.financialLoad$.next();
  }

  retryFinancialHub(): void {
    this.loadOperationsDashboard();
  }

  private applyFinancialSnapshot(_summary: OperationsDashboardSummary): void {
    // Hero KPIs rebuilt in rebuildHeroKpis() from operationsSummary.
  }

  private rebuildHeroKpis(): void {
    const kpis: HeroKpi[] = [];

    if (this.platformStatsState === 'loading') {
      kpis.push(this.buildPlaceholderKpi('active-churches', 'Active churches', 'indigo'));
      kpis.push(this.buildPlaceholderKpi('churches', 'Churches', 'amber'));
    } else if (this.platformStatsState === 'ready' && this.platformStats) {
      kpis.push({
        id: 'active-churches',
        label: 'Active churches',
        value: this.formatCompactNumber(this.platformStats.active_tenants),
        sublabel: `${this.formatCompactNumber(this.platformStats.total_tenants)} churches`,
        change: '—',
        trend: 'neutral',
        accent: 'indigo',
        sparkline: [],
      });
      kpis.push({
        id: 'churches-trial',
        label: 'In trial',
        value: this.formatCompactNumber(this.platformStats.in_trial),
        sublabel: `${this.formatCompactNumber(this.platformStats.subscribed)} subscribed`,
        change: '—',
        trend: 'neutral',
        accent: 'amber',
        sparkline: [],
      });
    } else if (this.platformStatsState === 'error') {
      kpis.push(this.buildErrorKpi('active-churches', 'Active churches', 'indigo'));
      kpis.push(this.buildErrorKpi('churches', 'Churches', 'amber'));
    } else if (this.registryState === 'loading') {
      kpis.push(this.buildPlaceholderKpi('active-families', 'Active Families', 'indigo'));
      kpis.push(this.buildPlaceholderKpi('active-members', 'Active Members', 'amber'));
    } else if (this.registryState === 'idle') {
      kpis.push(this.buildIdleKpi('active-families', 'Active Families', 'indigo'));
      kpis.push(this.buildIdleKpi('active-members', 'Active Members', 'amber'));
    } else if (this.registryState === 'error') {
      kpis.push(this.buildErrorKpi('active-families', 'Active Families', 'indigo'));
      kpis.push(this.buildErrorKpi('active-members', 'Active Members', 'amber'));
    } else {
      kpis.push({
        id: 'active-families',
        label: 'Active Families',
        value: this.formatCompactNumber(this.activeFamilies),
        sublabel: `${this.formatCompactNumber(this.totalFamilies)} total families`,
        change: '—',
        trend: 'neutral',
        accent: 'indigo',
        sparkline: [],
      });
      kpis.push({
        id: 'active-members',
        label: 'Active Members',
        value: this.formatCompactNumber(this.activeMembers),
        sublabel: `${this.formatCompactNumber(this.totalMembers)} total members`,
        change: '—',
        trend: 'neutral',
        accent: 'amber',
        sparkline: [],
      });
    }

    if (this.canViewFinancial) {
      if (this.financialHubState === 'loading') {
        kpis.push(this.buildPlaceholderKpi('collections', 'Collections This Month', 'forest'));
      } else if (this.financialHubState === 'ready' && this.operationsSummary?.financial) {
        const financial = this.operationsSummary.financial;
        const monthCollected = financial.totals?.current_month_collected ?? 0;
        const mom = this.collectionTrendMom();
        kpis.push({
          id: 'collections',
          label: 'Collections This Month',
          value: this.formatCurrency(monthCollected),
          sublabel: `${financial.families?.participation_rate ?? 0}% family participation`,
          change: mom.change,
          trend: mom.trend,
          accent: 'forest',
          sparkline: [],
        });
      }
    }

    this.heroKpis = kpis;
  }

  private buildIdleKpi(
    id: string,
    label: string,
    accent: HeroKpi['accent']
  ): HeroKpi {
    return {
      id,
      label,
      value: '—',
      sublabel: 'Open a church to see counts',
      change: '—',
      trend: 'neutral',
      accent,
      sparkline: [],
    };
  }

  private buildPlaceholderKpi(
    id: string,
    label: string,
    accent: HeroKpi['accent']
  ): HeroKpi {
    return {
      id,
      label,
      value: '—',
      sublabel: 'Loading…',
      change: '—',
      trend: 'neutral',
      accent,
      sparkline: [],
    };
  }

  private buildErrorKpi(
    id: string,
    label: string,
    accent: HeroKpi['accent']
  ): HeroKpi {
    return {
      id,
      label,
      value: '—',
      sublabel: 'Could not load',
      change: '—',
      trend: 'neutral',
      accent,
      sparkline: [],
    };
  }

  private collectionTrendMom(): { change: string; trend: 'up' | 'down' | 'neutral' } {
    const points = this.operationsSummary?.collection_trend ?? [];
    if (points.length < 2) {
      return { change: '—', trend: 'neutral' };
    }

    const current = Number(points[points.length - 1]?.collected ?? 0);
    const previous = Number(points[points.length - 2]?.collected ?? 0);

    if (previous === 0 && current === 0) {
      return { change: '—', trend: 'neutral' };
    }
    if (previous === 0 && current > 0) {
      return { change: '+100%', trend: 'up' };
    }

    const pct = ((current - previous) / previous) * 100;
    const rounded = Math.round(pct);
    return {
      change: `${rounded >= 0 ? '+' : ''}${rounded}%`,
      trend: rounded > 0 ? 'up' : rounded < 0 ? 'down' : 'neutral',
    };
  }




  stewardshipCurrencyCode(): string | null {
    const fromExecutive = this.executive?.stewardship?.data?.currency_code;
    if (fromExecutive) {
      return fromExecutive;
    }
    const fromOps = this.operationsSummary?.tenant_context?.currency_code;
    return fromOps || null;
  }

  overdueFollowUp(): { count: number; amountLabel: string } | null {
    if (this.financialHubState !== 'ready') {
      return null;
    }
    const summary = this.operationsSummary?.financial?.attention_summary;
    const count = summary?.count;
    const amount = summary?.total_overdue_amount;
    if (
      typeof count !== 'number' || !Number.isFinite(count)
      || typeof amount !== 'number' || !Number.isFinite(amount)
    ) {
      return null;
    }
    const code = this.stewardshipCurrencyCode();
    return {
      count,
      amountLabel: code ? cfFormatMoney(amount, code) : '',
    };
  }

  overdueFollowUpUnavailable(): boolean {
    return this.financialHubState === 'ready' && this.overdueFollowUp() === null;
  }

  openOverdueFamiliesFollowUp(): void {
    void this.router.navigate(['/donations/dues'], {
      queryParams: { overdue_only: '1' },
    });
  }

  formatCurrency(value: number | null | undefined, currencyCode?: string): string {
    const code = currencyCode ?? this.stewardshipCurrencyCode();
    if (!code) {
      return '';
    }
    return cfFormatMoney(value, code, 0);
  }

  givingChannelRows(): GivingChannelRow[] {
    const mix = this.operationsSummary?.collections_by_method_this_month ?? {};
    const total = Object.values(mix).reduce((sum, value) => sum + (value ?? 0), 0);
    if (total <= 0) {
      return [];
    }

    return Object.entries(mix)
      .filter(([, amount]) => (amount ?? 0) > 0)
      .sort(([, left], [, right]) => (right ?? 0) - (left ?? 0))
      .map(([method, amount]) => ({
        channel: PAYMENT_METHOD_LABELS[method] ?? method,
        amount: this.formatCurrency(amount ?? 0),
        share: Math.round(((amount ?? 0) / total) * 100),
      }));
  }

  stewardshipPeriodLabel(): string {
    const period = this.operationsSummary?.period;
    if (!period?.month_start) {
      return 'This month';
    }
    const start = new Date(`${period.month_start}T12:00:00`);
    return cfFormatDate(start, 'monthYear');
  }

  openFinancialDashboard(): void {
    this.router.navigate(['/donations']);
  }


  formatCompactNumber(value: number | null | undefined): string {
    return new Intl.NumberFormat(undefined, { maximumFractionDigits: 0 }).format(value ?? 0);
  }

  planBreakdown(byPlan: Record<string, number> | null | undefined): { key: string; label: string; count: number }[] {
    if (!byPlan) {
      return [];
    }

    const order = ['free', 'starter', 'standard', 'professional', 'enterprise'];
    const label = (key: string) => key.replace(/[_-]+/g, ' ').replace(/\b\w/g, (c) => c.toUpperCase());

    const rows = Object.entries(byPlan)
      .filter(([, count]) => count > 0)
      .map(([key, count]) => ({ key, label: `${label(key)} plan`, count }));

    return rows.sort((a, b) => {
      const ai = order.indexOf(a.key);
      const bi = order.indexOf(b.key);
      if (ai !== -1 || bi !== -1) {
        return (ai === -1 ? 99 : ai) - (bi === -1 ? 99 : bi);
      }
      return a.label.localeCompare(b.label);
    });
  }















  getSparklinePath(values: number[], width = 72, height = 28): string {
    if (values.length < 2) return '';
    const min = Math.min(...values);
    const max = Math.max(...values);
    const range = max - min || 1;
    const step = width / (values.length - 1);
    return values
      .map((v, i) => {
        const x = i * step;
        const y = height - ((v - min) / range) * (height - 4) - 2;
        return `${i === 0 ? 'M' : 'L'}${x.toFixed(1)},${y.toFixed(1)}`;
      })
      .join(' ');
  }

  navigateTo(route: string): void {
    this.router.navigate([route]);
  }

  private loadPastoralWorkflow(): void {
    this.loadingPastoral = true;
    this.pastoralError = false;
    this.pastoralCare
      .dashboard()
      .pipe(takeUntil(this.destroy$))
      .subscribe({
        next: (data) => {
          this.careAlerts = data?.alerts ?? [];
          this.pastoralTasks = data?.tasks ?? [];
          this.pastoralLoaded = true;
          this.pastoralError = false;
          this.loadingPastoral = false;
          this.cdr.markForCheck();
        },
        error: () => {
          this.pastoralError = true;
          this.loadingPastoral = false;
          this.cdr.markForCheck();
        },
      });

    if (this.canAssignPastoral && this.pastoralStaff.length === 0) {
      this.pastoralCare
        .staff()
        .pipe(takeUntil(this.destroy$))
        .subscribe({
          next: (staff) => {
            this.pastoralStaff = staff ?? [];
            this.cdr.markForCheck();
          },
          error: () => {
            this.pastoralStaff = [];
            this.cdr.markForCheck();
          },
        });
    }
  }

  beginAssign(task: PastoralCareRequest): void {
    if (!this.canAssignPastoral || task.status !== 'open') {
      return;
    }
    this.assigningTaskId = task.id;
    this.selectedAssigneeId = this.pastoralStaff[0]?.id ?? null;
    this.cdr.markForCheck();
  }

  cancelAssign(): void {
    this.assigningTaskId = null;
    this.selectedAssigneeId = null;
    this.cdr.markForCheck();
  }

  confirmAssign(task: PastoralCareRequest): void {
    if (!this.selectedAssigneeId || this.assigningBusy) {
      return;
    }
    this.assigningBusy = true;
    this.pastoralCare.assign(task.id, this.selectedAssigneeId).pipe(takeUntil(this.destroy$)).subscribe({
      next: (updated) => {
        this.pastoralTasks = this.pastoralTasks.map((row) => (row.id === updated.id ? updated : row));
        this.assigningTaskId = null;
        this.selectedAssigneeId = null;
        this.assigningBusy = false;
        this.pastoralLoaded = false;
        this.loadPastoralWorkflow();
        this.cdr.markForCheck();
      },
      error: () => {
        this.assigningBusy = false;
        this.cdr.markForCheck();
      },
    });
  }

  completeTask(task: PastoralCareRequest): void {
    if (!this.canCompleteTask(task)) {
      return;
    }
    this.pastoralCare.complete(task.id).pipe(takeUntil(this.destroy$)).subscribe({
      next: () => {
        this.pastoralLoaded = false;
        this.loadPastoralWorkflow();
      },
      error: () => this.cdr.markForCheck(),
    });
  }

  canCompleteTask(task: PastoralCareRequest): boolean {
    if (task.status !== 'assigned') {
      return false;
    }
    if (this.canAssignPastoral) {
      return true;
    }
    const userId = this.authService.currentUserValue?.id;
    return userId != null && Number(userId) === Number(task.assigned_to_user_id);
  }

  getUserFirstName(name?: string | null): string {
    return (name || 'there').split(' ')[0];
  }

  getGreeting(): string {
    const hour = this.today.getHours();
    if (hour < 12) return 'Good morning';
    if (hour < 17) return 'Good afternoon';
    return 'Good evening';
  }
}
