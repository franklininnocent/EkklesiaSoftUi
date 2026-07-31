import { CommonModule } from '@angular/common';
import { ChangeDetectionStrategy, Component, Input } from '@angular/core';
import { FinancialCommandCenterPayload } from '../../../models/donation.model';
import { formatExecutiveCardValue, healthGaugeArc, sparklinePoints } from '../../utils/foc-format.util';

@Component({
  selector: 'app-foc-health-zone',
  standalone: true,
  imports: [CommonModule],
  changeDetection: ChangeDetectionStrategy.OnPush,
  templateUrl: './foc-health-zone.component.html',
  styleUrl: '../../styles/financial-command-center.scss'
})
export class FocHealthZoneComponent {
  @Input({ required: true }) data!: FinancialCommandCenterPayload;

  get currencyCode(): string {
    return this.data.meta?.currency_code || this.data.tenant_context?.currency_code || 'INR';
  }

  gaugeArc(): string {
    return healthGaugeArc(this.data.health_index?.score ?? 0);
  }

  formatCard(card: { key: string; value: number }): string {
    return formatExecutiveCardValue(card, this.currencyCode);
  }

  sparkline(value: number): string {
    return sparklinePoints(value);
  }
}
