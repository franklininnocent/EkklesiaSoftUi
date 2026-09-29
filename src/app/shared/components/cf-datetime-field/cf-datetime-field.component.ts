import {
  ChangeDetectionStrategy,
  ChangeDetectorRef,
  Component,
  forwardRef,
  inject,
  Input,
  OnChanges,
  SimpleChanges,
} from '@angular/core';
import { CommonModule } from '@angular/common';
import {
  ControlValueAccessor,
  NG_VALUE_ACCESSOR,
  ReactiveFormsModule,
} from '@angular/forms';
import {
  combineDateTime,
  formatDateTimeDisplay,
  minDateFromDateTime,
  minTimeForDate,
  splitDateTime,
} from '@core/utils/datetime.util';

@Component({
  selector: 'app-cf-datetime-field',
  standalone: true,
  imports: [CommonModule, ReactiveFormsModule],
  templateUrl: './cf-datetime-field.component.html',
  styleUrl: './cf-datetime-field.component.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
  providers: [
    {
      provide: NG_VALUE_ACCESSOR,
      useExisting: forwardRef(() => CfDateTimeFieldComponent),
      multi: true,
    },
  ],
})
export class CfDateTimeFieldComponent implements ControlValueAccessor, OnChanges {
  private readonly cdr = inject(ChangeDetectorRef);

  /** Primary control id (date input); time input uses `${dateInputId}-time`. */
  @Input({ required: true }) dateInputId!: string;
  /** Associates the group with an external label (`app-form-field`). */
  @Input() labelledById?: string;
  @Input() dateAriaLabel = 'Date';
  @Input() timeAriaLabel = 'Time';
  /** Earliest allowed datetime (`YYYY-MM-DDTHH:mm`). */
  @Input() minDateTime: string | null = null;
  @Input() invalid = false;
  @Input() disabled = false;

  dateValue = '';
  timeValue = '';
  minDate: string | null = null;
  minTime: string | null = null;
  displaySummary = '';

  private onChange: (value: string) => void = () => {};
  private onTouched: () => void = () => {};

  ngOnChanges(changes: SimpleChanges): void {
    if (changes['minDateTime'] || changes['dateValue']) {
      this.syncConstraints();
    }
  }

  writeValue(value: string | null): void {
    const parts = splitDateTime(value);
    this.dateValue = parts.date;
    this.timeValue = parts.time;
    this.displaySummary = formatDateTimeDisplay(value);
    this.syncConstraints();
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

  onDateInput(event: Event): void {
    const target = event.target as HTMLInputElement;
    this.dateValue = target.value;
    this.syncConstraints();
    this.emitValue();
  }

  onTimeInput(event: Event): void {
    const target = event.target as HTMLInputElement;
    this.timeValue = target.value;
    this.emitValue();
  }

  onBlur(): void {
    this.onTouched();
  }

  clear(): void {
    if (this.disabled) {
      return;
    }
    this.dateValue = '';
    this.timeValue = '';
    this.syncConstraints();
    this.emitValue();
    this.onTouched();
  }

  get timeInputId(): string {
    return `${this.dateInputId}-time`;
  }

  private emitValue(): void {
    const combined = combineDateTime(this.dateValue, this.timeValue);
    this.displaySummary = formatDateTimeDisplay(combined);
    this.onChange(combined);
    this.cdr.markForCheck();
  }

  private syncConstraints(): void {
    this.minDate = minDateFromDateTime(this.minDateTime);
    this.minTime = minTimeForDate(this.dateValue, this.minDateTime);
  }
}
