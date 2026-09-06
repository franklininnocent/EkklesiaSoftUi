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
import {
  MEMBER_STATUS_COLORS,
  resolveDemographicsColor,
  resolveDemographicsScope,
} from './sacrament-dashboard-demographics-palette';

export interface SacramentDashboardMemberStatus {
  member: number;
  non_member: number;
  unknown: number;
}

@Component({
  selector: 'app-sacrament-dashboard-member-status-chart',
  standalone: true,
  imports: [CommonModule],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <section
      class="cf-chart-panel sacrament-member-status-chart"
      [class.sacrament-member-status-chart--compact]="compact"
      aria-label="Parish members vs visitors chart"
    >
      <div class="cf-chart-panel__legend" aria-hidden="true">
        <span><i class="cf-chart-panel__swatch sacrament-demo-swatch--member-parish"></i> Parish families</span>
        <span><i class="cf-chart-panel__swatch sacrament-demo-swatch--member-visitor"></i> Visitors / others</span>
        <span *ngIf="memberStatus?.unknown"><i class="cf-chart-panel__swatch sacrament-demo-swatch--member-unknown"></i> Unknown</span>
      </div>
      <p class="sacrament-chart__sr-only" *ngIf="hasData">{{ dataSummary }}</p>
      <div class="cf-chart-panel__chart-wrap" *ngIf="hasData; else empty">
        <canvas #chartCanvas role="img" [attr.aria-label]="dataSummary"></canvas>
      </div>
      <ng-template #empty>
        <p class="cf-chart-panel__empty">No records in this period.</p>
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

    .sacrament-member-status-chart--compact.cf-chart-panel {
      min-height: 0;
    }

    .cf-chart-panel__chart-wrap {
      position: relative;
      height: 240px;
      width: 100%;
      flex: 0 0 auto;
      min-height: 0;
    }

    .sacrament-member-status-chart--compact .cf-chart-panel__chart-wrap {
      height: 10.5rem;
      flex: 0 0 10.5rem;
    }

    .sacrament-member-status-chart--compact .cf-chart-panel__legend {
      flex-wrap: wrap;
      gap: 0.35rem 0.65rem;
      margin-bottom: 0.35rem;
      font-size: 0.7rem;
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

    .sacrament-demo-swatch--member-parish {
      background: var(--cf-demo-member-parish, #0d9488);
    }

    .sacrament-demo-swatch--member-visitor {
      background: var(--cf-demo-member-visitor, #b45309);
    }

    .sacrament-demo-swatch--member-unknown {
      background: var(--cf-demo-member-unknown, #64748b);
    }
  `],
})
export class SacramentDashboardMemberStatusChartComponent implements AfterViewInit, OnChanges, OnDestroy {
  private readonly cdr = inject(ChangeDetectorRef);
  private readonly host = inject(ElementRef);

  @Input() memberStatus: SacramentDashboardMemberStatus | null = null;
  @Input() compact = false;

  @ViewChild('chartCanvas') private canvas?: ElementRef<HTMLCanvasElement>;

  private chart?: Chart;

  get hasData(): boolean {
    if (!this.memberStatus) {
      return false;
    }

    return this.memberStatus.member + this.memberStatus.non_member + this.memberStatus.unknown > 0;
  }

  get dataSummary(): string {
    if (!this.memberStatus || !this.hasData) {
      return 'No parish membership data available.';
    }

    const parts = [
      `Parish families ${this.memberStatus.member}`,
      `Visitors / others ${this.memberStatus.non_member}`,
    ];

    if (this.memberStatus.unknown > 0) {
      parts.push(`Unknown ${this.memberStatus.unknown}`);
    }

    return parts.join(', ') + '.';
  }

  ngAfterViewInit(): void {
    this.renderChart();
  }

  ngOnChanges(changes: SimpleChanges): void {
    if (changes['memberStatus'] || changes['compact']) {
      if (!changes['memberStatus']?.firstChange) {
        this.renderChart();
      }
    }
  }

  ngOnDestroy(): void {
    this.chart?.destroy();
  }

  private renderChart(): void {
    if (!this.canvas?.nativeElement || !this.hasData || !this.memberStatus) {
      this.chart?.destroy();
      this.chart = undefined;
      return;
    }

    const scope = resolveDemographicsScope(this.host.nativeElement);
    const labels = ['Parish families', 'Visitors / others'];
    const data = [this.memberStatus.member, this.memberStatus.non_member];
    const colors = [
      resolveDemographicsColor(MEMBER_STATUS_COLORS.parish, scope),
      resolveDemographicsColor(MEMBER_STATUS_COLORS.visitor, scope),
    ];

    if (this.memberStatus.unknown > 0) {
      labels.push('Unknown');
      data.push(this.memberStatus.unknown);
      colors.push(resolveDemographicsColor(MEMBER_STATUS_COLORS.unknown, scope));
    }

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
              label: (context) => {
                const total = data.reduce((sum, value) => sum + value, 0);
                const value = context.parsed;
                const pct = total > 0 ? Math.round((value / total) * 100) : 0;
                return `${context.label}: ${value} (${pct}%)`;
              },
            },
          },
        },
      },
    });

    this.cdr.markForCheck();
  }
}
