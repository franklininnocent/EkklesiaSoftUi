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
  inject
} from '@angular/core';
import { Chart } from 'chart.js/auto';

interface GeographicRow {
  area_name: string;
  collected: number;
  family_count: number;
}

@Component({
  selector: 'app-foc-geographic-chart',
  standalone: true,
  imports: [CommonModule],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <div class="foc-geo-chart" *ngIf="rows.length; else empty">
      <canvas #canvas role="img" aria-label="Geographic contribution chart"></canvas>
    </div>
    <ng-template #empty>
      <p class="foc-empty">No area breakdown yet.</p>
    </ng-template>
  `,
  styles: [`
    .foc-geo-chart { position: relative; height: 220px; width: 100%; }
  `]
})
export class FocGeographicChartComponent implements AfterViewInit, OnChanges, OnDestroy {
  private readonly cdr = inject(ChangeDetectorRef);

  @Input() rows: GeographicRow[] = [];
  @Input() currencyCode = 'INR';
  @ViewChild('canvas') private canvas?: ElementRef<HTMLCanvasElement>;

  private chart?: Chart;

  ngAfterViewInit(): void {
    this.render();
  }

  ngOnChanges(changes: SimpleChanges): void {
    if (changes['rows'] && !changes['rows'].firstChange) {
      this.render();
    }
  }

  ngOnDestroy(): void {
    this.chart?.destroy();
  }

  private render(): void {
    const canvas = this.canvas?.nativeElement;
    if (!canvas || !this.rows.length) {
      return;
    }

    this.chart?.destroy();
    this.chart = new Chart(canvas, {
      type: 'bar',
      data: {
        labels: this.rows.map((row) => row.area_name),
        datasets: [{
          label: 'Collected',
          data: this.rows.map((row) => row.collected),
          backgroundColor: '#6366f1',
          borderRadius: 4
        }]
      },
      options: {
        indexAxis: 'y',
        responsive: true,
        maintainAspectRatio: false,
        plugins: { legend: { display: false } },
        scales: { x: { beginAtZero: true } }
      }
    });
    this.cdr.markForCheck();
  }
}
