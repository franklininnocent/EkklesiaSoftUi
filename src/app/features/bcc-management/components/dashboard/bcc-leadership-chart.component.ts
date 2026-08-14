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

export interface BccLeadershipChartData {
  withPrimary: number;
  withoutPrimary: number;
  activeLeaders: number;
  coveragePercent: number | null;
}

interface RadialRing {
  label: string;
  value: number;
  display: string;
  color: string;
}

@Component({
  selector: 'app-bcc-leadership-chart',
  standalone: true,
  imports: [CommonModule],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <div class="bcc-lead-chart" aria-label="Leadership radial chart">
      <div class="bcc-lead-chart__canvas-wrap" *ngIf="rings.length; else empty">
        <canvas #chartCanvas role="img" [attr.aria-label]="ariaLabel"></canvas>
        <div class="bcc-lead-chart__center" *ngIf="coverageLabel !== null">
          <strong>{{ coverageLabel }}</strong>
          <span>Coverage</span>
        </div>
      </div>
      <ul class="bcc-lead-chart__legend" *ngIf="rings.length">
        <li *ngFor="let ring of rings">
          <i [style.background]="ring.color"></i>
          <span>{{ ring.label }}</span>
          <strong>{{ ring.display }}</strong>
        </li>
      </ul>
      <ng-template #empty>
        <p class="cf-meta">Leadership data is not available.</p>
      </ng-template>
    </div>
  `,
  styles: [
    `
      .bcc-lead-chart {
        display: grid;
        grid-template-columns: minmax(9rem, 1fr) minmax(9rem, 1.1fr);
        gap: 0.85rem;
        align-items: center;
      }
      .bcc-lead-chart__canvas-wrap {
        position: relative;
        height: 210px;
        width: 100%;
        max-width: 220px;
        margin: 0 auto;
      }
      .bcc-lead-chart__center {
        position: absolute;
        inset: 0;
        display: grid;
        place-content: center;
        text-align: center;
        pointer-events: none;
        gap: 0.1rem;
      }
      .bcc-lead-chart__center strong {
        font-size: 1.35rem;
        line-height: 1;
        color: var(--cf-slate-900, #0f172a);
      }
      .bcc-lead-chart__center span {
        font-size: 0.72rem;
        text-transform: uppercase;
        letter-spacing: 0.04em;
        color: var(--cf-muted, #64748b);
      }
      .bcc-lead-chart__legend {
        list-style: none;
        margin: 0;
        padding: 0;
        display: grid;
        gap: 0.5rem;
      }
      .bcc-lead-chart__legend li {
        display: grid;
        grid-template-columns: auto 1fr auto;
        gap: 0.45rem;
        align-items: center;
        font-size: 0.82rem;
      }
      .bcc-lead-chart__legend i {
        width: 0.65rem;
        height: 0.65rem;
        border-radius: 999px;
        display: inline-block;
      }
      @media (max-width: 640px) {
        .bcc-lead-chart {
          grid-template-columns: 1fr;
        }
      }
    `,
  ],
})
export class BccLeadershipChartComponent implements AfterViewInit, OnChanges, OnDestroy {
  private readonly cdr = inject(ChangeDetectorRef);

  @Input() data: BccLeadershipChartData | null = null;
  @ViewChild('chartCanvas') private canvas?: ElementRef<HTMLCanvasElement>;

  rings: RadialRing[] = [];
  coverageLabel: string | null = null;

  private chart?: Chart;
  private readonly trackColor = 'rgba(148, 163, 184, 0.22)';

  get ariaLabel(): string {
    return this.rings.map((r) => `${r.label} ${r.display}`).join(', ');
  }

  ngAfterViewInit(): void {
    this.rebuild();
  }

  ngOnChanges(changes: SimpleChanges): void {
    if (changes['data'] && !this.sameData(changes['data'].previousValue, changes['data'].currentValue)) {
      this.rebuild();
    }
  }

  private sameData(
    prev: BccLeadershipChartData | null | undefined,
    next: BccLeadershipChartData | null | undefined
  ): boolean {
    if (prev === next) {
      return true;
    }
    if (!prev || !next) {
      return false;
    }
    return (
      prev.withPrimary === next.withPrimary &&
      prev.withoutPrimary === next.withoutPrimary &&
      prev.activeLeaders === next.activeLeaders &&
      prev.coveragePercent === next.coveragePercent
    );
  }

  ngOnDestroy(): void {
    this.chart?.destroy();
  }

  private rebuild(): void {
    this.rings = this.buildRings();
    const coverage = this.data?.coveragePercent;
    this.coverageLabel = coverage === null || coverage === undefined ? null : `${coverage}%`;
    this.cdr.markForCheck();
    queueMicrotask(() => this.renderChart());
  }

  private buildRings(): RadialRing[] {
    if (!this.data) {
      return [];
    }

    const withPrimary = Math.max(0, this.data.withPrimary);
    const withoutPrimary = Math.max(0, this.data.withoutPrimary);
    const activeLeaders = Math.max(0, this.data.activeLeaders);
    const activeBccs = withPrimary + withoutPrimary;
    const coverage = this.data.coveragePercent;

    const primaryRate = activeBccs > 0 ? Math.round((withPrimary / activeBccs) * 100) : 0;
    const coverageValue = coverage === null || coverage === undefined ? primaryRate : Math.max(0, Math.min(100, coverage));
    const leaderCapacity =
      activeBccs > 0 ? Math.max(0, Math.min(100, Math.round((activeLeaders / activeBccs) * 100))) : 0;
    const gapRate = activeBccs > 0 ? Math.round((withoutPrimary / activeBccs) * 100) : 0;

    return [
      {
        label: 'Leadership coverage',
        value: coverageValue,
        display: `${coverageValue}%`,
        color: '#2563eb',
      },
      {
        label: 'BCCs with primary leader',
        value: primaryRate,
        display: String(withPrimary),
        color: '#0d9488',
      },
      {
        label: 'Active leaders',
        value: leaderCapacity,
        display: String(activeLeaders),
        color: '#7c3aed',
      },
      {
        label: 'BCCs without primary leader',
        value: gapRate,
        display: String(withoutPrimary),
        color: '#d97706',
      },
    ];
  }

  private renderChart(): void {
    if (!this.rings.length) {
      this.chart?.destroy();
      this.chart = undefined;
      return;
    }

    const canvas = this.canvas?.nativeElement;
    if (!canvas) {
      queueMicrotask(() => this.renderChart());
      return;
    }

    if (typeof canvas.getContext !== 'function') {
      return;
    }
    try {
      if (!canvas.getContext('2d')) {
        return;
      }
    } catch {
      return;
    }

    try {
      this.chart?.destroy();

      // Concentric doughnut rings → radial bar appearance (outer → inner).
      const datasets = this.rings.map((ring) => ({
        label: ring.label,
        data: [ring.value, Math.max(0, 100 - ring.value)],
        backgroundColor: [ring.color, this.trackColor],
        borderWidth: 0,
        weight: 1,
      }));

      this.chart = new Chart(canvas, {
        type: 'doughnut',
        data: {
          labels: ['Filled', 'Remaining'],
          datasets,
        },
        options: {
          responsive: true,
          maintainAspectRatio: false,
          animation: false,
          rotation: -90,
          circumference: 360,
          cutout: '52%',
          plugins: {
            legend: { display: false },
            tooltip: {
              filter: (item) => item.dataIndex === 0,
              callbacks: {
                label: (ctx) => {
                  const ring = this.rings[ctx.datasetIndex];
                  if (!ring) {
                    return '';
                  }
                  return ` ${ring.label}: ${ring.display} (${ring.value}%)`;
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
