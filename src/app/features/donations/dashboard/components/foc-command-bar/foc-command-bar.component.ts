import { CommonModule } from '@angular/common';
import { ChangeDetectionStrategy, Component, EventEmitter, Input, Output } from '@angular/core';
import { RouterModule } from '@angular/router';
import { DashboardPersona, DioceseRollupDashboard, FinancialCommandCenterPayload } from '../../../models/donation.model';
import { formatFocCurrency, lastSyncLabel } from '../../utils/foc-format.util';
import { FocCollectionHealthKpiComponent } from '../foc-collection-health-kpi/foc-collection-health-kpi.component';
import { FocOperationsHubComponent } from '../foc-workspace-menu/foc-workspace-menu.component';

@Component({
  selector: 'app-foc-command-bar',
  standalone: true,
  imports: [CommonModule, RouterModule, FocCollectionHealthKpiComponent, FocOperationsHubComponent],
  changeDetection: ChangeDetectionStrategy.OnPush,
  templateUrl: './foc-command-bar.component.html',
  styleUrl: './foc-command-bar.component.scss'
})
export class FocCommandBarComponent {
  @Input({ required: true }) data!: FinancialCommandCenterPayload;
  @Input() rollup: DioceseRollupDashboard | null = null;
  @Input() dashboardView: 'local' | 'rollup' = 'local';
  @Input() period = 'month';

  @Output() periodChange = new EventEmitter<string>();
  @Output() dashboardViewChange = new EventEmitter<'local' | 'rollup'>();
  @Output() quickCollect = new EventEmitter<void>();
  @Output() recordExpense = new EventEmitter<void>();
  @Output() refresh = new EventEmitter<void>();
  @Output() scrollToAdvisor = new EventEmitter<void>();
  @Output() quickAction = new EventEmitter<string>();

  private readonly periodLabels: Record<string, string> = {
    month: 'This Month',
    quarter: 'This Quarter',
    year: 'This Year',
    fy: 'Financial Year'
  };

  readonly periodOptions: Array<{ value: string; label: string; title: string }> = [
    { value: 'month', label: 'Month', title: 'This Month' },
    { value: 'quarter', label: 'Quarter', title: 'This Quarter' },
    { value: 'year', label: 'Year', title: 'This Year' },
    { value: 'fy', label: 'FY', title: 'Financial Year' }
  ];

  get persona(): DashboardPersona | undefined {
    return this.data.persona;
  }

  get syncLabel(): string {
    return lastSyncLabel(this.data.meta?.last_synced_at);
  }

  get currencyCode(): string {
    return this.data.meta?.currency_code || this.data.tenant_context?.currency_code || 'INR';
  }

  get periodLabel(): string {
    return this.periodLabels[this.period] ?? 'This Month';
  }

  get financialYearLabel(): string {
    const fy = this.data.meta?.financial_year;
    if (!fy) {
      return '';
    }
    return `FY ${fy.replace('-', '–')}`;
  }

  get roleLabel(): string {
    return this.data.meta?.operator_role || this.persona?.label?.replace(/\s*View$/i, '') || 'Administrator';
  }

  get todayCollected(): number {
    return this.data.collections_command?.today_collected ?? 0;
  }

  get activeContributors(): number {
    return this.data.analytics?.family_engagement?.active_contributors
      ?? this.data.collections_command?.families_processed_today
      ?? 0;
  }

  get familiesContributedToday(): number {
    return this.data.collections_command?.families_processed_today
      ?? this.data.collections_command?.today_count
      ?? 0;
  }

  get outstandingDues(): number {
    return this.cardValue('outstanding') ?? this.data.totals?.pending_dues ?? 0;
  }

  get collectionHealthLabel(): string {
    return this.data.collection_health?.label ?? this.data.health_index?.label ?? 'Calculating';
  }

  get collectionHealth(): FinancialCommandCenterPayload['collection_health'] | undefined {
    return this.data.collection_health;
  }

  get fundingStatusLabel(): string {
    const pct = this.cardValue('projects') ?? 0;
    if (pct >= 75) {
      return 'On Track';
    }
    if (pct >= 50) {
      return 'Progressing';
    }
    if (pct > 0) {
      return 'Needs Focus';
    }
    return 'No Active Projects';
  }

  get operationalHeadline(): string {
    const status = this.data.health_index?.status;
    if (status === 'healthy') {
      return 'Collections running normally';
    }
    if (status === 'attention') {
      return 'Collections need attention';
    }
    if (status === 'risk') {
      return 'Collections require immediate review';
    }
    return 'Monitoring parish collections';
  }

  get contributionsTodayCount(): number {
    return this.data.collections_command?.today_count ?? 0;
  }

  get overdueAttentionCount(): number {
    const followUp = this.data.action_center?.find((queue) => queue.key === 'families_follow_up');
    return followUp?.affected_count ?? 0;
  }

  get collectionsActive(): boolean {
    return this.contributionsTodayCount > 0 || this.todayCollected > 0;
  }

  formatCurrency(value: number | null | undefined): string {
    return formatFocCurrency(value, this.currencyCode);
  }

  onPeriodChange(value: string): void {
    this.periodChange.emit(value);
  }

  private cardValue(key: string): number | undefined {
    return this.data.executive_cards?.find((card) => card.key === key)?.value;
  }
}
