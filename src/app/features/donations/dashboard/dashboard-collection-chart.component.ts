import { CommonModule } from '@angular/common';
import {
  AfterViewInit,
  ChangeDetectionStrategy,
  ChangeDetectorRef,
  Component,
  ElementRef,
  Input,
  OnChanges,
  OnDestroy,
  SimpleChanges,
  ViewChild,
  inject
} from '@angular/core';
import { Chart } from 'chart.js/auto';
import { CollectionPerformanceChart, DonationDashboardSummary } from '../models/donation.model';

type ChartPeriod = 'month' | 'quarter' | 'year';

interface ChartBarGroup {
  label: string;
  collected: number;
  outstanding: number;
  target: number;
}

@Component({
  selector: 'app-dashboard-collection-chart',
  standalone: true,
  imports: [CommonModule],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <section class="cf-chart-panel cf-panel" aria-label="Collection performance chart">
      <div class="cf-chart-panel__head">
        <div>
          <h3>Collection Performance</h3>
          <p>Interactive view of collected, outstanding, and target over time</p>
        </div>
        <div class="cf-chart-panel__toggle" role="tablist" aria-label="Chart period">
          <button type="button" role="tab" [class.active]="period === 'month'" [attr.aria-selected]="period === 'month'" (click)="setPeriod('month')">Month</button>
          <button type="button" role="tab" [class.active]="period === 'quarter'" [attr.aria-selected]="period === 'quarter'" (click)="setPeriod('quarter')">Quarter</button>
          <button type="button" role="tab" [class.active]="period === 'year'" [attr.aria-selected]="period === 'year'" (click)="setPeriod('year')">Year</button>
        </div>
      </div>

      <div class="cf-chart-panel__legend" aria-hidden="true">
        <span><i class="cf-chart-panel__swatch cf-chart-panel__swatch--collected"></i> Collected</span>
        <span><i class="cf-chart-panel__swatch cf-chart-panel__swatch--outstanding"></i> Outstanding</span>
        <span><i class="cf-chart-panel__swatch cf-chart-panel__swatch--target"></i> Target</span>
      </div>

      <div class="cf-chart-panel__chart-wrap" *ngIf="groups.length; else emptyChart">
        <canvas #chartCanvas role="img" [attr.aria-label]="chartAriaLabel"></canvas>
      </div>

      <ng-template #emptyChart>
        <p class="cf-chart-panel__empty">No collection data available yet.</p>
      </ng-template>
    </section>
  `,
  styles: [`
    .cf-chart-panel__chart-wrap {
      position: relative;
      height: 280px;
      width: 100%;
    }
  `]
})
export class DashboardCollectionChartComponent implements AfterViewInit, OnChanges, OnDestroy {
  private readonly cdr = inject(ChangeDetectorRef);

  @Input() summary: DonationDashboardSummary | null = null;
  @ViewChild('chartCanvas') private canvas?: ElementRef<HTMLCanvasElement>;

  period: ChartPeriod = 'month';
  private chart?: Chart;

  get groups(): ChartBarGroup[] {
    const chart = this.summary?.collection_performance_chart ?? this.buildFallbackChart();
    const collected = this.pointsForSeries(chart, 'collected');
    const outstanding = this.pointsForSeries(chart, 'outstanding');
    const target = this.pointsForSeries(chart, 'target');

    const merged = collected.map((point, index) => ({
      period: point.period,
      label: point.label,
      collected: point.value,
      outstanding: outstanding[index]?.value ?? 0,
      target: target[index]?.value ?? 0
    }));

    if (this.period === 'month') {
      return merged.map((row) => ({
        label: this.shortLabel(row.label),
        collected: row.collected,
        outstanding: row.outstanding,
        target: row.target
      }));
    }

    const bucket = new Map<string, ChartBarGroup>();
    for (const row of merged) {
      const key = this.period === 'quarter' ? this.quarterKey(row.period) : row.period.slice(0, 4);
      const label = this.period === 'quarter' ? this.quarterLabel(row.period) : row.period.slice(0, 4);
      const existing = bucket.get(key) ?? { label, collected: 0, outstanding: 0, target: 0 };
      existing.collected += row.collected;
      existing.outstanding = Math.max(existing.outstanding, row.outstanding);
      existing.target += row.target;
      bucket.set(key, existing);
    }

    return Array.from(bucket.values());
  }

  get chartAriaLabel(): string {
    return `Collection performance chart with ${this.groups.length} periods`;
  }

  ngAfterViewInit(): void {
    this.renderChart();
  }

  ngOnChanges(changes: SimpleChanges): void {
    if (changes['summary'] && !changes['summary'].firstChange) {
      this.renderChart();
    }
  }

  ngOnDestroy(): void {
    this.chart?.destroy();
  }

  setPeriod(period: ChartPeriod): void {
    this.period = period;
    this.cdr.markForCheck();
    queueMicrotask(() => this.renderChart());
  }

  private renderChart(): void {
    const canvas = this.canvas?.nativeElement;
    const groups = this.groups;
    if (!canvas || groups.length === 0) {
      return;
    }

    this.chart?.destroy();
    this.chart = new Chart(canvas, {
      type: 'bar',
      data: {
        labels: groups.map((group) => group.label),
        datasets: [
          {
            label: 'Collected',
            data: groups.map((group) => group.collected),
            backgroundColor: '#4f46e5',
            borderRadius: 4
          },
          {
            label: 'Outstanding',
            data: groups.map((group) => group.outstanding),
            backgroundColor: '#f59e0b',
            borderRadius: 4
          },
          {
            label: 'Target',
            data: groups.map((group) => group.target),
            backgroundColor: '#94a3b8',
            borderRadius: 4
          }
        ]
      },
      options: {
        responsive: true,
        maintainAspectRatio: false,
        interaction: { mode: 'index', intersect: false },
        plugins: {
          legend: { position: 'bottom' },
          tooltip: { enabled: true }
        },
        scales: {
          x: { grid: { display: false } },
          y: { beginAtZero: true }
        }
      }
    });
  }

  private buildFallbackChart(): CollectionPerformanceChart {
    const trend = this.summary?.collection_trend ?? [];
    return {
      granularity: 'month',
      series: [
        {
          key: 'collected',
          label: 'Collected',
          points: trend.map((row) => ({ period: row.period, label: row.label, value: row.collected }))
        },
        {
          key: 'outstanding',
          label: 'Outstanding',
          points: trend.map((row) => ({ period: row.period, label: row.label, value: 0 }))
        },
        {
          key: 'target',
          label: 'Target',
          points: trend.map((row) => ({ period: row.period, label: row.label, value: row.collected }))
        }
      ]
    };
  }

  private pointsForSeries(chart: CollectionPerformanceChart, key: string) {
    return chart.series.find((series) => series.key === key)?.points ?? [];
  }

  private shortLabel(label: string): string {
    return label.replace(/\s20(\d{2})$/, "'$1");
  }

  private quarterKey(period: string): string {
    const [year, month] = period.split('-').map(Number);
    const quarter = Math.ceil((month || 1) / 3);
    return `${year}-Q${quarter}`;
  }

  private quarterLabel(period: string): string {
    const [year, month] = period.split('-').map(Number);
    const quarter = Math.ceil((month || 1) / 3);
    return `Q${quarter} ${year}`;
  }
}
