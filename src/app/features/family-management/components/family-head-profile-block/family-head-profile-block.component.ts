import {
  ChangeDetectionStrategy,
  ChangeDetectorRef,
  Component,
  ElementRef,
  EventEmitter,
  Input,
  Output,
  ViewChild
} from '@angular/core';
import { CommonModule } from '@angular/common';
import { EditIconButtonComponent } from '@shared/components/edit-icon-button/edit-icon-button.component';
import { SectionCollapseToggleComponent } from '@shared/components/section-collapse-toggle/section-collapse-toggle.component';
import { ImageViewerComponent } from '@shared/components/image-viewer/image-viewer.component';
import { FamilyMember } from '@core/models/family.model';
import { SacramentTypeDto } from '@core/services/sacrament-type-lookup.service';
import { Sacrament } from '@features/settings/sacraments/models/sacrament.model';
import {
  countSacramentsOnRecord,
  pickRegisterRecordForType
} from '../../utils/register-sacrament.util';
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
    MemberSacramentDetailComponent,
    ImageViewerComponent
  ],
  templateUrl: './family-head-profile-block.component.html',
  styleUrls: ['./family-head-profile-block.component.scss'],
  changeDetection: ChangeDetectionStrategy.OnPush
})
export class FamilyHeadProfileBlockComponent {
  constructor(private readonly cdr: ChangeDetectorRef) {}

  @ViewChild('profileImageInput') profileImageInput?: ElementRef<HTMLInputElement>;

  @Input({ required: true }) member!: FamilyMember;
  @Input() relationshipEyebrow = 'Family Head';
  @Input() isFamilyHead = false;
  @Input() avatarImageUrl: string | null = null;
  @Input() sacramentTypesDisplay: SacramentTypeDto[] = [];
  @Input() sacramentsExpanded = true;
  @Input() editingHeadImage = false;
  @Input() memberRegisterSacraments: Sacrament[] = [];
  @Input() canViewRegisterSacraments = false;

  @Output() editProfile = new EventEmitter<void>();
  @Output() toggleSacraments = new EventEmitter<void>();
  @Output() toggleHeadImageEdit = new EventEmitter<void>();
  @Output() headProfileImageSelected = new EventEmitter<Event>();
  @Output() deleteHeadProfileImage = new EventEmitter<void>();
  @Output() editSacrament = new EventEmitter<string>();

  photoViewer: { src: string; alt: string; title: string; subtitle: string } | null = null;

  get isSacramentsComplete(): boolean {
    if (!this.sacramentTypesDisplay.length) {
      return true;
    }
    return this.countCompletedSacraments(this.member) > 0;
  }

  registerRecordForType(type: SacramentTypeDto): Sacrament | null {
    return pickRegisterRecordForType(this.memberRegisterSacraments, type);
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
    return countSacramentsOnRecord(member, this.sacramentTypesDisplay, this.memberRegisterSacraments);
  }

  trackSacramentType(index: number, type: SacramentTypeDto): number | string {
    return type.id ?? type.code ?? index;
  }

  onSacramentEdit(code: string): void {
    this.editSacrament.emit(code);
  }

  onHeadAvatarClick(): void {
    if (this.editingHeadImage) {
      this.profileImageInput?.nativeElement.click();
      return;
    }

    if (this.avatarImageUrl) {
      this.openPhotoViewer();
      return;
    }

    this.toggleHeadImageEdit.emit();
  }

  onMemberAvatarClick(event: MouseEvent): void {
    if (!this.avatarImageUrl) {
      return;
    }

    event.stopPropagation();
    this.openPhotoViewer();
  }

  openPhotoViewer(): void {
    if (!this.avatarImageUrl) {
      return;
    }

    this.photoViewer = {
      src: this.avatarImageUrl,
      alt: this.getDisplayName(this.member),
      title: this.getDisplayName(this.member),
      subtitle: this.relationshipEyebrow,
    };
    this.cdr.detectChanges();
  }

  closePhotoViewer(): void {
    this.photoViewer = null;
    this.cdr.detectChanges();
  }
}
