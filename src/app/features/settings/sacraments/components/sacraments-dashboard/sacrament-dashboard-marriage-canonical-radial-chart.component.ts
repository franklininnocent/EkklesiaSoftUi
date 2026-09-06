import { CommonModule } from '@angular/common';
import {
  ChangeDetectionStrategy,
  Component,
  EventEmitter,
  Input,
  OnChanges,
  Output,
  SimpleChanges,
} from '@angular/core';
import { MarriageCanonicalBreakdown, MarriageRegisterFilterKey } from '../../models/sacrament-dashboard.model';
import {
  METRIC_RADIAL_DEFAULT_COLORS,
  SacramentDashboardMetricRadialChartComponent,
  SacramentDashboardMetricRadialRing,
} from './sacrament-dashboard-metric-radial-chart.component';

const CANONICAL_RING_ORDER: Array<{
  key: keyof MarriageCanonicalBreakdown['metrics'];
  label: string;
}> = [
  { key: 'catholic_both', label: 'Sacramental marriages (both Catholic)' },
  { key: 'mixed_disparity', label: 'Mixed marriages & disparity of cult' },
  { key: 'same_parish', label: 'Both from same parish (bride & groom)' },
  { key: 'inter_parish', label: 'Different parishes (bride & groom)' },
];

@Component({
  selector: 'app-sacrament-dashboard-marriage-canonical-radial-chart',
  standalone: true,
  imports: [CommonModule, SacramentDashboardMetricRadialChartComponent],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <app-sacrament-dashboard-metric-radial-chart
      [centerValue]="breakdown?.total_recorded ?? 0"
      centerLabel="recorded marriages"
      [rings]="canonicalRings"
      [loading]="loading"
      [actionable]="true"
      emptyTitle="No marriages recorded"
      emptyMessage="Recorded marriages will appear here once they are entered in the parish register."
      (ringSelected)="onRingSelected($event)"
    />
  `,
})
export class SacramentDashboardMarriageCanonicalRadialChartComponent implements OnChanges {
  @Input({ required: true }) breakdown: MarriageCanonicalBreakdown | null = null;
  @Input() loading = false;
  @Output() ringSelected = new EventEmitter<MarriageRegisterFilterKey>();

  canonicalRings: SacramentDashboardMetricRadialRing[] = [];

  ngOnChanges(changes: SimpleChanges): void {
    if (changes['breakdown'] || !this.canonicalRings.length) {
      this.canonicalRings = this.buildRings();
    }
  }

  onRingSelected(key: string): void {
    this.ringSelected.emit(key as MarriageRegisterFilterKey);
  }

  private buildRings(): SacramentDashboardMetricRadialRing[] {
    if (!this.breakdown) {
      return [];
    }

    return CANONICAL_RING_ORDER.map((entry, index) => ({
      key: entry.key,
      label: entry.label,
      count: this.breakdown!.metrics[entry.key].count,
      pct: this.breakdown!.metrics[entry.key].pct,
      color: METRIC_RADIAL_DEFAULT_COLORS[index % METRIC_RADIAL_DEFAULT_COLORS.length],
    }));
  }
}
