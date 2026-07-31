import {
  ChangeDetectionStrategy,
  Component,
  EventEmitter,
  Input,
  Output
} from '@angular/core';
import { CommonModule } from '@angular/common';
import { EditIconButtonComponent } from '@shared/components/edit-icon-button/edit-icon-button.component';
import { SectionCollapseToggleComponent } from '@shared/components/section-collapse-toggle/section-collapse-toggle.component';
import { FamilyMember } from '@core/models/family.model';
import { SacramentTypeDto } from '@core/services/sacrament-type-lookup.service';
import {
  countCompletedSacraments,
  isSacramentCompleted
} from '../../utils/sacrament-completion.util';
import { formatCompletedAge } from '../../utils/age-from-birth.util';
import { getMemberDisplayName } from '../../utils/profile-completion.util';
import {
  getMembershipStatusClass,
  getMembershipStatusLabel
} from '../../utils/family-hierarchy.util';
import { MemberSacramentDetailComponent } from '../family-member-detail-panel/member-sacrament-detail.component';

@Component({
  selector: 'app-family-head-profile-block',
  standalone: true,
  imports: [
    CommonModule,
    EditIconButtonComponent,
    SectionCollapseToggleComponent,
    MemberSacramentDetailComponent
  ],
  templateUrl: './family-head-profile-block.component.html',
  styleUrls: ['./family-head-profile-block.component.scss'],
  changeDetection: ChangeDetectionStrategy.OnPush
})
export class FamilyHeadProfileBlockComponent {
  @Input({ required: true }) member!: FamilyMember;
  @Input() relationshipEyebrow = 'Family Head';
  @Input() isFamilyHead = false;
  @Input() avatarImageUrl: string | null = null;
  @Input() sacramentTypesDisplay: SacramentTypeDto[] = [];
  @Input() sacramentsExpanded = true;
  @Input() editingHeadImage = false;

  @Output() editProfile = new EventEmitter<void>();
  @Output() toggleSacraments = new EventEmitter<void>();
  @Output() toggleHeadImageEdit = new EventEmitter<void>();
  @Output() headProfileImageSelected = new EventEmitter<Event>();
  @Output() deleteHeadProfileImage = new EventEmitter<void>();
  @Output() editSacrament = new EventEmitter<string>();

  get isSacramentsComplete(): boolean {
    if (!this.sacramentTypesDisplay.length) {
      return true;
    }
    return this.countCompletedSacraments(this.member) > 0;
  }

  getDisplayName(member: FamilyMember): string {
    return getMemberDisplayName(member);
  }

  getStatusLabel(member: FamilyMember): string {
    return getMembershipStatusLabel(member.status);
  }

  getStatusClass(member: FamilyMember): string {
    return getMembershipStatusClass(member.status);
  }

  formatDate(date: string | null | undefined): string {
    if (!date) return '—';
    try {
      const d = new Date(date);
      return isNaN(d.getTime())
        ? '—'
        : d.toLocaleDateString('en-US', { year: 'numeric', month: 'short', day: 'numeric' });
    } catch {
      return '—';
    }
  }

  formatAge(dateOfBirth: string | null | undefined): string {
    return formatCompletedAge(dateOfBirth);
  }

  formatGender(gender: string | null | undefined): string {
    if (!gender) return '—';
    return gender.charAt(0).toUpperCase() + gender.slice(1);
  }

  formatMaritalStatus(status: string | null | undefined): string {
    if (!status) return '—';
    return status.charAt(0).toUpperCase() + status.slice(1);
  }

  formatTextValue(value: string | null | undefined): string {
    if (!value?.trim()) {
      return '—';
    }
    return value.trim();
  }

  countCompletedSacraments(member: FamilyMember): number {
    return countCompletedSacraments(member, this.sacramentTypesDisplay);
  }

  trackSacramentType(index: number, type: SacramentTypeDto): number | string {
    return type.id ?? type.code ?? index;
  }

  onSacramentEdit(code: string): void {
    this.editSacrament.emit(code);
  }
}
