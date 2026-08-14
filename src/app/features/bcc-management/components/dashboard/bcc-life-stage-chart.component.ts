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

export interface BccLifeStageSlice {
  label: string;
  count: number;
}

@Component({
  selector: 'app-bcc-life-stage-chart',
  standalone: true,
  imports: [CommonModule],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <div class="bcc-life-chart" aria-label="Life stage distribution">
      <div class="bcc-life-chart__canvas-wrap" *ngIf="hasData; else empty">
        <canvas #chartCanvas role="img" [attr.aria-label]="ariaLabel"></canvas>
      </div>
      <ul class="bcc-life-chart__legend" *ngIf="hasData" aria-hidden="true">
        <li *ngFor="let slice of slices; let i = index">
          <i [style.background]="colors[i]"></i>
          <span>{{ slice.label }}</span>
          <strong>{{ slice.count }}</strong>
        </li>
      </ul>
      <ng-template #empty>
        <p class="cf-meta">No life-stage data available.</p>
      </ng-template>
    </div>
  `,
  styles: [
    `
      .bcc-life-chart {
        display: grid;
        grid-template-columns: minmax(7rem, 0.9fr) minmax(7rem, 1fr);
        gap: 0.65rem;
        align-items: center;
      }
      .bcc-life-chart__canvas-wrap {
        position: relative;
        height: 160px;
        width: 100%;
        max-width: 180px;
        margin: 0 auto;
      }
      .bcc-life-chart__legend {
        list-style: none;
        margin: 0;
        padding: 0;
        display: grid;
        gap: 0.45rem;
      }
      .bcc-life-chart__legend li {
        display: grid;
        grid-template-columns: auto 1fr auto;
        gap: 0.45rem;
        align-items: center;
        font-size: 0.85rem;
      }
      .bcc-life-chart__legend i {
        width: 0.65rem;
        height: 0.65rem;
        border-radius: 999px;
        display: inline-block;
      }
      @media (max-width: 640px) {
        .bcc-life-chart {
          grid-template-columns: 1fr;
        }
      }
    `,
  ],
})
export class BccLifeStageChartComponent implements AfterViewInit, OnChanges, OnDestroy {
  private readonly cdr = inject(ChangeDetectorRef);

  @Input() slices: BccLifeStageSlice[] = [];
  @ViewChild('chartCanvas') private canvas?: ElementRef<HTMLCanvasElement>;

  readonly colors = ['#2563eb', '#0d9488', '#ca8a04', '#7c3aed'];

  private chart?: Chart;

  get hasData(): boolean {
    return this.slices.some((s) => s.count > 0);
  }

  get ariaLabel(): string {
    const parts = this.slices.map((s) => `${s.label} ${s.count}`).join(', ');
    return `Life stage pie chart: ${parts}`;
  }

  ngAfterViewInit(): void {
    this.renderChart();
  }

  ngOnChanges(changes: SimpleChanges): void {
    if (changes['slices'] && !this.sameSlices(changes['slices'].previousValue, changes['slices'].currentValue)) {
      this.renderChart();
    }
  }

  private sameSlices(prev: BccLifeStageSlice[] | undefined, next: BccLifeStageSlice[] | undefined): boolean {
    if (prev === next) {
      return true;
    }
    if (!prev || !next || prev.length !== next.length) {
      return false;
    }
    return prev.every((p, i) => p.label === next[i].label && p.count === next[i].count);
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

    if (typeof canvas.getContext !== 'function' || !canvas.getContext('2d')) {
      return;
    }

    try {
      this.chart?.destroy();
      this.chart = new Chart(canvas, {
        type: 'pie',
        data: {
          labels: this.slices.map((s) => s.label),
          datasets: [
            {
              data: this.slices.map((s) => s.count),
              backgroundColor: this.colors.slice(0, this.slices.length),
              borderColor: '#ffffff',
              borderWidth: 2,
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
                label: (ctx) => {
                  const total = this.slices.reduce((sum, s) => sum + s.count, 0);
                  const value = Number(ctx.raw ?? 0);
                  const pct = total > 0 ? ((value / total) * 100).toFixed(1) : '0';
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
