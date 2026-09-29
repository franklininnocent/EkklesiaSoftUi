import { CommonModule } from '@angular/common';
import {
  AfterViewInit,
  ChangeDetectionStrategy,
  ChangeDetectorRef,
  Component,
  ElementRef,
  EventEmitter,
  Input,
  OnChanges,
  OnDestroy,
  Output,
  SimpleChanges,
  ViewChild,
  inject,
} from '@angular/core';
import { Chart } from 'chart.js/auto';
import {
  SacramentDashboardAgeBucket,
  SacramentDashboardMatrimony,
} from '../../models/sacrament-dashboard.model';
import { SacramentDashboardMatrimonyAgeRadialChartComponent } from './sacrament-dashboard-matrimony-age-radial-chart.component';

interface MatrimonyCategoryRow {
  key: string;
  label: string;
  count: number;
}

const CANONICAL_LABELS: Record<string, string> = {
  both_catholic: 'Both Catholic',
  mixed_marriage: 'Mixed marriage',
  disparity_of_cult: 'Disparity of cult',
  other: 'Other',
  unspecified: 'Unspecified',
};

const PARISH_COLORS = ['#0d9488', '#14b8a6', '#2dd4bf', '#5eead4', '#0f766e', '#115e59'];
const CANONICAL_COLORS = ['#2563eb', '#7c3aed', '#d97706', '#64748b', '#9aa3b2'];

