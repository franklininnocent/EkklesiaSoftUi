import { Component, EventEmitter, Input, Output, OnInit, OnChanges, SimpleChanges, ViewChild, ElementRef, AfterViewInit, ChangeDetectionStrategy } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormBuilder, FormGroup, ReactiveFormsModule, Validators } from '@angular/forms';
import { DioceseService } from '@core/services/ecclesiastical';
import { GeographyService, DenominationService } from '@core/services';
import { Diocese, DioceseCreateRequest, DioceseUpdateRequest } from '@core/models/ecclesiastical';
import { ToastService } from '@core/services';
import { PhoneInputComponent } from '@shared/components/phone-input/phone-input.component';
import { getErrorMessage, isFieldInvalid, markFormGroupTouched } from '@core/validators/form-validation.helper';
import { ModalShellComponent } from '@shared/components/modal-shell/modal-shell.component';

@Component({
  selector: 'app-diocese-form-modal',
  standalone: true,
  imports: [CommonModule, ReactiveFormsModule, PhoneInputComponent, ModalShellComponent],
  templateUrl: './diocese-form-modal.component.html',
  changeDetection: ChangeDetectionStrategy.Eager,
  styleUrl: './diocese-form-modal.component.scss'
})
export class DioceseFormModalComponent implements OnInit, OnChanges, AfterViewInit {
  @Input() show = false;
  @Input() diocese: Diocese | null = null; // For edit mode
  @Output() saved = new EventEmitter<Diocese>();
  @Output() cancelled = new EventEmitter<void>();

  @ViewChild('firstInput') firstInput?: ElementRef;

  dioceseForm!: FormGroup;
  isSubmitting = false;
  isEditMode = false;
  showValidationErrors = false;

  // Dropdown data
  countries: any[] = [];
  denominations: any[] = [];
  filteredStates: any[] = [];

  constructor(
    private fb: FormBuilder,
    private dioceseService: DioceseService,
    private geographyService: GeographyService,
    private denominationService: DenominationService,
    private toastService: ToastService
  ) {}

  ngOnInit(): void {
    this.initializeForm();
    this.loadDropdownData();
  }

  ngOnChanges(changes: SimpleChanges): void {
    if (changes['diocese'] && changes['diocese'].currentValue) {
      this.isEditMode = true;
      this.populateForm(changes['diocese'].currentValue);
    } else if (changes['show'] && changes['show'].currentValue && !this.diocese) {
      this.isEditMode = false;
      this.dioceseForm?.reset();
      this.showValidationErrors = false;
    }
    
    // Auto-focus when modal is shown
    if (changes['show'] && changes['show'].currentValue) {
      this.autoFocus();
    }
  }

  ngAfterViewInit(): void {
    if (this.show) {
      this.autoFocus();
    }
  }

  /**
   * Auto-focus the first input field when modal opens
   */
  private autoFocus(): void {
    setTimeout(() => {
      if (this.firstInput?.nativeElement) {
        this.firstInput.nativeElement.focus();
      }
    }, 100);
  }

  initializeForm(): void {
    this.dioceseForm = this.fb.group({
      name: ['', [Validators.required, Validators.maxLength(255)]],
      code: ['', [Validators.maxLength(50)]],
      denomination_id: [null, [Validators.required]],
      country_id: [null, [Validators.required]],
      state_id: [null],
      is_archdiocese: [false],
      website: ['', [Validators.maxLength(255)]],
      address_line1: ['', [Validators.maxLength(255)]],
      city: ['', [Validators.maxLength(100)]],
      postal_code: ['', [Validators.maxLength(20)]],
      phone: ['', [Validators.maxLength(15), Validators.pattern(/^[0-9]*$/)]],
      email: ['', [Validators.email, Validators.maxLength(255)]],
      established_date: [''],
      active: [true]
    });

    // Watch country changes to update states
    this.dioceseForm.get('country_id')?.valueChanges.subscribe(countryId => {
      this.onCountryChange(countryId);
    });
  }

  loadDropdownData(): void {
    // Load countries
    this.geographyService.getCountries().subscribe({
      next: (response) => {
        this.countries = response.data || [];
      },
      error: (error) => {
        console.error('Error loading countries:', error);
        this.toastService.error('Failed to load countries');
      }
    });

    // Load denominations
    this.denominationService.getDenominations().subscribe({
      next: (response) => {
        this.denominations = response.data || [];
      },
      error: (error) => {
        console.error('Error loading denominations:', error);
        this.toastService.error('Failed to load denominations');
      }
    });
  }

