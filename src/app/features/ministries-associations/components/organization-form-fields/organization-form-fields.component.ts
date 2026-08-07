import { CommonModule } from '@angular/common';
import { ChangeDetectionStrategy, Component, Input } from '@angular/core';
import { ReactiveFormsModule } from '@angular/forms';
import { FormFieldComponent } from '@shared/components/form-field/form-field.component';
import { OrganizationCategory, OrganizationType } from '../../models/ministries.model';
import { OrganizationFormGroup } from '../../utils/organization-form.util';

/**
 * OrganizationFormFieldsComponent
 *
 * Renders the Basics/About/Contact/Settings fields shared by the
 * "Add organization" page and the organization detail page's inline
 * "Edit profile" form — previously two byte-for-byte duplicated field
 * sets. Built on the shared `app-form-field` wrapper so every field gets
 * one label/required-marker/error style. Purely presentational: the host
 * page owns the `FormGroup`, submit handling, and payload building.
 */
@Component({
  selector: 'app-organization-form-fields',
  standalone: true,
  imports: [CommonModule, ReactiveFormsModule, FormFieldComponent],
  templateUrl: './organization-form-fields.component.html',
  styleUrl: './organization-form-fields.component.scss',
  changeDetection: ChangeDetectionStrategy.Eager,
})
export class OrganizationFormFieldsComponent {
  @Input({ required: true }) form!: OrganizationFormGroup;
  @Input() categories: OrganizationCategory[] = [];
  @Input() types: OrganizationType[] = [];
  @Input() submitted = false;
  @Input() fieldErrors: Record<string, string> = {};
  @Input({ required: true }) maxEstablishedDate!: string;
  /** Desktop two-column section layout (create page). Detail edit stays stacked. */
  @Input() columns = false;

  /** Resolves the first applicable validator/server error message for a control. */
  error(name: keyof OrganizationFormGroup['controls'], messages: Record<string, string>): string | null {
    const serverError = this.fieldErrors[name as string];
    if (serverError) {
      return serverError;
    }
    if (!this.submitted) {
      return null;
    }
    const control = this.form.controls[name];
    for (const key of Object.keys(messages)) {
      if (control.hasError(key)) {
        return messages[key];
      }
    }
    return null;
  }

  /** Simpler variant for single-validator "required" style fields (e.g. selects). */
  requiredError(name: keyof OrganizationFormGroup['controls'], message: string): string | null {
    return this.error(name, { required: message });
  }
}
