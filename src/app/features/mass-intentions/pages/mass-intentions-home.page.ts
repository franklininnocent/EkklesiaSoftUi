import { CommonModule } from '@angular/common';
import { Component, inject, signal } from '@angular/core';
import { RouterModule } from '@angular/router';
import { AuthService } from '@core/services/auth.service';
import { CfEmptyStateComponent } from '@shared/components/cf-empty-state/cf-empty-state.component';
import { LoadingSkeletonComponent } from '@shared/components/loading-skeleton/loading-skeleton.component';
import { PageHeaderComponent } from '@shared/components/page-header/page-header.component';
import { CfCurrencyPipe } from '@shared/pipes/cf-currency.pipe';
import {
  MassIntentionsApiService,
  MassIntentionsHomeSummary,
  MassIntentionsTrendPoint,
  MassIntentionsUpcomingCelebration,
} from '../services/mass-intentions-api.service';
import { cfEnglishMonthShort, cfEnglishWeekdayShort } from '@shared/utils/cf-intl.util';
import { formatMassCelebrationTime } from '../utils/mass-celebration-display';
import { formatMassIntentionScheduledDay } from '../utils/mass-intention-list-display';
import { MassIntentionsSixMonthTrendComponent } from '../components/mass-intentions-six-month-trend.component';
import {
  canCreateMassIntention,
  canExportMassRegister,
  canScheduleMasses,
  canViewMassOfferings,
} from '../utils/mass-intentions-auth.util';
import { massIntentionsHomePeriodSubtitle } from '../utils/mass-intentions-chrome-header.util';

@Component({
  selector: 'app-mass-intentions-home-page',
  standalone: true,
  imports: [
    CommonModule,
    RouterModule,
    PageHeaderComponent,
    LoadingSkeletonComponent,
    CfEmptyStateComponent,
    CfCurrencyPipe,
    MassIntentionsSixMonthTrendComponent,
  ],
  templateUrl: './mass-intentions-home.page.html',
  styleUrl: './mass-intentions-home.page.scss',
})
export class MassIntentionsHomePageComponent {
  private readonly api = inject(MassIntentionsApiService);
  private readonly auth = inject(AuthService);

  readonly loading = signal(true);
  readonly loadError = signal<string | null>(null);
  readonly summary = signal<MassIntentionsHomeSummary | null>(null);

  constructor() {
    this.reload();
  }

  reload(): void {
    this.loading.set(true);
    this.loadError.set(null);
    this.api.getHome().subscribe({
      next: (res) => {
        this.summary.set(res.data);
        this.loading.set(false);
      },
      error: () => {
        this.loading.set(false);
        this.loadError.set('Could not load the Mass intention dashboard.');
      },
    });
  }

  canCreate(): boolean {
    return canCreateMassIntention(this.auth);
  }

  canSchedule(): boolean {
    return canScheduleMasses(this.auth);
  }

  canLinkOfferingsReport(): boolean {
    return canExportMassRegister(this.auth) && canViewMassOfferings(this.auth);
  }

  periodSubtitle(): string {
    return massIntentionsHomePeriodSubtitle(this.summary()?.period.label);
  }

  lastMonthHint(lastMonth: number | undefined): string {
    if (lastMonth === undefined) {
      return 'Compared with last month when available';
    }
    return `${lastMonth} last month`;
  }

  trendPoints(): MassIntentionsTrendPoint[] {
    return this.summary()?.trend ?? [];
  }

  upcomingMasses(s: MassIntentionsHomeSummary): MassIntentionsUpcomingCelebration[] {
    return s.upcoming_celebrations ?? [];
  }

  isNextUpcomingMass(s: MassIntentionsHomeSummary, mass: MassIntentionsUpcomingCelebration): boolean {
    const nextId = s.meta?.next_upcoming_celebration_id;
    if (nextId) {
      return mass.id === nextId;
    }
    const list = this.upcomingMasses(s);
    return list.length > 0 && list[0].id === mass.id;
  }

  operationalNeedsTick(s: MassIntentionsHomeSummary): number {
    return s.operational?.needs_a_tick ?? s.kpis?.needs_a_tick ?? 0;
  }

  operationalNeedsAMass(s: MassIntentionsHomeSummary): number {
    return s.operational?.needs_a_mass ?? s.kpis?.needs_a_mass ?? 0;
  }

  operationalScheduleAttention(s: MassIntentionsHomeSummary): number {
    return s.operational?.schedule_attention ?? s.kpis?.schedule_attention ?? 0;
  }

