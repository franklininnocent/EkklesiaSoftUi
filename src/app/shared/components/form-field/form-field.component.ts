import { CommonModule } from '@angular/common';
import {
  AfterContentInit,
  ChangeDetectionStrategy,
  Component,
  ElementRef,
  Input,
  OnChanges,
  SimpleChanges,
  inject,
} from '@angular/core';

/**
 * FormField
 *
 * Single label/control/help/error wrapper for form fields, built on the
 * existing global `.cf-form-field*` classes (`_church-financial-os-tokens.scss`)
 * so every form in the app shares one label style, one required/optional
 * marker, and one error-text color/size instead of each feature re-declaring
 * its own `label { ... }` / `small { color: #b91c1c }` block.
 *
 * The form control itself (input/select/textarea/custom) is projected as
 * default content; this component only owns the label + help/error chrome.
 * It also syncs aria-required / aria-invalid / aria-describedby onto the
 * projected native control when present.
 */
@Component({
  selector: 'app-form-field',
  standalone: true,
  imports: [CommonModule],
  templateUrl: './form-field.component.html',
  styles: [':host { display: contents; }'],
  changeDetection: ChangeDetectionStrategy.Eager,
})
export class FormFieldComponent implements AfterContentInit, OnChanges {
  private readonly host = inject(ElementRef<HTMLElement>);

  @Input({ required: true }) label!: string;
  /** Associates the label with the projected control via `for`/`id`. */
  @Input() fieldId?: string;
  @Input() required = false;
  /** Shows an "Optional" tag next to the label when the field isn't required. */
  @Input() optionalLabel = false;
  @Input() helpText?: string;
  @Input() errorText?: string | null;
  /** Spans the full width of a `.cf-form-grid` row. */
  @Input() wide = false;
  /** When false, label is linked via aria-labelledby (e.g. multi-part datetime field). */
  @Input() useLabelFor = true;

  get helpId(): string | null {
    return this.fieldId ? `${this.fieldId}-help` : null;
  }

  get errorId(): string | null {
    return this.fieldId ? `${this.fieldId}-error` : null;
  }

  ngAfterContentInit(): void {
    this.syncControlA11y();
  }

  ngOnChanges(_changes: SimpleChanges): void {
    this.syncControlA11y();
  }

  private syncControlA11y(): void {
    const datetimeField = this.host.nativeElement.querySelector(
      'app-cf-datetime-field'
    ) as HTMLElement | null;

    if (datetimeField) {
      this.syncDateTimeFieldA11y(datetimeField);
      return;
    }

    const control = this.host.nativeElement.querySelector(
      'input:not([type="hidden"]):not([type="checkbox"]):not([type="radio"]), select, textarea'
    ) as HTMLElement | null;

    if (!control) {
      return;
    }

    this.applyControlA11y(control);
  }

  private syncDateTimeFieldA11y(datetimeField: HTMLElement): void {
    const invalid = !!this.errorText;
    datetimeField.classList.toggle('cf-datetime-field--invalid', invalid);

    const controls = datetimeField.querySelectorAll('input');
    controls.forEach((control) => this.applyControlA11y(control, invalid));
  }

  private applyControlA11y(control: HTMLElement, invalidOverride?: boolean): void {
    if (this.required) {
      control.setAttribute('aria-required', 'true');
    } else {
      control.removeAttribute('aria-required');
    }

    const invalid = invalidOverride ?? !!this.errorText;
    control.setAttribute('aria-invalid', invalid ? 'true' : 'false');
    control.classList.toggle('cf-form-field__control--invalid', invalid);

    const describedBy: string[] = [];
    if (invalid && this.errorId) {
      describedBy.push(this.errorId);
    } else if (this.helpText && this.helpId) {
      describedBy.push(this.helpId);
    }

    if (describedBy.length) {
      control.setAttribute('aria-describedby', describedBy.join(' '));
    } else {
      control.removeAttribute('aria-describedby');
    }
  }
}
