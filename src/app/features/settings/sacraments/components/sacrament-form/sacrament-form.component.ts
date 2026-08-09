import { Component, OnInit, ChangeDetectionStrategy } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { ActivatedRoute, Router } from '@angular/router';
import { SacramentService } from '../../services/sacrament.service';
import { Sacrament, SacramentType, SacramentCreateRequest, SacramentUpdateRequest } from '../../models/sacrament.model';
import { ToastService } from '@core/services/toast.service';
import { Store } from '@ngrx/store';
import { AppState } from '@core/store';
import { selectCurrentUser } from '@core/store/auth/auth.selectors';
import { take } from 'rxjs';
import { SacramentStatus } from '../../constants/sacrament.constants';
import { ButtonComponent } from '@shared/components';
import { ModalShellComponent } from '@shared/components/modal-shell/modal-shell.component';

@Component({
  selector: 'app-sacrament-form',
  standalone: true,
  imports: [CommonModule, FormsModule, ButtonComponent, ModalShellComponent],
  templateUrl: './sacrament-form.component.html',
  changeDetection: ChangeDetectionStrategy.Eager,
  styleUrl: './sacrament-form.component.scss'
})
export class SacramentFormComponent implements OnInit {
  sacramentTypes: SacramentType[] = [];
  loading = false;
  saving = false;
  isEditMode = false;
  sacramentId: number | null = null;
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
    recipient_gender: undefined,
    father_name: '',
    mother_name: '',
    godparent1_name: '',
    godparent2_name: '',
    marriage_bride_full_name: '',
    marriage_bride_father_name: '',
    marriage_bride_mother_name: '',
    marriage_bride_address: '',
    marriage_bride_church_type: 'home_parish',
    marriage_bride_church_name: '',
    marriage_bride_church_address: '',
    marriage_groom_full_name: '',
    marriage_groom_father_name: '',
    marriage_groom_mother_name: '',
    marriage_groom_address: '',
    marriage_groom_church_type: 'home_parish',
    marriage_groom_church_name: '',
    marriage_groom_church_address: '',
    witnesses: '',
    notes: '',
    status: SacramentStatus.ACTIVE
  };

  constructor(
    private sacramentService: SacramentService,
    private toastService: ToastService,
    private router: Router,
    private route: ActivatedRoute,
    private store: Store<AppState>
  ) {}

  ngOnInit(): void {
    this.loadCurrentUser();
    this.loadSacramentTypes();
    this.checkEditMode();
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
          this.router.navigate(['/settings/sacraments']);
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
   * Check if we're in edit mode
   */
  checkEditMode(): void {
    const id = this.route.snapshot.paramMap.get('id');
    if (id) {
      this.isEditMode = true;
      this.sacramentId = parseInt(id, 10);
      this.loadSacrament();
    }
  }

  /**
   * Load sacrament for editing
   */
  loadSacrament(): void {
    if (!this.sacramentId) return;

    this.loading = true;
    this.sacramentService.getSacrament(this.sacramentId).subscribe({
      next: (response) => {
        if (response.success) {
          const sacrament = response.data;
          this.formData = {
            sacrament_type_id: sacrament.sacrament_type_id,
            recipient_name: sacrament.recipient_name,
            date_administered: sacrament.date_administered,
            place_administered: sacrament.place_administered || '',
            minister_name: sacrament.minister_name || '',
            minister_title: sacrament.minister_title || '',
            certificate_number: sacrament.certificate_number || '',
            book_number: sacrament.book_number || '',
            page_number: sacrament.page_number || '',
            recipient_birth_date: sacrament.recipient_birth_date || '',
            recipient_birth_place: sacrament.recipient_birth_place || '',
          recipient_gender: sacrament.recipient_gender || undefined,
            father_name: sacrament.father_name || '',
            mother_name: sacrament.mother_name || '',
            godparent1_name: sacrament.godparent1_name || '',
            godparent2_name: sacrament.godparent2_name || '',
            marriage_bride_full_name: sacrament.marriage_bride_full_name || '',
            marriage_bride_father_name: sacrament.marriage_bride_father_name || '',
            marriage_bride_mother_name: sacrament.marriage_bride_mother_name || '',
            marriage_bride_address: sacrament.marriage_bride_address || '',
            marriage_bride_church_type: sacrament.marriage_bride_church_type || 'home_parish',
            marriage_bride_church_name: sacrament.marriage_bride_church_name || '',
            marriage_bride_church_address: sacrament.marriage_bride_church_address || '',
            marriage_groom_full_name: sacrament.marriage_groom_full_name || '',
            marriage_groom_father_name: sacrament.marriage_groom_father_name || '',
            marriage_groom_mother_name: sacrament.marriage_groom_mother_name || '',
            marriage_groom_address: sacrament.marriage_groom_address || '',
            marriage_groom_church_type: sacrament.marriage_groom_church_type || 'home_parish',
            marriage_groom_church_name: sacrament.marriage_groom_church_name || '',
            marriage_groom_church_address: sacrament.marriage_groom_church_address || '',
            witnesses: sacrament.witnesses || '',
            notes: sacrament.notes || '',
            status: sacrament.status
          };
          if (this.isMarriageSacrament()) {
            this.syncMarriageRecipientName();
          }
        }
        this.loading = false;
      },
      error: (error) => {
        console.error('Error loading sacrament:', error);
        this.toastService.error('Failed to load sacrament.');
        this.loading = false;
        this.router.navigate(['/settings/sacraments']);
      }
    });
  }

  /**
   * Save sacrament (create or update)
   */
  onSave(): void {
    if (this.isMarriageSacrament()) {
      this.syncMarriageRecipientName();
    }
    if (!this.validateForm()) {
      return;
    }

    this.saving = true;

    if (this.isEditMode && this.sacramentId) {
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
          this.toastService.success('Sacrament record created successfully.');
          this.router.navigate(['/settings/sacraments']);
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
    if (!this.sacramentId) return;

    this.sacramentService.updateSacrament(this.sacramentId, this.formData as SacramentUpdateRequest).subscribe({
      next: (response) => {
        if (response.success) {
          this.toastService.success('Sacrament record updated successfully.');
          this.router.navigate(['/settings/sacraments']);
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

    if (this.isMarriageSacrament()) {
      if (!this.formData.marriage_bride_full_name?.trim()) {
        this.toastService.error('Please enter the bride\'s full name.');
        return false;
      }

      if (!this.formData.marriage_groom_full_name?.trim()) {
        this.toastService.error('Please enter the groom\'s full name.');
        return false;
      }
    }

    return true;
  }

  /**
   * Cancel and go back
   */
  onCancel(): void {
    this.router.navigate(['/settings/sacraments']);
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

  isMarriageSacrament(): boolean {
    const type = this.getSelectedSacramentType();
    return type ? type.code === 'MARRIAGE' : false;
  }

  onSacramentTypeChange(): void {
    if (this.isMarriageSacrament()) {
      this.ensureMarriageDefaults();
      this.syncMarriageRecipientName();
    }
  }

  onMarriageNameChange(): void {
    if (this.isMarriageSacrament()) {
      this.syncMarriageRecipientName();
    }
  }

  copyBrideChurchToGroom(): void {
    this.formData.marriage_groom_church_type = this.formData.marriage_bride_church_type || 'home_parish';
    this.formData.marriage_groom_church_name = this.formData.marriage_bride_church_name || '';
    this.formData.marriage_groom_church_address = this.formData.marriage_bride_church_address || '';
  }

  private ensureMarriageDefaults(): void {
    if (!this.formData.marriage_bride_church_type) {
      this.formData.marriage_bride_church_type = 'home_parish';
    }
    if (!this.formData.marriage_groom_church_type) {
      this.formData.marriage_groom_church_type = 'home_parish';
    }
  }

  private syncMarriageRecipientName(): void {
    const bride = (this.formData.marriage_bride_full_name || '').trim();
    const groom = (this.formData.marriage_groom_full_name || '').trim();

    if (bride && groom) {
      this.formData.recipient_name = `${bride} & ${groom}`;
    } else if (bride || groom) {
      this.formData.recipient_name = bride || groom || '';
    } else {
      this.formData.recipient_name = '';
    }
  }
}