@Component({
  selector: 'app-sacrament-dashboard-matrimony-insights',
  standalone: true,
  imports: [CommonModule, SacramentDashboardMatrimonyAgeRadialChartComponent],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <section class="matrimony-insights" aria-labelledby="matrimony-insights-title">
      <header class="matrimony-insights__head">
        <div>
          <h2 id="matrimony-insights-title" class="cf-section-title">Marriage insights</h2>
          <p class="cf-meta matrimony-insights__subtitle">
            {{ matrimony.count }} {{ matrimony.count === 1 ? 'marriage' : 'marriages' }}
            <span *ngIf="periodLabel">· {{ periodLabel }}</span>
          </p>
        </div>
        <button type="button" class="cf-btn cf-btn--sm" (click)="viewRegister.emit()">
          View marriages
        </button>
      </header>

      <div
        class="matrimony-insights__period-hint"
        *ngIf="matrimony.count === 0 && marriagesAllTime > 0"
        role="status"
      >
        <p class="cf-meta matrimony-insights__period-hint-copy">
          No marriages in {{ periodLabel || 'this period' }}, but this parish has
          <strong>{{ marriagesAllTime }}</strong>
          {{ marriagesAllTime === 1 ? 'marriage' : 'marriages' }} on record.
          Choose a wider period to view charts.
        </p>
        <div class="matrimony-insights__period-actions">
          <button type="button" class="cf-btn cf-btn--sm" (click)="changePeriod.emit('last12')">
            Last 12 months
          </button>
          <button type="button" class="cf-btn cf-btn--sm" (click)="changePeriod.emit('all')">
            All time
          </button>
        </div>
      </div>

      <div class="matrimony-insights__kpi-grid" role="list" aria-label="Marriage summary metrics">
        <article class="matrimony-insights__kpi" role="listitem">
          <span class="matrimony-insights__kpi-label">Marriages</span>
          <strong class="matrimony-insights__kpi-value">{{ matrimony.count }}</strong>
        </article>
        <article class="matrimony-insights__kpi" role="listitem">
          <span class="matrimony-insights__kpi-label">Bride average age</span>
          <strong class="matrimony-insights__kpi-value">{{ formatAge(matrimony.bride_avg_age) }}</strong>
          <span class="matrimony-insights__kpi-range cf-meta" *ngIf="brideAgeRange">{{ brideAgeRange }}</span>
        </article>
        <article class="matrimony-insights__kpi" role="listitem">
          <span class="matrimony-insights__kpi-label">Groom average age</span>
          <strong class="matrimony-insights__kpi-value">{{ formatAge(matrimony.groom_avg_age) }}</strong>
          <span class="matrimony-insights__kpi-range cf-meta" *ngIf="groomAgeRange">{{ groomAgeRange }}</span>
        </article>
        <article class="matrimony-insights__kpi" role="listitem">
          <span class="matrimony-insights__kpi-label">Inter-parish</span>
          <strong class="matrimony-insights__kpi-value">{{ matrimony.inter_parish_count }}</strong>
        </article>
      </div>

      <article class="matrimony-insights__card matrimony-insights__card--primary">
        <header class="matrimony-insights__card-head">
          <h3 class="matrimony-insights__card-title">Age at marriage</h3>
          <p class="cf-meta matrimony-insights__card-meta">Bride and groom distribution by age bracket</p>
        </header>
        <div class="matrimony-insights__card-body">
          <app-sacrament-dashboard-matrimony-age-radial-chart
            *ngIf="hasAgeData; else ageEmpty"
            [brideBuckets]="matrimony.age_brackets.bride"
            [groomBuckets]="matrimony.age_brackets.groom"
          ></app-sacrament-dashboard-matrimony-age-radial-chart>
          <ng-template #ageEmpty>
            <p class="matrimony-insights__empty">
              {{ matrimony.count > 0
                ? 'No bride or groom age data recorded for marriages in this period.'
                : 'No marriages recorded in this period.' }}
            </p>
          </ng-template>
        </div>
      </article>

      <div class="matrimony-insights__secondary-grid">
        <article class="matrimony-insights__card">
          <header class="matrimony-insights__card-head">
            <h3 class="matrimony-insights__card-title">Parish of origin</h3>
            <p class="cf-meta matrimony-insights__card-meta">Top parishes recorded for bride or groom</p>
          </header>
          <div class="matrimony-insights__card-body">
            <p class="sacrament-chart__sr-only" *ngIf="hasParishData">{{ parishDataSummary }}</p>
            <div class="matrimony-insights__chart-wrap matrimony-insights__chart-wrap--secondary" *ngIf="hasParishData; else parishEmpty">
              <canvas #parishChartCanvas role="img" [attr.aria-label]="parishDataSummary"></canvas>
            </div>
            <ng-template #parishEmpty>
              <p class="matrimony-insights__empty">
                {{ matrimony.count > 0
                  ? 'No parish of origin recorded yet.'
                  : 'No marriages recorded in this period.' }}
              </p>
            </ng-template>
          </div>
        </article>

        <article class="matrimony-insights__card">
          <header class="matrimony-insights__card-head">
            <h3 class="matrimony-insights__card-title">Canonical classification</h3>
            <p class="cf-meta matrimony-insights__card-meta">Marriage type breakdown for this period</p>
          </header>
          <div class="matrimony-insights__card-body">
            <p class="sacrament-chart__sr-only" *ngIf="hasCanonicalData">{{ canonicalDataSummary }}</p>
            <div class="matrimony-insights__chart-wrap matrimony-insights__chart-wrap--secondary" *ngIf="hasCanonicalData; else canonicalEmpty">
              <canvas #canonicalChartCanvas role="img" [attr.aria-label]="canonicalDataSummary"></canvas>
            </div>
            <ng-template #canonicalEmpty>
              <p class="matrimony-insights__empty">
                {{ matrimony.count > 0
                  ? 'No canonical classification recorded yet.'
                  : 'No marriages recorded in this period.' }}
              </p>
            </ng-template>
          </div>
        </article>
      </div>
    </section>
  `,
  styles: [`
    :host {
      display: block;
    }

    .matrimony-insights__head {
      display: flex;
      justify-content: space-between;
      align-items: flex-start;
      gap: var(--cf-space-2);
      margin-bottom: var(--cf-space-3);
    }

    .matrimony-insights__subtitle {
      margin: var(--cf-space-1) 0 0;
    }

    .matrimony-insights__period-hint {
      display: flex;
      flex-wrap: wrap;
      align-items: center;
      justify-content: space-between;
      gap: var(--cf-space-2);
      margin-bottom: var(--cf-space-3);
      padding: var(--cf-space-2) var(--cf-space-3);
      border: 1px solid var(--cf-border-subtle);
      border-radius: var(--cf-radius-md);
      background: color-mix(in srgb, var(--cf-primary) 6%, var(--cf-surface));
    }

    .matrimony-insights__period-hint-copy {
      margin: 0;
      flex: 1 1 16rem;
    }

    .matrimony-insights__period-actions {
      display: flex;
      flex-wrap: wrap;
      gap: var(--cf-space-1);
    }

    .matrimony-insights__kpi-grid {
      display: grid;
      grid-template-columns: repeat(4, minmax(0, 1fr));
      gap: var(--cf-space-2);
      margin-bottom: var(--cf-space-3);
    }

    .matrimony-insights__kpi {
      display: grid;
      gap: 0.2rem;
      padding: var(--cf-space-2);
      border: 1px solid var(--cf-border-subtle);
      border-radius: var(--cf-radius-md);
      background: var(--cf-surface);
      min-width: 0;
    }

    .matrimony-insights__kpi-label {
      font-size: var(--cf-font-size-body-sm);
      color: var(--cf-text-muted);
      line-height: 1.3;
    }

    .matrimony-insights__kpi-value {
      font-size: 1.35rem;
      line-height: 1.1;
      color: var(--cf-text);
      font-weight: 600;
    }

    .matrimony-insights__kpi-range {
      font-size: 0.75rem;
      line-height: 1.2;
    }

    .matrimony-insights__card {
      display: flex;
      flex-direction: column;
      min-width: 0;
      border: 1px solid var(--cf-border-subtle);
      border-radius: var(--cf-radius-md);
      background: var(--cf-surface);
      padding: var(--cf-space-2);
      overflow: hidden;
    }

    .matrimony-insights__card--primary {
      margin-bottom: var(--cf-space-3);
    }

    .matrimony-insights__card-head {
      margin-bottom: var(--cf-space-2);
    }

    .matrimony-insights__card-title {
      margin: 0;
      font-size: 0.875rem;
      font-weight: 600;
      line-height: 1.3;
      color: var(--cf-text);
    }

    .matrimony-insights__card-meta {
      margin: 0.2rem 0 0;
      font-size: var(--cf-font-size-body-sm);
    }

    .matrimony-insights__card-body {
      display: flex;
      flex: 1;
      flex-direction: column;
      min-height: 0;
    }

    .matrimony-insights__legend {
      display: flex;
      flex-wrap: wrap;
      gap: 0.5rem 1rem;
      margin-bottom: var(--cf-space-1);
      font-size: 0.75rem;
      color: var(--cf-text-muted);
    }

    .matrimony-insights__chart-wrap {
      position: relative;
      width: 100%;
      flex: 0 0 auto;
    }

    .matrimony-insights__chart-wrap--primary {
      min-height: 12rem;
    }

    .matrimony-insights__chart-wrap--secondary {
      height: 10rem;
    }

    .matrimony-insights__secondary-grid {
      display: grid;
      grid-template-columns: repeat(2, minmax(0, 1fr));
      gap: var(--cf-space-3);
    }

    .matrimony-insights__empty {
      display: flex;
      align-items: center;
      justify-content: center;
      flex: 1;
      margin: 0;
      min-height: 8.5rem;
      padding: var(--cf-space-2);
      font-size: var(--cf-font-size-body-sm);
      color: var(--cf-text-muted);
      text-align: center;
    }

    .sacrament-chart__sr-only {
      position: absolute;
      width: 1px;
      height: 1px;
      padding: 0;
      margin: -1px;
      overflow: hidden;
      clip: rect(0, 0, 0, 0);
      white-space: nowrap;
      border: 0;
    }

    @media (max-width: 1024px) {
      .matrimony-insights__kpi-grid {
        grid-template-columns: repeat(2, minmax(0, 1fr));
      }
    }

    @media (max-width: 767px) {
      .matrimony-insights__head {
        flex-direction: column;
        align-items: stretch;
      }

      .matrimony-insights__secondary-grid {
        grid-template-columns: minmax(0, 1fr);
      }
    }
  `],
})
export class SacramentDashboardMatrimonyInsightsComponent implements AfterViewInit, OnChanges, OnDestroy {
  private readonly cdr = inject(ChangeDetectorRef);

  @Input({ required: true }) matrimony!: SacramentDashboardMatrimony;
  @Input() periodLabel = '';
  @Input() marriagesAllTime = 0;
  @Output() viewRegister = new EventEmitter<void>();
  @Output() changePeriod = new EventEmitter<'last12' | 'all'>();

  @ViewChild('parishChartCanvas') private parishCanvas?: ElementRef<HTMLCanvasElement>;
  @ViewChild('canonicalChartCanvas') private canonicalCanvas?: ElementRef<HTMLCanvasElement>;

  private parishChart?: Chart;
  private canonicalChart?: Chart;
  private renderFrame: number | null = null;
  private renderAttempts = 0;

  get hasAgeData(): boolean {
    return this.ageBucketTotal(this.matrimony.age_brackets.bride) > 0
      || this.ageBucketTotal(this.matrimony.age_brackets.groom) > 0
      || this.matrimony.bride_avg_age != null
      || this.matrimony.groom_avg_age != null;
  }

  get brideAgeRange(): string | null {
    return this.formatAgeRange(this.matrimony.bride_min_age, this.matrimony.bride_max_age);
  }

  get groomAgeRange(): string | null {
    return this.formatAgeRange(this.matrimony.groom_min_age, this.matrimony.groom_max_age);
  }

  get hasParishData(): boolean {
    return this.parishRows.some((row) => row.count > 0);
  }

  get hasCanonicalData(): boolean {
    return this.canonicalChartRows.some((row) => row.count > 0);
  }

  get ageDataSummary(): string {
    if (!this.hasAgeData) {
      return 'No age data available.';
    }

    const bride = this.matrimony.age_brackets.bride
      .filter((row) => row.count > 0)
      .map((row) => `Bride ${row.label}: ${row.count}`)
      .join(', ');
    const groom = this.matrimony.age_brackets.groom
      .filter((row) => row.count > 0)
      .map((row) => `Groom ${row.label}: ${row.count}`)
      .join(', ');

    return [bride, groom].filter(Boolean).join('. ');
  }

  get parishDataSummary(): string {
    return this.parishRows
      .filter((row) => row.count > 0)
      .map((row) => `${row.label}: ${row.count}`)
      .join(', ');
  }

  get canonicalDataSummary(): string {
    return this.canonicalChartRows
      .filter((row) => row.count > 0)
      .map((row) => `${row.label}: ${row.count}`)
      .join(', ');
  }

  private get parishRows(): MatrimonyCategoryRow[] {
    const totals = new Map<string, number>();

    for (const origin of this.matrimony.parish_origins ?? []) {
      totals.set(origin.parish, (totals.get(origin.parish) ?? 0) + (Number(origin.count) || 0));
    }

    return Array.from(totals.entries())
      .map(([parish, count]) => ({
        key: parish,
        label: parish,
        count,
      }))
      .sort((a, b) => b.count - a.count)
      .slice(0, 6);
  }

  private get canonicalChartRows(): MatrimonyCategoryRow[] {
    const classification = this.matrimony.canonical_classification ?? {};
    const knownKeys = Object.keys(CANONICAL_LABELS);
    const extraKeys = Object.keys(classification).filter((key) => !knownKeys.includes(key));

    return [...knownKeys, ...extraKeys]
      .map((key) => ({
        key,
        label: CANONICAL_LABELS[key] ?? key,
        count: Number(classification[key]) || 0,
      }))
      .filter((row) => row.count > 0);
  }

  ngAfterViewInit(): void {
    this.scheduleChartRender();
  }

  ngOnChanges(changes: SimpleChanges): void {
    if (changes['matrimony'] || changes['periodLabel'] || changes['marriagesAllTime']) {
      if (changes['matrimony']?.firstChange) {
        return;
      }

      this.scheduleChartRender();
    }
  }

  ngOnDestroy(): void {
    this.cancelScheduledRender();
    this.destroyCharts();
  }

  formatAge(value: number | null | undefined): string {
    if (value === null || value === undefined) {
      return '—';
    }

    return String(value);
  }

  private formatAgeRange(min: number | null | undefined, max: number | null | undefined): string | null {
    if (min == null || max == null || min === max) {
      return null;
    }

    return `Range ${min}–${max}`;
  }

  private ageBucketTotal(buckets: SacramentDashboardAgeBucket[]): number {
    return buckets.reduce((sum, bucket) => sum + (Number(bucket.count) || 0), 0);
  }

  private renderCharts(): void {
    this.renderParishChart();
    this.renderCanonicalChart();
    this.cdr.markForCheck();
  }

  private scheduleChartRender(): void {
    this.cancelScheduledRender();
    this.renderAttempts = 0;
    this.cdr.markForCheck();
    this.scheduleChartRenderAttempt();
  }

  private scheduleChartRenderAttempt(): void {
    this.cancelScheduledRender();
    this.renderFrame = requestAnimationFrame(() => {
      this.renderFrame = null;
      this.cdr.detectChanges();
      this.renderCharts();

      const needsParish = this.hasParishData && !this.parishCanvas?.nativeElement;
      const needsCanonical = this.hasCanonicalData && !this.canonicalCanvas?.nativeElement;

      if ((needsParish || needsCanonical) && this.renderAttempts < 12) {
        this.renderAttempts += 1;
        this.scheduleChartRenderAttempt();
      }
    });
  }

  private cancelScheduledRender(): void {
    if (this.renderFrame !== null) {
      cancelAnimationFrame(this.renderFrame);
      this.renderFrame = null;
    }
  }

  private destroyCharts(): void {
    this.parishChart?.destroy();
    this.canonicalChart?.destroy();
    this.parishChart = undefined;
    this.canonicalChart = undefined;
  }

  private resolveAxisColor(): string {
    if (typeof document === 'undefined') {
      return '#64748b';
    }

    const value = getComputedStyle(document.documentElement).getPropertyValue('--cf-text-muted').trim();
    return value || '#64748b';
  }

  private resolveGridColor(): string {
    if (typeof document === 'undefined') {
      return '#e2e8f0';
    }

    const value = getComputedStyle(document.documentElement).getPropertyValue('--cf-border-subtle').trim();
    return value || '#e2e8f0';
  }

  private renderParishChart(): void {
    const canvas = this.parishCanvas?.nativeElement;
    this.parishChart?.destroy();
    this.parishChart = undefined;

    const rows = this.parishRows.filter((row) => row.count > 0);
    if (!canvas || rows.length === 0) {
      return;
    }

    const textMuted = this.resolveAxisColor();
    const gridColor = this.resolveGridColor();

    this.parishChart = new Chart(canvas, {
      type: 'bar',
      data: {
        labels: rows.map((row) => row.label),
        datasets: [{
          label: 'Recorded',
          data: rows.map((row) => row.count),
          backgroundColor: rows.map((_, index) => PARISH_COLORS[index % PARISH_COLORS.length]),
          borderRadius: 4,
          maxBarThickness: 14,
        }],
      },
      options: {
        indexAxis: 'y',
        responsive: true,
        maintainAspectRatio: false,
        animation: false,
        plugins: {
          legend: { display: false },
          tooltip: {
            callbacks: {
              label: (ctx) => ` ${ctx.label}: ${ctx.parsed.x ?? 0}`,
            },
          },
        },
        scales: {
          x: {
            beginAtZero: true,
            grid: { color: gridColor },
            ticks: {
              precision: 0,
              color: textMuted,
              font: { size: 10 },
            },
          },
          y: {
            grid: { display: false },
            ticks: {
              color: textMuted,
              font: { size: 10 },
              autoSkip: false,
            },
          },
        },
      },
    });
  }

  private renderCanonicalChart(): void {
    const canvas = this.canonicalCanvas?.nativeElement;
    this.canonicalChart?.destroy();
    this.canonicalChart = undefined;

    const rows = this.canonicalChartRows;
    if (!canvas || rows.length === 0) {
      return;
    }

    const textMuted = this.resolveAxisColor();
    const gridColor = this.resolveGridColor();

    this.canonicalChart = new Chart(canvas, {
      type: 'bar',
      data: {
        labels: rows.map((row) => row.label),
        datasets: [{
          label: 'Marriages',
          data: rows.map((row) => row.count),
          backgroundColor: rows.map((_, index) => CANONICAL_COLORS[index % CANONICAL_COLORS.length]),
          borderRadius: 4,
          maxBarThickness: 14,
        }],
      },
      options: {
        indexAxis: 'y',
        responsive: true,
        maintainAspectRatio: false,
        animation: false,
        plugins: {
          legend: { display: false },
          tooltip: {
            callbacks: {
              label: (ctx) => ` ${ctx.label}: ${ctx.parsed.x ?? 0}`,
            },
          },
        },
        scales: {
          x: {
            beginAtZero: true,
            grid: { color: gridColor },
            ticks: {
              precision: 0,
              color: textMuted,
              font: { size: 10 },
            },
          },
          y: {
            grid: { display: false },
            ticks: {
              color: textMuted,
              font: { size: 10 },
              autoSkip: false,
            },
          },
        },
      },
    });
  }
}
