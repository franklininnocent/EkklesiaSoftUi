import { CommonModule } from '@angular/common';
import { ChangeDetectionStrategy, Component, Input } from '@angular/core';
import { FinancialCommandCenterPayload } from '../../../models/donation.model';
import { formatFocCurrency } from '../../utils/foc-format.util';

@Component({
  selector: 'app-foc-projects-command',
  standalone: true,
  imports: [CommonModule],
  changeDetection: ChangeDetectionStrategy.OnPush,
  templateUrl: './foc-projects-command.component.html',
  styleUrl: '../../styles/financial-command-center.scss'
})
export class FocProjectsCommandComponent {
  @Input({ required: true }) projects!: FinancialCommandCenterPayload['projects_command'];
  @Input() currencyCode = 'INR';

  formatCurrency(value: number | null | undefined): string {
    return formatFocCurrency(value, this.currencyCode);
  }
}
