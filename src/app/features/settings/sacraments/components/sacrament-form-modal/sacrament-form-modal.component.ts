import { Component, EventEmitter, Input, OnInit, OnChanges, SimpleChanges, Output, ChangeDetectorRef, ChangeDetectionStrategy, OnDestroy } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { SacramentService } from '../../services/sacrament.service';
import { Sacrament, SacramentType, SacramentCreateRequest, SacramentUpdateRequest } from '../../models/sacrament.model';
import { ToastService } from '@core/services/toast.service';
import { Store } from '@ngrx/store';
import { AppState } from '@core/store';
import { selectCurrentUser } from '@core/store/auth/auth.selectors';
import { take, takeUntil } from 'rxjs';
import { Subject } from 'rxjs';
import { BCCService } from '@core/services/bcc.service';
import { FamilyService } from '@core/services/family.service';
import { BCC, Family, FamilyMember } from '@core/models/family.model';
import { FamilyFormComponent } from '@features/family-management/components/family-form/family-form';
import { ChurchLeadershipService } from '@core/services/church/church-leadership.service';
import { SacramentFormService, SacramentFormData } from '../../services/sacrament-form.service';
import { 
  SacramentStatus, 
  DEFAULT_SACRAMENT_FORM, 
  SACRAMENT_STATUS_OPTIONS,
  GENDER_OPTIONS,
  DATE_VALIDATION 
} from '../../constants/sacrament.constants';
import { handleApiError } from '../../utils/error-handler.util';
import {
  validateDateNotFuture,
  validateCertificateNumber,
  validateBookNumber,
  validatePageNumber,
  validateTextLength,
  validateRequired
} from '../../utils/validation.util';

@Component({
  selector: 'app-sacrament-form-modal',
  standalone: true,
  imports: [CommonModule, FormsModule, FamilyFormComponent],
  templateUrl: './sacrament-form-modal.component.html',
  styleUrl: './sacrament-form-modal.component.scss',
  changeDetection: ChangeDetectionStrategy.OnPush
})
export class SacramentFormModalComponent implements OnInit, OnChanges, OnDestroy {
  @Input() sacrament: Sacrament | null = null;
  @Output() save = new EventEmitter<void>();
  @Output() cancel = new EventEmitter<void>();

  sacramentTypes: SacramentType[] = [];
  loading = false;
  saving = false;
  isEditMode = false;
  currentTenantId: number | null = null;
  private destroy$ = new Subject<void>();

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
  
  // Family member selection for auto-population
  familyMembers: FamilyMember[] = [];
  selectedMemberId: string | null = null;
  loadingMembers = false;

  // Constants for template
  readonly statusOptions = SACRAMENT_STATUS_OPTIONS;
  readonly genderOptions = GENDER_OPTIONS;

  // Validation state
  fieldErrors: Record<string, string> = {};
  touchedFields: Set<string> = new Set();

  // Form model - initialized from service
  formData: SacramentFormData = this.formService.initializeFormData();

  constructor(
    private readonly sacramentService: SacramentService,
    private readonly toastService: ToastService,
    private readonly store: Store<AppState>,
    private readonly cdr: ChangeDetectorRef,
    private readonly bccService: BCCService,
    private readonly familyService: FamilyService,
    private readonly leadershipService: ChurchLeadershipService,
    private readonly formService: SacramentFormService
  ) {}

  /**
   * Get maximum date for date input (1 day in future)
   */
  getMaxDate(): string {
    return this.formService.getMaxDate();
  }

  /**
   * Handle status change from dropdown
   */
  onStatusChange(value: string | SacramentStatus): void {
    if (value === 'active' || value === SacramentStatus.ACTIVE) {
      this.formData['status'] = SacramentStatus.ACTIVE;
    } else if (value === 'cancelled' || value === SacramentStatus.CANCELLED) {
      this.formData['status'] = SacramentStatus.CANCELLED;
    } else if (value === 'conditional' || value === SacramentStatus.CONDITIONAL) {
      this.formData['status'] = SacramentStatus.CONDITIONAL;
    } else {
      this.formData['status'] = SacramentStatus.ACTIVE;
    }
  }

