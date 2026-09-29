import { ChangeDetectionStrategy, Component, EventEmitter, Input, Output } from '@angular/core';
import { CommonModule } from '@angular/common';
import { RouterLink } from '@angular/router';
import { EditIconButtonComponent } from '@shared/components/edit-icon-button/edit-icon-button.component';
import { FamilyMember } from '@core/models/family.model';
import { SacramentTypeDto } from '@core/services/sacrament-type-lookup.service';
import { Sacrament } from '@features/settings/sacraments/models/sacrament.model';
import {
  isSacramentCompleted,
  resolveCanonicalSacrament,
  SacramentFormType
} from '../../utils/sacrament-completion.util';
import {
  buildRegisterDisplayFields,
  registerStatusLabel
} from '../../utils/register-sacrament.util';

export interface SacramentDisplayField {
  label: string;
  value: string;
}

@Component({
  selector: 'app-member-sacrament-detail',
  standalone: true,
  imports: [CommonModule, RouterLink, EditIconButtonComponent],
  templateUrl: './member-sacrament-detail.component.html',
  styleUrls: ['./member-sacrament-detail.component.scss'],
  changeDetection: ChangeDetectionStrategy.OnPush
})
export class MemberSacramentDetailComponent {
  @Input({ required: true }) member!: FamilyMember;
  @Input({ required: true }) sacramentType!: SacramentTypeDto;
  @Input() registerRecord: Sacrament | null = null;
  @Input() canViewRegister = false;

  @Output() editSacrament = new EventEmitter<string>();

  formatSacramentDate(date: string | null | undefined): string {
    if (!date) {
      return '—';
    }
    try {
      const d = new Date(date);
      return isNaN(d.getTime())
        ? '—'
        : d.toLocaleDateString('en-US', { year: 'numeric', month: 'short', day: 'numeric' });
    } catch {
      return '—';
    }
  }

  get canonical(): SacramentFormType | null {
    return resolveCanonicalSacrament(this.sacramentType.code);
  }

  get profileCompleted(): boolean {
    return isSacramentCompleted(this.member, this.sacramentType.code);
  }

  get hasRegisterRecord(): boolean {
    return this.canViewRegister && this.registerRecord != null;
  }

  get statusLabel(): string {
    if (this.hasRegisterRecord) {
      return registerStatusLabel(this.registerRecord?.status);
    }
    return this.profileCompleted ? 'On profile' : 'Not on profile';
  }

  get tileComplete(): boolean {
    return this.hasRegisterRecord || this.profileCompleted;
  }

  get editable(): boolean {
    if (this.canonical === null) {
      return false;
    }
    if (this.profileCompleted || this.hasSacramentDetails) {
      return true;
    }
    return this.sacramentType.enabled_for_tenant !== false;
  }

  get hasSacramentDetails(): boolean {
    const m = this.member;
    switch (this.canonical) {
      case 'baptism':
        return !!(
          m.baptism_date?.trim() ||
          m.baptism_church_name?.trim() ||
          m.baptism_place?.trim() ||
          m.baptism_church_address?.trim() ||
          m.baptism_godparent_primary?.trim() ||
          m.baptism_godparent_secondary?.trim() ||
          m.baptism_priest_name?.trim()
        );
      case 'first_communion':
        return !!(
          m.first_communion_date?.trim() ||
          m.first_communion_place?.trim() ||
          m.first_communion_church_name?.trim() ||
          m.first_communion_church_address?.trim() ||
          m.first_communion_priest_name?.trim() ||
          m.first_communion_description?.trim()
        );
      case 'confirmation':
        return !!(m.confirmation_date?.trim() || m.confirmation_place?.trim());
      case 'marriage':
        return !!(
          m.marriage_date?.trim() ||
          m.marriage_place?.trim() ||
          m.marriage_spouse_name?.trim() ||
          m.marriage_bride_full_name?.trim() ||
          m.marriage_groom_full_name?.trim() ||
          m.marriage_minister_name?.trim() ||
          m.marriage_minister_title?.trim()
        );
      default:
        return false;
    }
  }

  get showProfileSummarySection(): boolean {
    return this.hasSacramentDetails || (!this.hasRegisterRecord && this.profileCompleted);
  }

  get showNoProfileSummary(): boolean {
    return !this.hasSacramentDetails && !this.profileCompleted;
  }

  get registerViewPath(): string | null {
    return this.registerRecord ? `/sacraments/view/${this.registerRecord.id}` : null;
  }

  get registerDisplayFields(): SacramentDisplayField[] {
    if (!this.registerRecord) {
      return [];
    }
    return buildRegisterDisplayFields(this.registerRecord);
  }

  get displayFields(): SacramentDisplayField[] {
    const m = this.member;
    switch (this.canonical) {
      case 'baptism':
        return this.buildFields([
          { label: 'Date', value: m.baptism_date, always: true },
          { label: 'Church', value: m.baptism_church_name },
          {
            label: 'Location',
            value: m.baptism_place && !m.baptism_church_name ? m.baptism_place : null
          },
          { label: 'Address', value: m.baptism_church_address },
          { label: 'Primary Godparent', value: m.baptism_godparent_primary },
          { label: 'Secondary Godparent', value: m.baptism_godparent_secondary },
          { label: 'Priest', value: m.baptism_priest_name }
        ]);
      case 'first_communion':
        return this.buildFields([
          { label: 'Date', value: m.first_communion_date, always: true },
          { label: 'Location', value: m.first_communion_place },
          { label: 'Church', value: m.first_communion_church_name },
          { label: 'Address', value: m.first_communion_church_address },
          { label: 'Priest', value: m.first_communion_priest_name },
          { label: 'Notes', value: m.first_communion_description }
        ]);
      case 'confirmation':
        return this.buildFields([
          { label: 'Date', value: m.confirmation_date, always: true },
          { label: 'Location', value: m.confirmation_place }
        ]);
      case 'marriage':
        return this.buildFields([
          { label: 'Date', value: m.marriage_date, always: true },
          { label: 'Location', value: m.marriage_place },
          { label: 'Spouse', value: m.marriage_spouse_name },
          { label: 'Bride', value: m.marriage_bride_full_name },
          { label: 'Groom', value: m.marriage_groom_full_name },
          { label: 'Minister', value: m.marriage_minister_name },
          { label: 'Title', value: m.marriage_minister_title }
        ]);
      default:
        return [{ label: 'Date', value: '—' }];
    }
  }

  get displayChips(): string[] {
    const m = this.member;
    switch (this.canonical) {
      case 'baptism':
        return this.locationChips(m.baptism_location_type);
      case 'first_communion':
        return this.locationChips(m.first_communion_location_type);
      default:
        return [];
    }
  }

  onEdit(): void {
    this.editSacrament.emit(this.sacramentType.code);
  }

  private buildFields(
    entries: Array<{ label: string; value?: string | null; always?: boolean }>
  ): SacramentDisplayField[] {
    return entries
      .map((entry) => {
        const always = entry.always ?? entry.label === 'Date';
        const display =
          entry.label === 'Date'
            ? this.formatSacramentDate(entry.value)
            : this.formatText(entry.value);
        if (!always && !entry.value?.trim()) {
          return null;
        }
        return { label: entry.label, value: display };
      })
      .filter((row): row is SacramentDisplayField => row !== null);
  }

  private formatText(value: string | null | undefined): string {
    return value?.trim() ? value.trim() : '—';
  }

  private locationChips(locationType: string | null | undefined): string[] {
    if (locationType === 'home_parish') {
      return ['Home Parish'];
    }
    if (locationType === 'other') {
      return ['Another Church'];
    }
    return [];
  }
}
