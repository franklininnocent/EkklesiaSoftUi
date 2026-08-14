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
import { BccGrowthPoint } from '../../models/bcc.model';

export type BccGrowthMeasure = 'families' | 'people';

@Component({
  selector: 'app-bcc-growth-panel',
  standalone: true,
  imports: [CommonModule],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <section class="cf-chart-panel cf-panel bcc-growth" [attr.aria-label]="title">
      <div class="cf-chart-panel__head">
        <div>
          <h3>{{ title }}</h3>
          <p class="cf-meta">{{ subtitle || ('Connected ' + measureLabel + ' over the selected period') }}</p>
        </div>
        <div class="cf-chart-panel__toggle" role="tablist" [attr.aria-label]="measureToggleLabel">
          <button
            type="button"
            role="tab"
            [class.active]="measure === 'families'"
            [attr.aria-selected]="measure === 'families'"
            (click)="setMeasure('families')"
          >
            {{ familiesLabel }}
          </button>
          <button
            type="button"
            role="tab"
            [class.active]="measure === 'people'"
            [attr.aria-selected]="measure === 'people'"
            (click)="setMeasure('people')"
          >
            {{ peopleLabel }}
          </button>
        </div>
      </div>

      <div *ngIf="insufficientHistory; else chartBlock" class="bcc-growth__empty">
        <p><strong>{{ emptyTitle }}</strong></p>
        <p class="cf-meta">{{ emptyDescription }}</p>
      </div>

      <ng-template #chartBlock>
        <div class="cf-chart-panel__chart-wrap" *ngIf="points.length; else noPoints">
          <canvas #chartCanvas role="img" [attr.aria-label]="ariaLabel"></canvas>
        </div>
        <ng-template #noPoints>
          <p class="cf-chart-panel__empty">No growth data available for this period.</p>
        </ng-template>
      </ng-template>
    </section>
  `,
  styles: [
    `
      .cf-chart-panel__chart-wrap {
        position: relative;
        height: 260px;
        width: 100%;
      }
      .bcc-growth__empty {
        padding: 1.25rem 0.25rem;
      }
      .bcc-growth h3 {
        margin: 0;
        font-size: 1rem;
      }
    `,
  ],
})
export class BccGrowthPanelComponent implements AfterViewInit, OnChanges, OnDestroy {
  private readonly cdr = inject(ChangeDetectorRef);

  @Input() families: BccGrowthPoint[] = [];
  @Input() people: BccGrowthPoint[] = [];
  @Input() insufficientHistory = false;
  @Input() measure: BccGrowthMeasure = 'families';
  @Input() title = 'Community growth';
  @Input() subtitle = '';
  @Input() familiesLabel = 'Families';
  @Input() peopleLabel = 'People';
  @Input() measureToggleLabel = 'Growth measure';
  @Input() emptyTitle = 'Not enough history yet';
  @Input() emptyDescription = 'Growth trends will appear once sufficient historical data is available.';
  @Output() measureChange = new EventEmitter<BccGrowthMeasure>();

  @ViewChild('chartCanvas') private canvas?: ElementRef<HTMLCanvasElement>;
  private chart?: Chart;

  get points(): BccGrowthPoint[] {
    return this.measure === 'people' ? this.people : this.families;
  }

  get measureLabel(): string {
    return this.measure === 'people' ? this.peopleLabel.toLowerCase() : this.familiesLabel.toLowerCase();
  }

  get ariaLabel(): string {
    return `${this.title} chart for ${this.measureLabel} with ${this.points.length} periods`;
  }

  ngAfterViewInit(): void {
    this.renderChart();
  }

  ngOnChanges(changes: SimpleChanges): void {
    if (changes['families'] || changes['people'] || changes['measure'] || changes['insufficientHistory']) {
      this.renderChart();
    }
  }

  ngOnDestroy(): void {
    this.chart?.destroy();
  }

  setMeasure(measure: BccGrowthMeasure): void {
    if (this.measure === measure) {
      return;
    }
    this.measureChange.emit(measure);
  }

  private renderChart(): void {
    if (this.insufficientHistory || !this.points.length) {
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
      this.chart = new Chart(canvas, {
        type: 'line',
        data: {
          labels: this.points.map((p) => p.label),
          datasets: [
            {
              label: this.measure === 'people' ? this.peopleLabel : this.familiesLabel,
              data: this.points.map((p) => p.value),
              borderColor: 'rgb(37, 99, 235)',
              backgroundColor: 'rgba(37, 99, 235, 0.12)',
              fill: true,
              tension: 0.3,
              pointRadius: 3,
              pointHoverRadius: 5,
            },
          ],
        },
        options: {
          responsive: true,
          maintainAspectRatio: false,
          plugins: {
            legend: { display: false },
            tooltip: { mode: 'index', intersect: false },
          },
          scales: {
            x: { grid: { display: false } },
            y: {
              beginAtZero: true,
              ticks: { precision: 0 },
            },
          },
        },
      });
      this.cdr.markForCheck();
    } catch {
      this.chart = undefined;
    }
  }
}