  ngOnInit(): void {
    this.loadCurrentUser();
    this.loadSacramentTypes();
    this.loadBCCs();
    
    if (this.sacrament) {
      this.isEditMode = true;
      // Fetch full sacrament details to ensure all fields are loaded
      this.fetchFullSacramentData();
    } else {
      // For new sacrament, load primary pastor to prefill minister information
      // Wait for currentTenantId to be loaded before fetching primary pastor
      this.store.select(selectCurrentUser)
        .pipe(take(1), takeUntil(this.destroy$))
        .subscribe({
          next: (user) => {
            if (user && user.tenant_id) {
              this.currentTenantId = user.tenant_id;
              // Load primary pastor after tenant_id is available
              this.loadPrimaryPastor();
            }
            this.cdr.markForCheck();
          }
        });
    }
  }

  ngOnChanges(changes: SimpleChanges): void {
    // Handle sacrament input changes
    if (changes['sacrament']) {
      const sacramentChange = changes['sacrament'];
      
      // When sacrament is provided, we're in edit mode
      if (sacramentChange.currentValue) {
        this.isEditMode = true;
        // Fetch full sacrament details to ensure all fields (including marriage fields) are loaded
        this.fetchFullSacramentData();
      } else if (sacramentChange.previousValue && !sacramentChange.currentValue) {
        // When sacrament is removed, we're in create mode
        this.isEditMode = false;
        this.resetForm();
        // Load primary pastor for new sacrament
        this.loadPrimaryPastor();
      }
    }
  }

  /**
   * Load current user to get tenant_id
   */
  loadCurrentUser(): void {
    this.store.select(selectCurrentUser)
      .pipe(take(1), takeUntil(this.destroy$))
      .subscribe({
        next: (user) => {
          if (user && user.tenant_id) {
            this.currentTenantId = user.tenant_id;
          } else {
            this.toastService.error('You must be associated with a church.');
            this.onCancel();
          }
          this.cdr.markForCheck();
        }
      });
  }

  /**
   * Load sacrament types for dropdown
   */
  loadSacramentTypes(): void {
    this.sacramentService.getSacramentTypes()
      .pipe(takeUntil(this.destroy$))
      .subscribe({
      next: (response) => {
        if (response.success) {
          this.sacramentTypes = response.data;
          // If we have a sacrament loaded, set the type and reload the form data
          // This ensures isMarriage() works correctly and marriage fields are visible
          if (this.sacrament && this.isEditMode && this.sacrament.sacrament_type_id) {
            // Set sacrament_type_id first to trigger isMarriage() check
            this.formData['sacrament_type_id'] = this.sacrament.sacrament_type_id;
            // Force change detection to update *ngIf conditions
            this.cdr.markForCheck();
            // Wait for view to render marriage sections, then load data
            setTimeout(() => {
              this.loadSacramentData();
            }, 100);
          }
          this.cdr.markForCheck();
        }
      },
      error: (error) => {
        console.error('Error loading sacrament types:', error);
        this.toastService.error('Failed to load sacrament types.');
        this.cdr.markForCheck();
      }
    });
  }

