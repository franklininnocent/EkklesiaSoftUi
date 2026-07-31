import { ChangeDetectionStrategy, Component, EventEmitter, Input, Output } from '@angular/core';
import { CommonModule } from '@angular/common';
import { EditIconButtonComponent } from '@shared/components/edit-icon-button/edit-icon-button.component';
import { FamilySummaryViewModel } from '../../models/family-navigator.model';

@Component({
  selector: 'app-family-summary-card',
  standalone: true,
  imports: [CommonModule, EditIconButtonComponent],
  templateUrl: './family-summary-card.component.html',
  styleUrls: ['./family-summary-card.component.scss'],
  changeDetection: ChangeDetectionStrategy.OnPush
})
export class FamilySummaryCardComponent {
  @Input({ required: true }) summary!: FamilySummaryViewModel;
  @Output() editFamily = new EventEmitter<void>();

  get statusLabel(): string {
    const status = (this.summary.familyStatus || 'active').toLowerCase();
    switch (status) {
      case 'inactive':
        return 'Inactive';
      case 'migrated':
        return 'Migrated';
      case 'active':
      default:
        return 'Active';
    }
  }

  get statusClass(): string {
    return `is-${(this.summary.familyStatus || 'active').toLowerCase()}`;
  }
}
