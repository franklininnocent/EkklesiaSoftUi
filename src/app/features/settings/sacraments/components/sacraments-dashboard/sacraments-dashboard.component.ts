import { CommonModule } from '@angular/common';
import {
  ChangeDetectionStrategy,
  ChangeDetectorRef,
  Component,
  DestroyRef,
  OnInit,
  inject,
} from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { ActivatedRoute, ParamMap, Router, RouterModule } from '@angular/router';
import { catchError, of, skip } from 'rxjs';
import { BCCService } from '@core/services/bcc.service';
import { BCC } from '@core/models/family.model';
import { PageHeaderComponent } from '@shared/components/page-header/page-header.component';
import { CfEmptyStateComponent } from '@shared/components/cf-empty-state/cf-empty-state.component';
import { LoadingSkeletonComponent } from '@shared/components/loading-skeleton/loading-skeleton.component';
import { SacramentService } from '../../services/sacrament.service';
import {
  SacramentDashboardGapSacrament,
  SacramentDashboardSummary,
  SacramentDashboardTrendPoint,
  SacramentDashboardTypeKpi,
  MarriageRegisterFilterKey,
} from '../../models/sacrament-dashboard.model';
import { SacramentDashboardGenderChartComponent } from './sacrament-dashboard-gender-chart.component';
import { SacramentDashboardAgeChartComponent } from './sacrament-dashboard-age-chart.component';
import { SacramentDashboardTypeDonutChartComponent } from './sacrament-dashboard-type-donut-chart.component';
import { SacramentDashboardMemberStatusChartComponent } from './sacrament-dashboard-member-status-chart.component';
import { SacramentDashboardParticipationSankeyComponent } from './sacrament-dashboard-participation-sankey.component';
import { SacramentDashboardMonthlyTrendChartComponent } from './sacrament-dashboard-monthly-trend-chart.component';
import {
  SacramentDashboardProgressionRadialChartComponent,
  SacramentDashboardProgressionKey,
} from './sacrament-dashboard-progression-radial-chart.component';
import { SacramentDashboardMarriageCanonicalRadialChartComponent } from './sacrament-dashboard-marriage-canonical-radial-chart.component';

type PeriodPreset = 'ytd' | 'month' | 'last12' | 'all';

@Component({
  selector: 'app-sacraments-dashboard',
  standalone: true,
  imports: [
    CommonModule,
    RouterModule,
    PageHeaderComponent,
    CfEmptyStateComponent,
    LoadingSkeletonComponent,
    SacramentDashboardGenderChartComponent,
    SacramentDashboardAgeChartComponent,
    SacramentDashboardTypeDonutChartComponent,
    SacramentDashboardMemberStatusChartComponent,
    SacramentDashboardParticipationSankeyComponent,
    SacramentDashboardMonthlyTrendChartComponent,
    SacramentDashboardProgressionRadialChartComponent,
    SacramentDashboardMarriageCanonicalRadialChartComponent,
  ],
  changeDetection: ChangeDetectionStrategy.OnPush,
  templateUrl: './sacraments-dashboard.component.html',
  styleUrl: './sacraments-dashboard.component.scss',
})
export class SacramentsDashboardComponent implements OnInit {
  private readonly sacramentService = inject(SacramentService);
  private readonly bccService = inject(BCCService);
  private readonly router = inject(Router);
  private readonly route = inject(ActivatedRoute);
  private readonly cdr = inject(ChangeDetectorRef);
  private readonly destroyRef = inject(DestroyRef);

  loading = false;
  error: string | null = null;
  summary: SacramentDashboardSummary | null = null;
  periodPreset: PeriodPreset = 'all';
  bccs: BCC[] = [];
  loadingBccs = false;
  selectedBccId: string | null = null;
  includeMarriageGaps = false;
  private urlStateInitialized = false;

  ngOnInit(): void {
    this.loadBccs();
    this.applyUrlState(this.route.snapshot.queryParamMap);
    this.route.queryParamMap
      .pipe(skip(1), takeUntilDestroyed(this.destroyRef))
      .subscribe((params) => this.applyUrlState(params));
  }

  loadBccs(): void {
    this.loadingBccs = true;
    this.bccService
      .getBCCs({ status: 'active', per_page: 500, sort_by: 'name', sort_order: 'asc' })
      .pipe(
        catchError(() => of({ success: false, data: [] as BCC[], total: 0, current_page: 1, last_page: 1, per_page: 500, from: 0, to: 0 })),
        takeUntilDestroyed(this.destroyRef)
      )
      .subscribe((response) => {
        this.loadingBccs = false;
        this.bccs = response.data ?? [];
        this.cdr.markForCheck();
      });
  }