  /**
   * Fetch full sacrament details from API when editing
   * This ensures all fields including marriage fields are loaded
   */
  fetchFullSacramentData(): void {
    if (!this.sacrament || !this.sacrament.id) {
      // If no sacrament or ID, load from input if available
      if (this.sacrament) {
        // Wait for types to be loaded before populating form
        this.waitForTypesAndLoadData();
      }
      return;
    }

    this.loading = true;
    this.cdr.markForCheck();
    this.sacramentService.getSacrament(this.sacrament.id)
      .pipe(takeUntil(this.destroy$))
      .subscribe({
        next: (response) => {
          if (response.success && response.data) {
            // Update the sacrament with full details
            this.sacrament = response.data;
            // Wait for types to be loaded and then populate form
            this.waitForTypesAndLoadData();
            this.loading = false;
          } else {
            this.loading = false;
          }
          this.cdr.markForCheck();
        },
        error: (error) => {
          console.error('Error fetching sacrament details:', error);
          this.toastService.error('Failed to load sacrament details.');
          // Fallback to using the provided sacrament data
          this.waitForTypesAndLoadData();
          this.loading = false;
          this.cdr.markForCheck();
        }
      });
  }

  /**
   * Wait for sacrament types to load, then populate form data
   * This ensures isMarriage() works correctly when form is populated
   */
  private waitForTypesAndLoadData(): void {
    // If types are already loaded, set sacrament type first, then populate
    if (this.sacramentTypes.length > 0) {
      // Set sacrament_type_id first to trigger isMarriage() check
      if (this.sacrament && this.sacrament.sacrament_type_id) {
        this.formData['sacrament_type_id'] = this.sacrament.sacrament_type_id;
        // Force change detection to show/hide marriage sections
        this.cdr.detectChanges();
      }
      // Wait for Angular to render the conditional sections, then load data
      setTimeout(() => {
        this.loadSacramentData();
      }, 100);
      return;
    }

    // Otherwise wait for types to load (they should be loading in ngOnInit)
    // Check every 100ms until types are loaded or timeout after 5 seconds
    let attempts = 0;
    const maxAttempts = 50;
    const checkInterval = setInterval(() => {
      attempts++;
      if (this.sacramentTypes.length > 0) {
        clearInterval(checkInterval);
        // Set sacrament_type_id first to trigger isMarriage() check
        if (this.sacrament && this.sacrament.sacrament_type_id) {
          this.formData['sacrament_type_id'] = this.sacrament.sacrament_type_id;
          // Force change detection to show/hide marriage sections
          this.cdr.detectChanges();
        }
        // Wait for Angular to render the conditional sections, then load data
        setTimeout(() => {
          this.loadSacramentData();
        }, 100);
      } else if (attempts >= maxAttempts) {
        clearInterval(checkInterval);
        // Load anyway even if types aren't loaded yet
        console.warn('Sacrament types not loaded after timeout, loading form data anyway');
        this.loadSacramentData();
      }
    }, 100);
  }

  /**
   * Load sacrament data for editing
   * Uses form service to populate form data
   */
  loadSacramentData(): void {
    if (!this.sacrament) return;

    const sacrament = this.sacrament;

    // CRITICAL: Set sacrament_type_id FIRST so isMarriage() works correctly
    // This ensures the *ngIf="isMarriage()" sections are rendered before we populate data
    this.formData['sacrament_type_id'] = sacrament.sacrament_type_id;
    
    // Force change detection to render marriage sections
    this.cdr.detectChanges();
    
    // Use form service to populate all form data
    setTimeout(() => {
      this.formData = this.formService.populateFormFromSacrament(sacrament);
      
      // Set family selection if family_id exists
      if (sacrament.family_id) {
        this.familySelectionType = 'existing';
        this.selectedFamilyId = sacrament.family_id;
        this.selectedBccId = sacrament.bcc_id || null;
        
        // Load families for the BCC if BCC is set
        if (this.selectedBccId) {
          this.loadFamiliesByBCC(this.selectedBccId);
        }
      } else {
        this.familySelectionType = null;
        this.selectedFamilyId = null;
        this.selectedBccId = null;
        this.families = [];
      }
      
      // Force change detection after setting all fields
      this.cdr.detectChanges();
    }, 100);
  }

