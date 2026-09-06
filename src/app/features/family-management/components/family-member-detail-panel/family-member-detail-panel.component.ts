import {
  ChangeDetectionStrategy,
  Component,
  EventEmitter,
  Input,
  Output
} from '@angular/core';
import { CommonModule } from '@angular/common';
import { Family, FamilyMember } from '@core/models/family.model';
import { SacramentTypeDto } from '@core/services/sacrament-type-lookup.service';
import { getMemberDisplayName } from '../../utils/profile-completion.util';
import { getRelationshipLabel } from '../../utils/family-hierarchy.util';
import { FamilyAffiliationsPanelComponent } from '../family-affiliations-panel/family-affiliations-panel.component';
import { FamilyHeadProfileBlockComponent } from '../family-head-profile-block/family-head-profile-block.component';
import { Sacrament } from '@features/settings/sacraments/models/sacrament.model';

@Component({
  selector: 'app-family-member-detail-panel',
  standalone: true,
  imports: [CommonModule, FamilyHeadProfileBlockComponent, FamilyAffiliationsPanelComponent],
  templateUrl: './family-member-detail-panel.component.html',
  styleUrls: ['./family-member-detail-panel.component.scss'],
  changeDetection: ChangeDetectionStrategy.OnPush
})
export class FamilyMemberDetailPanelComponent {
  @Input({ required: true }) family!: Family;
  @Input() selectedMemberIndex: number | null = null;
  @Input() isHeadSelected = false;
  @Input() sacramentTypesDisplay: SacramentTypeDto[] = [];
  @Input() headSacramentsExpanded = true;
  @Input() editingHeadImage = false;
  @Input() showHeadWithoutMember = false;
  @Input() memberRegisterSacraments: Sacrament[] = [];
  @Input() canViewRegisterSacraments = false;

  @Output() editHead = new EventEmitter<void>();
  @Output() editMember = new EventEmitter<number>();
  @Output() addHead = new EventEmitter<void>();
  @Output() toggleHeadSacraments = new EventEmitter<void>();
  @Output() toggleHeadImageEdit = new EventEmitter<void>();
  @Output() headProfileImageSelected = new EventEmitter<Event>();
  @Output() deleteHeadProfileImage = new EventEmitter<void>();
  @Output() openSacramentModal = new EventEmitter<{ index: number; code: string }>();
  @Output() openHeadSacramentModal = new EventEmitter<string>();

  sacramentsSectionExpanded = true;

  get selectedMember(): FamilyMember | null {
    if (
      this.selectedMemberIndex === null ||
      !this.family?.members?.[this.selectedMemberIndex]
    ) {
      return null;
    }
    return this.family.members[this.selectedMemberIndex];
  }

  get avatarUrl(): string | null {
    return this.isHeadSelected ? this.family.head_profile_image_full_url ?? null : null;
  }

  get sacramentsExpandedForSelected(): boolean {
    return this.isHeadSelected ? this.headSacramentsExpanded : this.sacramentsSectionExpanded;
  }

  getDisplayName(member: FamilyMember | null | undefined): string {
    if (!member) {
      return '—';
    }
    return getMemberDisplayName(member);
  }

  getRelationshipLabel(member: FamilyMember): string {
    return getRelationshipLabel(member.relationship_to_head, this.isHeadSelected);
  }

  getProfileEyebrow(member: FamilyMember): string {
    return this.isHeadSelected ? 'Family Head' : this.getRelationshipLabel(member);
  }

  toggleSacramentsSection(): void {
    if (this.isHeadSelected) {
      this.toggleHeadSacraments.emit();
    } else {
      this.sacramentsSectionExpanded = !this.sacramentsSectionExpanded;
    }
  }

  onEditClick(): void {
    if (this.isHeadSelected) {
      this.editHead.emit();
    } else if (this.selectedMemberIndex !== null) {
      this.editMember.emit(this.selectedMemberIndex);
    }
  }

  onSacramentEdit(code: string): void {
    if (this.selectedMemberIndex === null) {
      return;
    }
    if (this.isHeadSelected) {
      this.openHeadSacramentModal.emit(code);
    } else {
      this.openSacramentModal.emit({ index: this.selectedMemberIndex, code });
    }
  }
}
