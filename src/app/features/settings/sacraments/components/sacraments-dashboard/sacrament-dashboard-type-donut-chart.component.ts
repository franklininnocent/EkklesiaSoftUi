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
  SacramentDashboardTypeKpi,
  SacramentDashboardTypeTotal,
} from '../../models/sacrament-dashboard.model';

const TYPE_COLORS = [
  '#3b6ebf',
  '#0d9488',
  '#7c6bc4',
  '#c45c8a',
  '#d97706',
  '#2563eb',
  '#14b8a6',
  '#e11d48',
  '#84cc16',
  '#64748b',
];

@Component({
  selector: 'app-sacrament-dashboard-type-donut-chart',
  standalone: true,
  imports: [CommonModule],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <section
      class="cf-chart-panel sacrament-type-donut"
      [class.sacrament-type-donut--compact]="compact"
      aria-label="Sacrament type distribution chart"
    >
      <p class="sacrament-chart__sr-only" *ngIf="hasData">{{ dataSummary }}</p>
      <div class="cf-chart-panel__chart-wrap" *ngIf="hasData; else empty">
        <canvas #chartCanvas role="img" [attr.aria-label]="dataSummary"></canvas>
      </div>
      <ng-template #empty>
        <p class="cf-chart-panel__empty">No sacrament types to display.</p>
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
    }

    .sacrament-type-donut--compact.cf-chart-panel {
      min-height: 0;
    }

    .cf-chart-panel__chart-wrap {
      position: relative;
      height: 280px;
      width: 100%;
      flex: 0 0 auto;
      min-height: 0;
    }

    .sacrament-type-donut--compact .cf-chart-panel__chart-wrap {
      height: 10.5rem;
      flex: 0 0 10.5rem;
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
export class SacramentDashboardTypeDonutChartComponent implements AfterViewInit, OnChanges, OnDestroy {
  private readonly cdr = inject(ChangeDetectorRef);

  @Input() rows: SacramentDashboardTypeTotal[] = [];
  @Input() typeKpis: SacramentDashboardTypeKpi[] = [];
  @Input() compact = false;
  @Output() typeSelected = new EventEmitter<{
    sacrament_type_id: number;
    code: string;
    label: string;
  }>();

  @ViewChild('chartCanvas') private canvas?: ElementRef<HTMLCanvasElement>;

  private chart?: Chart;

  get populatedRows(): SacramentDashboardTypeTotal[] {
    return this.rows.filter((row) => row.count > 0);
  }

  get hasData(): boolean {
    return this.populatedRows.length > 0;
  }

  get dataSummary(): string {
    if (!this.hasData) {
      return 'No sacrament type data available.';
    }

    return this.populatedRows
      .map((row) => `${row.label}: ${row.count}`)
      .join(', ');
  }

  ngAfterViewInit(): void {
    this.renderChart();
  }

  ngOnChanges(changes: SimpleChanges): void {
    if (changes['rows'] || changes['typeKpis'] || changes['compact']) {
      this.renderChart();
    }
  }

  ngOnDestroy(): void {
    this.chart?.destroy();
  }

  private renderChart(): void {
    if (!this.canvas?.nativeElement || !this.hasData) {
      this.chart?.destroy();
      this.chart = undefined;
      return;
    }

    const rows = this.populatedRows;
    const labels = rows.map((row) => row.label);
    const data = rows.map((row) => row.count);
    const colors = rows.map((_, index) => TYPE_COLORS[index % TYPE_COLORS.length]);

    this.chart?.destroy();
    this.chart = new Chart(this.canvas.nativeElement, {
      type: 'doughnut',
      data: {
        labels,
        datasets: [{
          data,
          backgroundColor: colors,
          borderWidth: 0,
        }],
      },
      options: {
        responsive: true,
        maintainAspectRatio: false,
        cutout: this.compact ? '58%' : '50%',
        onClick: (_event, elements) => {
          if (!elements.length) {
            return;
          }

          const row = rows[elements[0].index];
          if (!row) {
            return;
          }

          const typeId = this.typeKpis.find((kpi) => kpi.code === row.code)?.sacrament_type_id;
          if (typeId === undefined) {
            return;
          }

          this.typeSelected.emit({
            sacrament_type_id: typeId,
            code: row.code,
            label: row.label,
          });
        },
        plugins: {
          legend: {
            position: 'bottom',
            labels: this.compact ? {
              boxWidth: 10,
              padding: 8,
              font: { size: 10 },
            } : undefined,
          },
          tooltip: {
            callbacks: {
              label: (ctx) => {
                const value = Number(ctx.raw ?? 0);
                const total = data.reduce((sum, count) => sum + count, 0);
                const pct = total > 0 ? Math.round((value / total) * 100) : 0;

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
