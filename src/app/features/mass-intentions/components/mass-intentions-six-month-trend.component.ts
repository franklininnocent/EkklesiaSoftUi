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
  inject,
} from '@angular/core';
import { Chart } from 'chart.js/auto';
import { MassIntentionsTrendPoint } from '../services/mass-intentions-api.service';

/** Soft dashboard palette (teal / violet / amber) — matches component SCSS tokens */
const SERIES = [
  { key: 'registered' as const, label: 'New records', color: '#2dd4bf' },
  { key: 'closed' as const, label: 'Closed', color: '#a5b4fc' },
  { key: 'said' as const, label: 'Marked said', color: '#fbbf24' },
];

@Component({
  selector: 'app-mass-intentions-six-month-trend',
  standalone: true,
  imports: [CommonModule],
  changeDetection: ChangeDetectionStrategy.OnPush,
  templateUrl: './mass-intentions-six-month-trend.component.html',
  styleUrl: './mass-intentions-six-month-trend.component.scss',
})
export class MassIntentionsSixMonthTrendComponent implements AfterViewInit, OnChanges, OnDestroy {
  private donutRenderQueued = false;
  private readonly cdr = inject(ChangeDetectorRef);

  @Input({ required: true }) points: MassIntentionsTrendPoint[] = [];

  @ViewChild('donutCanvas') private donutCanvas?: ElementRef<HTMLCanvasElement>;

  private donutChart?: Chart;

  readonly series = SERIES;

  get hasPoints(): boolean {
    return this.points.length > 0;
  }

  get hasActivity(): boolean {
    return this.points.some((point) => this.monthTotal(point) > 0);
  }

  get dataSummary(): string {
    if (!this.hasPoints) {
      return 'No month-by-month intention activity for the last four months.';
    }
    const totals = this.seriesTotals();
    return `Last four months. New records: ${totals.registered}. Closed: ${totals.closed}. Marked said: ${totals.said}.`;
  }

  get centerValue(): number {
    return this.seriesTotals().registered;
  }

  seriesTotals(): { registered: number; closed: number; said: number } {
    return this.points.reduce(
      (acc, point) => ({
        registered: acc.registered + (point.registered ?? 0),
        closed: acc.closed + (point.closed ?? 0),
        said: acc.said + (point.said ?? 0),
      }),
      { registered: 0, closed: 0, said: 0 },
    );
  }

  monthTotal(point: MassIntentionsTrendPoint): number {
    return (point.registered ?? 0) + (point.closed ?? 0) + (point.said ?? 0);
  }

  monthSegmentWidth(point: MassIntentionsTrendPoint, key: 'registered' | 'closed' | 'said'): number {
    const total = this.monthTotal(point);
    if (total <= 0) {
      return 0;
    }
    const value = point[key] ?? 0;
    return Math.round((value / total) * 100);
  }

  maxMonthTotal(): number {
    return Math.max(1, ...this.points.map((point) => this.monthTotal(point)));
  }

  monthActivityWidth(point: MassIntentionsTrendPoint): number {
    return Math.round((this.monthTotal(point) / this.maxMonthTotal()) * 100);
  }

  monthSummary(point: MassIntentionsTrendPoint): string {
    const registered = point.registered ?? 0;
    const closed = point.closed ?? 0;
    const said = point.said ?? 0;
    return `${registered} new · ${closed} closed · ${said} marked said`;
  }

  ngAfterViewInit(): void {
    this.renderDonut();
  }

  ngOnChanges(changes: SimpleChanges): void {
    if (changes['points']) {
      this.renderDonut();
    }
  }

  ngOnDestroy(): void {
    this.donutChart?.destroy();
  }

  private renderDonut(): void {
    if (!this.hasActivity) {
      this.donutChart?.destroy();
      this.donutChart = undefined;
      this.cdr.markForCheck();
      return;
    }

    const canvas = this.donutCanvas?.nativeElement;
    if (!canvas) {
      if (!this.donutRenderQueued) {
        this.donutRenderQueued = true;
        queueMicrotask(() => {
          this.donutRenderQueued = false;
          this.renderDonut();
        });
      }
      return;
    }

    const totals = this.seriesTotals();
    const rows = SERIES.map((row) => ({
      label: row.label,
      value: totals[row.key],
      color: row.color,
    })).filter((row) => row.value > 0);

    const labels = rows.map((row) => row.label);
    const data = rows.map((row) => row.value);
    const colors = rows.map((row) => row.color);
    const total = data.reduce((sum, value) => sum + value, 0);

    this.donutChart?.destroy();
    this.donutChart = new Chart(canvas, {
      type: 'doughnut',
      data: {
        labels,
        datasets: [
          {
            data,
            backgroundColor: colors,
            borderWidth: 0,
            hoverOffset: 4,
          },
        ],
      },
      options: {
        responsive: true,
        maintainAspectRatio: false,
        cutout: '62%',
        animation: { duration: 350 },
        plugins: {
          legend: { display: false },
          tooltip: {
            callbacks: {
              label: (ctx) => {
                const value = Number(ctx.raw ?? 0);
                const pct = total > 0 ? Math.round((value / total) * 100) : 0;
                return ` ${ctx.label}: ${value} (${pct}%)`;
              },
            },
          },
        },
      },
    });

    this.cdr.markForCheck();
  }
}
