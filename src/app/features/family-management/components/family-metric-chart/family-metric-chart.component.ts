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
import { CommonModule } from '@angular/common';
import { Chart, ChartConfiguration } from 'chart.js/auto';

export interface FamilyMetricSlice {
  key: string;
  label: string;
  count: number;
  percent: number;
  color: string;
}

export interface MetricChartPoint {
  x: number;
  y: number;
}

export interface MetricChartBox {
  top: number;
  right: number;
  bottom: number;
  left: number;
}

/**
 * Bar and column clicks resolve to the slice under the pointer.
 * A hit on the bar wins. Otherwise the category axis (label or row) maps to that slice.
 */
export function metricSliceIndexAt(
  point: MetricChartPoint,
  type: 'doughnut' | 'bar' | 'column' | 'semicircle',
  sliceCount: number,
  hitIndex: number | undefined,
  categoryScale: (MetricChartBox & { getValueForPixel: (pixel: number) => unknown }) | null,
  plot: MetricChartBox | null,
): number | undefined {
  if (hitIndex !== undefined && hitIndex >= 0 && hitIndex < sliceCount) {
    return hitIndex;
  }
  if ((type !== 'bar' && type !== 'column') || !categoryScale || !plot || sliceCount === 0) {
    return undefined;
  }

  const horizontal = type === 'bar';
  const alongScale = horizontal
    ? point.y >= categoryScale.top && point.y <= categoryScale.bottom
    : point.x >= categoryScale.left && point.x <= categoryScale.right;
  const acrossScale = horizontal
    ? point.x >= Math.min(categoryScale.left, plot.left) && point.x <= Math.max(categoryScale.right, plot.right)
    : point.y >= Math.min(plot.top, categoryScale.top) && point.y <= Math.max(plot.bottom, categoryScale.bottom);
  if (!alongScale || !acrossScale) {
    return undefined;
  }

  const raw = categoryScale.getValueForPixel(horizontal ? point.y : point.x);
  const index = typeof raw === 'number' && Number.isFinite(raw) ? Math.round(raw) : Number.NaN;
  if (!Number.isInteger(index) || index < 0 || index >= sliceCount) {
    return undefined;
  }
  return index;
}

