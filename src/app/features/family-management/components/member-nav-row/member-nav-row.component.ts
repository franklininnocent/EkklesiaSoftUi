import {
  ChangeDetectionStrategy,
  Component,
  EventEmitter,
  Input,
  Output
} from '@angular/core';
import { CommonModule } from '@angular/common';
import { NavMemberViewModel } from '../../models/family-navigator.model';

@Component({
  selector: 'app-member-nav-row',
  standalone: true,
  imports: [CommonModule],
  templateUrl: './member-nav-row.component.html',
  styleUrls: ['./member-nav-row.component.scss'],
  changeDetection: ChangeDetectionStrategy.OnPush
})
export class MemberNavRowComponent {
  @Input({ required: true }) vm!: NavMemberViewModel;
  @Input() selected = false;
  @Input() focused = false;
  @Input() optionId = '';

  @Output() selectMember = new EventEmitter<number>();

  onSelect(): void {
    this.selectMember.emit(this.vm.memberIndex);
  }

  onKeydown(event: KeyboardEvent): void {
    if (event.key === 'Enter' || event.key === ' ') {
      event.preventDefault();
      this.onSelect();
    }
  }
}
