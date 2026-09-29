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
  SacramentDashboardTrendPoint,
  SacramentDashboardTrendSeries,
} from '../../models/sacrament-dashboard.model';
import { isIncludedInStandardDashboardChart } from './sacrament-dashboard-demographics-palette';

const SERIES_COLORS = [
  '#3b6ebf',
  '#0d9488',
  '#7c6bc4',
  '#c45c8a',
  '#d97706',
  '#2563eb',
  '#14b8a6',
  '#e11d48',
  '#84cc16',
  '#64748b',
];

@Component({
  selector: 'app-sacrament-dashboard-monthly-trend-chart',
  standalone: true,
  imports: [CommonModule],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <section
      class="sacrament-monthly-trend"
      aria-label="Monthly sacrament activity trend chart"
    >
      <p class="sacrament-chart__sr-only" *ngIf="hasData">{{ dataSummary }}</p>

      <div class="sacrament-monthly-trend__chart-wrap" *ngIf="hasData; else empty">
        <canvas #chartCanvas role="img" [attr.aria-label]="dataSummary"></canvas>
      </div>

      <ul class="sacrament-monthly-trend__legend" *ngIf="hasData" aria-hidden="true">
        <li *ngFor="let row of visibleSeries; let i = index">
          <i [style.background]="seriesColor(i)"></i>
          <span [title]="row.label">{{ row.label }}</span>
        </li>
      </ul>

      <p class="sacrament-monthly-trend__footer" *ngIf="hasData">
        <span class="cf-meta">12-month total</span>
        <strong>{{ periodTotal }}</strong>
      </p>

      <ng-template #empty>
        <p class="cf-chart-panel__empty">No sacrament activity for the selected period.</p>
      </ng-template>
    </section>
  `,
  styles: [`
    :host {
      display: flex;
      flex: 1;
      min-height: 0;
      width: 100%;
    }

    .sacrament-monthly-trend {
      display: flex;
      flex-direction: column;
      flex: 1;
      min-height: 0;
      width: 100%;
      gap: var(--cf-space-2);
    }

    .sacrament-monthly-trend__chart-wrap {
      position: relative;
      flex: 0 0 auto;
      height: 8.5rem;
      min-height: 0;
      width: 100%;
    }

    .sacrament-monthly-trend__legend {
      list-style: none;
      display: flex;
      flex-wrap: wrap;
      gap: 0.35rem 0.65rem;
      margin: 0;
      padding: 0;
      flex-shrink: 0;
    }

    .sacrament-monthly-trend__legend li {
      display: inline-flex;
      align-items: center;
      gap: 0.3rem;
      font-size: 0.68rem;
      color: var(--cf-text-muted);
      min-width: 0;
    }

    .sacrament-monthly-trend__legend i {
      flex-shrink: 0;
      width: 0.55rem;
      height: 0.55rem;
      border-radius: 999px;
      display: inline-block;
    }

    .sacrament-monthly-trend__legend span {
      min-width: 0;
      line-height: 1.2;
    }

    .sacrament-monthly-trend__footer {
      display: flex;
      justify-content: space-between;
      align-items: baseline;
      gap: var(--cf-space-2);
      margin: 0;
      flex-shrink: 0;
      font-size: 0.75rem;
    }

    .cf-chart-panel__empty {
      display: flex;
      align-items: center;
      justify-content: center;
      flex: 1;
      margin: 0;
      min-height: 6rem;
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

    @media (max-width: 480px) {
      .sacrament-monthly-trend__legend {
        gap: 0.25rem 0.5rem;
      }

      .sacrament-monthly-trend__legend li {
        font-size: 0.62rem;
      }
    }
  `],
})
export class SacramentDashboardMonthlyTrendChartComponent implements AfterViewInit, OnChanges, OnDestroy {
  private readonly cdr = inject(ChangeDetectorRef);

  @Input() series: SacramentDashboardTrendSeries[] = [];
  @Output() pointSelected = new EventEmitter<{
    point: SacramentDashboardTrendPoint;
    seriesCode: string | null;
  }>();

  @ViewChild('chartCanvas') private canvas?: ElementRef<HTMLCanvasElement>;

  private chart?: Chart;

  get visibleSeries(): SacramentDashboardTrendSeries[] {
    return this.series.filter((row) => isIncludedInStandardDashboardChart(row.code));
  }

  get hasData(): boolean {
    return this.visibleSeries.some((row) => row.points.some((point) => point.count > 0));
  }

  get periodTotal(): number {
    return this.visibleSeries.reduce(
      (sum, row) => sum + row.points.reduce((rowSum, point) => rowSum + point.count, 0),
      0,
    );
  }

  get dataSummary(): string {
    if (!this.hasData) {
      return 'No monthly sacrament activity for the selected period.';
    }

    const aggregated = this.aggregatedMonthlyTotals();
    const peak = aggregated.reduce(
      (best, point) => (point.count > best.count ? point : best),
      aggregated[0],
    );

    return `All sacrament types. Last 12 months. Total ${this.periodTotal}. Peak month ${peak.label}: ${peak.count}.`;
  }

  ngAfterViewInit(): void {
    this.rebuild();
  }

  ngOnChanges(changes: SimpleChanges): void {
    if (changes['series']) {
      this.rebuild();
    }
  }

  ngOnDestroy(): void {
    this.chart?.destroy();
  }

  seriesColor(index: number): string {
    return SERIES_COLORS[index % SERIES_COLORS.length];
  }

  private rebuild(): void {
    this.cdr.markForCheck();
    this.renderChart();
  }

  private aggregatedMonthlyTotals(): SacramentDashboardTrendPoint[] {
    const template = this.visibleSeries[0]?.points ?? [];
    return template.map((point, index) => ({
      period: point.period,
      label: point.label,
      count: this.visibleSeries.reduce((sum, row) => sum + (row.points[index]?.count ?? 0), 0),
    }));
  }

  private formatPeriodLabel(dataIndex: number): string {
    const period = this.visibleSeries[0]?.points[dataIndex]?.period;
    if (!period) {
      return this.visibleSeries[0]?.points[dataIndex]?.label ?? '';
    }

    const [year, month] = period.split('-').map(Number);
    const date = new Date(year, month - 1, 1);
    return date.toLocaleDateString(undefined, { month: 'long', year: 'numeric' });
  }

  private renderChart(): void {
    if (!this.hasData) {
      this.chart?.destroy();
      this.chart = undefined;
      return;
    }

    const canvas = this.canvas?.nativeElement;
    if (!canvas) {
      return;
    }

    const borderSubtle = this.resolveCssColor('--cf-border-subtle', '#e2e8f0');
    const textMuted = this.resolveCssColor('--cf-text-muted', '#64748b');

    const activeSeries = this.visibleSeries;
    const labels = activeSeries[0]?.points.map((point) => point.label) ?? [];
    const datasets = activeSeries.map((row, index) => ({
      label: row.label,
      data: row.points.map((point) => point.count),
      borderColor: this.seriesColor(index),
      backgroundColor: 'transparent',
      borderWidth: 2,
      pointRadius: 2,
      pointHoverRadius: 4,
      tension: 0.25,
    }));

    this.chart?.destroy();
    this.chart = new Chart(canvas, {
      type: 'line',
      data: { labels, datasets },
      options: {
        responsive: true,
        maintainAspectRatio: false,
        animation: false,
        layout: {
          padding: { top: 4, right: 4, bottom: 0, left: 4 },
        },
        interaction: { mode: 'index', intersect: false },
        onClick: (_event, elements) => {
          if (!elements.length) {
            return;
          }

          const seriesRow = activeSeries[elements[0].datasetIndex];
          const point = seriesRow?.points[elements[0].index];
          if (!seriesRow || !point) {
            return;
          }

          this.pointSelected.emit({
            point,
            seriesCode: seriesRow.code,
          });
        },
        plugins: {
          legend: { display: false },
          tooltip: {
            callbacks: {
              title: (items) => this.formatPeriodLabel(items[0]?.dataIndex ?? 0),
              label: (ctx) => ` ${ctx.dataset.label}: ${ctx.parsed.y ?? 0}`,
            },
          },
        },
        scales: {
          x: {
            grid: { display: false },
            border: { display: false },
            ticks: {
              font: { size: 9 },
              color: textMuted,
              maxRotation: 0,
              autoSkip: true,
              maxTicksLimit: 12,
            },
          },
          y: {
            beginAtZero: true,
            grid: {
              color: borderSubtle,
            },
            border: { display: false },
            ticks: {
              font: { size: 9 },
              color: textMuted,
              precision: 0,
              maxTicksLimit: 4,
            },
          },
        },
      },
    });

    this.cdr.markForCheck();
  }

  private resolveCssColor(variable: string, fallback: string): string {
    if (typeof document === 'undefined') {
      return fallback;
    }

    const value = getComputedStyle(document.documentElement).getPropertyValue(variable).trim();
    return value || fallback;
  }
}
