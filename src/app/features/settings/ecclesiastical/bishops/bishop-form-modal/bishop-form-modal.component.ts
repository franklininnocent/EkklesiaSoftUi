import { Component, EventEmitter, Input, Output, OnInit, OnChanges, SimpleChanges, ChangeDetectionStrategy, ChangeDetectorRef, ViewChild } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormBuilder, FormGroup, ReactiveFormsModule, Validators } from '@angular/forms';
import { NgSelectModule } from '@ng-select/ng-select';
import { BishopService, DioceseService, EcclesiasticalTitleService } from '@core/services/ecclesiastical';
import {
  Bishop,
  BishopCreateRequest,
  BishopUpdateRequest,
  Diocese,
  EcclesiasticalTitle,
} from '@core/models/ecclesiastical';
import { ToastService } from '@core/services';
import { AuthService } from '@core/services/auth.service';
import { PhoneInputComponent } from '@shared/components/phone-input/phone-input.component';
import { getErrorMessage, isFieldInvalid, markFormGroupTouched } from '@core/validators/form-validation.helper';
import { ModalShellComponent } from '@shared/components/modal-shell/modal-shell.component';
import {
  BishopPhotoControlComponent,
  BishopPhotoControlState,
} from '@shared/components/bishop-photo-control/bishop-photo-control.component';
import { forkJoin, of, switchMap, map, Observable } from 'rxjs';

@Component({
  selector: 'app-bishop-form-modal',
  standalone: true,
  imports: [
    CommonModule,
    ReactiveFormsModule,
    NgSelectModule,
    PhoneInputComponent,
    ModalShellComponent,
    BishopPhotoControlComponent,
  ],
  templateUrl: './bishop-form-modal.component.html',
  changeDetection: ChangeDetectionStrategy.Eager,
  styleUrl: './bishop-form-modal.component.scss'
})
export class BishopFormModalComponent implements OnInit, OnChanges {
  @Input() show = false;
  @Input() bishop: Bishop | null = null;
  @Output() saved = new EventEmitter<Bishop>();
  @Output() cancelled = new EventEmitter<void>();

  @ViewChild(BishopPhotoControlComponent) photoControl?: BishopPhotoControlComponent;

  bishopForm!: FormGroup;
  isSubmitting = false;
  isEditMode = false;
  loadingDioceses = false;
  canManageImages = false;
  showExternalPhotoUrl = false;
  photoState: BishopPhotoControlState = {
    pendingFile: null,
    removeExisting: false,
    previewUrl: null,
  };

  dioceses: Diocese[] = [];
  titles: EcclesiasticalTitle[] = [];

  statusOptions = [
    { value: 'active', label: 'Active' },
    { value: 'retired', label: 'Retired' },
    { value: 'deceased', label: 'Deceased' },
    { value: 'inactive', label: 'Inactive' }
  ];

  constructor(
    private fb: FormBuilder,
    private bishopService: BishopService,
    private dioceseService: DioceseService,
    private titleService: EcclesiasticalTitleService,
    private toastService: ToastService,
    private authService: AuthService,
    private cdr: ChangeDetectorRef
  ) {}

  ngOnInit(): void {
    this.canManageImages = this.authService.hasEcclesiasticalPermission('bishops.manage_images');
    this.initializeForm();
    this.loadDropdownData();
  }

  ngOnChanges(changes: SimpleChanges): void {
    if (changes['bishop'] && changes['bishop'].currentValue) {
      this.isEditMode = true;
      this.populateForm(changes['bishop'].currentValue);
      this.bishopForm.get('archdiocese_id')?.disable({ emitEvent: false });
    } else if (changes['show'] && changes['show'].currentValue && !this.bishop) {
      this.isEditMode = false;
      this.bishopForm?.reset({
        status: 'active',
        is_current: true
      });
      this.bishopForm?.get('archdiocese_id')?.enable({ emitEvent: false });
      this.showExternalPhotoUrl = false;
      this.photoControl?.reset();
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
  }

  loadDropdownData(): void {
    this.loadingDioceses = true;
    this.dioceseService.getDioceseOptions().subscribe({
      next: (dioceses) => {
        this.dioceses = dioceses;
        this.loadingDioceses = false;
        this.cdr.detectChanges();
      },
      error: (error) => {
        console.error('Error loading dioceses:', error);
        this.dioceses = [];
        this.loadingDioceses = false;
        this.toastService.error('Failed to load dioceses');
        this.cdr.detectChanges();
      }
    });

    this.titleService.getTitleOptions().subscribe({
      next: (titles) => {
        this.titles = titles;
        this.cdr.detectChanges();
      },
      error: (error) => {
        console.error('Error loading ecclesiastical titles:', error);
        this.titles = [];
        this.cdr.detectChanges();
      }
    });
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
      photo_url: bishop.photo_path ? '' : (bishop.photo_url || ''),
      education: bishop.education,
      status: bishop.status,
      is_current: bishop.is_current
    });

