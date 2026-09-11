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
  @Output() previewPhoto = new EventEmitter<{ src: string; alt: string; title: string; subtitle: string }>();

  onSelect(): void {
    this.selectMember.emit(this.vm.memberIndex);
  }

  onKeydown(event: KeyboardEvent): void {
    if (event.key === 'Enter' || event.key === ' ') {
      event.preventDefault();
      this.onSelect();
    }
  }

  onPhotoClick(event: MouseEvent): void {
    if (!this.vm.avatarUrl) {
      return;
    }

    event.stopPropagation();
    event.preventDefault();
    this.previewPhoto.emit({
      src: this.vm.avatarUrl,
      alt: this.vm.displayName,
      title: this.vm.displayName,
      subtitle: this.vm.relationshipLabel,
    });
  }
}
