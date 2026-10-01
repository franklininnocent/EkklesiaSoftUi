import { CommonModule } from '@angular/common';
import { Component, computed, inject, signal } from '@angular/core';
import { ActivatedRoute, Router, RouterModule } from '@angular/router';
import { AuthService } from '@core/services/auth.service';
import { CfEmptyStateComponent } from '@shared/components/cf-empty-state/cf-empty-state.component';
import { LoadingSkeletonComponent } from '@shared/components/loading-skeleton/loading-skeleton.component';
import { StatusBadgeComponent } from '@shared/components/status-badge/status-badge.component';
import { AddMassModalComponent } from '../components/add-mass-modal.component';
import { MassCelebrationsViewNavComponent } from '../components/mass-celebrations-view-nav.component';
import { SpecialDayScheduleModalComponent } from '../components/special-day-schedule-modal.component';
import { monthKeyFromWeekSunday } from '../utils/mass-celebrations-nav.util';
import { MassCelebrationSummary, MassIntentionsApiService } from '../services/mass-intentions-api.service';
import { formatMassCelebrationTime } from '../utils/mass-celebration-display';
import { canScheduleMasses } from '../utils/mass-intentions-auth.util';
import {
  formatMassWeekRangeLabel,
  MASS_WEEKDAY_LABELS,
  massWeekBoundsContaining,
  massWeekDayDates,
} from '../utils/mass-week.util';

@Component({
  selector: 'app-mass-celebrations-week-page',
  standalone: true,
  imports: [
    CommonModule,
    RouterModule,
    CfEmptyStateComponent,
    LoadingSkeletonComponent,
    StatusBadgeComponent,
    AddMassModalComponent,
    SpecialDayScheduleModalComponent,
    MassCelebrationsViewNavComponent,
  ],
  templateUrl: './mass-celebrations-week.page.html',
  styleUrl: './mass-celebrations-week.page.scss',
})
export class MassCelebrationsWeekPageComponent {
  private readonly api = inject(MassIntentionsApiService);
  private readonly auth = inject(AuthService);
  private readonly route = inject(ActivatedRoute);
  private readonly router = inject(Router);

  readonly loading = signal(true);
  readonly loadError = signal<string | null>(null);
  readonly items = signal<MassCelebrationSummary[]>([]);
  readonly showAddMass = signal(false);
  readonly addMassPrefillDate = signal('');
  readonly showSpecialDay = signal(false);
  readonly specialDayDate = signal('');
  readonly expandedDays = signal(new Set<string>());
  readonly weekSunday = signal(massWeekBoundsContaining().sunday);
  readonly scheduleDenied = signal(false);

  private static readonly MAX_VISIBLE_CHIPS = 4;

  readonly weekBounds = computed(() => {
    const sunday = this.weekSunday();
    const dates = massWeekDayDates(sunday);
    return {
      sunday,
      saturday: dates[6],
      dates,
      label: formatMassWeekRangeLabel({ sunday, saturday: dates[6] }),
    };
  });

  readonly daySections = computed(() => {
    const byDate = new Map<string, MassCelebrationSummary[]>();
    for (const row of this.items()) {
      const key = row.celebrated_on;
      if (!byDate.has(key)) {
        byDate.set(key, []);
      }
      byDate.get(key)!.push(row);
    }
    return this.weekBounds().dates.map((date, index) => ({
      date,
      label: MASS_WEEKDAY_LABELS[index],
      masses: (byDate.get(date) ?? []).sort((a, b) => (a.celebrated_at ?? '').localeCompare(b.celebrated_at ?? '')),
    }));
  });

  constructor() {
    this.route.queryParamMap.subscribe((params) => {
      this.scheduleDenied.set(params.get('schedule_denied') === '1');
      const week = params.get('week');
      if (week && /^\d{4}-\d{2}-\d{2}$/.test(week)) {
        const parts = week.split('-').map(Number);
        const anchor = new Date(parts[0], parts[1] - 1, parts[2]);
        this.weekSunday.set(massWeekBoundsContaining(anchor).sunday);
      } else {
        this.weekSunday.set(massWeekBoundsContaining().sunday);
      }
      this.reload();
    });
  }

  canScheduleMass(): boolean {
    return canScheduleMasses(this.auth);
  }

  dismissScheduleDenied(): void {
    this.scheduleDenied.set(false);
    void this.router.navigate([], {
      relativeTo: this.route,
      queryParams: { schedule_denied: null },
      queryParamsHandling: 'merge',
      replaceUrl: true,
    });
  }

  openSpecialDay(date: string): void {
    this.specialDayDate.set(date);
    this.showSpecialDay.set(true);
  }

  chipLabel(row: MassCelebrationSummary): string {
    const time = formatMassCelebrationTime(row.celebrated_at);
    const place = row.place?.trim();
    return place ? `${time} · ${place}` : time;
  }

  originBadge(row: MassCelebrationSummary): string {
    switch (row.origin) {
      case 'regular':
        return 'Regular';
      case 'temporary':
        return 'Temporary';
      case 'day_override':
        return 'Special day';
      case 'one_time':
        return 'One-time';
      default:
        return 'Mass';
    }
  }

  chipAriaLabel(row: MassCelebrationSummary): string {
    const parts = [this.originBadge(row), this.chipLabel(row)];
    if (row.status === 'cancelled') {
      parts.push('cancelled');
    }
    return parts.join(', ');
  }

  visibleMasses(masses: MassCelebrationSummary[], date: string): MassCelebrationSummary[] {
    if (this.expandedDays().has(date) || masses.length <= MassCelebrationsWeekPageComponent.MAX_VISIBLE_CHIPS) {
      return masses;
    }
    return masses.slice(0, MassCelebrationsWeekPageComponent.MAX_VISIBLE_CHIPS);
  }

  hiddenMassCount(masses: MassCelebrationSummary[], date: string): number {
    if (this.expandedDays().has(date)) {
      return 0;
    }
    return Math.max(0, masses.length - MassCelebrationsWeekPageComponent.MAX_VISIBLE_CHIPS);
  }

  expandDay(date: string): void {
    this.expandedDays.update((set) => new Set(set).add(date));
  }

  openAddMass(date = ''): void {
    this.addMassPrefillDate.set(date);
    this.showAddMass.set(true);
  }

  weekMonthKey(): string {
    return monthKeyFromWeekSunday(this.weekBounds().sunday);
  }

  reload(): void {
    this.loading.set(true);
    this.loadError.set(null);
    const { sunday, saturday } = this.weekBounds();
    this.api
      .listCelebrations({
        from: sunday,
        to: saturday,
        per_page: 100,
        page: 1,
        include_cancelled: 1,
      })
      .subscribe({
        next: (res) => {
          this.items.set(res.data ?? []);
          this.loading.set(false);
        },
        error: () => {
          this.loading.set(false);
          this.loadError.set('Could not load Masses for this week.');
        },
      });
  }

  isEmptyWeek(): boolean {
    return !this.loading() && this.items().length === 0;
  }

}