  reload(): void {
    this.loading = true;
    this.error = null;

    this.sacramentService
      .getDashboardSummary(this.dashboardParams())
      .pipe(
        catchError((err: Error) => {
          this.error = err.message || 'Failed to load sacrament dashboard.';
          return of(null);
        }),
        takeUntilDestroyed(this.destroyRef)
      )
      .subscribe((response) => {
        this.loading = false;
        if (response?.success && response.data) {
          this.summary = response.data;
        }
        this.cdr.markForCheck();
      });
  }

  setPeriod(preset: PeriodPreset): void {
    if (this.periodPreset === preset) {
      return;
    }
    this.periodPreset = preset;
    this.syncUrlState();
    this.reload();
  }

  onPeriodKeydown(event: Event, preset: PeriodPreset): void {
    event.preventDefault();
    this.setPeriod(preset);
  }

  onBccChange(bccId: string): void {
    this.selectedBccId = bccId || null;
    this.syncUrlState();
    this.reload();
  }

  clearBccFilter(): void {
    if (!this.selectedBccId) {
      return;
    }
    this.selectedBccId = null;
    this.syncUrlState();
    this.reload();
  }

  setMarriageGaps(enabled: boolean): void {
    if (this.includeMarriageGaps === enabled) {
      return;
    }
    this.includeMarriageGaps = enabled;
    this.syncUrlState();
    this.reload();
  }

  get selectedBccLabel(): string | null {
    if (!this.selectedBccId) {
      return null;
    }

    return this.bccs.find((bcc) => bcc.id === this.selectedBccId)?.name ?? null;
  }

  get participationScopeLabel(): string {
    return this.selectedBccLabel ? this.selectedBccLabel : 'the parish';
  }

  get topTypeKpis(): SacramentDashboardTypeKpi[] {
    if (!this.summary) {
      return [];
    }

    return [...this.summary.kpis.by_type]
      .filter((row) => row.period > 0)
      .sort((a, b) => b.period - a.period)
      .slice(0, 4);
  }

  get memberTotal(): number {
    const status = this.summary?.breakdowns.member_status;
    if (!status) {
      return 0;
    }
    return status.member + status.non_member + status.unknown;
  }

  yoyLabel(value: number): string {
    if (value > 0) {
      return `+${value}%`;
    }
    if (value < 0) {
      return `${value}%`;
    }
    return '0%';
  }

  yoyClass(value: number): string {
    if (value > 0) {
      return 'sacraments-dashboard__yoy--up';
    }
    if (value < 0) {
      return 'sacraments-dashboard__yoy--down';
    }
    return 'sacraments-dashboard__yoy--flat';
  }

  yoyRailClass(value: number): string {
    if (value > 0) {
      return 'bcc-kpi-rail__delta--up';
    }
    if (value < 0) {
      return 'bcc-kpi-rail__delta--down';
    }
    return '';
  }

  periodButtonLabel(preset: PeriodPreset): string {
    const labels: Record<PeriodPreset, string> = {
      ytd: 'YTD',
      month: 'Month',
      last12: '12M',
      all: 'All',
    };
    return labels[preset];
  }

  periodButtonTitle(preset: PeriodPreset): string {
    const titles: Record<PeriodPreset, string> = {
      ytd: 'Year to date',
      month: 'This month',
      last12: 'Last 12 months',
      all: 'All time',
    };
    return titles[preset];
  }

  typeAccentClass(code: string): string {
    const normalized = (code ?? '').toUpperCase().replace(/[^A-Z0-9_]/g, '');
    const map: Record<string, string> = {
      BAPTISM: 'baptism',
      CONFIRMATION: 'confirmation',
      EUCHARIST: 'eucharist',
      FIRST_COMMUNION: 'eucharist',
      FIRSTCOMMUNION: 'eucharist',
      RECONCILIATION: 'reconciliation',
      ANOINTING: 'anointing',
      HOLY_ORDERS: 'holy-orders',
      MATRIMONY: 'matrimony',
      MARRIAGE: 'matrimony',
      WEDDING: 'matrimony',
    };

    return `sacraments-dashboard__breakdown-item--${map[normalized] ?? 'default'}`;
  }

  memberPct(kind: 'member' | 'non_member'): number {
    const total = this.memberTotal;
    if (!this.summary || total === 0) {
      return 0;
    }
    const value = this.summary.breakdowns.member_status[kind];
    return Math.round((value / total) * 100);
  }

  openCreate(): void {
    void this.router.navigate(['/sacraments/register'], {
      queryParams: { create: '1' },
    });
  }

  openRegister(filters: {
    sacrament_type_id?: number;
    date_from?: string;
    date_to?: string;
    bcc_id?: string;
    marriage_register_filter?: MarriageRegisterFilterKey;
  } = {}): void {
    void this.router.navigate(['/sacraments/register'], {
      queryParams: {
        ...filters,
        ...(this.selectedBccId && !filters.bcc_id ? { bcc_id: this.selectedBccId } : {}),
      },
    });
  }

