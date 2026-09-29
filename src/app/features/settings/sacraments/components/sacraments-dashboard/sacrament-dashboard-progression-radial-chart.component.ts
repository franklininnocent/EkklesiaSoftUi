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
import { SacramentDashboardGaps } from '../../models/sacrament-dashboard.model';

export type SacramentDashboardProgressionKey =
  | 'baptized_without_communion'
  | 'baptized_without_confirmation'
  | 'female_unmarried_over_18'
  | 'male_unmarried_over_23';

interface ProgressionRadialItem {
  key: SacramentDashboardProgressionKey;
  label: string;
  count: number;
  color: string;
}

const PROGRESSION_COLORS = ['#22c55e', '#eab308', '#ef4444', '#2563eb'];
const TRACK_COLOR = '#e2e8f0';

@Component({
  selector: 'app-sacrament-dashboard-progression-radial-chart',
  standalone: true,
  imports: [CommonModule],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <div class="progression-radial" role="group" aria-label="Sacrament progression radial bar chart">
      <p class="sacrament-chart__sr-only">{{ dataSummary }}</p>
      <div class="progression-radial__body">
        <div class="progression-radial__canvas-wrap">
          <canvas #chartCanvas role="img" [attr.aria-label]="dataSummary"></canvas>
          <div class="progression-radial__center" aria-hidden="true">
            <strong>{{ totalCount }}</strong>
            <span>flagged</span>
          </div>
        </div>

        <ul class="progression-radial__legend">
          <li *ngFor="let item of items">
            <button
              type="button"
              class="progression-radial__legend-row"
              [disabled]="item.count === 0"
              (click)="onItemSelected(item.key)"
              [attr.aria-label]="item.label + ': ' + item.count + '. View families.'"
            >
              <i [style.background]="item.color"></i>
              <span>{{ item.label }}</span>
              <strong>{{ item.count }}</strong>
            </button>
          </li>
        </ul>
      </div>
    </div>
  `,
  styles: [`
    .progression-radial {
      min-width: 0;
    }

    .progression-radial__body {
      display: grid;
      grid-template-columns: minmax(8rem, 10rem) minmax(0, 1fr);
      gap: var(--cf-space-2);
      align-items: start;
    }

    .progression-radial__canvas-wrap {
      position: relative;
      width: 100%;
      max-width: 10rem;
      height: 10rem;
      margin: 0 auto;
    }

    .progression-radial__center {
      position: absolute;
      inset: 0;
      display: grid;
      place-content: center;
      text-align: center;
      gap: 0.1rem;
      pointer-events: none;
      padding: 0 1rem;
    }

    .progression-radial__center strong {
      font-size: 1.15rem;
      line-height: 1.1;
      color: var(--cf-text);
      font-weight: 600;
    }

    .progression-radial__center span {
      font-size: 0.65rem;
      text-transform: uppercase;
      letter-spacing: 0.04em;
      color: var(--cf-text-muted);
    }

    .progression-radial__legend {
      list-style: none;
      margin: 0;
      padding: 0;
      display: grid;
      gap: 0.35rem;
    }

    .progression-radial__legend-row {
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

    .progression-radial__legend-row:not(:disabled) {
      cursor: pointer;
    }

    .progression-radial__legend-row:not(:disabled):hover {
      color: var(--cf-primary);
    }

    .progression-radial__legend-row:disabled {
      cursor: default;
      opacity: 0.85;
    }

    .progression-radial__legend-row i {
      width: 0.55rem;
      height: 0.55rem;
      border-radius: 999px;
      display: inline-block;
      flex-shrink: 0;
    }

    .progression-radial__legend-row span {
      min-width: 0;
      font-size: 0.8125rem;
      line-height: 1.35;
      color: var(--cf-text-muted);
    }

    .progression-radial__legend-row strong {
      font-size: 0.875rem;
      color: var(--cf-text);
      font-weight: 600;
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
      .progression-radial__body {
        grid-template-columns: minmax(0, 1fr);
      }
    }
  `],
})
export class SacramentDashboardProgressionRadialChartComponent implements AfterViewInit, OnChanges, OnDestroy {
  private readonly cdr = inject(ChangeDetectorRef);

  @Input({ required: true }) progression!: SacramentDashboardGaps['progression'];
  @Input()
  set progressionThreshold(value: number | null | undefined) {
    this.resolvedThreshold = value ?? 10;
  }
  @Output() progressionSelected = new EventEmitter<SacramentDashboardProgressionKey>();

  @ViewChild('chartCanvas') private canvas?: ElementRef<HTMLCanvasElement>;

  items: ProgressionRadialItem[] = [];
  totalCount = 0;
  private resolvedThreshold = 10;

  private chart?: Chart;
  private frame: number | null = null;
  private renderAttempts = 0;

  get dataSummary(): string {
    return this.items.map((item) => `${item.label}: ${item.count}`).join(', ');
  }

  ngAfterViewInit(): void {
    this.rebuild();
  }

  ngOnChanges(changes: SimpleChanges): void {
    if (changes['progression'] || changes['progressionThreshold']) {
      this.rebuild();
    }
  }

  ngOnDestroy(): void {
    this.cancelScheduledRender();
    this.chart?.destroy();
  }

  onItemSelected(key: SacramentDashboardProgressionKey): void {
    const item = this.items.find((row) => row.key === key);
    if (!item || item.count === 0) {
      return;
    }

    this.progressionSelected.emit(key);
  }

  private rebuild(): void {
    const communion = this.progression?.baptized_without_communion;
    const confirmation = this.progression?.baptized_without_confirmation;
    const femaleUnmarried = this.progression?.female_unmarried_over_18;
    const maleUnmarried = this.progression?.male_unmarried_over_23;
    const threshold = this.resolvedThreshold;

    this.items = [
      {
        key: 'baptized_without_communion',
        label: `Baptized but no First Communion (age ${threshold}+)`,
        count: Number(communion?.count) || 0,
        color: PROGRESSION_COLORS[0],
      },
      {
        key: 'baptized_without_confirmation',
        label: `Baptized but not confirmation (age ${threshold}+)`,
        count: Number(confirmation?.count) || 0,
        color: PROGRESSION_COLORS[1],
      },
      {
        key: 'female_unmarried_over_18',
        label: 'Female (>18) - Not Married',
        count: Number(femaleUnmarried?.count) || 0,
        color: PROGRESSION_COLORS[2],
      },
      {
        key: 'male_unmarried_over_23',
        label: 'Male (>23) - Not Married',
        count: Number(maleUnmarried?.count) || 0,
        color: PROGRESSION_COLORS[3],
      },
    ];
    this.totalCount = this.items.reduce((sum, item) => sum + item.count, 0);
    this.cdr.markForCheck();
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
    const canvas = this.canvas?.nativeElement;
    if (!canvas) {
      if (this.renderAttempts < 8) {
        this.renderAttempts += 1;
        this.scheduleRender();
      }
      return;
    }

    this.chart?.destroy();

    const maxValue = Math.max(...this.items.map((item) => item.count), 1);
    const datasets = this.items.map((item) => ({
      label: item.label,
      data: [item.count, Math.max(maxValue - item.count, 0)],
      backgroundColor: [item.color, TRACK_COLOR],
      borderWidth: 0,
      borderRadius: 3,
      circumference: 360,
      rotation: -90,
    }));

    this.chart = new Chart(canvas, {
      type: 'doughnut',
      data: {
        labels: this.items.map((item) => item.label),
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
                return ` ${value} (${pct}% of highest)`;
              },
            },
          },
        },
      },
    });

    this.cdr.markForCheck();
  }
}