  /**
   * Format date for HTML date input (YYYY-MM-DD format)
   * Delegates to form service
   */
  private formatDateForInput(dateValue: string | Date | null | undefined): string {
    // This method is kept for backward compatibility but delegates to service
    // The form service now handles date formatting in populateFormFromSacrament
    return '';
  }

  /**
   * Load Primary Pastor from Church Leadership to prefill Minister Information
   * This method loads the Primary Pastor details and prefills the Minister Name and Title fields
   */
  loadPrimaryPastor(): void {
    // Only load if we're creating a new sacrament (not editing)
    if (this.isEditMode || this.sacrament) {
      return;
    }

    // Ensure we have tenant_id before making the API call
    if (!this.currentTenantId) {
      console.warn('Cannot load primary pastor: tenant_id not available yet');
      return;
    }

    this.fetchPrimaryPastor();
  }

  /**
   * Fetch primary pastor from Church Leadership API
   */
  private fetchPrimaryPastor(): void {
    // Load active leaders and find the primary pastor
    this.leadershipService.getLeaders({ active: 1 })
      .pipe(takeUntil(this.destroy$))
      .subscribe({
      next: (response) => {
        if (response.success && response.data && response.data.length > 0) {
          // Priority 1: Find "Primary Pastor" role with is_primary = 1
          // Check for exact match first (case-insensitive)
          let primaryPastor = response.data.find(leader => {
            const roleLower = leader.role?.toLowerCase().trim() || '';
            return leader.is_primary === 1 && 
                   leader.active === 1 &&
                   (roleLower === 'primary pastor' || roleLower === 'pastor' && leader.is_primary === 1);
          });

          // Priority 2: Find any pastor role with is_primary = 1
          if (!primaryPastor) {
            primaryPastor = response.data.find(leader => {
              const roleLower = leader.role?.toLowerCase().trim() || '';
              return leader.is_primary === 1 && 
                     leader.active === 1 &&
                     roleLower.includes('pastor');
            });
          }

          // Priority 3: If no pastor found, use any leader with is_primary = 1
          const primaryLeader = primaryPastor || response.data.find(leader => 
            leader.is_primary === 1 && leader.active === 1
          );

          if (primaryLeader) {
            // Prefill minister information
            // Use full_name for minister_name
            this.formData['minister_name'] = primaryLeader.full_name || '';
            
            // Use title if available, otherwise use role, otherwise empty string
            this.formData['minister_title'] = primaryLeader.title || primaryLeader.role || '';
            
            // Force change detection to update the form
            this.cdr.detectChanges();
            
            console.log('Primary Pastor loaded:', {
              name: this.formData['minister_name'],
              title: this.formData['minister_title']
            });
          } else {
            console.log('No primary pastor found in church leadership');
          }
        } else {
          console.log('No church leaders found or API response was unsuccessful');
        }
      },
      error: (error) => {
        // Log error for debugging but don't show to user
        // The user can still manually enter minister information
        console.warn('Could not load primary pastor information:', error);
        // Optionally, you could show a subtle notification here
      }
    });
  }

  /**
   * Reset form to initial state
   */
  resetForm(): void {
    this.formData = this.formService.initializeFormData();

    this.familySelectionType = 'existing';
    this.selectedBccId = null;
    this.selectedFamilyId = null;
    this.families = [];
    this.showFamilyForm = false;
    this.newlyCreatedFamily = null;
    this.cdr.detectChanges();
  }

