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

export interface SacramentDashboardRadialItem {
  key: string;
  label: string;
  count: number;
}

interface RadialRing {
  label: string;
  value: number;
  display: string;
  color: string;
}

const DEFAULT_COLORS = [
  '#3b6ebf',
  '#0d9488',
  '#7c3aed',
  '#d97706',
  '#c45c8a',
  '#64748b',
];

@Component({
  selector: 'app-sacrament-dashboard-radial-chart',
  standalone: true,
  imports: [CommonModule],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <section class="sacrament-radial-chart" [attr.aria-label]="title || 'Radial chart'">
      <h3 class="sacraments-dashboard__subheading" *ngIf="title">{{ title }}</h3>
      <p class="sacrament-chart__sr-only" *ngIf="hasItems">{{ dataSummary }}</p>
      <div class="sacrament-radial-chart__body" *ngIf="hasItems; else empty">
        <div class="sacrament-radial-chart__canvas-wrap" *ngIf="hasPositiveData">
          <canvas #chartCanvas role="img" [attr.aria-label]="dataSummary"></canvas>
          <div class="sacrament-radial-chart__center" *ngIf="centerValue !== null">
            <strong>{{ centerValue }}</strong>
            <span *ngIf="centerLabel">{{ centerLabel }}</span>
          </div>
        </div>
        <div class="sacrament-radial-chart__zero-panel" *ngIf="!hasPositiveData && centerValue !== null">
          <strong>{{ centerValue }}</strong>
          <span *ngIf="centerLabel">{{ centerLabel }}</span>
        </div>
        <ul class="sacrament-radial-chart__legend">
          <li *ngFor="let ring of rings">
            <i [style.background]="ring.color"></i>
            <span>{{ ring.label }}</span>
            <strong>{{ ring.display }}</strong>
          </li>
        </ul>
      </div>
      <ng-template #empty>
        <p class="cf-meta">{{ emptyMessage }}</p>
      </ng-template>
    </section>
  `,
  styles: [`
    .sacrament-radial-chart__body {
      display: grid;
      grid-template-columns: minmax(9rem, 1fr) minmax(9rem, 1.1fr);
      gap: var(--cf-space-2);
      align-items: center;
    }

    .sacrament-radial-chart__canvas-wrap {
      position: relative;
      height: 210px;
      width: 100%;
      max-width: 220px;
      margin: 0 auto;
    }

    .sacrament-radial-chart__center,
    .sacrament-radial-chart__zero-panel {
      display: grid;
      place-content: center;
      text-align: center;
      gap: 0.1rem;
    }

    .sacrament-radial-chart__center {
      position: absolute;
      inset: 0;
      pointer-events: none;
      padding: 0 1.5rem;
    }

    .sacrament-radial-chart__zero-panel {
      min-height: 8.5rem;
      padding: 0 1rem;
    }

    .sacrament-radial-chart__center strong,
    .sacrament-radial-chart__zero-panel strong {
      font-size: 1.2rem;
      line-height: 1.1;
      color: var(--cf-text);
    }

    .sacrament-radial-chart__center span,
    .sacrament-radial-chart__zero-panel span {
      font-size: 0.72rem;
      text-transform: uppercase;
      letter-spacing: 0.04em;
      color: var(--cf-text-muted);
    }

    .sacrament-radial-chart__legend {
      list-style: none;
      margin: 0;
      padding: 0;
      display: grid;
      gap: 0.45rem;
    }

    .sacrament-radial-chart__legend li {
      display: grid;
      grid-template-columns: auto 1fr auto;
      gap: 0.45rem;
      align-items: center;
      font-size: 0.82rem;
    }

    .sacrament-radial-chart__legend i {
      width: 0.65rem;
      height: 0.65rem;
      border-radius: 999px;
      display: inline-block;
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

    @media (max-width: 640px) {
      .sacrament-radial-chart__body {
        grid-template-columns: 1fr;
      }
    }
  `],
})
export class SacramentDashboardRadialChartComponent implements AfterViewInit, OnChanges, OnDestroy {
  private readonly cdr = inject(ChangeDetectorRef);

  @Input() title = '';
  @Input() items: SacramentDashboardRadialItem[] = [];
  @Input() emptyMessage = 'No data yet.';
  @Input() centerValue: string | null = null;
  @Input() centerLabel: string | null = null;
  @Input() colors: string[] = DEFAULT_COLORS;

  @ViewChild('chartCanvas') private canvas?: ElementRef<HTMLCanvasElement>;

  rings: RadialRing[] = [];
  private chart?: Chart;
  private frame: number | null = null;
  private renderAttempts = 0;

  get normalizedItems(): SacramentDashboardRadialItem[] {
    return (this.items ?? []).map((item) => ({
      key: item.key,
      label: item.label,
      count: Number(item.count) || 0,
    }));
  }

  get populatedItems(): SacramentDashboardRadialItem[] {
    return this.normalizedItems.filter((item) => item.count > 0);
  }

  get hasItems(): boolean {
    return this.normalizedItems.length > 0;
  }

  get hasPositiveData(): boolean {
    return this.populatedItems.length > 0;
  }

  get hasData(): boolean {
    return this.hasPositiveData;
  }

  get dataSummary(): string {
    if (!this.hasItems) {
      return this.emptyMessage;
    }

    return this.normalizedItems
      .map((item) => `${item.label}: ${item.count}`)
      .join(', ');
  }

  ngAfterViewInit(): void {
    this.rebuild();
  }

  ngOnChanges(changes: SimpleChanges): void {
    if (changes['items'] || changes['colors']) {
      this.rebuild();
    }
  }

  ngOnDestroy(): void {
    this.cancelScheduledRender();
    this.destroyChart();
  }

  private rebuild(): void {
    this.rings = this.buildRings();
    this.cdr.markForCheck();
    this.renderAttempts = 0;

    if (this.hasPositiveData) {
      this.scheduleRender();
      return;
    }

    this.cancelScheduledRender();
    this.destroyChart(this.canvas?.nativeElement);
  }

  private buildRings(): RadialRing[] {
    if (!this.hasItems) {
      return [];
    }

    return this.normalizedItems.map((item, index) => ({
      label: item.label,
      value: item.count,
      display: String(item.count),
      color: this.colors[index % this.colors.length],
    }));
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

  private destroyChart(canvas?: HTMLCanvasElement): void {
    this.chart?.destroy();
    this.chart = undefined;

    if (canvas && typeof Chart.getChart === 'function') {
      Chart.getChart(canvas)?.destroy();
    }
  }

  private renderChart(): void {
    if (!this.hasPositiveData) {
      this.destroyChart(this.canvas?.nativeElement);
      return;
    }

    const canvas = this.canvas?.nativeElement;
    if (!canvas) {
      if (this.renderAttempts < 8) {
        this.renderAttempts += 1;
        this.scheduleRender();
      }
      return;
    }

    this.renderAttempts = 0;

    try {
      if (!canvas.getContext('2d')) {
        return;
      }
    } catch {
      return;
    }

    const rows = this.populatedItems;
    const sliceColors = rows.map((_, index) => {
      const sourceIndex = this.normalizedItems.findIndex((item) => item.key === rows[index].key);
      return this.colors[(sourceIndex >= 0 ? sourceIndex : index) % this.colors.length];
    });

    try {
      this.destroyChart(canvas);

      this.chart = new Chart(canvas, {
        type: 'doughnut',
        data: {
          labels: rows.map((row) => row.label),
          datasets: [{
            data: rows.map((row) => row.count),
            backgroundColor: sliceColors,
            borderWidth: 0,
          }],
        },
        options: {
          responsive: true,
          maintainAspectRatio: false,
          animation: false,
          cutout: '58%',
          plugins: {
            legend: { display: false },
            tooltip: {
              callbacks: {
                label: (ctx) => {
                  const value = Number(ctx.raw ?? 0);
                  const total = rows.reduce((sum, row) => sum + row.count, 0);
                  const pct = total > 0 ? Math.round((value / total) * 100) : 0;

                  return ` ${ctx.label}: ${value} (${pct}%)`;
                },
              },
            },
          },
        },
      });
    } catch {
      this.chart = undefined;
    }
  }
}