    this.showExternalPhotoUrl = !!(!bishop.photo_path && bishop.photo_url);
    this.photoControl?.reset();
  }

  get photoSource(): Bishop | null {
    return this.bishop;
  }

  get bishopDisplayName(): string {
    return this.bishopForm.get('full_name')?.value || this.bishop?.full_name || '';
  }

  onPhotoStateChange(state: BishopPhotoControlState): void {
    this.photoState = state;
  }

  onPhotoError(message: string): void {
    this.toastService.error(message);
  }

  searchDiocese(term: string, item: Diocese): boolean {
    const query = term.trim().toLowerCase();
    if (!query) {
      return true;
    }

    const haystack = `${item.name ?? ''} ${item.country?.name ?? ''}`.toLowerCase();
    return haystack.includes(query);
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

    operation.pipe(
      switchMap((response) => {
        const savedBishop = response.data;
        if (!savedBishop) {
          throw new Error('Bishop save failed');
        }
        return this.syncPhoto(savedBishop.id).pipe(
          switchMap(() => this.bishopService.getBishop(savedBishop.id))
        );
      })
    ).subscribe({
      next: (response) => {
        const message = this.isEditMode ? 'Bishop updated successfully' : 'Bishop created successfully';
        this.toastService.success(message);
        if (response.data) {
          this.saved.emit(response.data);
        }
        this.onCancel();
      },
      error: (error) => {
        console.error('Error saving bishop:', error);
        const message = this.isEditMode ? 'Failed to update bishop' : 'Failed to create bishop';
        this.toastService.error(message);
        this.isSubmitting = false;
        this.cdr.detectChanges();
      }
    });
  }

  private syncPhoto(bishopId: number): Observable<void> {
    const requests: Observable<unknown>[] = [];

    if (this.photoState.pendingFile && this.canManageImages) {
      requests.push(this.bishopService.uploadPhoto(bishopId, this.photoState.pendingFile));
    } else if (this.photoState.removeExisting && this.canManageImages) {
      requests.push(this.bishopService.deletePhoto(bishopId));
    }

    if (requests.length === 0) {
      return of(undefined);
    }

    return forkJoin(requests).pipe(map(() => undefined));
  }

  prepareFormData(): Partial<BishopCreateRequest & BishopUpdateRequest> {
    const formValue = this.bishopForm.getRawValue();

    const data: Record<string, unknown> = {};
    Object.keys(formValue).forEach(key => {
      if (formValue[key] !== '' && formValue[key] !== null && formValue[key] !== undefined) {
        data[key] = formValue[key];
      }
    });

    if (this.isEditMode) {
      delete data['archdiocese_id'];
    }

    if (this.photoState.pendingFile || this.photoState.removeExisting) {
      delete data['photo_url'];
    }

    return data;
  }

  onCancel(): void {
    this.bishopForm.reset({
      status: 'active',
      is_current: true
    });
    this.isSubmitting = false;
    this.isEditMode = false;
    this.showExternalPhotoUrl = false;
    this.photoControl?.reset();
    this.cancelled.emit();
  }

  onBackdropClick(event: MouseEvent): void {
    if (event.target === event.currentTarget && !this.isSubmitting) {
      this.onCancel();
    }
  }

  private formatDateForInput(date: string): string {
    if (!date) return '';
    const isoDate = date.includes('T') ? date.split('T')[0] : date;
    if (/^\d{4}-\d{2}-\d{2}$/.test(isoDate)) {
      return isoDate;
    }
    const d = new Date(date);
    if (Number.isNaN(d.getTime())) {
      return '';
    }
    const year = d.getFullYear();
    const month = String(d.getMonth() + 1).padStart(2, '0');
    const day = String(d.getDate()).padStart(2, '0');
    return `${year}-${month}-${day}`;
  }

  isFieldInvalid(fieldName: string): boolean {
    return isFieldInvalid(fieldName, this.bishopForm);
  }

  getFieldError(fieldName: string): string {
    return getErrorMessage(fieldName, this.bishopForm);
  }

  hasError(fieldName: string): boolean {
    return this.isFieldInvalid(fieldName);
  }

  getErrorMessage(fieldName: string): string {
    return this.getFieldError(fieldName);
  }

  get modalTitle(): string {
    return this.isEditMode ? 'Edit Bishop' : 'Create New Bishop';
  }

  get submitButtonText(): string {
    if (this.isSubmitting) {
      return this.isEditMode ? 'Saving…' : 'Creating…';
    }
    return this.isEditMode ? 'Update' : 'Create';
  }
}
