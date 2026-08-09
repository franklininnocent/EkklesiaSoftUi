import { Component, OnInit, Input, Output, EventEmitter, OnChanges, SimpleChanges } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormBuilder, FormGroup, Validators, ReactiveFormsModule } from '@angular/forms';
import { SacramentTypeService } from '../../services/sacrament-type.service';
import { SacramentType, SACRAMENT_CATEGORIES, MINISTER_TYPES } from '../../models/sacrament-type.model';
import { ToastService } from '@core/services/toast.service';
import { getErrorMessage, isFieldInvalid, markFormGroupTouched } from '@core/validators/form-validation.helper';
import { ModalShellComponent } from '@shared/components/modal-shell/modal-shell.component';

@Component({
  selector: 'app-sacrament-type-form',
  standalone: true,
  imports: [CommonModule, ReactiveFormsModule, ModalShellComponent],
  templateUrl: './sacrament-type-form.component.html',
  styleUrls: ['./sacrament-type-form.component.scss']
})
export class SacramentTypeFormComponent implements OnInit, OnChanges {
  @Input() sacramentType: SacramentType | null = null;
  @Input() isEditMode = false;
  @Output() formClose = new EventEmitter<void>();
  @Output() formSave = new EventEmitter<void>();

  form!: FormGroup;
  loading = false;
  categories = SACRAMENT_CATEGORIES;
  ministerTypes = MINISTER_TYPES;

  constructor(
    private fb: FormBuilder,
    private sacramentTypeService: SacramentTypeService,
    private toastService: ToastService
  ) {}

  ngOnInit(): void {
    this.initForm();
  }

  ngOnChanges(changes: SimpleChanges): void {
    if (changes['sacramentType'] && this.form) {
      this.initForm();
    }
  }

  initForm(): void {
    this.form = this.fb.group({
      name: [this.sacramentType?.name || '', [Validators.required, Validators.maxLength(100)]],
      code: [this.sacramentType?.code || '', [Validators.required, Validators.maxLength(50)]],
      description: [this.sacramentType?.description || ''],
      category: [this.sacramentType?.category || 'other', Validators.required],
      theological_significance: [this.sacramentType?.theological_significance || ''],
      requires_minister: [this.sacramentType?.requires_minister ?? true],
      minister_type: [this.sacramentType?.minister_type || ''],
      repeatable: [this.sacramentType?.repeatable ?? false],
      min_age_years: [this.sacramentType?.min_age_years || null],
      typical_age_years: [this.sacramentType?.typical_age_years || null],
      display_order: [this.sacramentType?.display_order || 1, [Validators.required, Validators.min(1)]],
      active: [this.sacramentType?.active ?? true]
    });
  }

  onSubmit(): void {
    if (this.form.invalid) {
      markFormGroupTouched(this.form);
      return;
    }

    this.loading = true;
    const formData = this.form.value;

    const request$ = this.isEditMode && this.sacramentType
      ? this.sacramentTypeService.updateSacramentType(this.sacramentType.id, formData)
      : this.sacramentTypeService.createSacramentType(formData);

    request$.subscribe({
      next: (response) => {
        if (response.success) {
          this.toastService.success(
            this.isEditMode ? 'Sacrament type updated successfully' : 'Sacrament type created successfully'
          );
          this.formSave.emit();
        }
        this.loading = false;
      },
      error: (error) => {
        console.error('Error saving sacrament type:', error);
        const errorMessage = error.error?.message || 'Failed to save sacrament type';
        this.toastService.error(errorMessage);
        this.loading = false;
      }
    });
  }

  onCancel(): void {
    this.formClose.emit();
  }

  isFieldInvalid(fieldName: string): boolean {
    return isFieldInvalid(fieldName, this.form);
  }

  getFieldError(fieldName: string): string {
    return getErrorMessage(fieldName, this.form);
  }
}


