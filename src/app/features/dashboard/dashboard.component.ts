import { Component, inject, OnInit, OnDestroy, ChangeDetectionStrategy, ChangeDetectorRef } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { Router } from '@angular/router';
import { Store } from '@ngrx/store';
import { Observable, Subject } from 'rxjs';
import { take, takeUntil } from 'rxjs/operators';

import { AppState } from '@core/store';
import { User } from '@core/models';
import { BCC, BCCStatistics, FamilyMember } from '@core/models/family.model';
import { selectCurrentUser } from '@core/store/auth/auth.selectors';
import { FamilyService } from '@core/services/family.service';
import { BCCService } from '@core/services/bcc.service';
import { MemberService } from '@features/members/services/member.service';
import { SacramentService } from '@features/settings/sacraments/services/sacrament.service';
import { Sacrament } from '@features/settings/sacraments/models/sacrament.model';
import { AuthService } from '@core/services/auth.service';
import { DonationsService } from '@features/donations/services/donations.service';
import { OperationsDashboardSummary } from '@features/donations/models/donation.model';

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

interface CareAlert {
  id: string;
  title: string;
  count: number;
  priority: 'urgent' | 'normal';
  action: string;
}

interface PastoralTask {
  id: string;
  title: string;
  assignee: string;
  due: string;
  status: 'open' | 'assigned';
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
  attendance: number;
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
  private donationsService = inject(DonationsService);
  private router = inject(Router);
  private cdr = inject(ChangeDetectorRef);
  private destroy$ = new Subject<void>();
  private tenantId: number | null = null;

  currentUser$: Observable<User | null>;
  today = new Date();
  searchQuery = '';
  readonly maxAttendance = 1350;
  readonly maxGiving = 180;
  readonly chartBarMaxHeightPx = 140;

