import { CommonModule } from '@angular/common';
import { ChangeDetectionStrategy, Component, Input } from '@angular/core';
import { DonationDashboardSummary, FinancialCommandCenterPayload } from '../../../models/donation.model';
import { DashboardCollectionChartComponent } from '../../dashboard-collection-chart.component';
import { barHeightPercent, formatFocCurrency } from '../../utils/foc-format.util';
import { FocGeographicChartComponent } from '../foc-geographic-chart/foc-geographic-chart.component';

@Component({
  selector: 'app-foc-analytics-center',
  standalone: true,
  imports: [CommonModule, DashboardCollectionChartComponent, FocGeographicChartComponent],
  changeDetection: ChangeDetectionStrategy.OnPush,
  templateUrl: './foc-analytics-center.component.html',
  styleUrl: '../../styles/financial-command-center.scss'
})
export class FocAnalyticsCenterComponent {
  @Input({ required: true }) data!: FinancialCommandCenterPayload;

  get currencyCode(): string {
    return this.data.meta?.currency_code || this.data.tenant_context?.currency_code || 'INR';
  }

  get chartSummary(): DonationDashboardSummary | null {
    return {
      collection_performance_chart: this.data.analytics?.collection_performance_chart,
      collection_trend: this.data.analytics?.collection_trend,
      totals: this.data.totals
    } as DonationDashboardSummary;
  }

  get maxTrendValue(): number {
    return Math.max(...(this.data.analytics.collection_trend?.map((row) => row.collected) ?? [1]), 1);
  }

  barHeight(value: number): number {
    return barHeightPercent(value, this.maxTrendValue);
  }

  formatCurrency(value: number): string {
    return formatFocCurrency(value, this.currencyCode);
  }
}
