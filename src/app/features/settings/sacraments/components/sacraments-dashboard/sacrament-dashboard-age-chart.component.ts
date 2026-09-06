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
import {
  SacramentDashboardAgeBucket,
  SacramentDashboardAgeByType,
} from '../../models/sacrament-dashboard.model';
import {
  isIncludedInAgeDistribution,
  resolveDemographicsScope,
  resolveSacramentSeriesColor,
} from './sacrament-dashboard-demographics-palette';

@Component({
  selector: 'app-sacrament-dashboard-age-chart',
  standalone: true,
  imports: [CommonModule],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <section
      class="cf-chart-panel sacrament-age-chart"
      [class.sacrament-age-chart--compact]="compact"
      aria-label="Age distribution chart"
    >
      <p class="sacrament-chart__sr-only" *ngIf="hasData">{{ dataSummary }}</p>
      <div class="cf-chart-panel__chart-wrap" *ngIf="hasData; else empty">
        <canvas #chartCanvas role="img" [attr.aria-label]="dataSummary"></canvas>
      </div>
      <ul class="sacrament-age-chart__legend" *ngIf="hasData" aria-hidden="true">
        <li *ngFor="let row of activeRows; let i = index">
          <i [style.background]="seriesColor(i)"></i>
          <span [title]="row.label">{{ row.label }}</span>
        </li>
      </ul>
      <ng-template #empty>
        <p class="cf-chart-panel__empty">No age data recorded yet for sacraments in this period.</p>
      </ng-template>
    </section>
  `,
  styles: [`
    :host {
      display: flex;
      flex: 1;
      min-height: 0;
    }

    .cf-chart-panel {
      display: flex;
      flex-direction: column;
      flex: 1;
      min-height: 0;
      width: 100%;
      gap: var(--cf-space-1);
    }

    .sacrament-age-chart--compact.cf-chart-panel {
      min-height: 0;
    }

    .cf-chart-panel__chart-wrap {
      position: relative;
      height: 260px;
      width: 100%;
      flex: 0 0 auto;
      min-height: 0;
    }

    .sacrament-age-chart--compact .cf-chart-panel__chart-wrap {
      height: 9.5rem;
      flex: 0 0 9.5rem;
    }

    .sacrament-age-chart__legend {
      list-style: none;
      display: flex;
      flex-wrap: wrap;
      gap: 0.35rem 0.65rem;
      margin: 0;
      padding: 0;
      flex-shrink: 0;
    }

    .sacrament-age-chart__legend li {
      display: inline-flex;
      align-items: center;
      gap: 0.3rem;
      font-size: 0.68rem;
      color: var(--cf-text-muted);
      min-width: 0;
    }

    .sacrament-age-chart--compact .sacrament-age-chart__legend li {
      font-size: 0.62rem;
    }

    .sacrament-age-chart__legend i {
      flex-shrink: 0;
      width: 0.55rem;
      height: 0.55rem;
      border-radius: 999px;
      display: inline-block;
    }

    .sacrament-age-chart__legend span {
      min-width: 0;
      line-height: 1.2;
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
  `],
})
export class SacramentDashboardAgeChartComponent implements AfterViewInit, OnChanges, OnDestroy {
  private readonly cdr = inject(ChangeDetectorRef);
  private readonly host = inject(ElementRef);

  @Input() rows: SacramentDashboardAgeByType[] = [];
  @Input() compact = false;
  @Output() bucketSelected = new EventEmitter<{ sacrament_type_id: number; bucket: SacramentDashboardAgeBucket }>();

  @ViewChild('chartCanvas') private canvas?: ElementRef<HTMLCanvasElement>;

  private chart?: Chart;

  get activeRows(): SacramentDashboardAgeByType[] {
    return this.rows
      .filter((row) => isIncludedInAgeDistribution(row.code))
      .filter((row) => row.buckets.some((bucket) => bucket.count > 0));
  }

  get hasData(): boolean {
    return this.activeRows.length > 0;
  }

  get dataSummary(): string {
    if (!this.hasData) {
      return 'No age data available.';
    }

    return this.activeRows
      .map((row) => {
        const buckets = row.buckets
          .filter((bucket) => bucket.count > 0)
          .map((bucket) => `${bucket.label}: ${bucket.count}`)
          .join(', ');
        return `${row.label}: ${buckets}`;
      })
      .join('. ');
  }

  seriesColor(index: number): string {
    return resolveSacramentSeriesColor(index, resolveDemographicsScope(this.host.nativeElement));
  }

  ngAfterViewInit(): void {
    this.renderChart();
  }

  ngOnChanges(changes: SimpleChanges): void {
    if (changes['rows'] || changes['compact']) {
      if (!changes['rows']?.firstChange) {
        this.renderChart();
      }
    }
  }

  ngOnDestroy(): void {
    this.chart?.destroy();
  }

  private bucketTemplate(): SacramentDashboardAgeBucket[] {
    return this.rows
      .filter((row) => isIncludedInAgeDistribution(row.code))
      .find((row) => row.buckets.length > 0)?.buckets ?? [];
  }

  private renderChart(): void {
    if (!this.canvas?.nativeElement || !this.hasData) {
      this.chart?.destroy();
      this.chart = undefined;
      return;
    }

    const scope = resolveDemographicsScope(this.host.nativeElement);
    const bucketTemplate = this.bucketTemplate();
    const labels = bucketTemplate.map((bucket) => bucket.label);
    const activeRows = this.activeRows;

    const datasets = activeRows.map((row, index) => ({
      label: row.label,
      data: bucketTemplate.map((templateBucket) => {
        const match = row.buckets.find((bucket) => bucket.key === templateBucket.key);
        return match?.count ?? 0;
      }),
      backgroundColor: resolveSacramentSeriesColor(index, scope),
      borderRadius: 4,
      maxBarThickness: this.compact ? 14 : 20,
    }));

    this.chart?.destroy();
    this.chart = new Chart(this.canvas.nativeElement, {
      type: 'bar',
      data: {
        labels,
        datasets,
      },
      options: {
        responsive: true,
        maintainAspectRatio: false,
        onClick: (_event, elements) => {
          if (!elements.length) {
            return;
          }

          const row = activeRows[elements[0].datasetIndex];
          const bucket = bucketTemplate[elements[0].index];
          if (!row || !bucket) {
            return;
          }

          this.bucketSelected.emit({
            sacrament_type_id: row.sacrament_type_id,
            bucket,
          });
        },
        plugins: {
          legend: { display: false },
          tooltip: {
            callbacks: {
              title: (items) => items[0]?.label ?? '',
              label: (ctx) => ` ${ctx.dataset.label}: ${ctx.parsed.y ?? 0}`,
            },
          },
        },
        scales: {
          x: {
            ticks: this.compact ? {
              font: { size: 10 },
              maxRotation: 45,
              minRotation: 0,
            } : undefined,
          },
          y: {
            beginAtZero: true,
            ticks: {
              precision: 0,
              ...(this.compact ? { font: { size: 10 } } : {}),
            },
          },
        },
      },
    });

    this.cdr.markForCheck();
  }
}
