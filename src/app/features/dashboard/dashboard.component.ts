/**
 * Dashboard version 2.0 — two-tab architecture (Overview | Operations).
 * Phase 2: Overview hierarchy. Phase 3: Operations workspace. Phase 4: lazy-load Operations APIs.
 * Restore Version 1.0 from: ./v1.0/ (see v1.0/VERSION.md).
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
import { BCC, BCCStatistics, FamilyStatistics } from '@core/models/family.model';
import { SubscriptionAccessService } from '@core/services/subscription-access.service';
import { selectCurrentUser } from '@core/store/auth/auth.selectors';
import { FamilyService } from '@core/services/family.service';
import { BCCService } from '@core/services/bcc.service';
import { MemberService } from '@features/members/services/member.service';
import { SacramentService } from '@features/settings/sacraments/services/sacrament.service';
import { AuthService } from '@core/services/auth.service';
import { DonationsService } from '@features/donations/services/donations.service';
import { OperationsDashboardSummary } from '@features/donations/models/donation.model';
import { MinistriesApiService } from '@features/ministries-associations/services/ministries-api.service';
import {
  MinistriesAuditLogEntry,
  MinistriesDashboardSummary,
} from '@features/ministries-associations/models/ministries.model';
import { SupportSessionService } from '@features/support-center/services/support-session.service';
import { PastoralCareService } from '@features/pastoral-care/services/pastoral-care.service';
import {
  PastoralCareAlert,
  PastoralCareRequest,
  PastoralCareStaff,
} from '@features/pastoral-care/models/pastoral-care.model';

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

interface LifeGroupMetric {
  label: string;
  value: string;
  detail: string;
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

interface BccHighlight {
  id: string;
  name: string;
  code: string;
  families: number;
  meetingLabel: string;
  status: string;
}

interface SacramentHighlight {
  id: number;
  typeName: string;
  recipientName: string;
  dateAdministered: string;
  place?: string;
}

interface SacramentTypeCount {
  label: string;
  count: number;
}

interface CelebrationItem {
  id: string;
  name: string;
  dayLabel: string;
  dateLabel: string;
  detail: string;
  familyId?: string;
}

@Component({
  selector: 'app-dashboard',
  standalone: true,
  imports: [CommonModule, FormsModule],
  templateUrl: './dashboard.component.html',
  styleUrl: './dashboard.component.scss',
  changeDetection: ChangeDetectionStrategy.OnPush
})
export class DashboardComponent implements OnInit, OnDestroy {
  private store = inject(Store<AppState>);
  private familyService = inject(FamilyService);
  private bccService = inject(BCCService);
  private memberService = inject(MemberService);
  private sacramentService = inject(SacramentService);
  private authService = inject(AuthService);
  private supportSessions = inject(SupportSessionService);
  private donationsService = inject(DonationsService);
  private pastoralCare = inject(PastoralCareService);
  private ministriesApi = inject(MinistriesApiService);
  private subscriptionAccess = inject(SubscriptionAccessService);
  private router = inject(Router);
  private cdr = inject(ChangeDetectorRef);
  private destroy$ = new Subject<void>();
  private tenantId: number | null = null;

  currentUser$: Observable<User | null>;
  today = new Date();
  readonly chartBarMaxHeightPx = 140;

  heroKpis: HeroKpi[] = [];
  registryState: DataLoadState = 'idle';
  bccStatsState: DataLoadState = 'idle';
  familyStats: FamilyStatistics | null = null;
  activeFamilies = 0;
  activeMembers = 0;
  membersCreatedThisMonth = 0;
  familiesWithoutBcc = 0;

  lifeGroups: LifeGroupMetric[] = [
    { label: 'Active BCCs', value: '—', detail: 'Loading group count…' },
    { label: 'Family coverage', value: '—', detail: 'Families assigned to a Life Group' },
    { label: 'BCC Leaders', value: '—', detail: 'Active BCC leaders across parish' }
  ];

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

  bccStatistics: BCCStatistics | null = null;
  bccHighlights: BccHighlight[] = [];
  sacramentHighlights: SacramentHighlight[] = [];
  sacramentTypeCounts: SacramentTypeCount[] = [];
  sacramentsThisMonth = 0;
  weekBirthdays: CelebrationItem[] = [];
  weekAnniversaries: CelebrationItem[] = [];
  weekRangeLabel = '';
  loadingBccDetails = false;
  loadingSacraments = false;
  loadingCelebrations = false;
  canViewFinancial = false;

  private readonly financialLoad$ = new Subject<void>();

  showMinistriesSection = false;
  loadingMinistries = false;
  ministriesSummary: MinistriesDashboardSummary | null = null;
  ministriesActivity: MinistriesAuditLogEntry[] = [];
  canCreateOrganization = false;
  canManageMembers = false;
  canManageLeadership = false;
  canConfigureTaxonomies = false;
  canViewTenantAuditLogs = false;

  /** Dashboard v2.0 tab state — default Overview. */
  activeTab: DashboardTab = 'overview';
  /** True after Operations is opened once; keeps panel mounted for the session. */
  operationsVisited = false;
  readonly dashboardTabs: DashboardTab[] = ['overview', 'operations'];
  readonly dashboardTabLabels: Record<DashboardTab, string> = {
    overview: 'Overview',
    operations: 'Operations',
  };

  /** Session cache — set true only after a successful Operations-scoped response. */
  private bccHighlightsLoaded = false;
  private celebrationsLoaded = false;
  private sacramentsLoaded = false;
  private ministriesActivityLoaded = false;

  loadingMinistriesActivity = false;
  bccHighlightsError = false;
  celebrationsError = false;
  celebrationsUnauthorized = false;
  sacramentsError = false;
  ministriesActivityError = false;

  private readonly ministriesActionLabels: Record<string, string> = {
    'organization.created': 'Organization created',
    'organization.updated': 'Organization updated',
    'organization.status_changed': 'Organization status changed',
    'organization.deleted': 'Organization deleted',
    'organization.restored': 'Organization restored',
    'membership.enrolled': 'Member enrolled',
    'membership.status_changed': 'Membership status changed',
    'membership.re_enrolled': 'Member re-enrolled',
    'guest_member.created': 'Guest created',
    'guest_member.updated': 'Guest updated',
    'guest_member.linked_to_parishioner': 'Guest linked',
    'leadership.assigned': 'Leadership assigned',
    'leadership.terminated': 'Leadership terminated',
    'leadership.handover': 'Leadership handed over',
  };

  constructor() {
    this.currentUser$ = this.store.select(selectCurrentUser);
  }

  ngOnInit(): void {
    this.weekRangeLabel = 'This week';
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
        // #region agent log
        fetch('http://127.0.0.1:7631/ingest/5401a346-7001-4033-9c37-4ee605985cd9',{method:'POST',headers:{'Content-Type':'application/json','X-Debug-Session-Id':'0c9b95'},body:JSON.stringify({sessionId:'0c9b95',location:'dashboard.component.ts:ngOnInit',message:'dashboard user emission',data:{userPresent:!!user,userId:user?.id ?? null,tenantId:user?.tenant_id ?? null,href:location.href},hypothesisId:'H1',runId:'post-fix-v2',timestamp:Date.now()})}).catch(()=>{});
        // #endregion
        // Wait for hydrated user — a null emission must not wipe in-flight/loaded dashboard data.
        if (!user) {
          return;
        }
        if (user.tenant_id) {
          this.tenantId = Number(user.tenant_id);
        }
        this.refreshDashboardAccess(user);
        this.cdr.markForCheck();
      });
  }

  private refreshDashboardAccess(user: User | null): void {
    const isTenantActor = !!user?.tenant_id && !this.authService.isPlatformActor(user);
    const hasActiveSupportSession = !!user && this.authService.isPlatformActor(user) && !!this.supportSessions.sessionId;
    const hasTenantContext = !!user?.tenant_id || hasActiveSupportSession;
    // #region agent log
    fetch('http://127.0.0.1:7631/ingest/5401a346-7001-4033-9c37-4ee605985cd9',{method:'POST',headers:{'Content-Type':'application/json','X-Debug-Session-Id':'0c9b95'},body:JSON.stringify({sessionId:'0c9b95',location:'dashboard.component.ts:refreshDashboardAccess',message:'refreshDashboardAccess',data:{userPresent:!!user,tenantId:user?.tenant_id ?? null,hasTenantContext,canDonations:hasTenantContext && this.authService.canAccessDonations(user,{hasActiveSupportSession}),willLoadStats:hasTenantContext},hypothesisId:'H1',runId:'post-fix-v2',timestamp:Date.now()})}).catch(()=>{});
    // #endregion

    if (hasTenantContext) {
      this.loadFamilyStatistics();
      this.loadBccStatistics();
    } else {
      this.registryState = 'idle';
      this.bccStatsState = 'idle';
      this.rebuildHeroKpis();
    }

    this.canViewFinancial = hasTenantContext && this.authService.canAccessDonations(user, { hasActiveSupportSession });
    if (this.canViewFinancial) {
      this.loadOperationsDashboard();
    } else {
      this.financialHubState = 'unauthorized';
      this.operationsSummary = null;
      this.loadingFinancial = false;
      this.rebuildHeroKpis();
    }
    this.canViewPastoral = isTenantActor && this.authService.canAccessPastoral(user);
    this.canAssignPastoral = this.authService.hasPermission('pastoral.care.assign');
    this.resolveMinistriesAccess(user);
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
    if (!this.bccHighlightsLoaded && !this.loadingBccDetails) {
      this.loadBccHighlights();
    }

    if (!this.celebrationsLoaded && !this.loadingCelebrations) {
      this.loadMemberCelebrations();
    }

    if (!this.sacramentsLoaded && !this.loadingSacraments && this.tenantId) {
      this.loadSacramentDetails();
    }

    if (
      this.showMinistriesSection &&
      this.canViewTenantAuditLogs &&
      !this.ministriesActivityLoaded &&
      !this.loadingMinistriesActivity
    ) {
      this.loadMinistriesActivity();
    }

    if (this.canViewPastoral && !this.pastoralLoaded && !this.loadingPastoral) {
      this.loadPastoralWorkflow();
    }
  }

  retryBccHighlights(): void {
    this.loadBccHighlights();
  }

  retryMemberCelebrations(): void {
    this.celebrationsLoaded = false;
    this.loadMemberCelebrations();
  }

  retryPastoralWorkflow(): void {
    this.pastoralLoaded = false;
    this.loadPastoralWorkflow();
  }

  retrySacramentDetails(): void {
    this.loadSacramentDetails();
  }

  retryMinistriesActivity(): void {
    this.loadMinistriesActivity();
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
          // #region agent log
          fetch('http://127.0.0.1:7631/ingest/5401a346-7001-4033-9c37-4ee605985cd9',{method:'POST',headers:{'Content-Type':'application/json','X-Debug-Session-Id':'0c9b95'},body:JSON.stringify({sessionId:'0c9b95',location:'dashboard.component.ts:loadFamilyStatistics',message:'family stats response',data:{success:!!response?.success,hasData:!!response?.data,totalFamilies:response?.data?.total_families ?? null},hypothesisId:'H1',runId:'post-fix',timestamp:Date.now()})}).catch(()=>{});
          // #endregion
          if (response.success && response.data) {
            this.familyStats = response.data;
            this.totalFamilies = response.data.total_families ?? 0;
            this.totalMembers = response.data.total_members ?? 0;
            this.activeFamilies = response.data.active_families ?? 0;
            this.activeMembers = response.data.active_members ?? 0;
            this.membersCreatedThisMonth = response.data.members_created_this_month ?? 0;
            this.familiesWithoutBcc = response.data.families_without_bcc ?? 0;
            this.registryState = 'ready';
            this.updateLifeGroupCoverage();
          } else {
            this.registryState = 'error';
          }
          this.rebuildHeroKpis();
          this.cdr.markForCheck();
        },
        error: (err) => {
          // #region agent log
          fetch('http://127.0.0.1:7631/ingest/5401a346-7001-4033-9c37-4ee605985cd9',{method:'POST',headers:{'Content-Type':'application/json','X-Debug-Session-Id':'0c9b95'},body:JSON.stringify({sessionId:'0c9b95',location:'dashboard.component.ts:loadFamilyStatistics',message:'family stats error',data:{status:err?.status ?? null},hypothesisId:'H1',runId:'post-fix',timestamp:Date.now()})}).catch(()=>{});
          // #endregion
          this.registryState = 'error';
          this.rebuildHeroKpis();
          this.cdr.markForCheck();
        }
      });
  }

  retryRegistry(): void {
    this.loadFamilyStatistics();
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

    if (this.registryState === 'loading' || this.registryState === 'idle') {
      kpis.push(this.buildPlaceholderKpi('active-families', 'Active Families', 'indigo'));
      kpis.push(this.buildPlaceholderKpi('active-members', 'Active Members', 'amber'));
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

  familyCoveragePercent(): number | null {
    if (this.registryState !== 'ready' || !this.familyStats) {
      return null;
    }
    const total = this.familyStats.total_families ?? 0;
    if (total <= 0) {
      return null;
    }
    const withBcc = this.familyStats.families_with_bcc ?? 0;
    return Math.round((withBcc / total) * 100);
  }

  private updateLifeGroupCoverage(): void {
    if (this.bccStatsState !== 'ready' || this.registryState !== 'ready') {
      return;
    }

    const coverage = this.familyCoveragePercent();
    if (coverage !== null) {
      const assigned = this.familyStats?.families_with_bcc ?? 0;
      const total = this.familyStats?.total_families ?? 0;
      this.lifeGroups[1].value = `${coverage}%`;
      this.lifeGroups[1].detail = `${assigned} of ${total} families assigned`;
    }
  }

  isSubscriptionReadOnly(): boolean {
    return this.subscriptionAccess.isReadOnly();
  }

  stewardshipCurrencyCode(): string {
    return this.operationsSummary?.tenant_context?.currency_code || 'INR';
  }

  formatCurrency(value: number | null | undefined, currencyCode?: string): string {
    const amount = value ?? 0;
    const currency = currencyCode ?? this.stewardshipCurrencyCode();
    return new Intl.NumberFormat(undefined, {
      style: 'currency',
      currency,
      maximumFractionDigits: 0,
    }).format(amount);
  }

  givingTrendPoints(): Array<{ month: string; collected: number }> {
    const points = this.operationsSummary?.collection_trend ?? [];
    return points.map((point) => ({
      month: point.label?.split(' ')[0] ?? point.period,
      collected: Number(point.collected ?? 0),
    }));
  }

  maxGivingTrend(): number {
    const values = this.givingTrendPoints().map((point) => point.collected);
    const max = values.length ? Math.max(...values) : 0;
    return max > 0 ? max : 1;
  }

  givingTrendIsEmpty(): boolean {
    const points = this.givingTrendPoints();
    if (!points.length) {
      return true;
    }
    return points.every((point) => point.collected === 0);
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
    return start.toLocaleDateString(undefined, { month: 'long', year: 'numeric' });
  }

  openFinancialDashboard(): void {
    this.router.navigate(['/donations']);
  }

  openMinistries(): void {
    this.router.navigate(['/ministries']);
  }

  formatCompactNumber(value: number | null | undefined): string {
    return new Intl.NumberFormat(undefined, { maximumFractionDigits: 0 }).format(value ?? 0);
  }

  ministriesMembershipTotal(): number {
    if (!this.ministriesSummary) {
      return 0;
    }
    return this.ministriesSummary.memberships.active + this.ministriesSummary.memberships.inactive;
  }

  ministriesActiveSharePercent(): number {
    const total = this.ministriesMembershipTotal();
    if (total <= 0) {
      return 0;
    }
    return Math.round((this.ministriesSummary!.memberships.active / total) * 100);
  }

  ministriesOrgMemberBarPercent(activeMembers: number): number {
    const max = this.ministriesSummary?.top_organizations[0]?.active_members ?? 0;
    if (max <= 0) {
      return 0;
    }
    return Math.max(4, Math.round((activeMembers / max) * 100));
  }

  ministriesActionLabel(entry: MinistriesAuditLogEntry): string {
    const key = entry.action_type || entry.event;
    return this.ministriesActionLabels[key] ?? key;
  }

  ministriesActivityActor(entry: MinistriesAuditLogEntry): string {
    return entry.actor_name?.trim() || 'System';
  }

  formatMinistriesDate(value: string | null | undefined): string {
    if (!value) {
      return '—';
    }
    const date = new Date(value.includes('T') ? value : `${value}T00:00:00`);
    if (Number.isNaN(date.getTime())) {
      return value;
    }
    return date.toLocaleDateString(undefined, {
      month: 'short',
      day: 'numeric',
      year: 'numeric',
    });
  }

  formatMinistriesDateTime(value: string | null | undefined): string {
    if (!value) {
      return '—';
    }
    const date = new Date(value);
    if (Number.isNaN(date.getTime())) {
      return value;
    }
    return date.toLocaleString(undefined, {
      month: 'short',
      day: 'numeric',
      hour: 'numeric',
      minute: '2-digit',
    });
  }

  private resolveMinistriesAccess(user: User | null): void {
    const hasActiveSupportSession = !!user && this.authService.isPlatformActor(user) && !!this.supportSessions.sessionId;
    const hasTenantContext = !!user?.tenant_id || hasActiveSupportSession;
    if (!hasTenantContext || !this.authService.canAccessMinistries(user)) {
      this.showMinistriesSection = false;
      this.ministriesSummary = null;
      this.ministriesActivity = [];
      return;
    }

    this.canCreateOrganization = this.authService.isSuperAdmin() || this.authService.hasPermission('ministries.create');
    this.canManageMembers = this.authService.isSuperAdmin() || this.authService.hasPermission('ministries.manage_members');
    this.canManageLeadership =
      this.authService.isSuperAdmin() || this.authService.hasPermission('ministries.manage_leadership');
    this.canConfigureTaxonomies =
      this.authService.isSuperAdmin() || this.authService.hasPermission('ministries.configure');
    this.canViewTenantAuditLogs = this.authService.canViewTenantAuditLogs(user);

    this.ministriesApi
      .getModuleStatus()
      .pipe(takeUntil(this.destroy$))
      .subscribe({
        next: (response) => {
          const enabled = response.data?.enabled === true;
          this.showMinistriesSection = enabled;
          if (enabled) {
            this.loadMinistriesSummary();
            if (this.operationsVisited) {
              this.loadOperationsScopedData();
            }
          } else {
            this.ministriesSummary = null;
            this.ministriesActivity = [];
          }
          this.cdr.markForCheck();
        },
        error: () => {
          this.showMinistriesSection = false;
          this.cdr.markForCheck();
        },
      });
  }

  /** Overview — ministries KPIs / membership / leadership summary. */
  private loadMinistriesSummary(): void {
    this.loadingMinistries = true;
    this.cdr.markForCheck();

    this.ministriesApi
      .getDashboardSummary()
      .pipe(
        catchError(() => of(null)),
        takeUntil(this.destroy$),
      )
      .subscribe({
        next: (summary) => {
          this.ministriesSummary = summary?.data ?? null;
          this.loadingMinistries = false;
          this.cdr.markForCheck();
        },
        error: () => {
          this.loadingMinistries = false;
          this.cdr.markForCheck();
        },
      });
  }

  /** Operations — recent ministries audit feed (lazy, session-cached). */
  private loadMinistriesActivity(): void {
    if (!this.canViewTenantAuditLogs || this.ministriesActivityLoaded || this.loadingMinistriesActivity) {
      return;
    }

    this.loadingMinistriesActivity = true;
    this.ministriesActivityError = false;
    this.cdr.markForCheck();

    this.ministriesApi
      .listAuditLogs({ per_page: 3 })
      .pipe(takeUntil(this.destroy$))
      .subscribe({
        next: (activity) => {
          this.ministriesActivity = activity?.data ?? [];
          this.ministriesActivityLoaded = true;
          this.ministriesActivityError = false;
          this.loadingMinistriesActivity = false;
          this.cdr.markForCheck();
        },
        error: () => {
          this.ministriesActivityError = true;
          this.loadingMinistriesActivity = false;
          this.cdr.markForCheck();
        },
      });
  }

  /** Overview — BCC stats for Life Groups strip and registry count. */
  loadBccStatistics(): void {
    this.bccStatsState = 'loading';
    this.lifeGroups[0].value = '—';
    this.lifeGroups[0].detail = 'Loading group count…';
    this.lifeGroups[1].value = '—';
    this.lifeGroups[1].detail = 'Families assigned to a Life Group';
    this.lifeGroups[2].value = '—';
    this.lifeGroups[2].detail = 'Active BCC leaders across parish';
    this.cdr.markForCheck();

    this.bccService.getStatistics()
      .pipe(takeUntil(this.destroy$))
      .subscribe({
        next: (response) => {
          if (response.success && response.data) {
            this.bccStatistics = response.data;
            this.totalBCCs = response.data.total_bccs ?? 0;
            const activeBccs = response.data.active_bccs ?? 0;
            this.lifeGroups[0].value = String(activeBccs);
            this.lifeGroups[0].detail = `${response.data.total_families_in_bccs ?? 0} families in groups`;
            this.lifeGroups[2].value = String(response.data.total_leaders ?? 0);
            this.lifeGroups[2].detail = 'Active BCC leaders across parish';
            this.bccStatsState = 'ready';
            this.updateLifeGroupCoverage();
          } else {
            this.bccStatsState = 'error';
          }
          this.cdr.markForCheck();
        },
        error: () => {
          this.bccStatsState = 'error';
          this.cdr.markForCheck();
        }
      });
  }

  retryBccStats(): void {
    this.loadBccStatistics();
  }

  /** Operations — top BCC list (lazy, session-cached). */
  loadBccHighlights(): void {
    this.loadingBccDetails = true;
    this.bccHighlightsError = false;
    this.cdr.markForCheck();

    this.bccService.getBCCs({ status: 'active', sort_by: 'current_family_count', sort_order: 'desc', per_page: 5, page: 1 })
      .pipe(takeUntil(this.destroy$))
      .subscribe({
        next: (response) => {
          if (response.success && response.data) {
            this.bccHighlights = response.data.map(bcc => this.mapBccHighlight(bcc));
            this.bccHighlightsLoaded = true;
            this.bccHighlightsError = false;
          } else if (response.success) {
            this.bccHighlights = [];
            this.bccHighlightsLoaded = true;
            this.bccHighlightsError = false;
          } else {
            this.bccHighlightsError = true;
          }
          this.loadingBccDetails = false;
          this.cdr.markForCheck();
        },
        error: () => {
          this.bccHighlightsError = true;
          this.loadingBccDetails = false;
          this.cdr.markForCheck();
        }
      });
  }

  loadSacramentDetails(): void {
    if (!this.tenantId) return;

    this.loadingSacraments = true;
    this.sacramentsError = false;
    this.cdr.markForCheck();

    this.sacramentService.getDashboardSummary({
      preset: 'calendar_month_mtd',
      minimal: true,
      include_gaps: false,
    }).pipe(takeUntil(this.destroy$)).subscribe({
      next: (response) => {
        if (response.success && response.data) {
          const summary = response.data;
          this.sacramentsThisMonth = summary.kpis.total_period;
          this.sacramentHighlights = summary.recent.map((record) => ({
            id: record.id,
            typeName: record.type?.name || 'Sacrament',
            recipientName: record.recipient_name,
            dateAdministered: record.date_administered,
            place: record.place_administered,
          }));
          this.sacramentTypeCounts = summary.breakdowns.by_type_totals
            .filter((row) => row.count > 0)
            .map((row) => ({
              label: row.label,
              count: row.count,
            }));
          this.sacramentsLoaded = true;
          this.sacramentsError = false;
        } else if (response.success) {
          this.sacramentHighlights = [];
          this.sacramentTypeCounts = [];
          this.sacramentsThisMonth = 0;
          this.sacramentsLoaded = true;
          this.sacramentsError = false;
        } else {
          this.sacramentsError = true;
        }
        this.loadingSacraments = false;
        this.cdr.markForCheck();
      },
      error: () => {
        this.sacramentsError = true;
        this.loadingSacraments = false;
        this.cdr.markForCheck();
      }
    });
  }

  loadMemberCelebrations(): void {
    this.loadingCelebrations = true;
    this.celebrationsError = false;
    this.celebrationsUnauthorized = false;
    this.cdr.markForCheck();

    this.memberService.getCelebrations()
      .pipe(takeUntil(this.destroy$))
      .subscribe({
        next: (response) => {
          if (response.success && response.data) {
            this.weekRangeLabel = response.data.week?.label ?? this.weekRangeLabel;
            this.weekBirthdays = (response.data.birthdays ?? []).map((item) => this.mapCelebrationItem(item));
            this.weekAnniversaries = (response.data.anniversaries ?? []).map((item) => this.mapCelebrationItem(item));
            this.celebrationsLoaded = true;
            this.celebrationsError = false;
            this.celebrationsUnauthorized = false;
          } else if (response.success) {
            this.weekBirthdays = [];
            this.weekAnniversaries = [];
            this.celebrationsLoaded = true;
            this.celebrationsError = false;
            this.celebrationsUnauthorized = false;
          } else {
            this.celebrationsError = true;
          }
          this.loadingCelebrations = false;
          this.cdr.markForCheck();
        },
        error: (error) => {
          this.celebrationsUnauthorized = error?.status === 403;
          this.celebrationsError = error?.status !== 403;
          this.loadingCelebrations = false;
          this.cdr.markForCheck();
        }
      });
  }

  private mapCelebrationItem(item: {
    id: string;
    family_id?: string;
    name: string;
    day_label: string;
    date_label: string;
    detail: string;
  }): CelebrationItem {
    return {
      id: item.id,
      name: item.name,
      dayLabel: item.day_label,
      dateLabel: item.date_label,
      detail: item.detail,
      familyId: item.family_id,
    };
  }

  private mapBccHighlight(bcc: BCC): BccHighlight {
    const meetingDay = bcc.meeting_day ? this.capitalize(bcc.meeting_day) : '';
    const meetingTime = bcc.meeting_time ? this.formatTimeLabel(bcc.meeting_time) : '';
    const meetingLabel = [meetingDay, meetingTime].filter(Boolean).join(' · ') || 'Schedule not set';

    return {
      id: bcc.id,
      name: bcc.name,
      code: bcc.bcc_code,
      families: bcc.current_family_count ?? bcc.families_count ?? 0,
      meetingLabel,
      status: bcc.status
    };
  }

  private capitalize(value: string): string {
    return value.charAt(0).toUpperCase() + value.slice(1);
  }

  private formatTimeLabel(time: string): string {
    const match = time.match(/^(\d{1,2}):(\d{2})/);
    if (!match) return time;
    let hours = Number(match[1]);
    const minutes = match[2];
    const suffix = hours >= 12 ? 'PM' : 'AM';
    hours = hours % 12 || 12;
    return `${hours}:${minutes} ${suffix}`;
  }

  formatSacramentDate(dateValue: string): string {
    const date = new Date(dateValue);
    if (Number.isNaN(date.getTime())) return dateValue;
    return date.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' });
  }

  navigateToFamily(familyId?: string): void {
    if (familyId) {
      this.router.navigate(['/families', familyId]);
    }
  }

  navigateToBcc(bccId: string): void {
    this.router.navigate(['/bccs', bccId]);
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

  getChartBarHeightPx(value: number, max: number): number {
    if (!max) return 4;
    return Math.max(4, Math.round((value / max) * this.chartBarMaxHeightPx));
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
