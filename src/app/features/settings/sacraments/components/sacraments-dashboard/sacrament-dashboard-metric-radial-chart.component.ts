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
import { CfEmptyStateComponent } from '@shared/components/cf-empty-state/cf-empty-state.component';

export interface SacramentDashboardMetricRadialRing {
  key: string;
  label: string;
  count: number;
  pct: number;
  color?: string;
}

export const METRIC_RADIAL_DEFAULT_COLORS = ['#2563eb', '#7c3aed', '#d97706', '#0d9488', '#dc2626', '#4f46e5'];

const TRACK_COLOR = '#e2e8f0';

@Component({
  selector: 'app-sacrament-dashboard-metric-radial-chart',
  standalone: true,
  imports: [CommonModule, CfEmptyStateComponent],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <article class="metric-radial" role="group" [attr.aria-label]="title || 'Metric radial chart'">
      <header class="metric-radial__head" *ngIf="title">
        <h3 class="metric-radial__title">{{ title }}</h3>
        <p class="cf-meta metric-radial__subtitle" *ngIf="subtitle">{{ subtitle }}</p>
      </header>

      <p class="sacrament-chart__sr-only" *ngIf="!loading && hasRings">{{ dataSummary }}</p>

      <div class="metric-radial__loading cf-meta" *ngIf="loading" role="status">Loading chart…</div>

      <ng-container *ngIf="!loading">
        <div class="metric-radial__body" *ngIf="hasRings; else emptyState">
          <div class="metric-radial__canvas-wrap">
            <canvas #chartCanvas role="img" [attr.aria-label]="dataSummary"></canvas>
            <div class="metric-radial__center" aria-hidden="true">
              <strong>{{ centerValue }}</strong>
              <span>{{ centerLabel }}</span>
            </div>
          </div>

          <ul class="metric-radial__legend">
            <li *ngFor="let ring of displayRings">
              <button
                type="button"
                class="metric-radial__legend-row"
                *ngIf="actionable; else staticLegendRow"
                [disabled]="ring.count === 0"
                (click)="onRingSelected(ring.key)"
                [attr.aria-label]="ring.label + ': ' + ring.count + ' (' + ring.pct + '%). View matching marriages.'"
              >
                <i [style.background]="ring.color"></i>
                <span>{{ ring.label }}</span>
                <strong>{{ ring.count }} ({{ ring.pct }}%)</strong>
              </button>
              <ng-template #staticLegendRow>
                <div class="metric-radial__legend-row metric-radial__legend-row--static">
                  <i [style.background]="ring.color"></i>
                  <span>{{ ring.label }}</span>
                  <strong>{{ ring.count }} ({{ ring.pct }}%)</strong>
                </div>
              </ng-template>
            </li>
          </ul>
        </div>
      </ng-container>

      <ng-template #emptyState>
        <app-cf-empty-state
          [title]="emptyTitle"
          [description]="emptyMessage"
        />
      </ng-template>
    </article>
  `,
  styles: [`
    .metric-radial {
      display: flex;
      flex-direction: column;
      gap: var(--cf-space-2);
      min-width: 0;
    }

    .metric-radial__head {
      display: grid;
      gap: 0.15rem;
    }

    .metric-radial__title {
      margin: 0;
      font-size: 0.875rem;
      font-weight: 600;
      line-height: 1.3;
      color: var(--cf-text);
    }

    .metric-radial__subtitle {
      margin: 0;
    }

    .metric-radial__body {
      display: grid;
      grid-template-columns: minmax(8rem, 10rem) minmax(0, 1fr);
      gap: var(--cf-space-2);
      align-items: center;
    }

    .metric-radial__canvas-wrap {
      position: relative;
      width: 100%;
      max-width: 10rem;
      height: 10rem;
      margin: 0 auto;
    }

    .metric-radial__center {
      position: absolute;
      inset: 0;
      display: grid;
      place-content: center;
      text-align: center;
      gap: 0.1rem;
      pointer-events: none;
      padding: 0 1rem;
    }

    .metric-radial__center strong {
      font-size: 1.15rem;
      line-height: 1.1;
      color: var(--cf-text);
      font-weight: 600;
    }

    .metric-radial__center span {
      font-size: 0.65rem;
      text-transform: uppercase;
      letter-spacing: 0.04em;
      color: var(--cf-text-muted);
    }

    .metric-radial__legend {
      list-style: none;
      margin: 0;
      padding: 0;
      display: grid;
      gap: 0.35rem;
    }

    .metric-radial__legend li {
      display: block;
    }

    .metric-radial__legend-row {
      display: grid;
      grid-template-columns: auto 1fr auto;
      gap: 0.45rem;
      align-items: center;
      width: 100%;
      border: 0;
      background: transparent;
      padding: 0;
      text-align: left;
      font: inherit;
      color: inherit;
    }

    .metric-radial__legend-row:not(:disabled) {
      cursor: pointer;
    }

    .metric-radial__legend-row:not(:disabled):hover {
      color: var(--cf-primary);
    }

    .metric-radial__legend-row:disabled {
      cursor: default;
      opacity: 0.85;
    }

    .metric-radial__legend-row i {
      width: 0.55rem;
      height: 0.55rem;
      border-radius: 999px;
      display: inline-block;
      flex-shrink: 0;
    }

    .metric-radial__legend-row span {
      font-size: 0.8125rem;
      line-height: 1.35;
      color: var(--cf-text-muted);
    }

    .metric-radial__legend-row strong {
      font-size: 0.8125rem;
      color: var(--cf-text);
      font-weight: 600;
      white-space: nowrap;
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

    @media (max-width: 768px) {
      .metric-radial__body {
        grid-template-columns: minmax(0, 1fr);
      }
    }
  `],
})
export class SacramentDashboardMetricRadialChartComponent implements AfterViewInit, OnChanges, OnDestroy {
  private readonly cdr = inject(ChangeDetectorRef);

  @Input() title = '';
  @Input() subtitle = '';
  @Input() centerValue = 0;
  @Input() centerLabel = 'total';
  @Input() rings: SacramentDashboardMetricRadialRing[] = [];
  @Input() loading = false;
  @Input() emptyTitle = 'No records yet';
  @Input() emptyMessage = 'No data available for this chart.';
  @Input() colors: string[] = METRIC_RADIAL_DEFAULT_COLORS;
  @Input() actionable = false;

  @Output() ringSelected = new EventEmitter<string>();

  @ViewChild('chartCanvas') private canvas?: ElementRef<HTMLCanvasElement>;

  displayRings: Array<SacramentDashboardMetricRadialRing & { color: string }> = [];

  private chart?: Chart;
  private frame: number | null = null;
  private renderAttempts = 0;

  get hasRings(): boolean {
    return this.displayRings.length > 0;
  }

  get dataSummary(): string {
    return this.displayRings
      .map((ring) => `${ring.label}: ${ring.count} (${ring.pct}%)`)
      .join(', ');
  }

  ngAfterViewInit(): void {
    this.rebuild();
  }

  ngOnChanges(changes: SimpleChanges): void {
    if (changes['rings'] || changes['centerValue'] || changes['colors'] || changes['loading'] || changes['actionable']) {
      this.rebuild();
    }
  }

  onRingSelected(key: string): void {
    this.ringSelected.emit(key);
  }

  ngOnDestroy(): void {
    this.cancelScheduledRender();
    this.chart?.destroy();
  }

  private rebuild(): void {
    this.displayRings = (this.rings ?? []).map((ring, index) => ({
      ...ring,
      count: Number(ring.count) || 0,
      pct: Number(ring.pct) || 0,
      color: ring.color ?? this.colors[index % this.colors.length],
    }));

    this.cdr.markForCheck();

    if (this.loading || !this.hasRings) {
      this.cancelScheduledRender();
      this.chart?.destroy();
      this.chart = undefined;
      return;
    }

    this.renderAttempts = 0;
    this.scheduleRender();
  }

  private scheduleRender(): void {
    this.cancelScheduledRender();
    this.frame = requestAnimationFrame(() => {
      this.frame = null;
      this.renderChart();
    });
  }

  private cancelScheduledRender(): void {
    if (this.frame !== null) {
      cancelAnimationFrame(this.frame);
      this.frame = null;
    }
  }

  private renderChart(): void {
    if (!this.hasRings) {
      return;
    }

    const canvas = this.canvas?.nativeElement;
    if (!canvas) {
      if (this.renderAttempts < 12) {
        this.renderAttempts += 1;
        this.scheduleRender();
      }
      return;
    }

    this.chart?.destroy();

    const total = Math.max(Number(this.centerValue) || 0, 1);

    const datasets = this.displayRings.map((ring) => ({
      label: ring.label,
      data: [ring.count, Math.max(total - ring.count, 0)],
      backgroundColor: [ring.color, TRACK_COLOR],
      borderWidth: 0,
      borderRadius: 3,
      circumference: 360,
      rotation: -90,
    }));

    this.chart = new Chart(canvas, {
      type: 'doughnut',
      data: {
        labels: this.displayRings.map((ring) => ring.label),
        datasets,
      },
      options: {
        responsive: true,
        maintainAspectRatio: false,
        animation: false,
        cutout: '22%',
        onClick: (_event, elements) => {
          if (!this.actionable || !elements.length) {
            return;
          }

          const ring = this.displayRings[elements[0].datasetIndex];
          if (!ring || ring.count === 0) {
            return;
          }

          this.onRingSelected(ring.key);
        },
        plugins: {
          legend: { display: false },
          tooltip: {
            filter: (item) => item.dataIndex === 0,
            callbacks: {
              label: (ctx) => {
                const value = Number(ctx.raw ?? 0);
                const centerTotal = Math.max(Number(this.centerValue) || 0, 0);
                const pct = centerTotal > 0
                  ? Math.round((value / centerTotal) * 100)
                  : 0;
                return ` ${ctx.dataset.label}: ${value} (${pct}%)`;
              },
            },
          },
        },
      },
    });

    this.cdr.markForCheck();
  }
}
