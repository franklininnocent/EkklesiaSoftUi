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
import { Chart } from 'chart.js';
import { Flow, SankeyController } from 'chartjs-chart-sankey';
import { SacramentDashboardGapSacrament } from '../../models/sacrament-dashboard.model';

Chart.register(SankeyController, Flow);

interface ParticipationFlow {
  from: string;
  to: string;
  flow: number;
}

interface ParticipationFlowMeta {
  code: string;
  kind: 'received' | 'missing';
}

const SACRAMENT_COLORS: Record<string, string> = {
  BAPTISM: '#3b6ebf',
  EUCHARIST: '#0d9488',
  CONFIRMATION: '#7c6bc4',
  MATRIMONY: '#c45c8a',
};

const RECEIVED_COLOR = '#16a34a';
const MISSING_COLOR = '#dc2626';

@Component({
  selector: 'app-sacrament-dashboard-participation-sankey',
  standalone: true,
  imports: [CommonModule],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <section
      class="cf-chart-panel sacrament-participation-sankey"
      [class.sacrament-participation-sankey--compact]="compact"
      aria-label="Parish participation flow chart"
    >
      <p class="sacrament-chart__sr-only" *ngIf="hasData">{{ dataSummary }}</p>
      <p class="cf-meta sacrament-participation-sankey__hint" *ngIf="hasMissingFlows && !compact">
        Click a red missing flow to view families who still need that sacrament.
      </p>
      <div class="cf-chart-panel__chart-wrap" *ngIf="hasData; else empty">
        <canvas #chartCanvas role="img" [attr.aria-label]="dataSummary"></canvas>
      </div>
      <ng-template #empty>
        <p class="cf-chart-panel__empty">No participation data yet.</p>
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

    .sacrament-participation-sankey--compact.cf-chart-panel {
      min-height: 0;
    }

    .cf-chart-panel__chart-wrap {
      position: relative;
      height: 360px;
      width: 100%;
      flex: 0 0 auto;
      min-height: 0;
    }

    .sacrament-participation-sankey--compact .cf-chart-panel__chart-wrap {
      height: 11rem;
      flex: 0 0 11rem;
    }

    .sacrament-participation-sankey__hint {
      margin: 0 0 var(--cf-space-2);
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
export class SacramentDashboardParticipationSankeyComponent implements AfterViewInit, OnChanges, OnDestroy {
  private readonly cdr = inject(ChangeDetectorRef);

  @Input() rows: SacramentDashboardGapSacrament[] = [];
  @Input() compact = false;
  @Output() missingSelected = new EventEmitter<string>();

  @ViewChild('chartCanvas') private canvas?: ElementRef<HTMLCanvasElement>;

  private chart?: Chart;
  private flows: ParticipationFlow[] = [];
  private flowMeta: ParticipationFlowMeta[] = [];
  private labels: Record<string, string> = {};
  private columns: Record<string, number> = {};

  get hasData(): boolean {
    return this.flows.length > 0;
  }

  get hasMissingFlows(): boolean {
    return this.flowMeta.some((meta) => meta.kind === 'missing');
  }

  get dataSummary(): string {
    if (!this.hasData) {
      return 'No parish participation data available.';
    }

    return this.rows
      .filter((row) => row.eligible_count > 0)
      .map((row) => `${row.label}: ${row.received_count} received, ${row.missing_count} missing`)
      .join('. ');
  }

  ngAfterViewInit(): void {
    this.rebuild();
  }

  ngOnChanges(changes: SimpleChanges): void {
    if (changes['rows'] || changes['compact']) {
      this.rebuild();
    }
  }

  ngOnDestroy(): void {
    this.chart?.destroy();
  }

  private rebuild(): void {
    this.buildModel();
    this.cdr.markForCheck();
    queueMicrotask(() => this.renderChart());
  }

  private buildModel(): void {
    this.flows = [];
    this.flowMeta = [];
    this.labels = {};
    this.columns = {};

    for (const row of this.rows) {
      if (row.eligible_count <= 0) {
        continue;
      }

      const fromId = row.code;
      const receivedId = `${row.code}_received`;
      const missingId = `${row.code}_missing`;

      this.labels[fromId] = row.label;
      this.labels[receivedId] = 'Received';
      this.labels[missingId] = 'Missing';
      this.columns[fromId] = 0;
      this.columns[receivedId] = 1;
      this.columns[missingId] = 1;

      if (row.received_count > 0) {
        this.flows.push({ from: fromId, to: receivedId, flow: row.received_count });
        this.flowMeta.push({ code: row.code, kind: 'received' });
      }

      if (row.missing_count > 0) {
        this.flows.push({ from: fromId, to: missingId, flow: row.missing_count });
        this.flowMeta.push({ code: row.code, kind: 'missing' });
      }
    }
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

    try {
      if (!canvas.getContext('2d')) {
        return;
      }
    } catch {
      return;
    }

    try {
      this.chart?.destroy();

      this.chart = new Chart(canvas, {
        type: 'sankey',
        data: {
          datasets: [{
            label: 'Parish participation',
            data: this.flows,
            labels: this.labels,
            column: this.columns,
            colorFrom: (ctx) => this.colorForNode(this.flows[ctx.dataIndex]?.from),
            colorTo: (ctx) => this.colorForNode(this.flows[ctx.dataIndex]?.to),
            colorMode: 'gradient',
            alpha: 0.9,
          }],
        },
        options: {
          responsive: true,
          maintainAspectRatio: false,
          animation: false,
          layout: {
            padding: this.compact ? { top: 4, right: 8, bottom: 4, left: 8 } : undefined,
          },
          onClick: (_event, elements) => {
            if (!elements.length) {
              return;
            }

            const meta = this.flowMeta[elements[0].index];
            if (meta?.kind === 'missing') {
              this.missingSelected.emit(meta.code);
            }
          },
          plugins: {
            legend: { display: false },
            tooltip: {
              callbacks: {
                label: (ctx) => {
                  const flow = this.flows[ctx.dataIndex];
                  if (!flow) {
                    return '';
                  }

                  const fromLabel = this.labels[flow.from] ?? flow.from;
                  const toLabel = this.labels[flow.to] ?? flow.to;

                  return ` ${fromLabel} → ${toLabel}: ${flow.flow}`;
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

  private colorForNode(nodeId?: string): string {
    if (!nodeId) {
      return '#64748b';
    }

    if (nodeId.endsWith('_received')) {
      return RECEIVED_COLOR;
    }

    if (nodeId.endsWith('_missing')) {
      return MISSING_COLOR;
    }

    return SACRAMENT_COLORS[nodeId] ?? '#3b6ebf';
  }
}
