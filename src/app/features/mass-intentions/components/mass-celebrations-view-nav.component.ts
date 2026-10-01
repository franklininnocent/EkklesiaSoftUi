import { ChangeDetectionStrategy, Component, computed, inject, input } from '@angular/core';
import { ActivatedRoute, Router, RouterModule } from '@angular/router';
import { CfActionIconComponent } from '@shared/components/cf-action-icon/cf-action-icon.component';
import {
  currentCalendarMonthKey,
  massWeekBoundsContaining,
} from '../utils/mass-week.util';
import {
  defaultWeekSundayForMonth,
  isCurrentCalendarMonth,
  isCurrentMassWeek,
  listViewQueryParams,
  MassCelebrationsCalendarView,
  monthKeyFromWeekSunday,
  preservedMassCelebrationFilters,
  shiftListMonth,
  shiftWeekSunday,
  weekViewQueryParams,
} from '../utils/mass-celebrations-nav.util';

@Component({
  selector: 'app-mass-celebrations-view-nav',
  standalone: true,
  imports: [RouterModule, CfActionIconComponent],
  templateUrl: './mass-celebrations-view-nav.component.html',
  styleUrl: './mass-celebrations-view-nav.component.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class MassCelebrationsViewNavComponent {
  readonly view = input.required<MassCelebrationsCalendarView>();
  readonly periodLabel = input.required<string>();
  readonly monthKey = input.required<string>();
  readonly weekSunday = input.required<string>();
  readonly canScheduleMass = input(false);

  private readonly router = inject(Router);
  private readonly route = inject(ActivatedRoute);

  readonly isCurrentPeriod = computed(() => {
    if (this.view() === 'list') {
      return isCurrentCalendarMonth(this.monthKey());
    }
    return isCurrentMassWeek(this.weekSunday());
  });

  readonly listSwitchParams = computed(() =>
    listViewQueryParams(this.monthKey(), preservedMassCelebrationFilters(this.route.snapshot.queryParamMap))
  );

  readonly weekSwitchParams = computed(() => {
    const week = defaultWeekSundayForMonth(this.monthKey());
    return weekViewQueryParams(week, preservedMassCelebrationFilters(this.route.snapshot.queryParamMap));
  });

  readonly listSwitchFromWeekParams = computed(() => {
    const month = monthKeyFromWeekSunday(this.weekSunday());
    return listViewQueryParams(month, preservedMassCelebrationFilters(this.route.snapshot.queryParamMap));
  });

  readonly pickerValue = computed(() =>
    this.view() === 'list' ? this.monthKey() : this.weekSunday()
  );

  readonly jumpFieldId = computed(() =>
    this.view() === 'list' ? 'mass-celebrations-jump-month' : 'mass-celebrations-jump-date'
  );

  periodNavAriaLabel(): string {
    return this.view() === 'list' ? 'Month navigation' : 'Week navigation';
  }

  prevLabel(): string {
    return this.view() === 'list' ? 'Previous month' : 'Previous week';
  }

  nextLabel(): string {
    return this.view() === 'list' ? 'Next month' : 'Next week';
  }

  resetLabel(): string {
    return this.view() === 'list' ? 'This month' : 'This week';
  }

  jumpControlLabel(): string {
    return this.view() === 'list' ? 'Month' : 'Week of';
  }

  jumpInputAriaLabel(): string {
    return this.view() === 'list' ? 'Choose month to view Masses' : 'Choose date to view that week';
  }

  goPrev(): void {
    if (this.view() === 'list') {
      this.navigateList(shiftListMonth(this.monthKey(), -1));
      return;
    }
    this.navigateWeek(shiftWeekSunday(this.weekSunday(), -1));
  }

  goNext(): void {
    if (this.view() === 'list') {
      this.navigateList(shiftListMonth(this.monthKey(), 1));
      return;
    }
    this.navigateWeek(shiftWeekSunday(this.weekSunday(), 1));
  }

  goToCurrentPeriod(): void {
    if (this.view() === 'list') {
      this.navigateList(currentCalendarMonthKey());
      return;
    }
    this.navigateWeek(massWeekBoundsContaining().sunday);
  }

  onPickerChange(raw: string): void {
    if (this.view() === 'list') {
      if (!raw || !/^\d{4}-\d{2}$/.test(raw)) {
        return;
      }
      this.navigateList(raw);
      return;
    }
    if (!raw || !/^\d{4}-\d{2}-\d{2}$/.test(raw)) {
      return;
    }
    const parts = raw.split('-').map(Number);
    const anchor = new Date(parts[0], parts[1] - 1, parts[2]);
    this.navigateWeek(massWeekBoundsContaining(anchor).sunday);
  }

  private navigateList(monthKey: string): void {
    void this.router.navigate(['/mass-intentions/masses'], {
      queryParams: listViewQueryParams(monthKey, preservedMassCelebrationFilters(this.route.snapshot.queryParamMap)),
      replaceUrl: true,
    });
  }

  private navigateWeek(weekSunday: string): void {
    void this.router.navigate(['/mass-intentions/masses/week'], {
      queryParams: weekViewQueryParams(weekSunday, preservedMassCelebrationFilters(this.route.snapshot.queryParamMap)),
      replaceUrl: true,
    });
  }
}
