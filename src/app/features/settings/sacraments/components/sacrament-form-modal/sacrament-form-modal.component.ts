import { Component, EventEmitter, Input, OnInit, Output } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { SacramentService } from '../../services/sacrament.service';
import { Sacrament, SacramentType, SacramentCreateRequest, SacramentUpdateRequest } from '../../models/sacrament.model';
import { ToastService } from '@core/services/toast.service';
import { Store } from '@ngrx/store';
import { AppState } from '@core/store';
import { selectCurrentUser } from '@core/store/auth/auth.selectors';
import { take } from 'rxjs';

@Component({
  selector: 'app-sacrament-form-modal',
  standalone: true,
  imports: [CommonModule, FormsModule],
  templateUrl: './sacrament-form-modal.component.html',
  styleUrl: './sacrament-form-modal.component.scss'
})
export class SacramentFormModalComponent implements OnInit {
  @Input() sacrament: Sacrament | null = null;
  @Output() save = new EventEmitter<void>();
  @Output() cancel = new EventEmitter<void>();

  sacramentTypes: SacramentType[] = [];
  loading = false;
  saving = false;
  isEditMode = false;
  currentTenantId: number | null = null;

  // Form model
  formData: Partial<SacramentCreateRequest | SacramentUpdateRequest> = {
    sacrament_type_id: undefined,
    recipient_name: '',
    date_administered: '',
    place_administered: '',
    minister_name: '',
    minister_title: '',
    certificate_number: '',
    book_number: '',
    page_number: '',
    recipient_birth_date: '',
    recipient_birth_place: '',
    father_name: '',
    mother_name: '',
    godparent1_name: '',
    godparent2_name: '',
    witnesses: '',
    notes: '',
    status: 'active'
  };

  constructor(
    private sacramentService: SacramentService,
    private toastService: ToastService,
    private store: Store<AppState>
  ) {}

  ngOnInit(): void {
    this.loadCurrentUser();
    this.loadSacramentTypes();
    
    if (this.sacrament) {
      this.isEditMode = true;
      this.loadSacramentData();
    }
  }

  /**
   * Load current user to get tenant_id
   */
  loadCurrentUser(): void {
    this.store.select(selectCurrentUser).pipe(take(1)).subscribe({
      next: (user) => {
        if (user && user.tenant_id) {
          this.currentTenantId = user.tenant_id;
        } else {
          this.toastService.error('You must be associated with a church.');
          this.onCancel();
        }
      }
    });
  }

  /**
   * Load sacrament types for dropdown
   */
  loadSacramentTypes(): void {
    this.sacramentService.getSacramentTypes().subscribe({
      next: (response) => {
        if (response.success) {
          this.sacramentTypes = response.data;
        }
      },
      error: (error) => {
        console.error('Error loading sacrament types:', error);
        this.toastService.error('Failed to load sacrament types.');
      }
    });
  }

  /**
   * Load sacrament data for editing
   */
  loadSacramentData(): void {
    if (!this.sacrament) return;

    this.formData = {
      sacrament_type_id: this.sacrament.sacrament_type_id,
      recipient_name: this.sacrament.recipient_name,
      date_administered: this.sacrament.date_administered,
      place_administered: this.sacrament.place_administered || '',
      minister_name: this.sacrament.minister_name || '',
      minister_title: this.sacrament.minister_title || '',
      certificate_number: this.sacrament.certificate_number || '',
      book_number: this.sacrament.book_number || '',
      page_number: this.sacrament.page_number || '',
      recipient_birth_date: this.sacrament.recipient_birth_date || '',
      recipient_birth_place: this.sacrament.recipient_birth_place || '',
      father_name: this.sacrament.father_name || '',
      mother_name: this.sacrament.mother_name || '',
      godparent1_name: this.sacrament.godparent1_name || '',
      godparent2_name: this.sacrament.godparent2_name || '',
      witnesses: this.sacrament.witnesses || '',
      notes: this.sacrament.notes || '',
      status: this.sacrament.status
    };
  }

  /**
   * Save sacrament (create or update)
   */
  onSave(): void {
    if (!this.validateForm()) {
      return;
    }

    this.saving = true;

    if (this.isEditMode && this.sacrament) {
      this.updateSacrament();
    } else {
      this.createSacrament();
    }
  }

  /**
   * Create new sacrament
   */
  createSacrament(): void {
    if (!this.currentTenantId) return;

    const data: SacramentCreateRequest = {
      ...this.formData as SacramentCreateRequest,
      tenant_id: this.currentTenantId
    };

    this.sacramentService.createSacrament(data).subscribe({
      next: (response) => {
        if (response.success) {
          this.toastService.success('Sacrament created successfully.');
          this.save.emit();
        }
        this.saving = false;
      },
      error: (error) => {
        console.error('Error creating sacrament:', error);
        this.toastService.error(error.error?.message || 'Failed to create sacrament.');
        this.saving = false;
      }
    });
  }

  /**
   * Update existing sacrament
   */
  updateSacrament(): void {
    if (!this.sacrament) return;

    this.sacramentService.updateSacrament(this.sacrament.id, this.formData as SacramentUpdateRequest).subscribe({
      next: (response) => {
        if (response.success) {
          this.toastService.success('Sacrament updated successfully.');
          this.save.emit();
        }
        this.saving = false;
      },
      error: (error) => {
        console.error('Error updating sacrament:', error);
        this.toastService.error(error.error?.message || 'Failed to update sacrament.');
        this.saving = false;
      }
    });
  }

  /**
   * Validate form
   */
  validateForm(): boolean {
    if (!this.formData.sacrament_type_id) {
      this.toastService.error('Please select a sacrament type.');
      return false;
    }

    if (!this.formData.recipient_name || this.formData.recipient_name.trim() === '') {
      this.toastService.error('Please enter the recipient name.');
      return false;
    }

    if (!this.formData.date_administered) {
      this.toastService.error('Please enter the date administered.');
      return false;
    }

    return true;
  }

  /**
   * Cancel and close modal
   */
  onCancel(): void {
    this.cancel.emit();
  }

  /**
   * Get selected sacrament type
   */
  getSelectedSacramentType(): SacramentType | null {
    if (!this.formData.sacrament_type_id) return null;
    return this.sacramentTypes.find(t => t.id === this.formData.sacrament_type_id) || null;
  }

  /**
   * Check if sacrament type requires godparents (Baptism, Confirmation)
   */
  requiresGodparents(): boolean {
    const type = this.getSelectedSacramentType();
    return type ? ['BAPTISM', 'CONFIRMATION'].includes(type.code) : false;
  }

  /**
   * Check if sacrament type requires parents (Baptism)
   */
  requiresParents(): boolean {
    const type = this.getSelectedSacramentType();
    return type ? type.code === 'BAPTISM' : false;
  }

  /**
   * Close modal on backdrop click
   */
  onBackdropClick(): void {
    if (!this.saving) {
      this.onCancel();
    }
  }

  /**
   * Prevent event propagation
   */
  onModalClick(event: Event): void {
    event.stopPropagation();
  }
}

