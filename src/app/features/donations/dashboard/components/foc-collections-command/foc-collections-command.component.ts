import { CommonModule } from '@angular/common';
import { ChangeDetectionStrategy, Component, Input } from '@angular/core';
import { RouterModule } from '@angular/router';
import { FinancialCommandCenterPayload } from '../../../models/donation.model';
import { formatFocCurrency } from '../../utils/foc-format.util';

@Component({
  selector: 'app-foc-collections-command',
  standalone: true,
  imports: [CommonModule, RouterModule],
  changeDetection: ChangeDetectionStrategy.OnPush,
  templateUrl: './foc-collections-command.component.html',
  styleUrl: '../../styles/financial-command-center.scss'
})
export class FocCollectionsCommandComponent {
  @Input({ required: true }) command!: FinancialCommandCenterPayload['collections_command'];
  @Input() currencyCode = 'INR';

  formatCurrency(value: number | null | undefined): string {
    return formatFocCurrency(value, this.currencyCode);
  }
}
