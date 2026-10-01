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
import { Router } from '@angular/router';
import { Chart } from 'chart.js/auto';
import { cfFormatMoney } from '@shared/utils/cf-intl.util';
import { ExecutiveDueScheduleSlice } from '../models/executive-dashboard.model';
import {
  DueScheduleFilter,
  dueScheduleFilterQuery,
  isDueScheduleFilter,
} from '@features/donations/utils/due-schedule-filter.util';

const SLICE_COLORS: Record<string, string> = {
  overdue: '#dc2626',
  next_14_days: '#f59e0b',
  later: '#94a3b8',
};

@Component({
  selector: 'app-executive-due-schedule-chart',
  standalone: true,
  imports: [CommonModule],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <section class="exec-due-chart" aria-label="Due schedule">
      <p class="exec-due-chart__sr-only" *ngIf="hasData">{{ dataSummary }}</p>
      <div class="exec-due-chart__layout" *ngIf="hasData; else empty">
        <div class="exec-due-chart__canvas-wrap">
          <canvas
            #chartCanvas
            role="img"
            [attr.aria-label]="dataSummary"
            (click)="onCanvasClick($event)"
          ></canvas>
        </div>
        <ul class="exec-due-chart__legend">
          <li *ngFor="let slice of populatedSlices">
            <button
              type="button"
              class="exec-due-chart__legend-btn"
              (click)="drillToSlice(slice)"
              [attr.aria-label]="'View ' + slice.label + ' contributions'"
            >
              <i [style.background]="colorFor(slice.key)"></i>
              <span class="exec-due-chart__legend-label">{{ slice.label }}</span>
              <span class="exec-due-chart__legend-value">
                <strong>{{ formatAmount(slice.amount) }}</strong>
                <span class="cf-meta">({{ formatPercent(slice.percent) }})</span>
              </span>
            </button>
          </li>
        </ul>
      </div>
      <ng-template #empty>
        <p class="cf-chart-panel__empty">No outstanding balances to chart.</p>
      </ng-template>
    </section>
  `,
  styles: [
    `
      :host {
        display: block;
        width: 100%;
        position: relative;
        z-index: 1;
      }
      .exec-due-chart__layout {
        display: grid;
        grid-template-columns: minmax(6rem, auto) minmax(0, 1fr);
        gap: 0.65rem;
        align-items: center;
        pointer-events: auto;
      }
      .exec-due-chart__canvas-wrap {
        position: relative;
        height: 9.5rem;
        width: 100%;
        max-width: 9.5rem;
        margin: 0 auto;
        pointer-events: auto;
      }
      .exec-due-chart__canvas-wrap canvas {
        display: block;
        width: 100% !important;
        height: 100% !important;
        cursor: pointer;
        pointer-events: auto;
      }
      .exec-due-chart__legend {
        list-style: none;
        margin: 0;
        padding: 0;
        display: grid;
        gap: 0.35rem;
        font-size: 0.75rem;
        pointer-events: auto;
      }
      .exec-due-chart__legend li {
        display: block;
      }
      .exec-due-chart__legend-btn {
        display: grid;
        grid-template-columns: auto 1fr auto;
        gap: 0.45rem;
        align-items: baseline;
        width: 100%;
        margin: 0;
        padding: 0.15rem 0.2rem;
        border: 0;
        border-radius: var(--cf-radius-sm, 4px);
        background: transparent;
        color: inherit;
        text-align: left;
        cursor: pointer;
        pointer-events: auto;
      }
      .exec-due-chart__legend-btn:hover,
      .exec-due-chart__legend-btn:focus-visible {
        background: var(--cf-surface-muted, #f8fafc);
      }
      .exec-due-chart__legend i {
        width: 0.65rem;
        height: 0.65rem;
        border-radius: 999px;
        margin-top: 0.2rem;
        pointer-events: none;
      }
      .exec-due-chart__legend-value {
        text-align: right;
        white-space: nowrap;
      }
      .exec-due-chart__sr-only {
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
        .exec-due-chart__layout {
          grid-template-columns: 1fr;
        }
      }
    `,
  ],
})
export class ExecutiveDueScheduleChartComponent implements AfterViewInit, OnChanges, OnDestroy {
  private readonly cdr = inject(ChangeDetectorRef);
  private readonly router = inject(Router);

  @Input() slices: ExecutiveDueScheduleSlice[] = [];
  @Input() currencyCode = '';
  @Input() enableDrilldown = true;
  @Input() duesRoute = '/donations/dues';
  @Output() sliceSelected = new EventEmitter<ExecutiveDueScheduleSlice>();

  @ViewChild('chartCanvas') private canvas?: ElementRef<HTMLCanvasElement>;

  private chart?: Chart;
  private lastRenderKey = '';
  private renderCoalescePending = false;
  private canvasWaitAttempts = 0;
  private static readonly MAX_CANVAS_WAIT_ATTEMPTS = 24;

  get populatedSlices(): ExecutiveDueScheduleSlice[] {
    return this.slices.filter((slice) => Number(slice.amount) > 0);
  }

  get hasData(): boolean {
    return this.populatedSlices.length > 0;
  }

  get dataSummary(): string {
    if (!this.hasData) {
      return 'No outstanding due-schedule amounts.';
    }

    return this.populatedSlices
      .map(
        (slice) =>
          `${slice.label}: ${this.formatAmount(slice.amount)} (${this.formatPercent(slice.percent)})`
      )
      .join(', ');
  }

  colorFor(key: string): string {
    return SLICE_COLORS[key] ?? '#64748b';
  }

  formatAmount(amount: number): string {
    return cfFormatMoney(amount, this.currencyCode);
  }

  formatPercent(value: number): string {
    return `${Math.round(value * 10) / 10}%`;
  }

  drillToSlice(slice: ExecutiveDueScheduleSlice): void {
    this.sliceSelected.emit(slice);
    if (!this.enableDrilldown || !isDueScheduleFilter(slice.key)) {
      return;
    }
    void this.router.navigate([this.duesRoute], {
      queryParams: dueScheduleFilterQuery(slice.key as DueScheduleFilter),
    });
  }

  onCanvasClick(event: MouseEvent): void {
    const chart = this.chart;
    if (!chart) {
      return;
    }

    const hits = chart.getElementsAtEventForMode(event, 'nearest', { intersect: false }, false);
    const index = hits[0]?.index;
    if (index === undefined) {
      return;
    }

    const slice = this.populatedSlices[index];
    if (slice) {
      this.drillToSlice(slice);
    }
  }

  ngAfterViewInit(): void {
    this.scheduleRender();
  }

  ngOnChanges(changes: SimpleChanges): void {
    if (changes['slices'] || changes['currencyCode']) {
      this.scheduleRender();
    }
  }

  ngOnDestroy(): void {
    this.chart?.destroy();
    this.chart = undefined;
  }

  private scheduleRender(): void {
    if (this.renderCoalescePending) {
      return;
    }
    this.renderCoalescePending = true;
    queueMicrotask(() => {
      this.renderCoalescePending = false;
      this.canvasWaitAttempts = 0;
      this.renderChart();
    });
  }

  private renderChart(): void {
    if (!this.hasData) {
      this.chart?.destroy();
      this.chart = undefined;
      this.lastRenderKey = '';
      return;
    }

    const canvas = this.canvas?.nativeElement;
    if (!canvas) {
      if (this.canvasWaitAttempts < ExecutiveDueScheduleChartComponent.MAX_CANVAS_WAIT_ATTEMPTS) {
        this.canvasWaitAttempts += 1;
        queueMicrotask(() => this.renderChart());
      }
      return;
    }

    if (typeof canvas.getContext !== 'function' || !canvas.getContext('2d')) {
      return;
    }

    const renderKey = this.populatedSlices
      .map((row) => `${row.key}:${row.amount}:${this.currencyCode}`)
      .join('|');
    if (renderKey === this.lastRenderKey && this.chart) {
      return;
    }
    this.lastRenderKey = renderKey;

    const rows = this.populatedSlices;
    const data = rows.map((row) => row.amount);
    const colors = rows.map((row) => this.colorFor(row.key));
    this.chart?.destroy();
    this.chart = new Chart(canvas, {
      type: 'doughnut',
      data: {
        labels: rows.map((row) => row.label),
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
        animation: false,
        cutout: '58%',
        interaction: {
          mode: 'nearest',
          intersect: false,
        },
        onHover: (_event, elements) => {
          canvas.style.cursor = elements.length ? 'pointer' : 'default';
        },
        plugins: {
          legend: { display: false },
          tooltip: {
            callbacks: {
              label: (ctx) => {
                const slice = rows[ctx.dataIndex];
                if (!slice) {
                  return '';
                }
                return ` ${slice.label}: ${this.formatAmount(slice.amount)} (${this.formatPercent(slice.percent)})`;
              },
            },
          },
        },
      },
    });

    this.cdr.markForCheck();
  }
}
