import { CommonModule } from '@angular/common';
import {
  AfterViewInit,
  ChangeDetectionStrategy,
  Component,
  ElementRef,
  EventEmitter,
  Input,
  OnChanges,
  OnDestroy,
  Output,
  SimpleChanges,
  ViewChild,
} from '@angular/core';
import { Chart } from 'chart.js/auto';

export type BccOverviewChartType = 'doughnut' | 'pie' | 'column';

export interface BccOverviewChartSlice {
  key: string;
  label: string;
  count: number;
  color: string;
  /** Emitted through sliceSelect when the segment/column is activated. */
  drillable?: boolean;
}

/**
 * Single Chart.js panel used by the BCC 360 overview for composition
 * (doughnut / pie) and categorical count (column) datasets. The legend is
 * rendered in the template so it stays keyboard-accessible and can drill
 * into the Members tab.
 */
@Component({
  selector: 'app-bcc-overview-chart',
  standalone: true,
  imports: [CommonModule],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <div class="bcc-ov-chart" [class.bcc-ov-chart--column]="type === 'column'">
      <p class="bcc-ov-chart__sr">{{ summary }}</p>

      <ng-container *ngIf="hasData; else empty">
        <div class="bcc-ov-chart__canvas-wrap">
          <canvas #chartCanvas role="img" [attr.aria-label]="summary"></canvas>
        </div>

        <ul class="bcc-ov-chart__legend">
          <li *ngFor="let slice of slices" [class.is-zero]="slice.count === 0">
            <button
              *ngIf="slice.drillable; else staticLegend"
              type="button"
              class="bcc-ov-chart__legend-btn"
              (click)="sliceSelect.emit(slice)"
            >
              <i [style.background]="slice.color" aria-hidden="true"></i>
              <span>{{ slice.label }}</span>
              <strong>{{ slice.count }}{{ showPercent ? ' · ' + percentOf(slice) + '%' : '' }}</strong>
            </button>
            <ng-template #staticLegend>
              <span class="bcc-ov-chart__legend-static">
                <i [style.background]="slice.color" aria-hidden="true"></i>
                <span>{{ slice.label }}</span>
                <strong>{{ slice.count }}{{ showPercent ? ' · ' + percentOf(slice) + '%' : '' }}</strong>
              </span>
            </ng-template>
          </li>
        </ul>
      </ng-container>

      <ng-template #empty>
        <p class="cf-meta">{{ emptyMessage }}</p>
      </ng-template>
    </div>
  `,
  styles: [
    `
      .bcc-ov-chart {
        display: grid;
        grid-template-columns: minmax(8rem, 0.9fr) minmax(8rem, 1fr);
        gap: 0.85rem;
        align-items: center;
      }
      .bcc-ov-chart--column {
        grid-template-columns: 1fr;
      }
      .bcc-ov-chart__canvas-wrap {
        position: relative;
        height: 170px;
        width: 100%;
        margin: 0 auto;
      }
      .bcc-ov-chart:not(.bcc-ov-chart--column) .bcc-ov-chart__canvas-wrap {
        max-width: 190px;
      }
      .bcc-ov-chart--column .bcc-ov-chart__canvas-wrap {
        height: 200px;
      }
      .bcc-ov-chart__legend {
        list-style: none;
        margin: 0;
        padding: 0;
        display: grid;
        gap: 0.4rem;
      }
      .bcc-ov-chart--column .bcc-ov-chart__legend {
        grid-template-columns: repeat(auto-fit, minmax(9rem, 1fr));
      }
      .bcc-ov-chart__legend li.is-zero {
        opacity: 0.55;
      }
      .bcc-ov-chart__legend-btn,
      .bcc-ov-chart__legend-static {
        display: grid;
        grid-template-columns: auto 1fr auto;
        gap: 0.45rem;
        align-items: center;
        width: 100%;
        font-size: 0.85rem;
        text-align: left;
        color: inherit;
      }
      .bcc-ov-chart__legend-btn {
        background: transparent;
        border: 0;
        padding: 0;
        cursor: pointer;
      }
      .bcc-ov-chart__legend-btn:focus-visible {
        outline: 2px solid var(--cf-primary);
        outline-offset: 2px;
      }
      .bcc-ov-chart__legend i {
        width: 0.65rem;
        height: 0.65rem;
        border-radius: 999px;
        display: inline-block;
      }
      .bcc-ov-chart__legend strong {
        font-variant-numeric: tabular-nums;
      }
      .bcc-ov-chart__sr {
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
        .bcc-ov-chart {
          grid-template-columns: 1fr;
        }
      }
    `,
  ],
})
export class BccOverviewChartComponent implements AfterViewInit, OnChanges, OnDestroy {
  @Input() type: BccOverviewChartType = 'doughnut';
  @Input() slices: BccOverviewChartSlice[] = [];
  @Input() summary = '';
  @Input() emptyMessage = 'No data available yet.';
  @Input() showPercent = false;
  @Output() sliceSelect = new EventEmitter<BccOverviewChartSlice>();

  @ViewChild('chartCanvas') private canvas?: ElementRef<HTMLCanvasElement>;
  private chart?: Chart;

  get hasData(): boolean {
    return this.slices.some((slice) => slice.count > 0);
  }

  get total(): number {
    return this.slices.reduce((sum, slice) => sum + slice.count, 0);
  }

  percentOf(slice: BccOverviewChartSlice): string {
    if (this.total <= 0) {
      return '0';
    }
    return ((slice.count / this.total) * 100).toFixed(1);
  }

  ngAfterViewInit(): void {
    this.renderChart();
  }

  ngOnChanges(changes: SimpleChanges): void {
    if (changes['slices'] || changes['type']) {
      this.renderChart();
    }
  }

  ngOnDestroy(): void {
    this.chart?.destroy();
  }

  private renderChart(): void {
    if (!this.hasData) {
      this.chart?.destroy();
      this.chart = undefined;
      return;
    }

    const canvas = this.canvas?.nativeElement;
    if (!canvas) {
      queueMicrotask(() => this.renderChart());
      return;
    }

    // jsdom / restricted environments may not support canvas 2d.
    if (typeof canvas.getContext !== 'function' || !canvas.getContext('2d')) {
      return;
    }

    try {
      this.chart?.destroy();
      this.chart = this.type === 'column' ? this.buildColumnChart(canvas) : this.buildRoundChart(canvas);
    } catch {
      this.chart = undefined;
    }
  }

  private buildColumnChart(canvas: HTMLCanvasElement): Chart {
    return new Chart(canvas, {
      type: 'bar',
      data: {
        labels: this.slices.map((slice) => slice.label),
        datasets: [
          {
            data: this.slices.map((slice) => slice.count),
            backgroundColor: this.slices.map((slice) => slice.color),
            borderRadius: 4,
            maxBarThickness: 56,
          },
        ],
      },
      options: {
        responsive: true,
        maintainAspectRatio: false,
        animation: false,
        plugins: {
          legend: { display: false },
          tooltip: {
            callbacks: {
              label: (ctx) => ` ${ctx.label}: ${Number(ctx.raw ?? 0)}`,
            },
          },
        },
        scales: {
          x: { grid: { display: false } },
          y: { beginAtZero: true, ticks: { precision: 0 } },
        },
        onClick: (_event, elements) => this.emitSliceAt(elements?.[0]?.index),
      },
    });
  }

  private buildRoundChart(canvas: HTMLCanvasElement): Chart {
    const isPie = this.type === 'pie';
    return new Chart(canvas, {
      type: isPie ? 'pie' : 'doughnut',
      data: {
        labels: this.slices.map((slice) => slice.label),
        datasets: [
          {
            data: this.slices.map((slice) => slice.count),
            backgroundColor: this.slices.map((slice) => slice.color),
            borderColor: '#ffffff',
            borderWidth: 2,
          },
        ],
      },
      options: {
        responsive: true,
        maintainAspectRatio: false,
        animation: false,
        cutout: isPie ? 0 : '62%',
        plugins: {
          legend: { display: false },
          tooltip: {
            callbacks: {
              label: (ctx) => {
                const value = Number(ctx.raw ?? 0);
                const pct = this.total > 0 ? ((value / this.total) * 100).toFixed(1) : '0';
                return ` ${ctx.label}: ${value} (${pct}%)`;
              },
            },
          },
        },
        onClick: (_event, elements) => this.emitSliceAt(elements?.[0]?.index),
      },
    });
  }

  private emitSliceAt(index?: number): void {
    if (index === undefined) {
      return;
    }
    const slice = this.slices[index];
    if (slice?.drillable) {
      this.sliceSelect.emit(slice);
    }
  }
}
