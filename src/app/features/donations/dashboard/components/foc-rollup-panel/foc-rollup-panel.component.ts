import { CommonModule } from '@angular/common';
import { ChangeDetectionStrategy, Component, Input } from '@angular/core';
import { DioceseRollupDashboard } from '../../../models/donation.model';
import { formatFocCurrency } from '../../utils/foc-format.util';

@Component({
  selector: 'app-foc-rollup-panel',
  standalone: true,
  imports: [CommonModule],
  changeDetection: ChangeDetectionStrategy.OnPush,
  templateUrl: './foc-rollup-panel.component.html',
  styleUrl: '../../styles/financial-command-center.scss'
})
export class FocRollupPanelComponent {
  @Input({ required: true }) rollup!: DioceseRollupDashboard;
  @Input() currencyCode = 'INR';

  formatCurrency(value: number | null | undefined): string {
    return formatFocCurrency(value, this.currencyCode);
  }
}
