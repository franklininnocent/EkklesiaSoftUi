import { CommonModule } from '@angular/common';
import {
  ChangeDetectionStrategy,
  ChangeDetectorRef,
  Component,
  Input,
  forwardRef,
  inject,
} from '@angular/core';
import { ControlValueAccessor, NG_VALUE_ACCESSOR } from '@angular/forms';
import { FormFieldComponent } from '@shared/components/form-field/form-field.component';
import { MemberType, OrganizationMembership } from '../../models/ministries.model';

@Component({
  selector: 'app-leadership-member-picker',
  standalone: true,
  imports: [CommonModule, FormFieldComponent],
  templateUrl: './leadership-member-picker.component.html',
  styles: [':host { display: contents; }'],
  changeDetection: ChangeDetectionStrategy.OnPush,
  providers: [
    {
      provide: NG_VALUE_ACCESSOR,
      useExisting: forwardRef(() => LeadershipMemberPickerComponent),
      multi: true,
    },
  ],
})
export class LeadershipMemberPickerComponent implements ControlValueAccessor {
  private readonly cdr = inject(ChangeDetectorRef);

  @Input({ required: true }) members: OrganizationMembership[] = [];
  @Input() guestsCanHoldOffice = false;
  @Input() placeholder = 'Select member…';
  @Input() id: string | null = null;
  @Input() showRequiredError = false;

  value = '';
  disabled = false;

  private onChange: (value: string) => void = () => undefined;
  private onTouched: () => void = () => undefined;

  get fieldId(): string {
    return this.id || 'leadership-member-picker';
  }

  writeValue(value: string | null): void {
    this.value = value ?? '';
    this.cdr.markForCheck();
  }

  registerOnChange(fn: (value: string) => void): void {
    this.onChange = fn;
  }

  registerOnTouched(fn: () => void): void {
    this.onTouched = fn;
  }

  setDisabledState(isDisabled: boolean): void {
    this.disabled = isDisabled;
    this.cdr.markForCheck();
  }

  onSelectChange(event: Event): void {
    const next = (event.target as HTMLSelectElement).value;
    this.value = next;
    this.onChange(next);
    this.onTouched();
    this.cdr.markForCheck();
  }

  onBlur(): void {
    this.onTouched();
  }

  memberLabel(member: OrganizationMembership): string {
    return `${member.display_name} (${this.typeLabel(member.member_type)})`;
  }

  isGuestDisabled(member: OrganizationMembership): boolean {
    return member.member_source === 'guest' && !this.guestsCanHoldOffice;
  }

  guestDisabledTitle(member: OrganizationMembership): string | null {
    if (!this.isGuestDisabled(member)) {
      return null;
    }
    return 'Guests cannot hold office in this organization.';
  }

  private typeLabel(type: MemberType): string {
    switch (type) {
      case 'regular':
        return 'Regular';
      case 'honorary':
        return 'Honorary';
      case 'life':
        return 'Life';
      case 'junior':
        return 'Junior';
      default:
        return type;
    }
  }
}
