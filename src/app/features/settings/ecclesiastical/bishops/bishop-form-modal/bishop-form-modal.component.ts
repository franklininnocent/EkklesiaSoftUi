import { Component, EventEmitter, Input, Output, OnInit, OnChanges, SimpleChanges, ViewChild, ElementRef, AfterViewInit, ChangeDetectionStrategy } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormBuilder, FormGroup, ReactiveFormsModule, Validators } from '@angular/forms';
import { BishopService, DioceseService } from '@core/services/ecclesiastical';
import { Bishop, BishopCreateRequest, BishopUpdateRequest } from '@core/models/ecclesiastical';
import { ToastService } from '@core/services';
import { PhoneInputComponent } from '@shared/components/phone-input/phone-input.component';
import { getErrorMessage, isFieldInvalid, markFormGroupTouched } from '@core/validators/form-validation.helper';
import { ModalShellComponent } from '@shared/components/modal-shell/modal-shell.component';

@Component({
  selector: 'app-bishop-form-modal',
  standalone: true,
  imports: [CommonModule, ReactiveFormsModule, PhoneInputComponent, ModalShellComponent],
  templateUrl: './bishop-form-modal.component.html',
  changeDetection: ChangeDetectionStrategy.Eager,
  styleUrl: './bishop-form-modal.component.scss'
})
export class BishopFormModalComponent implements OnInit, OnChanges {
  @Input() show = false;
  @Input() bishop: Bishop | null = null; // For edit mode
  @Output() saved = new EventEmitter<Bishop>();
  @Output() cancelled = new EventEmitter<void>();

  bishopForm!: FormGroup;
  isSubmitting = false;
  isEditMode = false;

  // Dropdown data
  dioceses: any[] = [];
  titles: any[] = [];

  // Status options
  statusOptions = [
    { value: 'active', label: 'Active' },
    { value: 'retired', label: 'Retired' },
    { value: 'deceased', label: 'Deceased' },
    { value: 'inactive', label: 'Inactive' }
  ];

  // Photo preview
  photoPreviewUrl: string | null = null;

  constructor(
    private fb: FormBuilder,
    private bishopService: BishopService,
    private dioceseService: DioceseService,
    private toastService: ToastService
  ) {}

  ngOnInit(): void {
    this.initializeForm();
    this.loadDropdownData();
  }

  ngOnChanges(changes: SimpleChanges): void {
    if (changes['bishop'] && changes['bishop'].currentValue) {
      this.isEditMode = true;
      this.populateForm(changes['bishop'].currentValue);
    } else if (changes['show'] && changes['show'].currentValue && !this.bishop) {
      this.isEditMode = false;
      this.bishopForm?.reset({
        status: 'active',
        is_current: true
      });
      this.photoPreviewUrl = null;
    }
  }

  initializeForm(): void {
    this.bishopForm = this.fb.group({
      full_name: ['', [Validators.required, Validators.maxLength(255)]],
      given_name: ['', [Validators.maxLength(100)]],
      family_name: ['', [Validators.maxLength(100)]],
      religious_name: ['', [Validators.maxLength(100)]],
      archdiocese_id: [null, [Validators.required]],
      ecclesiastical_title_id: [null],
      appointed_date: [''],
      ordained_priest_date: [''],
      ordained_bishop_date: [''],
      date_of_birth: [''],
      email: ['', [Validators.email, Validators.maxLength(255)]],
      phone: ['', [Validators.maxLength(15), Validators.pattern(/^[0-9]*$/)]],
      photo_url: ['', [Validators.maxLength(500)]],
      education: [''],
      status: ['active', [Validators.required]],
      is_current: [true]
    });

    // Watch photo_url changes for preview
    this.bishopForm.get('photo_url')?.valueChanges.subscribe(url => {
      this.updatePhotoPreview(url);
    });
  }

  loadDropdownData(): void {
    // Load dioceses
    this.dioceseService.getDioceses().subscribe({
      next: (response) => {
        this.dioceses = response.data?.data || [];
      },
      error: (error) => {
        console.error('Error loading dioceses:', error);
        this.toastService.error('Failed to load dioceses');
      }
    });

    // Load ecclesiastical titles (hardcoded for now - would come from API)
    this.titles = [
      { id: 1, name: 'Archbishop' },
      { id: 2, name: 'Bishop' },
      { id: 3, name: 'Cardinal' },
      { id: 4, name: 'Auxiliary Bishop' },
      { id: 5, name: 'Emeritus Archbishop' },
      { id: 6, name: 'Emeritus Bishop' },
      { id: 7, name: 'Apostolic Administrator' },
      { id: 8, name: 'Coadjutor Bishop' }
    ];
  }

