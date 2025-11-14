import { Component, EventEmitter, Input, OnInit, Output, ChangeDetectorRef } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { SacramentService } from '../../services/sacrament.service';
import { Sacrament, SacramentType, SacramentCreateRequest, SacramentUpdateRequest } from '../../models/sacrament.model';
import { ToastService } from '@core/services/toast.service';
import { Store } from '@ngrx/store';
import { AppState } from '@core/store';
import { selectCurrentUser } from '@core/store/auth/auth.selectors';
import { take } from 'rxjs';
import { BCCService } from '@core/services/bcc.service';
import { FamilyService } from '@core/services/family.service';
import { BCC, Family } from '@core/models/family.model';
import { FamilyFormComponent } from '@features/family-management/components/family-form/family-form';

@Component({
  selector: 'app-sacrament-form-modal',
  standalone: true,
  imports: [CommonModule, FormsModule, FamilyFormComponent],
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

  // Family/BCC selection properties
  familySelectionType: 'new' | 'existing' | null = 'existing';
  bccs: BCC[] = [];
  families: Family[] = [];
  selectedBccId: string | null = null;
  selectedFamilyId: string | null = null;
  loadingBCCs = false;
  loadingFamilies = false;
  showFamilyForm = false;
  newlyCreatedFamily: Family | null = null;

  // Form model
  formData: Partial<SacramentCreateRequest | SacramentUpdateRequest> = {
    sacrament_type_id: undefined,
    family_id: null,
    bcc_id: null,
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
    witnesses: '',
    notes: '',
    status: 'active'
  };

  constructor(
    private sacramentService: SacramentService,
    private toastService: ToastService,
    private store: Store<AppState>,
    private cdr: ChangeDetectorRef,
    private bccService: BCCService,
    private familyService: FamilyService
  ) {}

  ngOnInit(): void {
    this.loadCurrentUser();
    this.loadSacramentTypes();
    this.loadBCCs();
    
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
      family_id: this.sacrament.family_id || null,
      bcc_id: this.sacrament.bcc_id || null,
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
      recipient_gender: this.sacrament.recipient_gender || undefined,
      father_name: this.sacrament.father_name || '',
      mother_name: this.sacrament.mother_name || '',
      godparent1_name: this.sacrament.godparent1_name || '',
      godparent2_name: this.sacrament.godparent2_name || '',
      witnesses: this.sacrament.witnesses || '',
      notes: this.sacrament.notes || '',
      status: this.sacrament.status
    };

    // Set family selection if family_id exists
    if (this.sacrament.family_id) {
      this.familySelectionType = 'existing';
      this.selectedFamilyId = this.sacrament.family_id;
      this.selectedBccId = this.sacrament.bcc_id || null;
      
      // Load families for the BCC if BCC is set
      if (this.selectedBccId) {
        this.loadFamiliesByBCC(this.selectedBccId);
      }
    }
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
      tenant_id: this.currentTenantId,
      family_id: this.formData.family_id || null,
      bcc_id: this.formData.bcc_id || null
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

    const updateData: SacramentUpdateRequest = {
      ...this.formData as SacramentUpdateRequest,
      id: this.sacrament.id,
      family_id: this.formData.family_id || null,
      bcc_id: this.formData.bcc_id || null
    };

    this.sacramentService.updateSacrament(this.sacrament.id, updateData).subscribe({
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
    if (!type) return false;
    const code = type.code?.toUpperCase();
    return ['BAPTISM', 'CONFIRMATION'].includes(code);
  }

  /**
   * Check if sacrament type requires parents (Baptism)
   */
  requiresParents(): boolean {
    const type = this.getSelectedSacramentType();
    if (!type) return false;
    return type.code?.toUpperCase() === 'BAPTISM';
  }

  /**
   * Check if selected sacrament type is Baptism (case-insensitive)
   */
  isBaptism(): boolean {
    const type = this.getSelectedSacramentType();
    if (!type || !type.code) return false;
    const code = type.code.toUpperCase().trim();
    // Handle both 'BAPTISM' and 'baptism' codes
    return code === 'BAPTISM';
  }

  /**
   * Handle sacrament type change to trigger UI updates
   */
  onSacramentTypeChange(): void {
    // Force change detection to update conditional fields
    const selectedType = this.getSelectedSacramentType();
    if (selectedType) {
      console.log('Selected sacrament type:', selectedType.name, 'Code:', selectedType.code);
      console.log('Is Baptism?', this.isBaptism());
    }
    this.cdr.detectChanges();
  }

  /**
   * Load all active BCCs
   */
  loadBCCs(): void {
    this.loadingBCCs = true;
    this.bccService.getBCCs({ status: 'active', per_page: 1000 }).subscribe({
      next: (response) => {
        if (response.success && response.data) {
          this.bccs = response.data;
        }
        this.loadingBCCs = false;
      },
      error: (error) => {
        console.error('Error loading BCCs:', error);
        this.toastService.error('Failed to load BCCs.');
        this.loadingBCCs = false;
      }
    });
  }

  /**
   * Load families by selected BCC
   */
  loadFamiliesByBCC(bccId: string): void {
    if (!bccId) {
      this.families = [];
      return;
    }

    this.loadingFamilies = true;
    this.familyService.getFamiliesByBCC(bccId).subscribe({
      next: (response) => {
        if (response.success && response.data) {
          this.families = response.data;
        } else {
          this.families = [];
        }
        this.loadingFamilies = false;
      },
      error: (error) => {
        console.error('Error loading families:', error);
        this.toastService.error('Failed to load families for selected BCC.');
        this.families = [];
        this.loadingFamilies = false;
      }
    });
  }


  /**
   * Clear family selection (No Family Association)
   */
  clearFamilySelection(): void {
    this.familySelectionType = null;
    this.selectedBccId = null;
    this.selectedFamilyId = null;
    this.families = [];
    this.showFamilyForm = false;
    this.newlyCreatedFamily = null;
    this.formData.family_id = null;
    this.formData.bcc_id = null;
    this.cdr.detectChanges();
  }

  /**
   * Handle family selection type change
   */
  onFamilySelectionTypeChange(type: 'new' | 'existing' | null): void {
    if (type === null) {
      this.clearFamilySelection();
      return;
    }

    this.familySelectionType = type;
    this.selectedBccId = null;
    this.selectedFamilyId = null;
    this.families = [];
    this.showFamilyForm = false;
    this.newlyCreatedFamily = null;
    
    // Clear form data
    this.formData.family_id = null;
    this.formData.bcc_id = null;
    
    if (type === 'new') {
      this.showFamilyForm = true;
    }
    
    this.cdr.detectChanges();
  }

  /**
   * Handle BCC selection change
   */
  onBCCChange(): void {
    this.selectedFamilyId = null;
    this.formData.family_id = null;
    this.formData.bcc_id = this.selectedBccId || null;
    
    if (this.selectedBccId) {
      this.loadFamiliesByBCC(this.selectedBccId);
    } else {
      this.families = [];
    }
    
    this.cdr.detectChanges();
  }

  /**
   * Handle family selection change
   */
  onFamilyChange(): void {
    this.formData.family_id = this.selectedFamilyId || null;
    this.cdr.detectChanges();
  }

  /**
   * Handle new family creation completion
   */
  onFamilyCreated(response: any): void {
    // Extract family from response (could be direct Family or ApiResponse<Family>)
    const family: Family = response?.data || response;
    
    if (!family || !family.id) {
      this.toastService.error('Failed to get created family information.');
      return;
    }
    
    this.newlyCreatedFamily = family;
    this.showFamilyForm = false;
    this.selectedFamilyId = family.id;
    this.formData.family_id = family.id;
    
    // If family has BCC, set it
    if (family.bcc_id) {
      this.selectedBccId = family.bcc_id;
      this.formData.bcc_id = family.bcc_id;
      this.loadFamiliesByBCC(family.bcc_id);
    }
    
    this.toastService.success('Family created successfully. You can now proceed with sacrament details.');
    this.cdr.detectChanges();
  }

  /**
   * Cancel family form
   */
  onFamilyFormCancel(): void {
    this.showFamilyForm = false;
    this.familySelectionType = null;
    this.cdr.detectChanges();
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