  openRegisterMarriageCanonical(filter: MarriageRegisterFilterKey): void {
    const matrimonyTypeId = this.summary?.matrimony?.sacrament_type_id;
    if (!matrimonyTypeId) {
      return;
    }

    this.openRegister({
      sacrament_type_id: matrimonyTypeId,
      marriage_register_filter: filter,
    });
  }

  openRecord(id: number): void {
    void this.router.navigate(['/sacraments/view', id]);
  }

  get demographicsTypeOptions() {
    return this.summary?.demographics.gender_by_type ?? [];
  }

  get gaps() {
    return this.summary?.gaps ?? null;
  }

  get gapSacraments(): SacramentDashboardGapSacrament[] {
    return this.gaps?.by_sacrament ?? [];
  }

  openFamilies(): void {
    void this.router.navigate(['/families'], {
      queryParams: this.selectedBccId ? { bcc_id: this.selectedBccId } : {},
    });
  }

  openFamiliesMissing(sacramentCode: string): void {
    void this.router.navigate(['/families'], {
      queryParams: {
        missing_sacrament: sacramentCode,
        ...(this.selectedBccId ? { bcc_id: this.selectedBccId } : {}),
      },
    });
  }

  openMembersProgression(progression: SacramentDashboardProgressionKey): void {
    void this.router.navigate(['/members'], {
      queryParams: {
        progression,
        ...(this.selectedBccId ? { bcc_id: this.selectedBccId } : {}),
      },
    });
  }

  openTrendPoint(
    point: SacramentDashboardTrendPoint,
    seriesCode: string | null = null,
  ): void {
    if (!this.summary) {
      return;
    }

    const typeId = seriesCode
      ? this.summary.kpis.by_type.find((row) => row.code === seriesCode)?.sacrament_type_id
      : undefined;

    const [year, month] = point.period.split('-').map(Number);
    const start = new Date(year, month - 1, 1);
    const end = new Date(year, month, 0);

    this.openRegister({
      ...(typeId !== undefined ? { sacrament_type_id: typeId } : {}),
      date_from: this.formatDate(start),
      date_to: this.formatDate(end),
    });
  }

  private dashboardParams() {
    const range = this.resolveDateRange(this.periodPreset);

    return {
      ...range,
      ...(this.selectedBccId ? { bcc_id: this.selectedBccId } : {}),
      include_marriage_gaps: this.includeMarriageGaps,
    };
  }

  private resolveDateRange(preset: PeriodPreset): { date_from?: string; date_to?: string } {
    const today = new Date();
    const to = this.formatDate(today);

    switch (preset) {
      case 'month': {
        const start = new Date(today.getFullYear(), today.getMonth(), 1);
        return { date_from: this.formatDate(start), date_to: to };
      }
      case 'last12': {
        const start = new Date(today.getFullYear(), today.getMonth() - 11, 1);
        return { date_from: this.formatDate(start), date_to: to };
      }
      case 'all':
        return {};
      case 'ytd':
      default: {
        const start = new Date(today.getFullYear(), 0, 1);
        return { date_from: this.formatDate(start), date_to: to };
      }
    }
  }

  private formatDate(date: Date): string {
    const year = date.getFullYear();
    const month = String(date.getMonth() + 1).padStart(2, '0');
    const day = String(date.getDate()).padStart(2, '0');
    return `${year}-${month}-${day}`;
  }

  private applyUrlState(params: ParamMap): void {
    let changed = false;
    const bccId = params.get('bcc_id');
    const period = params.get('period');
    const marriageGaps = params.get('include_marriage_gaps') === '1';

    if ((bccId || null) !== this.selectedBccId) {
      this.selectedBccId = bccId || null;
      changed = true;
    }

    const nextPeriod = this.isPeriodPreset(period) ? period : 'all';
    if (nextPeriod !== this.periodPreset) {
      this.periodPreset = nextPeriod;
      changed = true;
    }

    if (marriageGaps !== this.includeMarriageGaps) {
      this.includeMarriageGaps = marriageGaps;
      changed = true;
    }

    if (changed || !this.urlStateInitialized) {
      this.urlStateInitialized = true;
      this.reload();
    }
  }

  private syncUrlState(): void {
    void this.router.navigate([], {
      relativeTo: this.route,
      queryParams: {
        bcc_id: this.selectedBccId || null,
        period: this.periodPreset === 'all' ? null : this.periodPreset,
        include_marriage_gaps: this.includeMarriageGaps ? '1' : null,
      },
      queryParamsHandling: 'merge',
      replaceUrl: true,
    });
  }

  private isPeriodPreset(value: string | null): value is PeriodPreset {
    return value === 'ytd' || value === 'month' || value === 'last12' || value === 'all';
  }
}
