import { CommonModule } from '@angular/common';
import { ChangeDetectionStrategy, Component, Input } from '@angular/core';
import { RouterModule } from '@angular/router';
import { FinancialCommandCenterPayload } from '../../../models/donation.model';
import { formatFocCurrency } from '../../utils/foc-format.util';

@Component({
  selector: 'app-foc-action-center',
  standalone: true,
  imports: [CommonModule, RouterModule],
  changeDetection: ChangeDetectionStrategy.OnPush,
  templateUrl: './foc-action-center.component.html',
  styleUrl: '../../styles/financial-command-center.scss'
})
export class FocActionCenterComponent {
  @Input({ required: true }) data!: FinancialCommandCenterPayload;
  @Input() currencyCode = 'INR';

  focusedIndex = 0;

  get queues() {
    return this.data.action_center ?? [];
  }

  formatCurrency(value: number): string {
    return formatFocCurrency(value, this.currencyCode);
  }

  onQueueKeydown(event: KeyboardEvent, index: number): void {
    if (event.key === 'ArrowRight' || event.key === 'ArrowDown') {
      event.preventDefault();
      this.focusedIndex = Math.min(this.queues.length - 1, index + 1);
    }
    if (event.key === 'ArrowLeft' || event.key === 'ArrowUp') {
      event.preventDefault();
      this.focusedIndex = Math.max(0, index - 1);
    }
    if (event.key === 'Home') {
      event.preventDefault();
      this.focusedIndex = 0;
    }
    if (event.key === 'End') {
      event.preventDefault();
      this.focusedIndex = this.queues.length - 1;
    }
  }
}