  /**
   * Save sacrament (create or update)
   */
  onSave(): void {
    // For Marriage, backend expects recipient_name; synthesize it from groom & bride
    if (this.isMarriage()) {
      const groom = (this.formData['marriage_groom_full_name'] || '').toString().trim();
      const bride = (this.formData['marriage_bride_full_name'] || '').toString().trim();
      if (groom || bride) {
        this.formData['recipient_name'] = [groom, bride].filter(Boolean).join(' & ');
      } else {
        // Fallback to a generic value to satisfy validation; UI still guides user
        this.formData['recipient_name'] = 'Marriage';
      }
    }

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

    const data: SacramentCreateRequest = this.buildRequestPayload();

    this.sacramentService.createSacrament(data)
      .pipe(takeUntil(this.destroy$))
      .subscribe({
        next: (response) => {
          if (response.success) {
            this.toastService.success('Sacrament created successfully.');
            this.save.emit();
          }
          this.saving = false;
          this.cdr.markForCheck();
        },
        error: (error) => {
          console.error('Error creating sacrament:', error);
          this.toastService.error(error.error?.message || 'Failed to create sacrament.');
          this.saving = false;
          this.cdr.markForCheck();
        }
      });
  }

  /**
   * Update existing sacrament
   */
  updateSacrament(): void {
    if (!this.sacrament) return;

    const updateData: SacramentUpdateRequest = {
      id: this.sacrament.id,
      ...this.buildRequestPayload()
    };

    this.sacramentService.updateSacrament(this.sacrament.id, updateData)
      .pipe(takeUntil(this.destroy$))
      .subscribe({
        next: (response) => {
          if (response.success) {
            this.toastService.success('Sacrament updated successfully.');
            this.save.emit();
          }
          this.saving = false;
          this.cdr.markForCheck();
        },
        error: (error) => {
        const errorMessage = handleApiError(error, 'Failed to update sacrament');
        this.toastService.error(errorMessage);
        this.saving = false;
      }
    });
  }

  /**
   * Validate form with comprehensive validation
   */
  validateForm(): boolean {
    this.fieldErrors = {};
    let isValid = true;

    // Validate sacrament type
    const sacramentTypeValidation = validateRequired(this.formData['sacrament_type_id'], 'Sacrament type');
    if (!sacramentTypeValidation.valid) {
      this.fieldErrors['sacrament_type_id'] = sacramentTypeValidation.message || '';
      isValid = false;
    }

    // For Marriage sacraments, validate bride and groom names explicitly
    if (this.isMarriage()) {
      const brideName = (this.formData['marriage_bride_full_name'] || '').toString().trim();
      const groomName = (this.formData['marriage_groom_full_name'] || '').toString().trim();
      
      const brideValidation = validateRequired(brideName, 'Bride\'s full name');
      if (!brideValidation.valid) {
        this.fieldErrors['marriage_bride_full_name'] = brideValidation.message || '';
        isValid = false;
      }
      
      const groomValidation = validateRequired(groomName, 'Groom\'s full name');
      if (!groomValidation.valid) {
        this.fieldErrors['marriage_groom_full_name'] = groomValidation.message || '';
        isValid = false;
      }
    } else {
      // For non-marriage sacraments, validate recipient name
      const recipientValidation = validateRequired(this.formData['recipient_name'], 'Recipient name');
      if (!recipientValidation.valid) {
        this.fieldErrors['recipient_name'] = recipientValidation.message || '';
        isValid = false;
      } else {
        // Validate recipient name length
        const lengthValidation = validateTextLength(
          String(this.formData['recipient_name'] || ''), 
          2, 
          255, 
          'Recipient name'
        );
        if (!lengthValidation.valid) {
          this.fieldErrors['recipient_name'] = lengthValidation.message || '';
          isValid = false;
        }
      }
    }

    // Validate date administered
    const dateValidation = validateRequired(this.formData['date_administered'], 'Date administered');
    if (!dateValidation.valid) {
      this.fieldErrors['date_administered'] = dateValidation.message || '';
      isValid = false;
    } else {
      // Validate date is not in the future
      const futureDateValidation = validateDateNotFuture(
        String(this.formData['date_administered'] || '')
      );
      if (!futureDateValidation.valid) {
        this.fieldErrors['date_administered'] = futureDateValidation.message || '';
        isValid = false;
      }
    }

    // Validate certificate number format
    if (this.formData['certificate_number']) {
      const certValidation = validateCertificateNumber(String(this.formData['certificate_number']));
      if (!certValidation.valid) {
        this.fieldErrors['certificate_number'] = certValidation.message || '';
        isValid = false;
      }
    }

    // Validate book number format
    if (this.formData['book_number']) {
      const bookValidation = validateBookNumber(String(this.formData['book_number']));
      if (!bookValidation.valid) {
        this.fieldErrors['book_number'] = bookValidation.message || '';
        isValid = false;
      }
    }

    // Validate page number format
    if (this.formData['page_number']) {
      const pageValidation = validatePageNumber(String(this.formData['page_number']));
      if (!pageValidation.valid) {
        this.fieldErrors['page_number'] = pageValidation.message || '';
        isValid = false;
      }
    }

    // Validate text field lengths
    const textFields = [
      { key: 'place_administered', name: 'Place administered', max: 255 },
      { key: 'minister_name', name: 'Minister name', max: 255 },
      { key: 'minister_title', name: 'Minister title', max: 50 },
      { key: 'recipient_birth_place', name: 'Place of birth', max: 255 },
      { key: 'father_name', name: 'Father\'s name', max: 255 },
      { key: 'mother_name', name: 'Mother\'s name', max: 255 },
      { key: 'godparent1_name', name: 'Primary godparent', max: 255 },
      { key: 'godparent2_name', name: 'Secondary godparent', max: 255 }
    ];

    textFields.forEach(field => {
      const value = this.formData[field.key as keyof typeof this.formData] as string | undefined;
      if (value) {
        const lengthValidation = validateTextLength(String(value || ''), 0, field.max, field.name);
        if (!lengthValidation.valid) {
          this.fieldErrors[field.key] = lengthValidation.message || '';
          isValid = false;
        }
      }
    });

    // Show first error if validation failed
    if (!isValid) {
      const firstError = Object.values(this.fieldErrors)[0];
      if (firstError) {
        this.toastService.error(firstError);
      }
    }

    return isValid;
  }

