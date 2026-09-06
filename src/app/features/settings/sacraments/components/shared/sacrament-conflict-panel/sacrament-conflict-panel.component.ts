import { CommonModule } from '@angular/common';
import { ChangeDetectionStrategy, Component, EventEmitter, Input, Output } from '@angular/core';
import { SacramentContextConflict } from '../../../models/sacrament-context.model';

@Component({
  selector: 'app-sacrament-conflict-panel',
  standalone: true,
  imports: [CommonModule],
  templateUrl: './sacrament-conflict-panel.component.html',
  styleUrl: './sacrament-conflict-panel.component.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class SacramentConflictPanelComponent {
  @Input() conflicts: SacramentContextConflict[] = [];
  @Output() correctMember = new EventEmitter<SacramentContextConflict>();

  blockingConflicts(): SacramentContextConflict[] {
    return this.conflicts.filter((c) => c.blocks_save);
  }
}
