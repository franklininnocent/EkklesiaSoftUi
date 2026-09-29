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
  inject
} from '@angular/core';
import { Chart } from 'chart.js/auto';
import { ChurchCurrencyService } from '@core/services/church-currency.service';
import { cfFormatMoney } from '@shared/utils/cf-intl.util';
import { CollectionTrendPoint } from '../models/donation.model';

@Component({
  selector: 'app-dashboard-collected-trend',
  standalone: true,
  imports: [CommonModule],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <div class="collected-trend">
      <canvas #chartCanvas role="img" [attr.aria-label]="chartAriaLabel"></canvas>
    </div>
  `,
  styles: [`
    .collected-trend {
      position: relative;
      height: 220px;
      width: 100%;
    }
  `]
})
export class DashboardCollectedTrendComponent implements AfterViewInit, OnChanges, OnDestroy {
  private readonly cdr = inject(ChangeDetectorRef);
  private readonly churchCurrency = inject(ChurchCurrencyService);

  @Input() points: CollectionTrendPoint[] = [];
  @Input() chartAriaLabel =
    'Collected payments in the selected range, grouped by month. The current month is month to date.';
  @Output() monthSelected = new EventEmitter<CollectionTrendPoint>();
  @ViewChild('chartCanvas') private canvas?: ElementRef<HTMLCanvasElement>;

  private chart?: Chart;
  private viewReady = false;

  ngAfterViewInit(): void {
    this.viewReady = true;
    this.render();
  }

  ngOnChanges(changes: SimpleChanges): void {
    if (changes['points'] && this.viewReady) {
      this.render();
    }
  }

  ngOnDestroy(): void {
    this.chart?.destroy();
  }

  private render(): void {
    const canvas = this.canvas?.nativeElement;
    const context = canvas?.getContext('2d');
    if (!canvas || !context) {
      return;
    }

    const labels = this.points.map((point) => point.is_current ? `${point.label} MTD` : point.label);
    const values = this.points.map((point) => point.collected);
    const styles = getComputedStyle(canvas);
    const currentColor = styles.getPropertyValue('--cf-forest').trim() || '#1b4332';
    const pastColor = styles.getPropertyValue('--cf-slate-400').trim() || '#94a3b8';
    this.chart?.destroy();
    this.chart = new Chart(context, {
      type: 'bar',
      data: {
        labels,
        datasets: [{
          label: 'Collected',
          data: values,
          backgroundColor: this.points.map((point) => point.is_current ? currentColor : pastColor),
          borderRadius: 2,
          maxBarThickness: 28
        }]
      },
      options: {
        responsive: true,
        maintainAspectRatio: false,
        onClick: (_event, elements) => {
          const index = elements[0]?.index;
          const point = index === undefined ? undefined : this.points[index];
          if (point) {
            this.monthSelected.emit(point);
          }
        },
        plugins: {
          legend: { display: false },
          tooltip: {
            callbacks: {
              label: (item) => {
                const code = this.churchCurrency.currencyCode();
                const raw = typeof item.raw === 'number' ? item.raw : Number(item.raw ?? 0);
                const formatted = code ? cfFormatMoney(raw, code) : String(raw);
                return `Collected ${formatted}`;
              }
            }
          }
        },
        scales: {
          x: { ticks: { maxRotation: 0, autoSkip: true, font: { size: 11 } }, grid: { display: false } },
          y: { beginAtZero: true, ticks: { font: { size: 11 } } }
        }
      }
    });
    this.cdr.markForCheck();
  }
}