  /**
   * Validate a single field
   */
  validateField(fieldName: string, value: any): void {
    this.touchedFields.add(fieldName);
    delete this.fieldErrors[fieldName];

    switch (fieldName) {
      case 'certificate_number':
        if (value) {
          const validation = validateCertificateNumber(String(value || ''));
          if (!validation.valid) {
            this.fieldErrors[fieldName] = validation.message || '';
          }
        }
        break;
      case 'book_number':
        if (value) {
          const validation = validateBookNumber(String(value || ''));
          if (!validation.valid) {
            this.fieldErrors[fieldName] = validation.message || '';
          }
        }
        break;
      case 'page_number':
        if (value) {
          const validation = validatePageNumber(value);
          if (!validation.valid) {
            this.fieldErrors[fieldName] = validation.message || '';
          }
        }
        break;
      case 'date_administered':
        if (value) {
          const validation = validateDateNotFuture(String(value || ''));
          if (!validation.valid) {
            this.fieldErrors[fieldName] = validation.message || '';
          }
        }
        break;
      case 'recipient_name':
        if (!this.isMarriage()) {
          const requiredValidation = validateRequired(String(value || ''), 'Recipient name');
          if (!requiredValidation.valid) {
            this.fieldErrors[fieldName] = requiredValidation.message || '';
          } else if (value) {
            const lengthValidation = validateTextLength(String(value || ''), 2, 255, 'Recipient name');
            if (!lengthValidation.valid) {
              this.fieldErrors[fieldName] = lengthValidation.message || '';
            }
          }
        }
        break;
      case 'marriage_bride_full_name':
      case 'marriage_groom_full_name':
        if (this.isMarriage()) {
          const requiredValidation = validateRequired(String(value || ''), fieldName === 'marriage_bride_full_name' ? 'Bride\'s full name' : 'Groom\'s full name');
          if (!requiredValidation.valid) {
            this.fieldErrors[fieldName] = requiredValidation.message || '';
          }
        }
        break;
    }
  }