  populateForm(diocese: Diocese): void {
    this.dioceseForm.patchValue({
      name: diocese.name,
      code: diocese.code,
      denomination_id: diocese.denomination_id,
      country_id: diocese.country_id,
      state_id: diocese.state_id,
      is_archdiocese: diocese.is_archdiocese,
      website: diocese.website,
      address_line1: diocese.address_line1,
      city: diocese.city,
      postal_code: diocese.postal_code,
      phone: diocese.phone,
      email: diocese.email,
      established_date: diocese.established_date ? this.formatDateForInput(diocese.established_date) : '',
      active: diocese.active
    });

    // Trigger country change to load states
    if (diocese.country_id) {
      this.onCountryChange(diocese.country_id);
    }
  }

  onCountryChange(countryId: number): void {
    if (countryId) {
      // Load states for selected country
      this.geographyService.getStatesByCountry(countryId).subscribe({
        next: (response) => {
          this.filteredStates = response.data || [];
          
          // If current state is not in filtered states, clear it
          const currentStateId = this.dioceseForm.get('state_id')?.value;
          if (currentStateId && !this.filteredStates.find(s => s.id === currentStateId)) {
            this.dioceseForm.patchValue({ state_id: null });
          }
        },
        error: (error) => {
          console.error('Error loading states:', error);
          this.filteredStates = [];
        }
      });
    } else {
      this.filteredStates = [];
      this.dioceseForm.patchValue({ state_id: null });
    }
  }

  onSubmit(): void {
    if (!this.dioceseForm.valid || this.isSubmitting) {
      this.showValidationErrors = true;
      markFormGroupTouched(this.dioceseForm);
      return;
    }

    this.isSubmitting = true;
    this.showValidationErrors = false;
    const formData = this.prepareFormData();

    const operation = this.isEditMode
      ? this.dioceseService.updateDiocese(this.diocese!.id, formData as DioceseUpdateRequest)
      : this.dioceseService.createDiocese(formData as DioceseCreateRequest);

    operation.subscribe({
      next: (response) => {
        // Clear cache after successful create/update
        this.dioceseService.clearCache();
        const message = this.isEditMode ? 'Diocese updated successfully' : 'Diocese created successfully';
        this.toastService.success(message);
        this.saved.emit(response.data);
        this.onCancel();
      },
      error: (error) => {
        console.error('Error saving diocese:', error);
        const message = this.isEditMode ? 'Failed to update diocese' : 'Failed to create diocese';
        this.toastService.error(message);
        this.isSubmitting = false;
        this.showValidationErrors = true;
      }
    });
  }

  prepareFormData(): Partial<DioceseCreateRequest & DioceseUpdateRequest> {
    const formValue = this.dioceseForm.value;
    
    // Remove empty strings and null values
    const data: any = {};
    Object.keys(formValue).forEach(key => {
      if (formValue[key] !== '' && formValue[key] !== null) {
        data[key] = formValue[key];
      }
    });

    return data;
  }

  onCancel(): void {
    this.dioceseForm.reset();
    this.isSubmitting = false;
    this.isEditMode = false;
    this.showValidationErrors = false;
    this.cancelled.emit();
  }

  onBackdropClick(event: MouseEvent): void {
    if (event.target === event.currentTarget && !this.isSubmitting) {
      this.onCancel();
    }
  }

  private formatDateForInput(date: string): string {
    if (!date) return '';
    // Convert to YYYY-MM-DD format for input type="date"
    const d = new Date(date);
    return d.toISOString().split('T')[0];
  }

  // Validation helpers using standardized helper
  isFieldInvalid(fieldName: string): boolean {
    return isFieldInvalid(fieldName, this.dioceseForm);
  }

  getFieldError(fieldName: string): string {
    return getErrorMessage(fieldName, this.dioceseForm);
  }

  // Alias for template compatibility
  hasError(fieldName: string): boolean {
    return this.isFieldInvalid(fieldName);
  }

  getErrorMessage(fieldName: string): string {
    return this.getFieldError(fieldName);
  }

  get modalTitle(): string {
    return this.isEditMode ? 'Edit Diocese' : 'Create New Diocese';
  }

  get submitButtonText(): string {
    return this.isEditMode ? 'Update' : 'Create';
  }
}

