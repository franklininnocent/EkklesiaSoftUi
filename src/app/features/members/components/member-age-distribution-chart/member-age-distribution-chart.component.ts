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
import { MemberAgeChartSlice } from '../../models/member-dashboard.model';
import { memberAgeColor } from '../../utils/member-age-groups.util';

@Component({
  selector: 'app-member-age-distribution-chart',
  standalone: true,
  imports: [CommonModule],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <section
      class="member-age-chart cf-chart-panel"
      [class.member-age-chart--compact]="compact"
      aria-label="Member age distribution"
    >
      <p class="member-age-chart__sr-only" *ngIf="hasData">{{ dataSummary }}</p>
      <div class="member-age-chart__layout" *ngIf="hasData; else empty">
        <div class="member-age-chart__canvas-wrap">
          <canvas
            #chartCanvas
            role="img"
            [attr.aria-label]="dataSummary"
            (click)="onCanvasClick($event)"
          ></canvas>
        </div>
        <ul class="member-age-chart__legend">
          <li *ngFor="let slice of populatedSlices">
            <button
              type="button"
              class="member-age-chart__legend-btn"
              (click)="drillToSlice(slice)"
              [attr.aria-label]="'View ' + slice.displayLabel + ' members'"
            >
              <i [style.background]="colorFor(slice.key)"></i>
              <span class="member-age-chart__legend-label">{{ slice.displayLabel }}</span>
              <span class="member-age-chart__legend-value">
                <strong>{{ slice.count }}</strong>
                <span class="cf-meta">({{ formatPercent(slice.percent) }})</span>
              </span>
            </button>
          </li>
        </ul>
      </div>
      <ng-template #empty>
        <p class="cf-chart-panel__empty">No age data yet — add dates of birth on member profiles.</p>
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
        container-type: inline-size;
      }

      .member-age-chart.cf-chart-panel {
        display: flex;
        flex-direction: column;
        min-height: 0;
        pointer-events: auto;
      }

      .member-age-chart__layout {
        display: grid;
        grid-template-columns: minmax(8rem, 1fr) minmax(10rem, 1.1fr);
        gap: 1rem;
        align-items: center;
      }

      .member-age-chart__canvas-wrap {
        position: relative;
        height: 240px;
        width: 100%;
        max-width: 260px;
        margin: 0 auto;
        pointer-events: auto;
      }

      .member-age-chart--compact .member-age-chart__canvas-wrap {
        height: var(--member-age-chart-size, 9.5rem);
        max-width: var(--member-age-chart-max, 9.5rem);
      }

      .member-age-chart__canvas-wrap canvas {
        display: block;
        width: 100% !important;
        height: 100% !important;
        cursor: pointer;
        pointer-events: auto;
      }

      .member-age-chart__legend {
        list-style: none;
        margin: 0;
        padding: 0;
        display: grid;
        gap: 0.5rem;
        pointer-events: auto;
      }

      .member-age-chart__legend li {
        display: block;
        font-size: 0.875rem;
      }

      .member-age-chart__legend-btn {
        display: grid;
        grid-template-columns: auto 1fr auto;
        gap: 0.5rem;
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

      .member-age-chart__legend-btn:hover,
      .member-age-chart__legend-btn:focus-visible {
        background: var(--cf-surface-muted, #f8fafc);
      }

      .member-age-chart__legend i {
        width: 0.65rem;
        height: 0.65rem;
        border-radius: 999px;
        margin-top: 0.35rem;
        pointer-events: none;
      }

      .member-age-chart__legend-value {
        text-align: right;
        white-space: nowrap;
      }

      .member-age-chart--compact .member-age-chart__legend {
        font-size: 0.75rem;
        gap: 0.35rem;
      }

      .member-age-chart--compact .member-age-chart__layout {
        grid-template-columns: minmax(6rem, auto) minmax(0, 1fr);
        gap: 0.65rem;
      }

      .member-age-chart__sr-only {
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

      @container (max-width: 28rem) {
        .member-age-chart__layout {
          grid-template-columns: 1fr;
        }

        .member-age-chart__canvas-wrap {
          height: 180px;
          max-width: 180px;
        }
      }

      @media (max-width: 640px) {
        .member-age-chart__layout,
        .member-age-chart--compact .member-age-chart__layout {
          grid-template-columns: 1fr;
        }

        .member-age-chart--compact .member-age-chart__canvas-wrap {
          height: min(10.5rem, var(--member-age-chart-size, 9.5rem));
          max-width: min(10.5rem, var(--member-age-chart-max, 9.5rem));
          margin: 0 auto;
        }
      }
    `,
  ],
})
export class MemberAgeDistributionChartComponent implements AfterViewInit, OnChanges, OnDestroy {
  private readonly cdr = inject(ChangeDetectorRef);
  private readonly router = inject(Router);

  @Input() slices: MemberAgeChartSlice[] = [];
  @Input() compact = false;
  /** When true, chart and legend navigate to the member list with age_band applied. */
  @Input() enableListDrilldown = true;
  @Input() membersListPath = '/members/list';
  @Input() extraQueryParams: Record<string, string> = {};
  @Output() sliceSelected = new EventEmitter<MemberAgeChartSlice>();

  @ViewChild('chartCanvas') private canvas?: ElementRef<HTMLCanvasElement>;

  private chart?: Chart;
  private drillLock = false;
  private lastRenderKey = '';
  private renderCoalescePending = false;
  private canvasWaitAttempts = 0;
  private static readonly MAX_CANVAS_WAIT_ATTEMPTS = 24;

  get populatedSlices(): MemberAgeChartSlice[] {
    return this.slices.filter((slice) => slice.count > 0);
  }

  get hasData(): boolean {
    return this.populatedSlices.length > 0;
  }

  get dataSummary(): string {
    if (!this.hasData) {
      return 'No member age distribution data.';
    }

    return this.populatedSlices
      .map((slice) => `${slice.displayLabel}: ${slice.count} (${this.formatPercent(slice.percent)})`)
      .join(', ');
  }

  colorFor(key: MemberAgeChartSlice['key']): string {
    return memberAgeColor(key);
  }

  formatPercent(value: number): string {
    const rounded = Math.round(value * 10) / 10;
    return `${rounded}%`;
  }

  drillToSlice(slice: MemberAgeChartSlice): void {
    if (this.drillLock) {
      return;
    }
    this.drillLock = true;
    queueMicrotask(() => {
      this.drillLock = false;
    });
    this.sliceSelected.emit(slice);
    if (!this.enableListDrilldown) {
      return;
    }
    void this.router.navigate([this.membersListPath], {
      queryParams: { age_band: slice.key, ...this.extraQueryParams },
    });
  }

  onCanvasClick(event: MouseEvent): void {
    const chart = this.chart;
    if (!chart) {
      return;
    }

    const hits = chart.getElementsAtEventForMode(event, 'nearest', { intersect: true }, false);
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
    if (changes['slices'] || changes['compact']) {
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
      if (this.canvasWaitAttempts < MemberAgeDistributionChartComponent.MAX_CANVAS_WAIT_ATTEMPTS) {
        this.canvasWaitAttempts += 1;
        queueMicrotask(() => this.renderChart());
      }
      return;
    }

    if (typeof canvas.getContext !== 'function' || !canvas.getContext('2d')) {
      return;
    }

    const renderKey = this.populatedSlices.map((row) => `${row.key}:${row.count}:${this.compact}`).join('|');
    if (renderKey === this.lastRenderKey && this.chart) {
      return;
    }
    this.lastRenderKey = renderKey;

    const rows = this.populatedSlices;
    const labels = rows.map((row) => row.displayLabel);
    const data = rows.map((row) => row.count);
    const colors = rows.map((row) => memberAgeColor(row.key));
    const total = data.reduce((sum, count) => sum + count, 0);

    this.chart?.destroy();
    this.chart = new Chart(canvas, {
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
        animation: false,
        cutout: this.compact ? '58%' : '52%',
        interaction: {
          mode: 'nearest',
          intersect: true,
        },
        onClick: (_event, elements) => {
          const index = elements[0]?.index;
          const slice = index === undefined ? undefined : this.populatedSlices[index];
          if (slice) {
            this.drillToSlice(slice);
          }
        },
        onHover: (_event, elements) => {
          canvas.style.cursor = elements.length ? 'pointer' : 'default';
        },
        plugins: {
          legend: { display: false },
          tooltip: {
            callbacks: {
              label: (ctx) => {
                const value = Number(ctx.raw ?? 0);
                const pct = total > 0 ? Math.round((value / total) * 1000) / 10 : 0;
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
