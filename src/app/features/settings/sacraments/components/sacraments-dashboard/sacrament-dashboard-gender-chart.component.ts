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
import { SacramentDashboardGenderByType } from '../../models/sacrament-dashboard.model';
import {
  GENDER_COLORS,
  resolveDemographicsColor,
  resolveDemographicsScope,
} from './sacrament-dashboard-demographics-palette';

type GenderKey = 'male' | 'female' | 'other' | 'unknown';

const GENDER_KEYS: GenderKey[] = ['male', 'female', 'other', 'unknown'];
const GENDER_LABELS = ['Male', 'Female', 'Other', 'Unknown'] as const;

interface GenderSegment {
  sacrament_type_id: number;
  sacramentLabel: string;
  genderKey: GenderKey;
  genderLabel: string;
  count: number;
}

@Component({
  selector: 'app-sacrament-dashboard-gender-chart',
  standalone: true,
  imports: [CommonModule],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <section
      class="cf-chart-panel sacrament-gender-chart"
      [class.sacrament-gender-chart--compact]="compact"
      aria-label="Gender distribution chart"
    >
      <div class="cf-chart-panel__legend" *ngIf="hasData" aria-hidden="true">
        <span *ngFor="let label of genderLabels; let i = index">
          <i class="cf-chart-panel__swatch" [style.background]="genderColor(i)"></i>
          {{ label }}
        </span>
      </div>
      <p class="sacrament-chart__sr-only" *ngIf="hasData">{{ dataSummary }}</p>
      <div class="cf-chart-panel__chart-wrap sacrament-gender-chart__canvas-wrap" *ngIf="hasData; else empty">
        <canvas #chartCanvas role="img" [attr.aria-label]="dataSummary"></canvas>
        <div class="sacrament-gender-chart__center" aria-hidden="true">
          <strong>{{ totalRecipients }}</strong>
          <span>Recipients</span>
        </div>
      </div>
      <ng-template #empty>
        <p class="cf-chart-panel__empty">No gender data recorded yet for sacraments in this period.</p>
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

    .sacrament-gender-chart--compact.cf-chart-panel {
      min-height: 0;
    }

    .cf-chart-panel__chart-wrap {
      position: relative;
      height: 240px;
      width: 100%;
      flex: 0 0 auto;
      min-height: 0;
    }

    .sacrament-gender-chart--compact .cf-chart-panel__chart-wrap {
      height: 10.5rem;
      flex: 0 0 10.5rem;
    }

    .sacrament-gender-chart__canvas-wrap {
      max-width: 100%;
    }

    .sacrament-gender-chart__center {
      position: absolute;
      inset: 0;
      display: grid;
      place-content: center;
      text-align: center;
      gap: 0.1rem;
      pointer-events: none;
      padding: 0 1.5rem;
    }

    .sacrament-gender-chart__center strong {
      font-size: 1.1rem;
      line-height: 1.1;
      color: var(--cf-text);
    }

    .sacrament-gender-chart--compact .sacrament-gender-chart__center strong {
      font-size: 0.95rem;
    }

    .sacrament-gender-chart__center span {
      font-size: 0.62rem;
      text-transform: uppercase;
      letter-spacing: 0.04em;
      color: var(--cf-text-muted);
    }

    .cf-chart-panel__legend {
      display: flex;
      flex-wrap: wrap;
      gap: 0.35rem 0.65rem;
      margin: 0 0 0.35rem;
      flex-shrink: 0;
      font-size: 0.68rem;
      color: var(--cf-text-muted);
    }

    .sacrament-gender-chart--compact .cf-chart-panel__legend {
      font-size: 0.62rem;
    }

    .cf-chart-panel__legend span {
      display: inline-flex;
      align-items: center;
      gap: 0.3rem;
      min-width: 0;
    }

    .cf-chart-panel__swatch {
      flex-shrink: 0;
      width: 0.55rem;
      height: 0.55rem;
      border-radius: 999px;
      display: inline-block;
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
export class SacramentDashboardGenderChartComponent implements AfterViewInit, OnChanges, OnDestroy {
  private readonly cdr = inject(ChangeDetectorRef);
  private readonly host = inject(ElementRef);

  @Input() rows: SacramentDashboardGenderByType[] = [];
  @Input() compact = false;
  @Output() segmentSelected = new EventEmitter<{ sacrament_type_id: number; label: string }>();

  @ViewChild('chartCanvas') private canvas?: ElementRef<HTMLCanvasElement>;

  readonly genderLabels = GENDER_LABELS;

  private chart?: Chart;

  get activeRows(): SacramentDashboardGenderByType[] {
    return this.rows.filter(
      (row) => row.male + row.female + row.other + row.unknown > 0,
    );
  }

  get hasData(): boolean {
    return this.activeRows.length > 0;
  }

  get totalRecipients(): number {
    return this.activeRows.reduce(
      (sum, row) => sum + row.male + row.female + row.other + row.unknown,
      0,
    );
  }

  get dataSummary(): string {
    if (!this.hasData) {
      return 'No gender data available.';
    }

    return this.activeRows
      .map((row) => {
        const parts = GENDER_KEYS
          .map((key, index) => `${GENDER_LABELS[index]}: ${row[key]}`)
          .join(', ');
        return `${row.label}: ${parts}`;
      })
      .join('. ');
  }

  genderColor(index: number): string {
    const keys: GenderKey[] = GENDER_KEYS;
    const token = GENDER_COLORS[keys[index]];
    return resolveDemographicsColor(token, resolveDemographicsScope(this.host.nativeElement));
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

  private buildSegments(): GenderSegment[] {
    const segments: GenderSegment[] = [];

    for (const row of this.activeRows) {
      GENDER_KEYS.forEach((key, index) => {
        const count = row[key];
        if (count > 0) {
          segments.push({
            sacrament_type_id: row.sacrament_type_id,
            sacramentLabel: row.label,
            genderKey: key,
            genderLabel: GENDER_LABELS[index],
            count,
          });
        }
      });
    }

    return segments;
  }

  private renderChart(): void {
    if (!this.canvas?.nativeElement || !this.hasData) {
      this.chart?.destroy();
      this.chart = undefined;
      return;
    }

    const scope = resolveDemographicsScope(this.host.nativeElement);
    const segments = this.buildSegments();
    const total = segments.reduce((sum, segment) => sum + segment.count, 0);
    const colors = segments.map(
      (segment) => resolveDemographicsColor(GENDER_COLORS[segment.genderKey], scope),
    );

    this.chart?.destroy();
    this.chart = new Chart(this.canvas.nativeElement, {
      type: 'doughnut',
      data: {
        labels: segments.map((segment) => `${segment.sacramentLabel} — ${segment.genderLabel}`),
        datasets: [{
          data: segments.map((segment) => segment.count),
          backgroundColor: colors,
          borderWidth: 0,
        }],
      },
      options: {
        responsive: true,
        maintainAspectRatio: false,
        cutout: '58%',
        onClick: (_event, elements) => {
          if (!elements.length) {
            return;
          }

          const segment = segments[elements[0].index];
          if (!segment) {
            return;
          }

          this.segmentSelected.emit({
            sacrament_type_id: segment.sacrament_type_id,
            label: segment.genderLabel,
          });
        },
        plugins: {
          legend: { display: false },
          tooltip: {
            callbacks: {
              label: (ctx) => {
                const value = Number(ctx.raw ?? 0);
                const pct = total > 0 ? Math.round((value / total) * 100) : 0;
                const segment = segments[ctx.dataIndex];
                if (!segment) {
                  return ` ${value} (${pct}%)`;
                }

                return ` ${segment.sacramentLabel} — ${segment.genderLabel}: ${value} (${pct}%)`;
              },
            },
          },
        },
      },
    });

    this.cdr.markForCheck();
  }
}