  populateForm(bishop: Bishop): void {
    this.bishopForm.patchValue({
      full_name: bishop.full_name,
      given_name: bishop.given_name,
      family_name: bishop.family_name,
      religious_name: bishop.religious_name,
      archdiocese_id: bishop.archdiocese_id,
      ecclesiastical_title_id: bishop.ecclesiastical_title_id,
      appointed_date: bishop.appointed_date ? this.formatDateForInput(bishop.appointed_date) : '',
      ordained_priest_date: bishop.ordained_priest_date ? this.formatDateForInput(bishop.ordained_priest_date) : '',
      ordained_bishop_date: bishop.ordained_bishop_date ? this.formatDateForInput(bishop.ordained_bishop_date) : '',
      date_of_birth: bishop.date_of_birth ? this.formatDateForInput(bishop.date_of_birth) : '',
      email: bishop.email,
      phone: bishop.phone,
      photo_url: bishop.photo_url,
      education: bishop.education,
      status: bishop.status,
      is_current: bishop.is_current
    });

    // Update photo preview
    if (bishop.photo_url) {
      this.updatePhotoPreview(bishop.photo_url);
    }
  }

  updatePhotoPreview(url: string): void {
    if (url && this.isValidUrl(url)) {
      this.photoPreviewUrl = url;
    } else {
      this.photoPreviewUrl = null;
    }
  }

  isValidUrl(url: string): boolean {
    try {
      new URL(url);
      return true;
    } catch {
      return false;
    }
  }

  onSubmit(): void {
    if (!this.bishopForm.valid || this.isSubmitting) {
      markFormGroupTouched(this.bishopForm);
      return;
    }

    this.isSubmitting = true;
    const formData = this.prepareFormData();

    const operation = this.isEditMode
      ? this.bishopService.updateBishop(this.bishop!.id, formData as BishopUpdateRequest)
      : this.bishopService.createBishop(formData as BishopCreateRequest);

    operation.subscribe({
      next: (response) => {
        const message = this.isEditMode ? 'Bishop updated successfully' : 'Bishop created successfully';
        this.toastService.success(message);
        this.saved.emit(response.data);
        this.onCancel();
      },
      error: (error) => {
        console.error('Error saving bishop:', error);
        const message = this.isEditMode ? 'Failed to update bishop' : 'Failed to create bishop';
        this.toastService.error(message);
        this.isSubmitting = false;
      }
    });
  }

  prepareFormData(): Partial<BishopCreateRequest & BishopUpdateRequest> {
    const formValue = this.bishopForm.value;
    
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
    this.bishopForm.reset({
      status: 'active',
      is_current: true
    });
    this.isSubmitting = false;
    this.isEditMode = false;
    this.photoPreviewUrl = null;
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

  // Validation helpers using helper utility
  isFieldInvalid(fieldName: string): boolean {
    return isFieldInvalid(fieldName, this.bishopForm);
  }

  getFieldError(fieldName: string): string {
    return getErrorMessage(fieldName, this.bishopForm);
  }

  // Alias for template compatibility
  hasError(fieldName: string): boolean {
    return this.isFieldInvalid(fieldName);
  }

  getErrorMessage(fieldName: string): string {
    return this.getFieldError(fieldName);
  }

  private getFieldLabel(fieldName: string): string {
    const labels: Record<string, string> = {
      full_name: 'Full Name',
      given_name: 'Given Name',
      family_name: 'Family Name',
      religious_name: 'Religious Name',
      archdiocese_id: 'Diocese/Archdiocese',
      ecclesiastical_title_id: 'Ecclesiastical Title',
      appointed_date: 'Appointed Date',
      ordained_priest_date: 'Ordained Priest Date',
      ordained_bishop_date: 'Ordained Bishop Date',
      date_of_birth: 'Date of Birth',
      email: 'Email',
      phone: 'Phone',
      photo_url: 'Photo URL',
      education: 'Education',
      status: 'Status'
    };
    return labels[fieldName] || fieldName;
  }

  get modalTitle(): string {
    return this.isEditMode ? 'Edit Bishop' : 'Create New Bishop';
  }

  get submitButtonText(): string {
    return this.isEditMode ? 'Update' : 'Create';
  }

  getInitials(): string {
    const fullName = this.bishopForm.get('full_name')?.value || '';
    const parts = fullName.split(' ');
    if (parts.length >= 2) {
      return `${parts[0].charAt(0)}${parts[parts.length - 1].charAt(0)}`.toUpperCase();
    }
    return fullName.substring(0, 2).toUpperCase();
  }
}

