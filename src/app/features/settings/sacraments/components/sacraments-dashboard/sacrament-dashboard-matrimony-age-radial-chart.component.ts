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
  QueryList,
  SimpleChanges,
  ViewChildren,
  inject,
} from '@angular/core';
import { Chart } from 'chart.js/auto';
import { SacramentDashboardAgeBucket } from '../../models/sacrament-dashboard.model';

/** Green → yellow → red progression by age bracket (youngest inner ring). */
export const MATRIMONY_AGE_RADIAL_COLORS = ['#22c55e', '#eab308', '#f59e0b', '#f97316', '#ef4444'];

const TRACK_COLOR = '#e2e8f0';

@Component({
  selector: 'app-sacrament-dashboard-matrimony-age-radial-chart',
  standalone: true,
  imports: [CommonModule],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <div class="matrimony-age-radial" role="group" [attr.aria-label]="ariaLabel">
      <p class="sacrament-chart__sr-only" *ngIf="hasData">{{ dataSummary }}</p>
      <div class="matrimony-age-radial__grid">
        <article class="matrimony-age-radial__panel" *ngFor="let panel of panels">
          <p class="matrimony-age-radial__panel-label">{{ panel.label }}</p>
          <div class="matrimony-age-radial__canvas-wrap">
            <canvas
              #panelCanvas
              [attr.data-panel]="panel.key"
              role="img"
              [attr.aria-label]="panel.summary"
            ></canvas>
            <div class="matrimony-age-radial__center" aria-hidden="true">
              <strong>{{ panel.total }}</strong>
              <span>recorded</span>
            </div>
          </div>
          <ul class="matrimony-age-radial__legend" aria-hidden="true">
            <li *ngFor="let ring of panel.rings">
              <i [style.background]="ring.color"></i>
              <span>{{ ring.label }}</span>
              <strong>{{ ring.count }}</strong>
            </li>
          </ul>
        </article>
      </div>
    </div>
  `,
  styles: [`
    .matrimony-age-radial__grid {
      display: grid;
      grid-template-columns: repeat(2, minmax(0, 1fr));
      gap: var(--cf-space-2);
    }

    .matrimony-age-radial__panel {
      display: grid;
      gap: 0.35rem;
      min-width: 0;
    }

    .matrimony-age-radial__panel-label {
      margin: 0;
      font-size: 0.6875rem;
      font-weight: 600;
      text-transform: uppercase;
      letter-spacing: 0.04em;
      color: var(--cf-text-muted);
    }

    .matrimony-age-radial__canvas-wrap {
      position: relative;
      width: 100%;
      max-width: 11rem;
      height: 11rem;
      margin: 0 auto;
    }

    .matrimony-age-radial__center {
      position: absolute;
      inset: 0;
      display: grid;
      place-content: center;
      text-align: center;
      gap: 0.1rem;
      pointer-events: none;
      padding: 0 1.25rem;
    }

    .matrimony-age-radial__center strong {
      font-size: 1.1rem;
      line-height: 1.1;
      color: var(--cf-text);
      font-weight: 600;
    }

    .matrimony-age-radial__center span {
      font-size: 0.65rem;
      text-transform: uppercase;
      letter-spacing: 0.04em;
      color: var(--cf-text-muted);
    }

    .matrimony-age-radial__legend {
      list-style: none;
      margin: 0;
      padding: 0;
      display: grid;
      gap: 0.3rem;
    }

    .matrimony-age-radial__legend li {
      display: grid;
      grid-template-columns: auto 1fr auto;
      gap: 0.35rem;
      align-items: center;
      font-size: 0.75rem;
      color: var(--cf-text-muted);
    }

    .matrimony-age-radial__legend i {
      width: 0.55rem;
      height: 0.55rem;
      border-radius: 999px;
      display: inline-block;
    }

    .matrimony-age-radial__legend strong {
      color: var(--cf-text);
      font-weight: 600;
      font-size: 0.75rem;
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
      .matrimony-age-radial__grid {
        grid-template-columns: minmax(0, 1fr);
      }
    }
  `],
})
export class SacramentDashboardMatrimonyAgeRadialChartComponent implements AfterViewInit, OnChanges, OnDestroy {
  private readonly cdr = inject(ChangeDetectorRef);

  @Input() brideBuckets: SacramentDashboardAgeBucket[] = [];
  @Input() groomBuckets: SacramentDashboardAgeBucket[] = [];
  @Input() colors: string[] = MATRIMONY_AGE_RADIAL_COLORS;

  @ViewChildren('panelCanvas') private canvases?: QueryList<ElementRef<HTMLCanvasElement>>;

  panels: Array<{
    key: string;
    label: string;
    total: number;
    summary: string;
    buckets: SacramentDashboardAgeBucket[];
    rings: Array<{ label: string; count: number; color: string }>;
  }> = [];

  private charts = new Map<string, Chart>();
  private frame: number | null = null;
  private renderAttempts = 0;

  get hasData(): boolean {
    return this.bucketTotal(this.brideBuckets) > 0 || this.bucketTotal(this.groomBuckets) > 0;
  }

  get ariaLabel(): string {
    return 'Bride and groom age at marriage radial bar chart';
  }

  get dataSummary(): string {
    return this.panels.map((panel) => panel.summary).join('. ');
  }

  ngAfterViewInit(): void {
    this.rebuild();
  }

  ngOnChanges(changes: SimpleChanges): void {
    if (changes['brideBuckets'] || changes['groomBuckets'] || changes['colors']) {
      this.rebuild();
    }
  }

  ngOnDestroy(): void {
    this.cancelScheduledRender();
    this.destroyCharts();
  }

  private rebuild(): void {
    this.panels = [
      this.buildPanel('bride', 'Bride', this.brideBuckets),
      this.buildPanel('groom', 'Groom', this.groomBuckets),
    ];
    this.cdr.markForCheck();
    this.renderAttempts = 0;
    this.scheduleRender();
  }

  private buildPanel(
    key: string,
    label: string,
    buckets: SacramentDashboardAgeBucket[],
  ): {
    key: string;
    label: string;
    total: number;
    summary: string;
    buckets: SacramentDashboardAgeBucket[];
    rings: Array<{ label: string; count: number; color: string }>;
  } {
    const rings = buckets.map((bucket, index) => ({
      label: bucket.label,
      count: Number(bucket.count) || 0,
      color: this.colors[index % this.colors.length],
    }));
    const total = rings.reduce((sum, ring) => sum + ring.count, 0);
    const summary = rings
      .filter((ring) => ring.count > 0)
      .map((ring) => `${label} ${ring.label}: ${ring.count}`)
      .join(', ');

    return {
      key,
      label,
      total,
      summary: summary || `${label}: no age data`,
      buckets,
      rings,
    };
  }

  private bucketTotal(buckets: SacramentDashboardAgeBucket[]): number {
    return buckets.reduce((sum, bucket) => sum + (Number(bucket.count) || 0), 0);
  }

  private scheduleRender(): void {
    this.cancelScheduledRender();
    this.frame = requestAnimationFrame(() => {
      this.frame = null;
      this.renderCharts();
    });
  }

  private cancelScheduledRender(): void {
    if (this.frame !== null) {
      cancelAnimationFrame(this.frame);
      this.frame = null;
    }
  }

  private destroyCharts(): void {
    for (const chart of this.charts.values()) {
      chart.destroy();
    }
    this.charts.clear();
  }

  private renderCharts(): void {
    const elements = this.canvases?.toArray() ?? [];
    if (!elements.length) {
      if (this.renderAttempts < 8) {
        this.renderAttempts += 1;
        this.scheduleRender();
      }
      return;
    }

    let missingCanvas = false;

    for (const panel of this.panels) {
      const ref = elements.find((entry) => entry.nativeElement.dataset['panel'] === panel.key);
      const canvas = ref?.nativeElement;
      if (!canvas) {
        missingCanvas = true;
        continue;
      }

      this.charts.get(panel.key)?.destroy();
      const chart = this.createRadialBarChart(canvas, panel.buckets);
      if (chart) {
        this.charts.set(panel.key, chart);
      }
    }

    if (missingCanvas && this.renderAttempts < 8) {
      this.renderAttempts += 1;
      this.scheduleRender();
    }

    this.cdr.markForCheck();
  }

  private createRadialBarChart(
    canvas: HTMLCanvasElement,
    buckets: SacramentDashboardAgeBucket[],
  ): Chart | undefined {
    if (!buckets.length) {
      return undefined;
    }

    const maxValue = Math.max(
      ...buckets.map((bucket) => Number(bucket.count) || 0),
      1,
    );

    const datasets = buckets.map((bucket, index) => {
      const value = Number(bucket.count) || 0;
      const color = this.colors[index % this.colors.length];

      return {
        label: bucket.label,
        data: [value, Math.max(maxValue - value, 0)],
        backgroundColor: [color, TRACK_COLOR],
        borderWidth: 0,
        borderRadius: 3,
        circumference: 360,
        rotation: -90,
      };
    });

    return new Chart(canvas, {
      type: 'doughnut',
      data: {
        labels: buckets.map((bucket) => bucket.label),
        datasets,
      },
      options: {
        responsive: true,
        maintainAspectRatio: false,
        animation: false,
        cutout: '22%',
        plugins: {
          legend: { display: false },
          tooltip: {
            filter: (item) => item.dataIndex === 0,
            callbacks: {
              label: (ctx) => {
                const value = Number(ctx.raw ?? 0);
                const pct = maxValue > 0 ? Math.round((value / maxValue) * 100) : 0;
                return ` ${ctx.dataset.label}: ${value} (${pct}% of peak bracket)`;
              },
            },
          },
        },
      },
    });
  }
}