  /**
   * Check if field has error
   */
  hasFieldError(fieldName: string): boolean {
    return !!this.fieldErrors[fieldName] && this.touchedFields.has(fieldName);
  }

  /**
   * Get field error message
   */
  getFieldError(fieldName: string): string | null {
    return this.hasFieldError(fieldName) ? this.fieldErrors[fieldName] : null;
  }

  /**
   * Cancel and close modal
   */
  onCancel(): void {
    this.cancel.emit();
  }

  /**
   * Cleanup subscriptions on component destroy
   */
  ngOnDestroy(): void {
    this.destroy$.next();
    this.destroy$.complete();
  }

  /**
   * Get selected sacrament type
   */
  getSelectedSacramentType(): SacramentType | null {
    if (!this.formData['sacrament_type_id']) return null;
    return this.sacramentTypes.find(t => t.id === this.formData['sacrament_type_id']) || null;
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
   * Check if selected sacrament type is Marriage
   */
  isMarriage(): boolean {
    const type = this.getSelectedSacramentType();
    if (!type) return false;
    const code = (type.code || '').toString().toUpperCase().trim();
    const name = (type.name || '').toString().toUpperCase().trim();
    // Support multiple possible identifiers used for marriage
    const marriageCodes = ['MARRIAGE', 'MATRIMONY', 'WEDDING'];
    return marriageCodes.includes(code) || marriageCodes.some(mc => name.includes(mc));
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
    this.bccService.getBCCs({ status: 'active', per_page: 1000 })
      .pipe(takeUntil(this.destroy$))
      .subscribe({
      next: (response) => {
        if (response.success && response.data) {
          this.bccs = response.data;
        }
        this.loadingBCCs = false;
        this.cdr.markForCheck();
      },
      error: (error) => {
        console.error('Error loading BCCs:', error);
        this.toastService.error('Failed to load BCCs.');
        this.loadingBCCs = false;
        this.cdr.markForCheck();
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
    this.familyService.getFamiliesByBCC(bccId)
      .pipe(takeUntil(this.destroy$))
      .subscribe({
        next: (response) => {
          if (response.success && response.data) {
            this.families = response.data;
          } else {
            this.families = [];
          }
          this.loadingFamilies = false;
          this.cdr.markForCheck();
        },
        error: (error) => {
          console.error('Error loading families:', error);
          this.toastService.error('Failed to load families for selected BCC.');
          this.families = [];
          this.loadingFamilies = false;
          this.cdr.markForCheck();
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
    this.formData['family_id'] = null;
    this.formData['bcc_id'] = null;
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
    this.formData['family_id'] = null;
    this.formData['bcc_id'] = null;
    
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
    this.formData['family_id'] = null;
    this.formData['bcc_id'] = this.selectedBccId || null;
    
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
    this.formData['family_id'] = this.selectedFamilyId || null;
    
    // Load family members when a family is selected
    if (this.selectedFamilyId) {
      this.loadFamilyMembers(this.selectedFamilyId);
    } else {
      this.familyMembers = [];
      this.selectedMemberId = null;
    }
    
    this.cdr.detectChanges();
  }

  /**
   * Load family members for the selected family
   */
  loadFamilyMembers(familyId: string): void {
    if (!familyId) {
      this.familyMembers = [];
      return;
    }

    this.loadingMembers = true;
    this.familyService.getFamilyMembers(familyId)
      .pipe(takeUntil(this.destroy$))
      .subscribe({
        next: (response) => {
          if (response.success && response.data) {
            this.familyMembers = response.data.filter(member => member.status === 'active');
          } else {
            this.familyMembers = [];
          }
          this.loadingMembers = false;
          this.cdr.markForCheck();
        },
        error: (error) => {
          console.error('Error loading family members:', error);
          this.familyMembers = [];
          this.loadingMembers = false;
          this.cdr.markForCheck();
        }
      });
  }

  /**
   * Handle family member selection and auto-populate recipient fields
   */
  onMemberSelect(): void {
    if (!this.selectedMemberId || !this.familyMembers.length) {
      return;
    }

    const member = this.familyMembers.find(m => m.id === this.selectedMemberId);
    if (!member) {
      return;
    }

    // Auto-populate recipient information from family member
    // Build full name from first, middle, last names
    const nameParts = [member.first_name, member.middle_name, member.last_name].filter(Boolean);
    this.formData['recipient_name'] = nameParts.join(' ');
    
    // Populate birth date if available
    if (member.date_of_birth) {
      this.formData['recipient_birth_date'] = member.date_of_birth;
    }
    
    // Populate birth place if available (from family address or member notes)
    if (member.family?.city) {
      this.formData['recipient_birth_place'] = member.family.city;
    }
    
    // Populate gender if available
    if (member.gender) {
      this.formData['recipient_gender'] = member.gender;
    }

    // For Baptism, populate godparents if available
    if (this.isBaptism()) {
      if (member.baptism_godparent_primary) {
        this.formData['godparent1_name'] = member.baptism_godparent_primary;
      }
      if (member.baptism_godparent_secondary) {
        this.formData['godparent2_name'] = member.baptism_godparent_secondary;
      }
    }

    // Populate parents if available (from family head or other members)
    // Note: This would require additional logic to find parents in the family
    // For now, we'll leave it as manual entry

    this.cdr.detectChanges();
    this.toastService.success('Recipient information populated from family member.');
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
    this.formData['family_id'] = family.id;
    
    // If family has BCC, set it
    if (family.bcc_id) {
      this.selectedBccId = family.bcc_id;
      this.formData['bcc_id'] = family.bcc_id;
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
   * Copy groom parish details to bride fields
   */
  copyGroomChurchToBride(): void {
    const groomType = (this.formData['marriage_groom_church_type'] || 'home_parish') as 'home_parish' | 'other';
    const groomName = (this.formData['marriage_groom_church_name'] || '').toString();
    const groomAddress = (this.formData['marriage_groom_church_address'] || '').toString();

    this.formData['marriage_bride_church_type'] = groomType;
    this.formData['marriage_bride_church_name'] = groomName;
    this.formData['marriage_bride_church_address'] = groomAddress;

    // Nudge change detection for template-driven form bindings
    this.cdr.detectChanges();
    setTimeout(() => this.cdr.detectChanges(), 0);
  }

  /**
   * Close modal on backdrop click
   */
  onBackdropClick(): void {
    if (!this.saving) {
      // Check if form has been modified
      if (this.hasUnsavedChanges()) {
        if (confirm('You have unsaved changes. Are you sure you want to close? All changes will be lost.')) {
          this.onCancel();
        }
      } else {
        this.onCancel();
      }
    }
  }

  /**
   * Check if form has unsaved changes
   */
  hasUnsavedChanges(): boolean {
    // Check if any form field has been modified
    // This is a simple check - you may want to implement a more sophisticated comparison
    return this.formData['sacrament_type_id'] !== undefined || 
           this.formData['recipient_name'] !== '' ||
           this.formData['date_administered'] !== '';
  }

  /**
   * Prevent event propagation
   */
  onModalClick(event: Event): void {
    event.stopPropagation();
  }

  /**
   * Build request payload compatible with backend schema
   * Uses the form service to build the payload
   */
  private buildRequestPayload(): SacramentCreateRequest {
    if (!this.currentTenantId) {
      throw new Error('Tenant ID is required');
    }

    return this.formService.buildRequestPayload(
      this.formData,
      this.currentTenantId,
      this.formData['family_id'] ? String(this.formData['family_id']) : null,
      this.formData['bcc_id'] ? String(this.formData['bcc_id']) : null
    );
  }
}