  heroKpis: HeroKpi[] = [
    {
      id: 'attendance',
      label: 'Active Attendance',
      value: '1,284',
      sublabel: 'Last Sunday · In-person + Online',
      change: '+4.2%',
      trend: 'up',
      accent: 'forest',
      sparkline: [1180, 1210, 1195, 1240, 1268, 1275, 1284]
    },
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
      accent: 'slate',
      sparkline: [38200, 39500, 40100, 41200, 41800, 42100, 42850]
    }
  ];

  attendanceBreakdown = {
    inPerson: 892,
    online: 392,
    inPersonChange: '+3.1%',
    onlineChange: '+6.4%'
  };

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

  careAlerts: CareAlert[] = [
    { id: '1', title: 'Hospital visit requests', count: 3, priority: 'urgent', action: 'Assign pastoral team' },
    { id: '2', title: 'Member follow-ups pending', count: 2, priority: 'urgent', action: 'Review care queue' },
    { id: '3', title: 'Prayer chain responses due', count: 5, priority: 'normal', action: 'Send updates' },
    { id: '4', title: 'New believer discipleship', count: 4, priority: 'normal', action: 'Match mentors' }
  ];

  pastoralTasks: PastoralTask[] = [
    { id: 't1', title: 'Call Maria Santos — surgery recovery', assignee: 'Pastor James', due: 'Today', status: 'assigned' },
    { id: 't2', title: 'Home visit — Wilson family (new baby)', assignee: 'Unassigned', due: 'Tomorrow', status: 'open' },
    { id: 't3', title: 'Bereavement follow-up — Thompson family', assignee: 'Care Team Lead', due: 'Jun 7', status: 'assigned' },
    { id: 't4', title: 'Membership class check-in — April cohort', assignee: 'Executive Pastor', due: 'Jun 8', status: 'open' }
  ];

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

  attendanceGivingChart: ChartMonth[] = [
    { month: 'Jan', attendance: 1120, giving: 148 },
    { month: 'Feb', attendance: 1155, giving: 152 },
    { month: 'Mar', attendance: 1188, giving: 158 },
    { month: 'Apr', attendance: 1210, giving: 161 },
    { month: 'May', attendance: 1245, giving: 165 },
    { month: 'Jun', attendance: 1284, giving: 168 }
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

  constructor() {
    this.currentUser$ = this.store.select(selectCurrentUser);
  }

  ngOnInit(): void {
    this.weekRangeLabel = this.formatWeekRangeLabel();
    this.loadFamilyStatistics();
    this.loadBCCDetails();
    this.store.select(selectCurrentUser).pipe(take(1), takeUntil(this.destroy$)).subscribe(user => {
      if (user?.tenant_id) {
        this.tenantId = Number(user.tenant_id);
        this.loadSacramentDetails();
      }
      this.canViewFinancial = this.authService.canAccessDonations(user);
      if (this.canViewFinancial) {
        this.loadOperationsDashboard();
      }
      this.cdr.markForCheck();
    });
    this.loadMemberCelebrations();
  }

  ngOnDestroy(): void {
    this.destroy$.next();
    this.destroy$.complete();
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
              this.heroKpis[1].sublabel = `This month · ${assimilation}% assimilation rate`;
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

    this.heroKpis[3] = {
      ...this.heroKpis[3],
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

  loadBCCDetails(): void {
    this.loadingBccDetails = true;
    this.cdr.markForCheck();

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

    this.bccService.getBCCs({ status: 'active', sort_by: 'current_family_count', sort_order: 'desc', per_page: 5, page: 1 })
      .pipe(takeUntil(this.destroy$))
      .subscribe({
        next: (response) => {
          if (response.success && response.data) {
            this.bccHighlights = response.data.map(bcc => this.mapBccHighlight(bcc));
          }
          this.loadingBccDetails = false;
          this.cdr.markForCheck();
        },
        error: () => {
          this.loadingBccDetails = false;
          this.cdr.markForCheck();
        }
      });
  }

  loadSacramentDetails(): void {
    if (!this.tenantId) return;

    this.loadingSacraments = true;
    this.cdr.markForCheck();

    const now = new Date();
    const monthStart = new Date(now.getFullYear(), now.getMonth(), 1);
    const dateFrom = monthStart.toISOString().slice(0, 10);

    this.sacramentService.getSacraments({
      tenant_id: this.tenantId,
      per_page: 100,
      page: 1,
      date_from: dateFrom,
      sort_by: 'date_administered',
      sort_dir: 'desc',
      status: 'active'
    }).pipe(takeUntil(this.destroy$)).subscribe({
      next: (response) => {
        if (response.success && response.data) {
          const records = response.data.data || [];
          this.sacramentsThisMonth = response.data.total || records.length;
          this.sacramentHighlights = records.slice(0, 5).map(s => this.mapSacramentHighlight(s));
          this.sacramentTypeCounts = this.buildSacramentTypeCounts(records);
        }
        this.loadingSacraments = false;
        this.cdr.markForCheck();
      },
      error: () => {
        this.loadingSacraments = false;
        this.cdr.markForCheck();
      }
    });
  }

  loadMemberCelebrations(): void {
    this.loadingCelebrations = true;
    this.cdr.markForCheck();

    this.memberService.getMembers({ status: 'active', per_page: 500, page: 1, sort_by: 'first_name', sort_order: 'asc' })
      .pipe(takeUntil(this.destroy$))
      .subscribe({
        next: (response) => {
          if (response.success && response.data) {
            const { start, end } = this.getThisWeekRange();
            this.weekBirthdays = this.extractWeekBirthdays(response.data, start, end);
            this.weekAnniversaries = this.extractWeekAnniversaries(response.data, start, end);
          }
          this.loadingCelebrations = false;
          this.cdr.markForCheck();
        },
        error: () => {
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

  private mapSacramentHighlight(sacrament: Sacrament): SacramentHighlight {
    return {
      id: sacrament.id,
      typeName: sacrament.sacrament_type?.name || 'Sacrament',
      recipientName: sacrament.recipient_name,
      dateAdministered: sacrament.date_administered,
      place: sacrament.place_administered
    };
  }

  private buildSacramentTypeCounts(records: Sacrament[]): SacramentTypeCount[] {
    const counts = new Map<string, number>();
    for (const record of records) {
      const label = record.sacrament_type?.name || 'Other';
      counts.set(label, (counts.get(label) || 0) + 1);
    }
    return Array.from(counts.entries())
      .map(([label, count]) => ({ label, count }))
      .sort((a, b) => b.count - a.count)
      .slice(0, 4);
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

  assignTask(task: PastoralTask): void {
    task.assignee = 'Pastoral Staff';
    task.status = 'assigned';
    this.cdr.markForCheck();
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
