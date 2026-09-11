import {
  ChangeDetectionStrategy,
  Component,
  EventEmitter,
  Input,
  Output
} from '@angular/core';
import { CommonModule } from '@angular/common';
import { HierarchyGroupViewModel } from '../../models/family-navigator.model';
import { MemberNavRowComponent } from '../member-nav-row/member-nav-row.component';

@Component({
  selector: 'app-family-hierarchy-group',
  standalone: true,
  imports: [CommonModule, MemberNavRowComponent],
  templateUrl: './family-hierarchy-group.component.html',
  styleUrls: ['./family-hierarchy-group.component.scss'],
  changeDetection: ChangeDetectionStrategy.OnPush
})
export class FamilyHierarchyGroupComponent {
  @Input({ required: true }) group!: HierarchyGroupViewModel;
  @Input() expanded = true;
  @Input() selectedMemberId: string | null = null;
  @Input() focusedMemberIndex: number | null = null;
  @Input() optionIdPrefix = 'nav-member-';

  @Output() expandedChange = new EventEmitter<boolean>();
  @Output() selectMember = new EventEmitter<number>();
  @Output() previewPhoto = new EventEmitter<{ src: string; alt: string; title: string; subtitle: string }>();

  toggleExpanded(): void {
    this.expandedChange.emit(!this.expanded);
  }

  isSelected(vm: { member: { id: string } }): boolean {
    return !!this.selectedMemberId && vm.member.id === this.selectedMemberId;
  }

  optionId(memberIndex: number): string {
    return `${this.optionIdPrefix}${memberIndex}`;
  }
}