@Component({
  selector: 'app-family-metric-chart',
  standalone: true,
  imports: [CommonModule],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <section
      class="fam-metric-chart"
      [class.fam-metric-chart--semi]="type === 'semicircle'"
      [class.fam-metric-chart--column]="type === 'column'"
      [class.fam-metric-chart--bar]="type === 'bar'"
      [class.fam-metric-chart--beside]="legendBeside"
      [style.--fam-chart-min]="usesFixedHeight ? stageHeight + 'px' : null"
      [attr.aria-label]="title"
    >
      <p class="fam-metric-chart__sr" *ngIf="slices.length">{{ summary }}</p>
      <div class="fam-metric-chart__layout" *ngIf="slices.length; else empty">
        <div class="fam-metric-chart__canvas-wrap">
          <div class="fam-metric-chart__canvas-stage">
            <canvas #canvas role="img" [attr.aria-label]="summary" (click)="onCanvasClick($event)"></canvas>
          </div>
        </div>
        <ul class="fam-metric-chart__legend">
          <li *ngFor="let slice of slices">
            <button
              type="button"
              class="fam-metric-chart__legend-btn"
              (click)="select.emit(slice)"
              [attr.aria-label]="slice.label + ', ' + slice.count + ', ' + slice.percent + ' percent'"
            >
              <i [style.background]="slice.color"></i>
              <span>{{ slice.label }}</span>
              <strong>{{ slice.count | number }} · {{ slice.percent }}%</strong>
            </button>
          </li>
        </ul>
      </div>
      <ng-template #empty>
        <p class="cf-meta">{{ emptyLabel }}</p>
      </ng-template>
    </section>
  `,
  styles: [`
    :host { display: block; container-type: inline-size; }
    .fam-metric-chart__layout { display: grid; grid-template-columns: 62% 38%; gap: 0.75rem; align-items: center; }
    .fam-metric-chart--bar .fam-metric-chart__layout,
    .fam-metric-chart--beside .fam-metric-chart__layout {
      grid-template-columns: minmax(0, 1fr) minmax(7.75rem, 34%);
      align-items: center;
    }
    @container (max-width: 28rem) {
      .fam-metric-chart__layout { grid-template-columns: 1fr; }
      .fam-metric-chart__canvas-wrap,
      .fam-metric-chart__canvas-stage { min-height: 140px; }
    }
    .fam-metric-chart__canvas-wrap { position: relative; min-height: 180px; }
    .fam-metric-chart__canvas-stage { position: relative; height: 100%; min-height: 180px; overflow: hidden; }
    .fam-metric-chart--bar .fam-metric-chart__canvas-wrap,
    .fam-metric-chart--bar .fam-metric-chart__canvas-stage,
    .fam-metric-chart--column .fam-metric-chart__canvas-wrap,
    .fam-metric-chart--column .fam-metric-chart__canvas-stage {
      height: var(--fam-chart-min, 180px);
      min-height: var(--fam-chart-min, 180px);
    }
    .fam-metric-chart__legend-btn span,
    .fam-metric-chart__legend-btn strong { font-size: 0.8125rem; line-height: 1.3; }
    .fam-metric-chart__legend-btn strong { font-weight: 600; white-space: nowrap; }
    .fam-metric-chart__canvas-wrap canvas { cursor: pointer; }
    .fam-metric-chart--semi .fam-metric-chart__canvas-wrap {
      min-height: 0;
      aspect-ratio: 2 / 1;
      overflow: hidden;
    }
    .fam-metric-chart--semi .fam-metric-chart__canvas-stage { height: 200%; min-height: 0; }
    .fam-metric-chart__legend { position: relative; z-index: 1; list-style: none; margin: 0; padding: 0; display: grid; gap: 0.35rem; }
    .fam-metric-chart__legend-btn {
      display: grid; grid-template-columns: 0.7rem 1fr auto; gap: 0.5rem; align-items: center;
      width: 100%; text-align: left; border: 0; background: transparent; cursor: pointer; padding: 0.25rem 0;
      color: inherit; font: inherit;
    }
    .fam-metric-chart__legend-btn i { width: 0.65rem; height: 0.65rem; border-radius: 999px; display: block; }
    .fam-metric-chart__sr { position: absolute; width: 1px; height: 1px; overflow: hidden; clip: rect(0,0,0,0); }
    @container (max-width: 20rem) {
      .fam-metric-chart--beside .fam-metric-chart__layout { grid-template-columns: 1fr; }
    }
    @media (max-width: 720px) {
      .fam-metric-chart__layout,
      .fam-metric-chart--beside .fam-metric-chart__layout { grid-template-columns: 1fr; }
    }
  `],
})
export class FamilyMetricChartComponent implements AfterViewInit, OnChanges, OnDestroy {
  @Input() title = '';
  @Input() type: 'doughnut' | 'bar' | 'column' | 'semicircle' = 'doughnut';
  @Input() slices: FamilyMetricSlice[] = [];
  @Input() emptyLabel = 'Not recorded';
  /** Locks bar/column canvas height so paired charts match. */
  @Input() chartMinHeight: number | null = null;
  /** Keep the legend beside the plot until the chart is very narrow. */
  @Input() legendBeside = false;
  @Output() select = new EventEmitter<FamilyMetricSlice>();
  @ViewChild('canvas') canvas?: ElementRef<HTMLCanvasElement>;

  private chart: Chart | null = null;
  private emitLock = false;

  get summary(): string {
    return this.slices.map((s) => `${s.label}: ${s.count} (${s.percent}%)`).join(', ');
  }

  get usesFixedHeight(): boolean {
    return this.type === 'bar' || this.type === 'column';
  }

  get stageHeight(): number {
    if (this.chartMinHeight != null && this.chartMinHeight > 0) {
      return this.chartMinHeight;
    }
    if (this.type === 'column') {
      return 220;
    }
    return Math.max(168, this.slices.length * 32);
  }

  ngAfterViewInit(): void {
    this.render();
  }

  ngOnChanges(changes: SimpleChanges): void {
    const slicesChanged = changes['slices'] && !changes['slices'].firstChange;
    const typeChanged = changes['type'] && !changes['type'].firstChange;
    if (slicesChanged || typeChanged) {
      this.render();
    }
  }

  ngOnDestroy(): void {
    this.chart?.destroy();
  }

  onCanvasClick(event: MouseEvent): void {
    this.emitIndex(this.indexAt(event));
  }

  private emitIndex(index: number | undefined): void {
    if (this.emitLock || index === undefined || index < 0 || index >= this.slices.length) {
      return;
    }
    const slice = this.slices[index];
    if (!slice) {
      return;
    }
    this.emitLock = true;
    queueMicrotask(() => {
      this.emitLock = false;
    });
    this.select.emit(slice);
  }

  private indexAt(event: MouseEvent): number | undefined {
    if (!this.chart) {
      return undefined;
    }
    const hits = this.chart.getElementsAtEventForMode(event, 'nearest', { intersect: true }, false);
    const scaleId = this.type === 'bar' ? 'y' : this.type === 'column' ? 'x' : null;
    const scale = scaleId ? this.chart.scales[scaleId] : null;
    return metricSliceIndexAt(
      { x: event.offsetX, y: event.offsetY },
      this.type,
      this.slices.length,
      hits[0]?.index,
      scale ?? null,
      this.chart.chartArea,
    );
  }

  private render(): void {
    const canvas = this.canvas?.nativeElement;
    if (!canvas || !this.slices.length) {
      this.chart?.destroy();
      this.chart = null;
      return;
    }

    this.chart?.destroy();
    const semi = this.type === 'semicircle';
    const column = this.type === 'column';
    const horizontalBar = this.type === 'bar';
    const cartesian = horizontalBar || column;
    const tickColor = this.themeColor(canvas, '--cf-color-text-muted', '#64748b');
    const gridColor = this.themeColor(canvas, '--cf-slate-200', '#e2e8f0');
    const config: ChartConfiguration = {
      type: cartesian ? 'bar' : 'doughnut',
      data: {
        labels: this.slices.map((s) => s.label),
        datasets: [{
          data: this.slices.map((s) => s.count),
          backgroundColor: this.slices.map((s) => s.color),
          borderWidth: 0,
          spacing: semi ? 2 : 0,
          borderRadius: cartesian || semi ? 4 : 0,
          borderSkipped: false,
          maxBarThickness: horizontalBar ? 22 : column ? 72 : undefined,
          barPercentage: horizontalBar ? 0.72 : undefined,
          categoryPercentage: horizontalBar ? 0.86 : undefined,
        }],
      },
      options: {
        responsive: true,
        maintainAspectRatio: false,
        indexAxis: horizontalBar ? 'y' : 'x',
        ...(semi ? { rotation: -90, circumference: 180, cutout: '62%' } : {}),
        ...(cartesian
          ? {
              interaction: { mode: 'nearest' as const, axis: horizontalBar ? 'y' as const : 'x' as const, intersect: false },
              scales: {
                x: {
                  beginAtZero: true,
                  grace: '6%',
                  ticks: { precision: 0, maxTicksLimit: 5, color: tickColor, font: { size: 11 } },
                  grid: { color: gridColor },
                  border: { display: false },
                },
                y: {
                  ticks: {
                    autoSkip: false,
                    padding: 8,
                    color: tickColor,
                    font: { size: 12 },
                  },
                  grid: { display: false },
                  border: { display: false },
                },
              },
            }
          : {}),
        plugins: {
          legend: { display: false },
          tooltip: {
            backgroundColor: '#0f172a',
            titleColor: '#f8fafc',
            bodyColor: '#f8fafc',
            titleFont: { size: 12, weight: 600 },
            bodyFont: { size: 12 },
            padding: 8,
            cornerRadius: 6,
            displayColors: true,
            callbacks: {
              title: (items) => {
                const index = items[0]?.dataIndex;
                return index === undefined ? '' : (this.slices[index]?.label ?? '');
              },
              label: (ctx) => {
                const slice = this.slices[ctx.dataIndex];
                if (!slice) {
                  return '';
                }
                return ` ${slice.count.toLocaleString()} · ${slice.percent}%`;
              },
            },
          },
        },
        onClick: (event, elements) => {
          const native = (event as { native?: Event }).native;
          const fromHit = elements[0]?.index;
          if (native instanceof MouseEvent) {
            this.emitIndex(fromHit ?? this.indexAt(native));
            return;
          }
          this.emitIndex(fromHit);
        },
      },
    };
    this.chart = new Chart(canvas, config);
  }

  private themeColor(canvas: HTMLCanvasElement, name: string, fallback: string): string {
    const value = getComputedStyle(canvas).getPropertyValue(name).trim();
    if (!value || value.startsWith('var(')) {
      return fallback;
    }
    return value;
  }
}