  generationNeedsAttention(s: MassIntentionsHomeSummary): boolean {
    return s.generation?.attention_required === true;
  }

  showScheduleAttention(s: MassIntentionsHomeSummary): boolean {
    if (!this.canSchedule()) {
      return false;
    }
    return this.operationalScheduleAttention(s) > 0 || this.generationNeedsAttention(s);
  }

  scheduleAttentionLabel(s: MassIntentionsHomeSummary): string {
    if (this.operationalScheduleAttention(s) > 0) {
      return `Schedule preview (${this.operationalScheduleAttention(s)})`;
    }
    return 'Mass calendar';
  }

  showAttentionStrip(s: MassIntentionsHomeSummary): boolean {
    return (
      this.operationalNeedsTick(s) > 0 ||
      this.operationalNeedsAMass(s) > 0 ||
      this.showScheduleAttention(s)
    );
  }

  attentionSummary(s: MassIntentionsHomeSummary): string {
    const parts: string[] = [];
    if (this.operationalNeedsTick(s) > 0) {
      parts.push(`${this.operationalNeedsTick(s)} Mass${this.operationalNeedsTick(s) === 1 ? '' : 'es'} to mark said`);
    }
    if (this.operationalNeedsAMass(s) > 0) {
      parts.push(`${this.operationalNeedsAMass(s)} without a Mass`);
    }
    if (this.showScheduleAttention(s)) {
      if (this.generationNeedsAttention(s)) {
        parts.push('calendar generation behind');
      } else if (this.operationalScheduleAttention(s) > 0) {
        parts.push('schedule preview conflicts');
      }
    }
    return parts.join(' · ');
  }

  registeredThisMonthParams(s: MassIntentionsHomeSummary): Record<string, string> {
    const from = s.period.created_from;
    const to = s.period.created_to;
    if (from && to) {
      return { status: 'all', created_from: from, created_to: to };
    }
    return {};
  }

  showOfferingsKpi(s: MassIntentionsHomeSummary): boolean {
    return (
      canViewMassOfferings(this.auth) &&
      (s.offerings?.received_this_month != null || s.kpis?.offering_received_this_month != null)
    );
  }

  offeringsThisMonth(s: MassIntentionsHomeSummary): string {
    return s.offerings?.received_this_month ?? s.kpis?.offering_received_this_month ?? '0';
  }

  offeringsReceiptHint(s: MassIntentionsHomeSummary): string {
    const count = s.offerings?.receipts_this_month ?? s.kpis?.receipts_this_month;
    if (count === undefined) {
      return 'Received this month';
    }
    return `${count} receipt${count === 1 ? '' : 's'} this month`;
  }

  formatMassDay(iso: string | null | undefined): string {
    return formatMassIntentionScheduledDay(iso);
  }

  formatMassTime(at: string | null | undefined): string {
    return at ? formatMassCelebrationTime(at) : '';
  }

  massDateWeekday(iso: string | null | undefined): string {
    const parsed = this.parseMassDate(iso);
    return parsed ? cfEnglishWeekdayShort(parsed) : '—';
  }

  massDateDay(iso: string | null | undefined): string {
    const parsed = this.parseMassDate(iso);
    return parsed ? String(parsed.getDate()) : '—';
  }

  massDateMonth(iso: string | null | undefined): string {
    const parsed = this.parseMassDate(iso);
    return parsed ? cfEnglishMonthShort(parsed) : '';
  }

  intentionCountLabel(count: number | null | undefined): string {
    const n = count ?? 0;
    if (n === 0) {
      return 'None yet';
    }
    return n === 1 ? 'intention' : 'intentions';
  }

  massRowAriaLabel(mass: MassIntentionsUpcomingCelebration): string {
    const when = `${this.formatMassDay(mass.celebrated_on)}, ${this.formatMassTime(mass.celebrated_at) || 'time not set'}`;
    const parts = [when];
    if (mass.place?.trim()) {
      parts.push(mass.place.trim());
    }
    if (mass.celebrant_name?.trim()) {
      parts.push(mass.celebrant_name.trim());
    }
    const count = mass.intention_count ?? 0;
    parts.push(`${count} intention${count === 1 ? '' : 's'}`);
    return parts.join(', ');
  }

  private parseMassDate(iso: string | null | undefined): Date | null {
    if (!iso) {
      return null;
    }
    const parsed = new Date(`${iso}T12:00:00`);
    return Number.isNaN(parsed.getTime()) ? null : parsed;
  }

}
