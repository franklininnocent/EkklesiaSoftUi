import { CommonModule } from '@angular/common';
import { ChangeDetectionStrategy, Component, Input } from '@angular/core';
import { FinancialCommandCenterPayload } from '../../../models/donation.model';
import { formatFocCurrency } from '../../utils/foc-format.util';

@Component({
  selector: 'app-foc-intelligence-stream',
  standalone: true,
  imports: [CommonModule],
  changeDetection: ChangeDetectionStrategy.OnPush,
  templateUrl: './foc-intelligence-stream.component.html',
  styleUrl: '../../styles/financial-command-center.scss'
})
export class FocIntelligenceStreamComponent {
  @Input({ required: true }) events!: FinancialCommandCenterPayload['intelligence'];
  @Input() currencyCode = 'INR';

  formatCurrency(value: number | null | undefined): string {
    return formatFocCurrency(value, this.currencyCode);
  }
}
