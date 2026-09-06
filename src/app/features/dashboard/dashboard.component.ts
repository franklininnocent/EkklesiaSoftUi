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
import { catchError, take, takeUntil } from 'rxjs/operators';

import { AppState } from '@core/store';
import { User } from '@core/models';
import { BCC, BCCStatistics, FamilyMember } from '@core/models/family.model';
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

interface ScheduleItem {
  time: string;
  title: string;
  detail: string;
  status: 'confirmed' | 'pending' | 'action';
  category: 'service' | 'volunteer' | 'facility';
}

interface VolunteerShift {
  team: string;
  filled: number;
  required: number;
  status: 'healthy' | 'watch' | 'critical';
}

interface LifeGroupMetric {
  label: string;
  value: string;
  detail: string;
}

interface GivingChannel {
  channel: string;
  amount: string;
  share: number;
}

interface GivingSummary {
  weekly: string;
  monthly: string;
  budgetGoal: string;
  budgetPercent: number;
  recurringEnrollment: string;
  recurringTrend: 'up' | 'down';
}

interface ChartMonth {
  month: string;
  giving: number;
}

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
  private router = inject(Router);
  private cdr = inject(ChangeDetectorRef);
  private destroy$ = new Subject<void>();
  private tenantId: number | null = null;

  currentUser$: Observable<User | null>;
  today = new Date();
  searchQuery = '';
  readonly maxGiving = 180;
  readonly chartBarMaxHeightPx = 140;

  heroKpis: HeroKpi[] = [
    {
      id: 'visitors',
      label: 'New Visitors',
      value: '47',
      sublabel: 'This month · 68% assimilation rate',
      change: '+12%',
      trend: 'up',
      accent: 'indigo',
      sparkline: [28, 31, 35, 38, 41, 44, 47]
    },
    {
      id: 'volunteers',
      label: 'Sunday Volunteer Readiness',
      value: '78%',
      sublabel: 'Next service · 9:00 AM',
      change: '-6%',
      trend: 'down',
      accent: 'amber',
      sparkline: [92, 88, 85, 84, 82, 80, 78]
    },
    {
      id: 'tithes',
      label: 'Weekly Tithes',
      value: '$42,850',
      sublabel: 'vs. $45,000 budget goal',
      change: '+3.8%',
      trend: 'up',
      accent: 'forest',
      sparkline: [38200, 39500, 40100, 41200, 41800, 42100, 42850]
    }
  ];

  growthMetrics = {
    newMembers: 34,
    assimilationRate: 68,
    visitorsToActive: 23
  };

  lifeGroups: LifeGroupMetric[] = [
    { label: 'Active BCCs', value: '—', detail: 'Loading group count...' },
    { label: 'Utilization', value: '—', detail: 'Families placed in BCCs' },
    { label: 'BCC Leaders', value: '—', detail: 'Leaders serving groups' }
  ];

  todaySchedule: ScheduleItem[] = [
    {
      time: '7:30 AM',
      title: 'Media Team Check-in',
      detail: 'Main Sanctuary · Lead: David Okonkwo',
      status: 'confirmed',
      category: 'volunteer'
    },
    {
      time: '8:15 AM',
      title: 'Kids Ministry Briefing',
      detail: 'Building B · 4 volunteers still unconfirmed',
      status: 'action',
      category: 'volunteer'
    },
    {
      time: '9:00 AM',
      title: 'Sunday Morning Service',
      detail: 'Main Sanctuary · Worship + Message',
      status: 'confirmed',
      category: 'service'
    },
    {
      time: '10:45 AM',
      title: 'Second Service Overflow',
      detail: 'Fellowship Hall streaming feed',
      status: 'pending',
      category: 'service'
    },
    {
      time: '12:30 PM',
      title: 'Youth Wing Booking',
      detail: 'New Members Lunch · 86 registered',
      status: 'confirmed',
      category: 'facility'
    },
    {
      time: '4:00 PM',
      title: 'Evening Prayer Gathering',
      detail: 'Chapel · Pastor Elena Ramirez',
      status: 'confirmed',
      category: 'service'
    }
  ];

  volunteerShifts: VolunteerShift[] = [
    { team: 'Ushers & Greeters', filled: 18, required: 20, status: 'healthy' },
    { team: 'Worship & Production', filled: 14, required: 14, status: 'healthy' },
    { team: 'Kids Ministry', filled: 9, required: 15, status: 'critical' },
    { team: 'Coffee & Hospitality', filled: 7, required: 10, status: 'watch' },
    { team: 'Parking & Security', filled: 6, required: 8, status: 'watch' }
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

  givingSummary: GivingSummary = {
    weekly: '$42,850',
    monthly: '$168,400',
    budgetGoal: '$180,000',
    budgetPercent: 94,
    recurringEnrollment: '+18 new enrollments',
    recurringTrend: 'up'
  };

  givingChannels: GivingChannel[] = [
    { channel: 'Mobile App', amount: '$18,240', share: 43 },
    { channel: 'Web Portal', amount: '$11,620', share: 27 },
    { channel: 'Text-to-Give', amount: '$6,480', share: 15 },
    { channel: 'Physical Plate', amount: '$6,510', share: 15 }
  ];

  givingTrendChart: ChartMonth[] = [
    { month: 'Jan', giving: 148 },
    { month: 'Feb', giving: 152 },
    { month: 'Mar', giving: 158 },
    { month: 'Apr', giving: 161 },
    { month: 'May', giving: 165 },
    { month: 'Jun', giving: 168 }
  ];

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
  operationsSummary: OperationsDashboardSummary | null = null;
  loadingFinancial = false;
  canViewFinancial = false;

  showMinistriesSection = false;
  loadingMinistries = false;
  ministriesSummary: MinistriesDashboardSummary | null = null;
  ministriesActivity: MinistriesAuditLogEntry[] = [];
  canCreateOrganization = false;
  canManageMembers = false;
  canManageLeadership = false;
  canConfigureTaxonomies = false;

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
    this.weekRangeLabel = this.formatWeekRangeLabel();
    this.loadFamilyStatistics();
    this.loadBccStatistics();
    this.store.select(selectCurrentUser).pipe(take(1), takeUntil(this.destroy$)).subscribe(user => {
      if (user?.tenant_id) {
        this.tenantId = Number(user.tenant_id);
      }
      this.canViewFinancial = this.authService.canAccessDonations(user);
      if (this.canViewFinancial) {
        this.loadOperationsDashboard();
      }
      this.canViewPastoral = this.authService.canAccessPastoral(user);
      this.canAssignPastoral = this.authService.hasPermission('pastoral.care.assign');
      this.resolveMinistriesAccess(user);
      if (this.operationsVisited) {
        this.loadOperationsScopedData();
      }
      this.cdr.markForCheck();
    });
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
    this.loadMemberCelebrations();
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
    this.familyService.getStatistics()
      .pipe(takeUntil(this.destroy$))
      .subscribe({
        next: (response) => {
          if (response.success && response.data) {
            this.totalFamilies = response.data.total_families || 0;
            this.totalMembers = response.data.total_members || 0;
            if (this.totalMembers > 0) {
              const assimilation = Math.min(95, Math.round((this.totalMembers / Math.max(this.totalMembers, 200)) * 68));
              this.growthMetrics.newMembers = Math.max(this.growthMetrics.newMembers, Math.round(this.totalMembers * 0.024));
              this.growthMetrics.assimilationRate = assimilation;
              this.heroKpis[0].sublabel = `This month · ${assimilation}% assimilation rate`;
            }
          }
          this.cdr.markForCheck();
        },
        error: () => this.cdr.markForCheck()
      });
  }

  loadOperationsDashboard(): void {
    this.loadingFinancial = true;
    this.donationsService.getOperationsDashboard().pipe(takeUntil(this.destroy$)).subscribe({
      next: (response) => {
        this.operationsSummary = response.data ?? null;
        this.applyFinancialSnapshot(this.operationsSummary);
        this.loadingFinancial = false;
        this.cdr.markForCheck();
      },
      error: () => {
        this.loadingFinancial = false;
        this.cdr.markForCheck();
      }
    });
  }

  private applyFinancialSnapshot(summary: OperationsDashboardSummary | null): void {
    if (!summary?.financial) {
      return;
    }

    const monthCollected = summary.financial.totals?.current_month_collected ?? 0;
    const outstanding = summary.financial.totals?.pending_dues ?? 0;
    const health = summary.financial.health;

    this.heroKpis[2] = {
      ...this.heroKpis[2],
      label: 'Collections This Month',
      value: this.formatCurrency(monthCollected),
      sublabel: `${summary.financial.families?.participation_rate ?? 0}% family participation`,
      change: health?.label ?? 'Live',
      trend: health?.status === 'risk' ? 'down' : 'up'
    };

    this.givingSummary = {
      weekly: this.formatCurrency(monthCollected * 0.25),
      monthly: this.formatCurrency(monthCollected),
      budgetGoal: this.formatCurrency(Math.max(monthCollected, outstanding + monthCollected)),
      budgetPercent: monthCollected > 0 ? Math.min(100, Math.round((monthCollected / Math.max(outstanding + monthCollected, 1)) * 100)) : 0,
      recurringEnrollment: `${summary.financial.attention_summary?.count ?? 0} families need follow-up`,
      recurringTrend: (summary.financial.attention_summary?.count ?? 0) > 0 ? 'down' : 'up'
    };
  }

  formatCurrency(value: number): string {
    return new Intl.NumberFormat(undefined, { style: 'currency', currency: 'INR', maximumFractionDigits: 0 }).format(value);
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
    const hasActiveSupportSession = !!this.supportSessions.sessionId;
    if (!this.authService.canAccessMinistries(user, { hasActiveSupportSession })) {
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
    if (this.ministriesActivityLoaded || this.loadingMinistriesActivity) {
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
    this.bccService.getStatistics()
      .pipe(takeUntil(this.destroy$))
      .subscribe({
        next: (response) => {
          if (response.success && response.data) {
            this.bccStatistics = response.data;
            this.totalBCCs = response.data.total_bccs || 0;
            this.lifeGroups[0].value = String(response.data.active_bccs || this.totalBCCs);
            this.lifeGroups[0].detail = `${response.data.total_families_in_bccs || 0} families assigned`;
            this.lifeGroups[1].value = `${response.data.utilization_percentage || 0}%`;
            this.lifeGroups[1].detail = `${response.data.bccs_with_space || 0} groups have open capacity`;
            this.lifeGroups[2].value = String(response.data.total_leaders || 0);
            this.lifeGroups[2].detail = 'Active BCC leaders across parish';
          }
          this.cdr.markForCheck();
        },
        error: () => this.cdr.markForCheck()
      });
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

    const now = new Date();
    const monthStart = new Date(now.getFullYear(), now.getMonth(), 1);
    const dateFrom = monthStart.toISOString().slice(0, 10);
    const dateTo = now.toISOString().slice(0, 10);

    this.sacramentService.getDashboardSummary({
      date_from: dateFrom,
      date_to: dateTo,
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
    this.cdr.markForCheck();

    this.memberService.getMembers({ status: 'active', per_page: 500, page: 1, sort_by: 'first_name', sort_order: 'asc' })
      .pipe(takeUntil(this.destroy$))
      .subscribe({
        next: (response) => {
          if (response.success && response.data) {
            const { start, end } = this.getThisWeekRange();
            this.weekBirthdays = this.extractWeekBirthdays(response.data, start, end);
            this.weekAnniversaries = this.extractWeekAnniversaries(response.data, start, end);
            this.celebrationsLoaded = true;
            this.celebrationsError = false;
          } else if (response.success) {
            this.weekBirthdays = [];
            this.weekAnniversaries = [];
            this.celebrationsLoaded = true;
            this.celebrationsError = false;
          } else {
            this.celebrationsError = true;
          }
          this.loadingCelebrations = false;
          this.cdr.markForCheck();
        },
        error: () => {
          this.celebrationsError = true;
          this.loadingCelebrations = false;
          this.cdr.markForCheck();
        }
      });
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

  private extractWeekBirthdays(members: FamilyMember[], weekStart: Date, weekEnd: Date): CelebrationItem[] {
    const items: CelebrationItem[] = [];

    for (const member of members) {
      if (!member.date_of_birth || member.status === 'deceased') continue;
      const parsed = this.parseMonthDay(member.date_of_birth);
      if (!parsed || !this.isMonthDayInWeek(parsed.month, parsed.day, weekStart, weekEnd)) continue;

      const eventDate = new Date(new Date().getFullYear(), parsed.month - 1, parsed.day);
      const age = this.calculateAge(member.date_of_birth, eventDate);

      items.push({
        id: member.id,
        name: this.getMemberDisplayName(member),
        dayLabel: eventDate.toLocaleDateString('en-US', { weekday: 'short' }),
        dateLabel: eventDate.toLocaleDateString('en-US', { month: 'short', day: 'numeric' }),
        detail: age !== null ? `Turning ${age}` : 'Birthday',
        familyId: member.family_id
      });
    }

    return items.sort((a, b) => this.compareCelebrationDates(a, b));
  }

  private extractWeekAnniversaries(members: FamilyMember[], weekStart: Date, weekEnd: Date): CelebrationItem[] {
    const items: CelebrationItem[] = [];

    for (const member of members) {
      if (!member.marriage_date || member.status === 'deceased') continue;
      const parsed = this.parseMonthDay(member.marriage_date);
      if (!parsed || !this.isMonthDayInWeek(parsed.month, parsed.day, weekStart, weekEnd)) continue;

      const eventDate = new Date(new Date().getFullYear(), parsed.month - 1, parsed.day);
      const years = eventDate.getFullYear() - new Date(member.marriage_date).getFullYear();
      const spouse = member.marriage_spouse_name?.trim();
      const coupleName = spouse
        ? `${this.getMemberDisplayName(member)} & ${spouse}`
        : this.getMemberDisplayName(member);

      items.push({
        id: `${member.id}-anniversary`,
        name: coupleName,
        dayLabel: eventDate.toLocaleDateString('en-US', { weekday: 'short' }),
        dateLabel: eventDate.toLocaleDateString('en-US', { month: 'short', day: 'numeric' }),
        detail: years > 0 ? `${years} years together` : 'Wedding anniversary',
        familyId: member.family_id
      });
    }

    return items.sort((a, b) => this.compareCelebrationDates(a, b));
  }

  private getMemberDisplayName(member: FamilyMember): string {
    return member.full_name?.trim() || `${member.first_name} ${member.last_name}`.trim();
  }

  private getThisWeekRange(): { start: Date; end: Date } {
    const now = new Date();
    const day = now.getDay();
    const diffToMonday = day === 0 ? -6 : 1 - day;
    const start = new Date(now);
    start.setHours(0, 0, 0, 0);
    start.setDate(now.getDate() + diffToMonday);
    const end = new Date(start);
    end.setDate(start.getDate() + 6);
    end.setHours(23, 59, 59, 999);
    return { start, end };
  }

  private formatWeekRangeLabel(): string {
    const { start, end } = this.getThisWeekRange();
    const startLabel = start.toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
    const endLabel = end.toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
    return `${startLabel} – ${endLabel}`;
  }

  private parseMonthDay(dateValue: string): { month: number; day: number } | null {
    const parts = dateValue.split('T')[0].split('-').map(Number);
    if (parts.length < 3 || !parts[1] || !parts[2]) return null;
    return { month: parts[1], day: parts[2] };
  }

  private isMonthDayInWeek(month: number, day: number, weekStart: Date, weekEnd: Date): boolean {
    const eventDate = new Date(new Date().getFullYear(), month - 1, day);
    eventDate.setHours(12, 0, 0, 0);
    return eventDate >= weekStart && eventDate <= weekEnd;
  }

  private calculateAge(dateOfBirth: string, onDate: Date): number | null {
    const birth = new Date(dateOfBirth);
    if (Number.isNaN(birth.getTime())) return null;
    let age = onDate.getFullYear() - birth.getFullYear();
    const monthDiff = onDate.getMonth() - birth.getMonth();
    if (monthDiff < 0 || (monthDiff === 0 && onDate.getDate() < birth.getDate())) {
      age -= 1;
    }
    return age + 1;
  }

  private compareCelebrationDates(a: CelebrationItem, b: CelebrationItem): number {
    const order = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'];
    return order.indexOf(a.dayLabel) - order.indexOf(b.dayLabel);
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

  getVolunteerPercent(shift: VolunteerShift): number {
    return Math.round((shift.filled / shift.required) * 100);
  }

  getVolunteerRingOffset(shift: VolunteerShift): number {
    const circumference = 2 * Math.PI * 16;
    const percent = this.getVolunteerPercent(shift) / 100;
    return circumference * (1 - percent);
  }

  navigateTo(route: string): void {
    this.router.navigate([route]);
  }

  onSearchKeydown(event: KeyboardEvent): void {
    if ((event.metaKey || event.ctrlKey) && event.key === 'k') {
      event.preventDefault();
      const input = event.target as HTMLInputElement;
      input?.focus();
    }
  }

  private loadPastoralWorkflow(): void {
    this.loadingPastoral = true;
    this.pastoralCare
      .dashboard()
      .pipe(takeUntil(this.destroy$))
      .subscribe({
        next: (data) => {
          this.careAlerts = data?.alerts ?? [];
          this.pastoralTasks = data?.tasks ?? [];
          this.pastoralLoaded = true;
          this.loadingPastoral = false;
          this.cdr.markForCheck();
        },
        error: () => {
          this.careAlerts = [];
          this.pastoralTasks = [];
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
