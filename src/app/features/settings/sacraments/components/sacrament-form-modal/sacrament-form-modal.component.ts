import { Component, EventEmitter, Input, OnInit, OnChanges, SimpleChanges, Output, ChangeDetectorRef, ChangeDetectionStrategy, OnDestroy } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { NgSelectModule } from '@ng-select/ng-select';
import { HttpErrorResponse } from '@angular/common/http';
import { SacramentService } from '../../services/sacrament.service';
import { Sacrament, SacramentType, SacramentCreateRequest, SacramentUpdateRequest } from '../../models/sacrament.model';
import { ToastService } from '@core/services/toast.service';
import { AuthService } from '@core/services/auth.service';
import { Store } from '@ngrx/store';
import { AppState } from '@core/store';
import { selectCurrentUser } from '@core/store/auth/auth.selectors';
import { take, takeUntil } from 'rxjs';
import { Subject } from 'rxjs';
import { Router } from '@angular/router';
import { BCCService } from '@core/services/bcc.service';
import { FamilyService } from '@core/services/family.service';
import { BCC, Family, FamilyMember } from '@core/models/family.model';
import { FamilyFormComponent } from '@features/family-management/components/family-form/family-form';
import { ParishPersonService, ParishPerson, PersonMatch } from '../../services/person.service';
import { ChurchLeadershipService } from '@core/services/church/church-leadership.service';
import { TenantService } from '@core/services/tenant.service';
import { SacramentFormService, SacramentFormData } from '../../services/sacrament-form.service';
import { 
  SacramentStatus, 
  DEFAULT_SACRAMENT_FORM, 
  SACRAMENT_STATUS_OPTIONS,
  GENDER_OPTIONS,
  DATE_VALIDATION 
} from '../../constants/sacrament.constants';
import { handleApiError } from '../../utils/error-handler.util';
import { sacramentTypesForSelector } from '../../utils/sacrament-type-availability.util';
import {
  validateDateNotFuture,
  validateCertificateNumber,
  validateBookNumber,
  validatePageNumber,
  validateTextLength,
  validateRequired
} from '../../utils/validation.util';
import { ModalShellComponent } from '@shared/components/modal-shell/modal-shell.component';
import { SacramentDefinitionService } from '../../services/sacrament-definition.service';
import { SacramentWorkflowResolver } from '../../services/sacrament-workflow-resolver.service';
import {
  SacramentParticipantDraft,
  SacramentWorkflowPlan,
  SacramentWorkflowSectionKey,
} from '../../models/sacrament-definition.model';
import { ParticipantSourceControlComponent } from '../shared/participant-source-control/participant-source-control.component';
import {
  ChurchAffiliationControlComponent,
  ChurchAffiliationValue,
} from '../shared/church-affiliation-control/church-affiliation-control.component';
import { MinisterPickerComponent } from '../shared/minister-picker/minister-picker.component';
import { SacramentReviewPanelComponent } from '../shared/sacrament-review-panel/sacrament-review-panel.component';
import { SacramentPersonContextService } from '../../services/sacrament-person-context.service';
import { SacramentContextResponse } from '../../models/sacrament-context.model';
import { PersonContextSummaryComponent } from '../shared/person-context-summary/person-context-summary.component';
import { SacramentConflictPanelComponent } from '../shared/sacrament-conflict-panel/sacrament-conflict-panel.component';
import { MissingFieldsSummaryComponent } from '../shared/missing-fields-summary/missing-fields-summary.component';
import { CfFieldProvenanceComponent } from '../shared/cf-field-provenance/cf-field-provenance.component';
import { SacramentEvidenceSummaryComponent } from '../shared/sacrament-evidence-summary/sacrament-evidence-summary.component';
import {
  MarriagePartyFieldErrors,
  MarriagePartyPanelComponent,
} from '../shared/marriage-party-panel/marriage-party-panel.component';

@Component({
  selector: 'app-sacrament-form-modal',
  standalone: true,
  imports: [
    CommonModule,
    FormsModule,
    NgSelectModule,
    FamilyFormComponent,
    ModalShellComponent,
    ParticipantSourceControlComponent,
    ChurchAffiliationControlComponent,
    MinisterPickerComponent,
    SacramentReviewPanelComponent,
    PersonContextSummaryComponent,
    SacramentConflictPanelComponent,
    MissingFieldsSummaryComponent,
    CfFieldProvenanceComponent,
    SacramentEvidenceSummaryComponent,
    MarriagePartyPanelComponent,
  ],
  templateUrl: './sacrament-form-modal.component.html',
  styleUrl: './sacrament-form-modal.component.scss',
  changeDetection: ChangeDetectionStrategy.OnPush
})
export class SacramentFormModalComponent implements OnInit, OnChanges, OnDestroy {
  @Input() sacrament: Sacrament | null = null;
  /** When set with edit mode, save uses correct API (historical correction + audit). */
  @Input() correctionReason: string | null = null;
  @Output() save = new EventEmitter<void>();
  /** Emitted after Save and Add Another — refresh list, keep modal open. */
  @Output() savedAndContinue = new EventEmitter<void>();
  @Output() cancel = new EventEmitter<void>();

  sacramentTypes: SacramentType[] = [];
  loadingSacramentTypes = false;
  sacramentTypesLoaded = false;
  sacramentTypesError: string | null = null;
  loading = false;
  saving = false;
  isEditMode = false;
  currentTenantId: number | null = null;
  private destroy$ = new Subject<void>();
  /** When true, create success clears people and keeps the form open. */
  private continueAfterSave = false;
  /** Remount shared people controls after batch continue. */
  peopleControlsEpoch = 0;

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
  
  // Family member selection for parent auto-population (recipient uses ParticipantSourceControl)
  familyMembers: FamilyMember[] = [];
  loadingMembers = false;
  selectedRecipientMemberId: string | null = null;
  resolvedPerson: ParishPerson | null = null;
  personLocked = false;
  personQuery = '';
  personResults: ParishPerson[] = [];
  searchingPersons = false;
  personMatches: PersonMatch[] = [];
  acknowledgePersonMatch = false;
  useMatchedPersonId: string | null = null;
  newFamilyDraft = {
    family_name: '',
    head_of_family: '',
    address_line_1: '',
    address_line_2: '',
    city: '',
    postal_code: '',
    bcc_id: null as string | null,
  };
  personDraft = {
    first_name: '',
    middle_name: '',
    last_name: '',
    date_of_birth: '',
    place_of_birth: '',
    gender: '' as '' | 'male' | 'female' | 'other',
    father_name: '',
    mother_name: '',
    phone: '',
    email: '',
    address_line_1: '',
    city: '',
  };
  
  // Parent selection mode (for Baptism)
  parentSelectionMode: 'dropdown' | 'manual' = 'dropdown';
  selectedFatherId: string | null = null;
  selectedMotherId: string | null = null;

  /** Phase 5 — definitions-driven shared controls (legacy flat fields still saved). */
  workflowPlan: SacramentWorkflowPlan | null = null;
  ministerDraft: SacramentParticipantDraft | null = null;
  affiliationDraft: ChurchAffiliationValue | null = null;
  /** Phase 7 — Marriage bride/groom with independent affiliation. */
  brideDraft: SacramentParticipantDraft | null = null;
  groomDraft: SacramentParticipantDraft | null = null;
  brideAffiliationDraft: ChurchAffiliationValue | null = null;
  groomAffiliationDraft: ChurchAffiliationValue | null = null;
  witnessDrafts: SacramentParticipantDraft[] = [];
  brideContext: SacramentContextResponse | null = null;
  groomContext: SacramentContextResponse | null = null;
  brideContextLoading = false;
  groomContextLoading = false;
  brideContextError: string | null = null;
  groomContextError: string | null = null;
  recipientContext: SacramentContextResponse | null = null;
  recipientContextLoading = false;
  baptismDuplicateWarning: string | null = null;
  confirmandDraft: SacramentParticipantDraft | null = null;
  useSharedPeopleControls = true;
  homeParishDisplayName = '';
  readonly baptismalStatusOptions = [
    { value: 'baptized_catholic', label: 'Baptized Catholic' },
    { value: 'baptized_non_catholic', label: 'Baptized Non-Catholic' },
    { value: 'unbaptized', label: 'Unbaptized' },
  ];
  readonly ecclesialAffiliationOptions = [
    { value: 'roman_catholic', label: 'Roman Catholic Church' },
    { value: 'syro_malabar', label: 'Syro-Malabar Church' },
    { value: 'syro_malankara', label: 'Syro-Malankara Church' },
    { value: 'orthodox', label: 'Orthodox Church' },
    { value: 'csi', label: 'Church of South India' },
    { value: 'anglican', label: 'Anglican Communion' },
    { value: 'lutheran', label: 'Lutheran' },
    { value: 'hindu', label: 'Hindu' },
    { value: 'muslim', label: 'Muslim' },
    { value: 'other', label: 'Other' },
  ];
  dispensationDraft: {
    dispensation_type: string;
    granting_authority: string;
    protocol_number: string;
    date_granted: string;
  } = {
    dispensation_type: '',
    granting_authority: '',
    protocol_number: '',
    date_granted: '',
  };

  get marriageClassificationCode(): string | null {
    const bride = this.brideDraft?.baptismal_status;
    const groom = this.groomDraft?.baptismal_status;
    if (!bride || !groom) {
      return null;
    }
    if (bride === 'baptized_catholic' && groom === 'baptized_catholic') {
      return 'both_catholic';
    }
    const set = [bride, groom];
    if (set.includes('baptized_catholic') && set.includes('baptized_non_catholic')) {
      return 'mixed_marriage';
    }
    if (set.includes('baptized_catholic') && set.includes('unbaptized')) {
      return 'disparity_of_cult';
    }
    return 'other';
  }

  get marriageClassificationLabel(): string {
    switch (this.marriageClassificationCode) {
      case 'both_catholic':
        return 'Both Catholic';
      case 'mixed_marriage':
        return 'Mixed marriage (permission needed)';
      case 'disparity_of_cult':
        return 'Disparity of cult (dispensation needed)';
      case 'other':
        return 'Other';
      default:
        return 'Complete baptismal status for both spouses to classify this marriage.';
    }
  }

  get marriageRequiresDispensation(): boolean {
    return this.marriageClassificationCode === 'mixed_marriage'
      || this.marriageClassificationCode === 'disparity_of_cult';
  }

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
    private readonly authService: AuthService,
    private readonly router: Router,
    private readonly store: Store<AppState>,
    private readonly cdr: ChangeDetectorRef,
    private readonly bccService: BCCService,
    private readonly familyService: FamilyService,
    private readonly leadershipService: ChurchLeadershipService,
    private readonly tenantService: TenantService,
    private readonly formService: SacramentFormService,
    private readonly definitionService: SacramentDefinitionService,
    private readonly workflowResolver: SacramentWorkflowResolver,
    private readonly personService: ParishPersonService,
    private readonly contextService: SacramentPersonContextService,
  ) {}

  /**
   * Get maximum date for date input (1 day in future)
   */
  getMaxDate(): string {
    return this.formService.getMaxDate();
  }

  get isCorrectionMode(): boolean {
    return this.isEditMode && !!this.correctionReason?.trim();
  }

  get modalTitle(): string {
    if (this.isCorrectionMode) {
      return 'Correct Sacrament';
    }
    return this.isEditMode ? 'Edit Sacrament' : 'Add Sacrament';
  }

  get primarySaveLabel(): string {
    if (this.saving) {
      return 'Saving…';
    }
    if (this.isCorrectionMode) {
      return 'Save correction';
    }
    return this.isEditMode ? 'Save changes' : 'Add Sacrament';
  }

  get sacramentTypePlaceholder(): string {
    if (this.loadingSacramentTypes) {
      return 'Loading sacraments…';
    }
    if (this.sacramentTypesError) {
      return 'Could not load sacraments';
    }
    if (this.sacramentTypesLoaded && this.sacramentTypes.length === 0) {
      return 'No sacraments available';
    }
    return 'Select a sacrament…';
  }

  get canSelectSacramentType(): boolean {
    return !this.loadingSacramentTypes
      && !this.sacramentTypesError
      && this.sacramentTypes.length > 0;
  }

  get showNoActiveSacramentsMessage(): boolean {
    return !this.isEditMode
      && this.sacramentTypesLoaded
      && !this.loadingSacramentTypes
      && !this.sacramentTypesError
      && this.sacramentTypes.length === 0;
  }

  get canSubmitSacrament(): boolean {
    if (this.saving || this.loading || this.loadingSacramentTypes) {
      return false;
    }
    if (this.isEditMode) {
      return true;
    }
    return !this.sacramentTypesError && this.sacramentTypes.length > 0;
  }

  bccOptionLabel(bcc: BCC): string {
    return `${bcc.bcc_code} - ${bcc.name}`;
  }

  familyOptionLabel(family: Family): string {
    return `${family.family_name} (${family.family_code})`;
  }

  /** ng-select search across full member name for parent pickers. */
  searchFamilyMember = (term: string, item: FamilyMember): boolean => {
    const q = (term || '').toLowerCase().trim();
    if (!q) {
      return true;
    }
    return this.getMemberFullName(item).toLowerCase().includes(q);
  };

  /**
   * Handle status change from dropdown
   */
  onStatusChange(value: string | SacramentStatus): void {
    const normalized = value === SacramentStatus.REGISTERED
      || value === SacramentStatus.CONDITIONAL
      || value === SacramentStatus.VOIDED
      ? value
      : (value === 'active' || value === 'registered'
        ? SacramentStatus.REGISTERED
        : value === 'cancelled' || value === 'voided'
          ? SacramentStatus.VOIDED
          : value === 'conditional'
            ? SacramentStatus.CONDITIONAL
            : SacramentStatus.REGISTERED);
    this.formData['status'] = normalized;
  }

  ngOnInit(): void {
    this.isEditMode = !!this.sacrament;
    this.loadCurrentUser();
    this.loadSacramentTypes();
    this.loadDefinitions();
    this.loadBCCs();
    this.loadFamilies();
    this.loadChurchPlacePrefill();

    if (this.sacrament) {
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
   * Load sacrament types for dropdown from tenant Sacrament Settings
   * (via /sacraments/types enabled_for_tenant). Inactive types are omitted.
   */
  loadSacramentTypes(): void {
    this.loadingSacramentTypes = true;
    this.sacramentTypesError = null;
    this.sacramentService.getSacramentTypes({
      includeInactive: this.isEditMode,
    })
      .pipe(takeUntil(this.destroy$))
      .subscribe({
      next: (response) => {
        if (response.success) {
          const types = response.data || [];
          const currentTypeId = this.isEditMode ? this.sacrament?.sacrament_type_id : null;
          this.sacramentTypes = sacramentTypesForSelector(types, { includeTypeId: currentTypeId });
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
        } else {
          this.sacramentTypes = [];
          this.sacramentTypesError = 'Could not load sacraments for this church.';
          this.toastService.error(this.sacramentTypesError);
        }
        this.sacramentTypesLoaded = true;
        this.loadingSacramentTypes = false;
        this.cdr.markForCheck();
      },
      error: (error) => {
        console.error('Error loading sacrament types:', error);
        this.sacramentTypes = [];
        this.sacramentTypesLoaded = true;
        this.loadingSacramentTypes = false;
        this.sacramentTypesError = handleApiError(error, 'Could not load sacraments for this church.');
        this.toastService.error(this.sacramentTypesError);
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
    // If types are already loaded (including an empty active list), populate
    if (this.sacramentTypesLoaded) {
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
      if (this.sacramentTypesLoaded) {
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

      if (this.isMarriage()) {
        const drafts = this.formService.hydrateMarriageDrafts(sacrament, this.formData);
        this.brideDraft = drafts.bride;
        this.groomDraft = drafts.groom;
        this.witnessDrafts = drafts.witnesses;
        this.brideAffiliationDraft = drafts.brideAffiliation;
        this.groomAffiliationDraft = drafts.groomAffiliation;
        if (drafts.minister) {
          this.ministerDraft = drafts.minister;
        }
        const existing = (sacrament.dispensations || [])[0];
        if (existing) {
          this.dispensationDraft = {
            dispensation_type: existing.dispensation_type || '',
            granting_authority: existing.granting_authority || '',
            protocol_number: existing.protocol_number || '',
            date_granted: (existing.date_granted || '').toString().slice(0, 10),
          };
        }
        this.refreshPartyContextsFromDrafts();
      }
      
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
            this.formData['minister_name'] = primaryLeader.full_name || '';
            this.formData['minister_title'] = primaryLeader.title || primaryLeader.role || '';
            this.ministerDraft = {
              role: 'minister',
              source: 'internal_leadership',
              sort_order: 0,
              church_leadership_id: primaryLeader.id,
              display_name: primaryLeader.full_name || '',
              external_title: primaryLeader.title || primaryLeader.role || undefined,
              external_minister_role: primaryLeader.role || undefined,
            };
            this.cdr.detectChanges();
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
    this.familyMembers = [];
    this.parentSelectionMode = 'dropdown';
    this.selectedFatherId = null;
    this.selectedMotherId = null;
    this.ministerDraft = null;
    this.affiliationDraft = null;
    this.brideDraft = null;
    this.groomDraft = null;
    this.brideAffiliationDraft = null;
    this.groomAffiliationDraft = null;
    this.witnessDrafts = [];
    this.continueAfterSave = false;
    this.peopleControlsEpoch += 1;
    this.cdr.detectChanges();
  }

  /**
   * Save sacrament (create or update)
   */
  onSave(): void {
    this.continueAfterSave = false;
    this.submitSave();
  }

  /** Baptism batch: save, keep type/date/place/minister/book, clear people. */
  onSaveAndAddAnother(): void {
    this.continueAfterSave = true;
    this.submitSave();
  }

  supportsBatchSave(): boolean {
    return !this.isEditMode && !!this.workflowPlan?.batchSupported;
  }

  private submitSave(): void {
    if (this.isReconciliation() && !this.authService.hasPermission('sacraments.view_restricted')) {
      this.toastService.error('Restricted access is required to register Reconciliation.');
      this.continueAfterSave = false;
      return;
    }

    // For Marriage, backend expects recipient_name; synthesize it from groom & bride
    if (this.isMarriage()) {
      const groom = (this.formData['marriage_groom_full_name'] || '').toString().trim();
      const bride = (this.formData['marriage_bride_full_name'] || '').toString().trim();
      if (groom || bride) {
        this.formData['recipient_name'] = [groom, bride].filter(Boolean).join(' & ');
      } else {
        this.formData['recipient_name'] = 'Marriage';
      }
    }

    if (!this.validateForm()) {
      this.continueAfterSave = false;
      return;
    }

    this.saving = true;

    if (this.isEditMode && this.sacrament) {
      if (this.isCorrectionMode) {
        this.correctSacrament();
      } else {
        this.updateSacrament();
      }
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
    const idempotencyKey = this.newIdempotencyKey();

    this.sacramentService.createSacrament(data, { idempotencyKey })
      .pipe(takeUntil(this.destroy$))
      .subscribe({
        next: (response) => {
          if (response.success) {
            this.toastService.success(
              this.continueAfterSave
                ? `${this.getSelectedSacramentType()?.name || 'Sacrament'} saved. Enter the next recipient.`
                : 'Sacrament created successfully.'
            );
            if (this.continueAfterSave) {
              this.clearPeopleForBatchContinue();
              this.savedAndContinue.emit();
            } else {
              this.save.emit();
            }
          }
          this.continueAfterSave = false;
          this.saving = false;
          this.cdr.markForCheck();
        },
        error: (error) => {
          console.error('Error creating sacrament:', error);
          const code = error?.code || error?.error?.code;
          if (code === 'possible_person_match') {
            this.personMatches = error?.context?.matches || error?.error?.context?.matches || [];
            this.toastService.error('A possible existing person was found. Choose Use Existing Person or Create New Person.');
          } else {
            this.toastService.error(error?.message || error?.error?.message || 'Failed to create sacrament.');
          }
          this.continueAfterSave = false;
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
        this.cdr.markForCheck();
      }
    });
  }

  /**
   * Historical correction (ADR-07) — requires reason + optimistic lock.
   */
  correctSacrament(): void {
    if (!this.sacrament) return;

    const reason = this.correctionReason?.trim();
    if (!reason) {
      this.toastService.error('A correction reason is required.');
      this.saving = false;
      this.cdr.markForCheck();
      return;
    }

    const payload = this.buildRequestPayload();
    const lockVersion = this.sacrament.lock_version ?? 0;

    this.sacramentService
      .correctSacrament(this.sacrament.id, {
        ...payload,
        lock_version: lockVersion,
        reason,
      })
      .pipe(takeUntil(this.destroy$))
      .subscribe({
        next: (response) => {
          if (response.success) {
            this.toastService.success('Sacrament corrected. The change is on the audit trail.');
            this.save.emit();
          }
          this.saving = false;
          this.cdr.markForCheck();
        },
        error: (error: unknown) => {
          this.handleLifecycleConflict(error, 'Failed to correct sacrament');
          this.saving = false;
          this.cdr.markForCheck();
        },
      });
  }

  private handleLifecycleConflict(error: unknown, fallback: string): void {
    const status =
      error instanceof HttpErrorResponse
        ? error.status
        : (error as { status?: number })?.status;
    if (status === 409) {
      this.toastService.error(
        'This record was changed by someone else. Reload and try again.'
      );
      return;
    }
    this.toastService.error(handleApiError(error, fallback));
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
    } else if (!this.isSelectedSacramentAvailableForRegistration()) {
      this.fieldErrors['sacrament_type_id'] =
        'This sacrament is not available for this church.';
      isValid = false;
    }

    if (this.usesPersonRecipientWorkflow()) {
      const composed = [this.personDraft.first_name, this.personDraft.middle_name, this.personDraft.last_name]
        .filter(Boolean)
        .join(' ')
        .trim();
      if (composed && !String(this.formData['recipient_name'] || '').trim()) {
        this.formData['recipient_name'] = composed;
      }
      if (this.personDraft.date_of_birth && !this.formData['recipient_birth_date']) {
        this.formData['recipient_birth_date'] = this.personDraft.date_of_birth;
      }
      if (this.personDraft.place_of_birth && !this.formData['recipient_birth_place']) {
        this.formData['recipient_birth_place'] = this.personDraft.place_of_birth;
      }
      if (this.personDraft.gender && !this.formData['recipient_gender']) {
        this.formData['recipient_gender'] = this.personDraft.gender;
      }
      if (this.personDraft.father_name && !this.formData['father_name']) {
        this.formData['father_name'] = this.personDraft.father_name;
      }
      if (this.personDraft.mother_name && !this.formData['mother_name']) {
        this.formData['mother_name'] = this.personDraft.mother_name;
      }
    }

    // Baptism: minister is required.
    if (this.isBaptism()) {
      const ministerOk = this.hasMinisterForSave();
      if (!ministerOk) {
        this.fieldErrors['minister_name'] = 'Minister is required for Baptism.';
        isValid = false;
      }
      if (this.baptismDuplicateWarning) {
        this.fieldErrors['baptism_duplicate'] = this.baptismDuplicateWarning;
        isValid = false;
      }
    }

    // Marriage: bride/groom required via drafts; minister required; bride ≠ groom
    if (this.isMarriage()) {
      if (this.brideContext?.has_blocking_conflicts || this.groomContext?.has_blocking_conflicts) {
        this.fieldErrors['marriage_conflicts'] = 'Resolve identity conflicts before saving.';
        isValid = false;
      }
      const brideName = this.partyDisplayName(this.brideDraft, this.formData['marriage_bride_full_name']);
      const groomName = this.partyDisplayName(this.groomDraft, this.formData['marriage_groom_full_name']);

      if (!brideName) {
        this.fieldErrors['marriage_bride_full_name'] = 'Bride is required.';
        isValid = false;
      }
      if (!groomName) {
        this.fieldErrors['marriage_groom_full_name'] = 'Groom is required.';
        isValid = false;
      }
      if (brideName && groomName && this.brideEqualsGroom()) {
        this.fieldErrors['marriage_bride_full_name'] = 'Bride and groom must be different people.';
        isValid = false;
      }
      if (!this.hasMinisterForSave()) {
        this.fieldErrors['minister_name'] = 'Minister is required for Marriage.';
        isValid = false;
      }
      if (this.marriageRequiresDispensation && !this.dispensationDraft.dispensation_type) {
        this.fieldErrors['dispensation_type'] = 'Record the permission or dispensation for this marriage.';
        isValid = false;
      }
      if (!this.affiliationValid(this.brideAffiliationDraft, 'bride')) {
        this.fieldErrors['marriage_bride_church_name'] =
          'Parish name and diocese are required when bride affiliation is other.';
        isValid = false;
      }
      if (!this.affiliationValid(this.groomAffiliationDraft, 'groom')) {
        this.fieldErrors['marriage_groom_church_name'] =
          'Parish name and diocese are required when groom affiliation is other.';
        isValid = false;
      }

      const placeAdminValidation = validateRequired(this.formData['place_administered'], 'Place administered');
      if (!placeAdminValidation.valid) {
        this.fieldErrors['place_administered'] = placeAdminValidation.message || '';
        isValid = false;
      }

      const brideDob = validateRequired(this.resolvePartyBirthDate(this.brideDraft), "Bride's date of birth");
      if (!brideDob.valid) {
        this.fieldErrors['bride_date_of_birth'] = this.brideDraft?.source === 'member'
          ? 'This member has no date of birth on file. Add it in Family before recording this sacrament.'
          : (brideDob.message || '');
        isValid = false;
      }
      const brideGender = validateRequired(this.resolvePartyGender(this.brideDraft), "Bride's gender");
      if (!brideGender.valid) {
        this.fieldErrors['bride_gender'] = this.brideDraft?.source === 'member'
          ? 'This member has no gender on file. Add it in Family before recording this sacrament.'
          : (brideGender.message || '');
        isValid = false;
      }
      const groomDob = validateRequired(this.resolvePartyBirthDate(this.groomDraft), "Groom's date of birth");
      if (!groomDob.valid) {
        this.fieldErrors['groom_date_of_birth'] = this.groomDraft?.source === 'member'
          ? 'This member has no date of birth on file. Add it in Family before recording this sacrament.'
          : (groomDob.message || '');
        isValid = false;
      }
      const groomGender = validateRequired(this.resolvePartyGender(this.groomDraft), "Groom's gender");
      if (!groomGender.valid) {
        this.fieldErrors['groom_gender'] = this.groomDraft?.source === 'member'
          ? 'This member has no gender on file. Add it in Family before recording this sacrament.'
          : (groomGender.message || '');
        isValid = false;
      }

      this.witnessDrafts.forEach((witness, index) => {
        const name = (witness.external_full_name || witness.display_name || '').toString().trim();
        const address = (witness.external_address || '').toString().trim();
        const gender = (witness.external_gender || '').toString().trim();
        const contact = (witness.external_contact_number || '').toString().trim();
        if (!name && !address && !gender && !contact) {
          return;
        }
        const missing: string[] = [];
        if (!name) {
          missing.push('full name');
        }
        if (!address) {
          missing.push('address');
        }
        if (!gender) {
          missing.push('gender');
        }
        if (!contact) {
          missing.push('contact number');
        }
        if (missing.length) {
          this.fieldErrors[`witness_${index}`] =
            `Witness ${index + 1} needs ${missing.join(', ')}.`;
          isValid = false;
        }
      });
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

    // Baptism and Eucharist: place, DOB, birth place, gender, and parents are mandatory
    if (this.requiresRecipientIdentityFields()) {
      const placeAdminValidation = validateRequired(this.formData['place_administered'], 'Place administered');
      if (!placeAdminValidation.valid) {
        this.fieldErrors['place_administered'] = placeAdminValidation.message || '';
        isValid = false;
      }

      const birthDateValidation = validateRequired(this.resolveRecipientBirthDate(), 'Date of birth');
      if (!birthDateValidation.valid) {
        this.fieldErrors['recipient_birth_date'] = this.personLocked
          ? 'This member has no date of birth on file. Add it in Family before recording this sacrament.'
          : (birthDateValidation.message || '');
        isValid = false;
      }

      const birthPlaceValidation = validateRequired(this.formData['recipient_birth_place'], 'Place of birth');
      if (!birthPlaceValidation.valid) {
        this.fieldErrors['recipient_birth_place'] = birthPlaceValidation.message || '';
        isValid = false;
      } else {
        const placeLength = validateTextLength(
          String(this.formData['recipient_birth_place'] || ''),
          1,
          255,
          'Place of birth'
        );
        if (!placeLength.valid) {
          this.fieldErrors['recipient_birth_place'] = placeLength.message || '';
          isValid = false;
        }
      }

      const genderValidation = validateRequired(this.formData['recipient_gender'], 'Gender');
      if (!genderValidation.valid) {
        this.fieldErrors['recipient_gender'] = genderValidation.message || '';
        isValid = false;
      }

      const fatherValidation = validateRequired(this.formData['father_name'], "Father's name");
      if (!fatherValidation.valid) {
        this.fieldErrors['father_name'] = fatherValidation.message || '';
        isValid = false;
      }

      const motherValidation = validateRequired(this.formData['mother_name'], "Mother's name");
      if (!motherValidation.valid) {
        this.fieldErrors['mother_name'] = motherValidation.message || '';
        isValid = false;
      }
    }

    if (this.isEucharist()) {
      const baptismDateValidation = validateRequired(this.formData['baptism_date'], 'Baptism date');
      if (!baptismDateValidation.valid) {
        this.fieldErrors['baptism_date'] = 'Baptism date is required.';
        isValid = false;
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
      Object.keys(this.fieldErrors).forEach((key) => this.touchedFields.add(key));
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
      case 'father_name':
        if (this.requiresRecipientIdentityFields()) {
          const requiredValidation = validateRequired(String(value || ''), 'Father\'s name');
          if (!requiredValidation.valid) {
            this.fieldErrors[fieldName] = requiredValidation.message || '';
          }
        }
        break;
      case 'mother_name':
        if (this.requiresRecipientIdentityFields()) {
          const requiredValidation = validateRequired(String(value || ''), 'Mother\'s name');
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
   * New registrations (and type changes) must use a church-active sacrament.
   * Historical records may keep their original type after it is turned off.
   */
  private isSelectedSacramentAvailableForRegistration(): boolean {
    const typeId = Number(this.formData['sacrament_type_id']);
    if (!typeId) {
      return false;
    }
    if (this.isEditMode && this.sacrament?.sacrament_type_id === typeId) {
      return true;
    }
    const selected = this.sacramentTypes.find((type) => type.id === typeId);
    return !!selected && selected.enabled_for_tenant !== false;
  }

  /**
   * Check if sacrament type requires godparents/sponsors UI (Baptism godparents or Confirmation sponsors)
   */
  requiresGodparents(): boolean {
    return this.isBaptism()
      || this.isConfirmation()
      || this.hasWorkflowSection('sponsors')
      || this.hasWorkflowSection('godparents');
  }

  normalizedTypeCode(): string {
    const type = this.getSelectedSacramentType();
    if (!type?.code) return '';
    const code = type.code.toUpperCase().trim();
    if (['MARRIAGE', 'WEDDING'].includes(code)) return 'MATRIMONY';
    if (['FIRST_COMMUNION', 'FIRSTCOMMUNION'].includes(code)) return 'EUCHARIST';
    if (['CONFESSION'].includes(code)) return 'RECONCILIATION';
    return code;
  }

  isConfirmation(): boolean {
    return this.normalizedTypeCode() === 'CONFIRMATION';
  }

  isEucharist(): boolean {
    return this.normalizedTypeCode() === 'EUCHARIST';
  }

  isAnointing(): boolean {
    return this.normalizedTypeCode() === 'ANOINTING';
  }

  isReconciliation(): boolean {
    return this.normalizedTypeCode() === 'RECONCILIATION';
  }

  isHolyOrders(): boolean {
    return this.normalizedTypeCode() === 'HOLY_ORDERS';
  }

  isProgressiveParticipantCreate(): boolean {
    return this.isConfirmation() || this.isEucharist() || this.isAnointing() || this.isReconciliation();
  }

  privacyClass(): string {
    return this.workflowPlan?.definition?.privacy_class || 'standard';
  }

  isRestrictedPrivacy(): boolean {
    return this.privacyClass() === 'restricted';
  }

  /**
   * Check if sacrament type requires parents (Baptism)
   */
  requiresParents(): boolean {
    return this.isBaptism() || this.isEucharist();
  }

  requiresRecipientIdentityFields(): boolean {
    return this.isBaptism() || this.isEucharist();
  }

  requiresPlaceAdministered(): boolean {
    return this.isBaptism() || this.isEucharist() || this.isMarriage();
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

  usesPersonRecipientWorkflow(): boolean {
    return !this.isEditMode && (this.isBaptism() || this.isEucharist());
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

  /** Type-adaptive primary party section title (UX-4–7). */
  recipientSectionTitle(): string {
    if (this.isConfirmation()) return 'Confirmand';
    if (this.isEucharist()) return 'Communicant';
    if (this.isAnointing()) return 'Recipient';
    if (this.isReconciliation()) return 'Penitent';
    if (this.isBaptism()) return 'Recipient (baptism)';
    return 'Recipient';
  }

  /**
   * Handle sacrament type change to trigger UI updates
   */
  onSacramentTypeChange(): void {
    if (!this.isEditMode && this.isHolyOrders()) {
      this.cancel.emit();
      void this.router.navigate(['/sacraments/holy-orders/create']);
      return;
    }
    this.refreshWorkflowPlan();
    if (this.isEucharist() && !this.formData['event_subtype']) {
      this.formData['event_subtype'] = 'FIRST_COMMUNION';
    }
    if (this.isReconciliation() && !this.authService.hasPermission('sacraments.view_restricted')) {
      this.toastService.error('Restricted access is required to register Reconciliation.');
      this.formData['sacrament_type_id'] = null as unknown as number;
    }
    this.ensureMarriageWitnessSlots();
    this.cdr.markForCheck();
  }

  loadDefinitions(): void {
    this.definitionService.load()
      .pipe(takeUntil(this.destroy$))
      .subscribe({
        next: () => {
          this.refreshWorkflowPlan();
          this.cdr.markForCheck();
        },
        error: () => {
          this.workflowPlan = this.workflowResolver.resolve(null);
          this.cdr.markForCheck();
        },
      });
  }

  refreshWorkflowPlan(): void {
    const type = this.getSelectedSacramentType();
    const code = type?.code || null;
    this.definitionService.getByCode(code)
      .pipe(take(1), takeUntil(this.destroy$))
      .subscribe((definition) => {
        this.workflowPlan = this.workflowResolver.resolve(definition, code);
        this.ensureMarriageWitnessSlots();
        this.cdr.markForCheck();
      });
  }

  hasWorkflowSection(section: SacramentWorkflowSectionKey): boolean {
    return this.workflowResolver.hasSection(this.workflowPlan, section);
  }

  ministerRoles(): string[] {
    return this.workflowPlan?.definition?.minister_roles?.length
      ? this.workflowPlan.definition.minister_roles
      : ['priest', 'deacon', 'pastor', 'other'];
  }

  onMinisterDraftChange(draft: SacramentParticipantDraft): void {
    this.ministerDraft = draft;
    if (draft.display_name) {
      this.formData['minister_name'] = draft.display_name;
    }
    if (draft.external_title) {
      this.formData['minister_title'] = draft.external_title;
    }
    this.cdr.markForCheck();
  }

  onConfirmandDraftChange(draft: SacramentParticipantDraft): void {
    this.confirmandDraft = { ...draft, role: 'candidate' };
    if (draft.display_name) {
      this.formData['recipient_name'] = draft.display_name;
    }
    if (draft.external_date_of_birth) {
      this.formData['recipient_birth_date'] = draft.external_date_of_birth;
    }
    if (draft.external_gender) {
      this.formData['recipient_gender'] = draft.external_gender;
    }
    if (draft.source === 'member' && draft.family_member_id) {
      this.loadRecipientContext(draft.family_member_id);
    } else {
      this.recipientContext = null;
    }
    this.cdr.markForCheck();
  }

  onAffiliationDraftChange(value: ChurchAffiliationValue): void {
    this.affiliationDraft = value;
    this.cdr.markForCheck();
  }

  onBrideDraftChange(draft: SacramentParticipantDraft): void {
    this.brideDraft = { ...draft, role: 'bride' };
    if (draft.display_name) {
      this.formData['marriage_bride_full_name'] = draft.display_name;
    }
    this.syncMarriageRecipientName();
    if (draft.source === 'member' && draft.family_member_id) {
      this.loadPartyContext('bride', draft.family_member_id);
    } else {
      this.brideContext = null;
      this.brideContextError = null;
    }
    this.cdr.markForCheck();
  }

  onGroomDraftChange(draft: SacramentParticipantDraft): void {
    this.groomDraft = { ...draft, role: 'groom' };
    if (draft.display_name) {
      this.formData['marriage_groom_full_name'] = draft.display_name;
    }
    this.syncMarriageRecipientName();
    if (draft.source === 'member' && draft.family_member_id) {
      this.loadPartyContext('groom', draft.family_member_id);
    } else {
      this.groomContext = null;
      this.groomContextError = null;
    }
    this.cdr.markForCheck();
  }

  partyContext(role: 'bride' | 'groom'): SacramentContextResponse | null {
    return role === 'bride' ? this.brideContext : this.groomContext;
  }

  partyContextLoading(role: 'bride' | 'groom'): boolean {
    return role === 'bride' ? this.brideContextLoading : this.groomContextLoading;
  }

  partyContextError(role: 'bride' | 'groom'): string | null {
    return role === 'bride' ? this.brideContextError : this.groomContextError;
  }

  shouldHideBaptismalStatusInput(role: 'bride' | 'groom'): boolean {
    const ctx = this.partyContext(role);
    if (!ctx) {
      return false;
    }
    const field = ctx.fields?.['baptismal_status'];
    return !!field?.input_hidden || !!field?.auto_resolved;
  }

  shouldHideEcclesialInput(role: 'bride' | 'groom'): boolean {
    const ctx = this.partyContext(role);
    if (!ctx) {
      return false;
    }
    const field = ctx.fields?.['ecclesial_affiliation_code'];
    return !!field?.input_hidden;
  }

  partyFieldErrors(role: 'bride' | 'groom'): MarriagePartyFieldErrors {
    const prefix = role === 'bride' ? 'bride' : 'groom';
    const marriageNameKey = role === 'bride' ? 'marriage_bride_full_name' : 'marriage_groom_full_name';
    const churchNameKey = role === 'bride' ? 'marriage_bride_church_name' : 'marriage_groom_church_name';
    return {
      fullName: this.getFieldError(marriageNameKey) || null,
      dateOfBirth: this.getFieldError(`${prefix}_date_of_birth`) || null,
      gender: this.getFieldError(`${prefix}_gender`) || null,
      churchName: this.getFieldError(churchNameKey) || null,
    };
  }

  private loadPartyContext(role: 'bride' | 'groom', familyMemberId: string): void {
    if (role === 'bride') {
      this.brideContextLoading = true;
      this.brideContextError = null;
    } else {
      this.groomContextLoading = true;
      this.groomContextError = null;
    }

    this.contextService.getContext({
      family_member_id: familyMemberId,
      workflow: 'MATRIMONY',
      participant_role: role,
    }).pipe(takeUntil(this.destroy$)).subscribe({
      next: (context) => {
        if (role === 'bride') {
          this.brideContext = context;
          this.brideContextLoading = false;
          this.applyContextToPartyDraft('bride', context);
        } else {
          this.groomContext = context;
          this.groomContextLoading = false;
          this.applyContextToPartyDraft('groom', context);
        }
        this.cdr.markForCheck();
      },
      error: () => {
        const message = 'Could not load person context. You may enter details manually.';
        if (role === 'bride') {
          this.brideContextLoading = false;
          this.brideContextError = message;
        } else {
          this.groomContextLoading = false;
          this.groomContextError = message;
        }
        this.cdr.markForCheck();
      },
    });
  }

  private applyContextToPartyDraft(role: 'bride' | 'groom', context: SacramentContextResponse): void {
    const draft = role === 'bride' ? this.brideDraft : this.groomDraft;
    if (!draft) {
      return;
    }

    const identity = context.canonical_identity;
    draft.display_name = identity.name?.value || draft.display_name;
    draft.external_date_of_birth = identity.date_of_birth?.value || draft.external_date_of_birth;
    draft.external_gender = (identity.gender?.value as SacramentParticipantDraft['external_gender']) || draft.external_gender;
    draft.father_name = identity.father_name?.value || draft.father_name;
    draft.mother_name = identity.mother_name?.value || draft.mother_name;

    const derivedStatus = context.derived?.baptismal_status?.value;
    if (derivedStatus) {
      draft.baptismal_status = derivedStatus;
    }
    if (context.record_status?.['baptism'] === 'FOUND' && !draft.ecclesial_affiliation_code) {
      draft.ecclesial_affiliation_code = 'roman_catholic';
    }

    if (role === 'bride') {
      this.brideDraft = { ...draft };
      if (draft.display_name) {
        this.formData['marriage_bride_full_name'] = draft.display_name;
      }
    } else {
      this.groomDraft = { ...draft };
      if (draft.display_name) {
        this.formData['marriage_groom_full_name'] = draft.display_name;
      }
    }
  }

  onPartyMissingFieldFocus(role: 'bride' | 'groom', field: string): void {
    const targetId = this.partyMissingFieldTargetId(role, field);
    if (!targetId) {
      return;
    }
    const element = document.getElementById(targetId);
    if (!element) {
      return;
    }
    element.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
    element.classList.add('cf-field-focus-highlight');
    window.setTimeout(() => element.classList.remove('cf-field-focus-highlight'), 2000);
    this.cdr.markForCheck();
  }

  private partyMissingFieldTargetId(role: 'bride' | 'groom', field: string): string | null {
    switch (field) {
      case 'baptism_register_record':
      case 'baptism_record_selection':
        return `party-${role}-baptism-evidence`;
      case 'baptismal_status':
        return `party-${role}-baptismal-status`;
      default:
        return null;
    }
  }

  private refreshPartyContextsFromDrafts(): void {
    if (this.brideDraft?.source === 'member' && this.brideDraft.family_member_id) {
      this.loadPartyContext('bride', this.brideDraft.family_member_id);
    }
    if (this.groomDraft?.source === 'member' && this.groomDraft.family_member_id) {
      this.loadPartyContext('groom', this.groomDraft.family_member_id);
    }
  }

  onPartyConflictCorrect(role: 'bride' | 'groom', conflict: { field: string; candidates: Array<{ value: string; source_type: string }> }): void {
    const ctx = this.partyContext(role);
    const personId = ctx?.subject?.person_id;
    if (!personId) {
      return;
    }
    const baptismCandidate = conflict.candidates.find((c) => c.source_type === 'BAPTISM_RECORD');
    const newValue = baptismCandidate?.value ?? conflict.candidates[1]?.value;
    const reason = window.prompt('Reason for updating canonical member information (required):')?.trim();
    if (!reason) {
      this.toastService.error('A reason is required to update member information.');
      return;
    }
    this.contextService.reconcileIdentity(personId, {
      field: conflict.field,
      new_value: newValue,
      source_selected: baptismCandidate?.source_type ?? 'USER_ENTERED',
      reason,
    }).pipe(takeUntil(this.destroy$)).subscribe({
      next: () => {
        this.toastService.success('Member information updated.');
        const memberId = role === 'bride' ? this.brideDraft?.family_member_id : this.groomDraft?.family_member_id;
        if (memberId) {
          this.loadPartyContext(role, memberId);
        }
      },
      error: (err) => this.toastService.error(handleApiError(err, 'Could not update member information.')),
    });
  }

  private loadRecipientContext(familyMemberId: string): void {
    const workflow = this.isBaptism() ? 'BAPTISM' : this.isEucharist() ? 'EUCHARIST' : 'CONFIRMATION';
    this.recipientContextLoading = true;
    this.baptismDuplicateWarning = null;
    this.contextService.getContext({
      family_member_id: familyMemberId,
      workflow,
      participant_role: 'recipient',
    }).pipe(takeUntil(this.destroy$)).subscribe({
      next: (context) => {
        this.recipientContext = context;
        this.recipientContextLoading = false;
        if (this.isBaptism() && context.record_status?.['baptism'] === 'FOUND') {
          this.baptismDuplicateWarning = 'A baptism record already exists for this person. Review before creating a duplicate.';
        }
        if (this.isEucharist() && context.sacraments?.baptism?.evidence?.date?.value) {
          this.formData['baptism_date'] = context.sacraments.baptism.evidence.date.value;
        }
        this.cdr.markForCheck();
      },
      error: () => {
        this.recipientContextLoading = false;
        this.cdr.markForCheck();
      },
    });
  }

  onBrideAffiliationChange(value: ChurchAffiliationValue): void {
    this.brideAffiliationDraft = value;
    if (value.affiliation_type === 'home_parish' || value.affiliation_type === 'other') {
      this.formData['marriage_bride_church_type'] = value.affiliation_type;
    }
    this.formData['marriage_bride_church_name'] = value.affiliation_parish_name || '';
    this.formData['marriage_bride_church_address'] = value.affiliation_parish_address || '';
    this.cdr.markForCheck();
  }

  onGroomAffiliationChange(value: ChurchAffiliationValue): void {
    this.groomAffiliationDraft = value;
    if (value.affiliation_type === 'home_parish' || value.affiliation_type === 'other') {
      this.formData['marriage_groom_church_type'] = value.affiliation_type;
    }
    this.formData['marriage_groom_church_name'] = value.affiliation_parish_name || '';
    this.formData['marriage_groom_church_address'] = value.affiliation_parish_address || '';
    this.cdr.markForCheck();
  }

  addWitness(): void {
    this.witnessDrafts = [
      ...this.witnessDrafts,
      this.emptyExternalWitness(this.witnessDrafts.length),
    ];
    this.cdr.markForCheck();
  }

  private emptyExternalWitness(sortOrder: number): SacramentParticipantDraft {
    return { role: 'witness', source: 'external', sort_order: sortOrder };
  }

  /** Show two external witness forms on Add Marriage so name/address/gender/contact are visible. */
  private ensureMarriageWitnessSlots(): void {
    if (this.isEditMode || !this.isMarriage() || this.witnessDrafts.length > 0) {
      return;
    }
    this.witnessDrafts = [
      this.emptyExternalWitness(0),
      this.emptyExternalWitness(1),
    ];
  }

  removeWitness(index: number): void {
    this.witnessDrafts = this.witnessDrafts.filter((_, i) => i !== index);
    this.cdr.markForCheck();
  }

  onWitnessDraftChange(index: number, draft: SacramentParticipantDraft): void {
    const next = [...this.witnessDrafts];
    next[index] = { ...draft, role: 'witness', sort_order: index };
    this.witnessDrafts = next;
    this.cdr.markForCheck();
  }

  partyAllowedSources(role: 'bride' | 'groom' | 'witness'): Array<'member' | 'external'> {
    const slot = this.workflowPlan?.definition?.participants.find((p) => p.role === role);
    if (slot?.allowed_sources?.length) {
      return slot.allowed_sources.filter(
        (source): source is 'member' | 'external' => source === 'member' || source === 'external',
      );
    }
    if (role === 'witness' && this.isMarriage()) {
      return ['external'];
    }
    return ['member', 'external'];
  }

  private syncMarriageRecipientName(): void {
    const groom = this.partyDisplayName(this.groomDraft, this.formData['marriage_groom_full_name']);
    const bride = this.partyDisplayName(this.brideDraft, this.formData['marriage_bride_full_name']);
    if (groom || bride) {
      this.formData['recipient_name'] = [groom, bride].filter(Boolean).join(' & ');
    }
  }

  private resolveRecipientBirthDate(): string {
    const explicit = String(this.formData['recipient_birth_date'] || '').trim();
    if (explicit) {
      return explicit;
    }

    if (this.selectedRecipientMemberId) {
      const member = this.familyMembers.find((item) => item.id === this.selectedRecipientMemberId);
      return this.canonicalMemberDateOfBirth(member);
    }

    return String(this.personDraft.date_of_birth || '').trim();
  }

  private resolvePartyBirthDate(draft: SacramentParticipantDraft | null): string {
    return String(draft?.external_date_of_birth || '').trim();
  }

  private resolvePartyGender(draft: SacramentParticipantDraft | null): string {
    return String(draft?.external_gender || '').trim();
  }

  private partyDisplayName(
    draft: SacramentParticipantDraft | null,
    fallback: string | number | null | undefined
  ): string {
    return (draft?.display_name || draft?.external_full_name || fallback || '').toString().trim();
  }

  private brideEqualsGroom(): boolean {
    const brideId = this.brideDraft?.source === 'member' ? this.brideDraft.family_member_id : null;
    const groomId = this.groomDraft?.source === 'member' ? this.groomDraft.family_member_id : null;
    if (brideId && groomId && brideId === groomId) {
      return true;
    }
    const brideName = this.partyDisplayName(this.brideDraft, this.formData['marriage_bride_full_name']).toLowerCase();
    const groomName = this.partyDisplayName(this.groomDraft, this.formData['marriage_groom_full_name']).toLowerCase();
    return !!brideName && !!groomName && brideName === groomName
      && this.brideDraft?.source === 'external'
      && this.groomDraft?.source === 'external';
  }

  private affiliationValid(
    value: ChurchAffiliationValue | null,
    _party: 'bride' | 'groom'
  ): boolean {
    if (!value || value.affiliation_type !== 'other') {
      return true;
    }
    return !!(value.affiliation_parish_name?.trim() && value.affiliation_diocese_name?.trim());
  }

  reviewParticipants(): SacramentParticipantDraft[] {
    const rows: SacramentParticipantDraft[] = [];

    if (this.hasWorkflowSection('bride') && this.brideDraft) {
      rows.push({ ...this.brideDraft, ...(this.brideAffiliationDraft || {}) });
    }
    if (this.hasWorkflowSection('groom') && this.groomDraft) {
      rows.push({ ...this.groomDraft, ...(this.groomAffiliationDraft || {}) });
    }

    if (this.hasWorkflowSection('recipient')) {
      const recipientName = String(this.formData['recipient_name'] || '').trim();
      if (recipientName) {
        rows.push({
          role: 'recipient',
          source: 'external',
          display_name: recipientName,
          external_full_name: recipientName,
          external_date_of_birth: this.formData['recipient_birth_date']
            ? String(this.formData['recipient_birth_date'])
            : undefined,
          external_gender: (this.formData['recipient_gender'] || undefined) as
            | 'male'
            | 'female'
            | 'other'
            | undefined,
          ...(this.affiliationDraft || {}),
        });
      }
    }

    const fatherName = String(this.formData['father_name'] || '').trim();
    if (fatherName || this.selectedFatherId) {
      rows.push({
        role: 'father',
        source: this.selectedFatherId ? 'member' : 'external',
        family_member_id: this.selectedFatherId,
        display_name: fatherName || undefined,
        external_full_name: this.selectedFatherId ? undefined : fatherName,
      });
    }

    const motherName = String(this.formData['mother_name'] || '').trim();
    if (motherName || this.selectedMotherId) {
      rows.push({
        role: 'mother',
        source: this.selectedMotherId ? 'member' : 'external',
        family_member_id: this.selectedMotherId,
        display_name: motherName || undefined,
        external_full_name: this.selectedMotherId ? undefined : motherName,
      });
    }

    const godfather = String(this.formData['godparent1_name'] || '').trim();
    if (godfather) {
      rows.push({
        role: 'godfather',
        source: 'external',
        display_name: godfather,
        external_full_name: godfather,
      });
    }

    const godmother = String(this.formData['godparent2_name'] || '').trim();
    if (godmother) {
      rows.push({
        role: 'godmother',
        source: 'external',
        display_name: godmother,
        external_full_name: godmother,
      });
    }

    this.witnessDrafts.forEach((w) => {
      if (w.display_name || w.external_full_name || w.family_member_id) {
        rows.push(w);
      }
    });

    if (this.ministerDraft) {
      rows.push(this.ministerDraft);
    }
    return rows;
  }

  reviewDateAdministered(): string | null {
    const value = this.formData['date_administered'];
    return typeof value === 'string' && value ? value : null;
  }

  reviewPlaceAdministered(): string | null {
    const value = this.formData['place_administered'];
    return typeof value === 'string' && value ? value : null;
  }

  private hasMinisterForSave(): boolean {
    if (this.ministerDraft?.source === 'internal_leadership') {
      return !!this.ministerDraft.church_leadership_id;
    }
    if (this.ministerDraft?.source === 'external') {
      return !!(this.ministerDraft.external_full_name || this.ministerDraft.display_name)?.trim();
    }
    return !!(this.formData['minister_name'] || '').toString().trim();
  }

  private loadChurchPlacePrefill(): void {
    if (this.isEditMode || this.sacrament) {
      return;
    }
    this.tenantService.getChurchProfile()
      .pipe(takeUntil(this.destroy$))
      .subscribe({
        next: (response) => {
          const name = response?.data?.name?.trim();
          if (!name) {
            return;
          }
          this.homeParishDisplayName = name;
          if (!this.formData['place_administered']) {
            this.formData['place_administered'] = name;
          }
          this.cdr.markForCheck();
        },
        error: () => {
          // Place remains manually editable
        },
      });
  }

  /**
   * After Save and Add Another: retain type/date/place/minister/book; clear people PII.
   */
  private clearPeopleForBatchContinue(): void {
    const retainType = this.formData['sacrament_type_id'];
    const retainDate = this.formData['date_administered'];
    const retainPlace = this.formData['place_administered'];
    const retainMinisterName = this.formData['minister_name'];
    const retainMinisterTitle = this.formData['minister_title'];
    const retainBook = this.formData['book_number'];
    const retainMinisterDraft = this.ministerDraft;

    this.formData = this.formService.initializeFormData();
    this.formData['sacrament_type_id'] = retainType;
    this.formData['date_administered'] = retainDate;
    this.formData['place_administered'] = retainPlace;
    this.formData['minister_name'] = retainMinisterName;
    this.formData['minister_title'] = retainMinisterTitle;
    this.formData['book_number'] = retainBook;
    this.formData['status'] = SacramentStatus.REGISTERED;

    this.affiliationDraft = null;
    this.ministerDraft = retainMinisterDraft;

    this.familySelectionType = 'existing';
    this.selectedBccId = null;
    this.selectedFamilyId = null;
    this.families = [];
    this.showFamilyForm = false;
    this.newlyCreatedFamily = null;
    this.familyMembers = [];
    this.parentSelectionMode = 'dropdown';
    this.selectedFatherId = null;
    this.selectedMotherId = null;
    this.fieldErrors = {};
    this.touchedFields = new Set();

    this.peopleControlsEpoch += 1;
    this.refreshWorkflowPlan();
    this.cdr.detectChanges();
  }

  private newIdempotencyKey(): string {
    if (typeof crypto !== 'undefined' && typeof crypto.randomUUID === 'function') {
      return crypto.randomUUID();
    }
    return `sac-${Date.now()}-${Math.random().toString(36).slice(2, 10)}`;
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


  loadFamilies(): void {
    this.loadingFamilies = true;
    this.familyService.getFamilies({ status: 'active', per_page: 100, sort_by: 'family_name', sort_order: 'asc' })
      .pipe(takeUntil(this.destroy$))
      .subscribe({
        next: (response) => {
          this.families = response.data || [];
          this.loadingFamilies = false;
          this.cdr.markForCheck();
        },
        error: () => {
          this.families = [];
          this.loadingFamilies = false;
          this.cdr.markForCheck();
        }
      });
  }

  onRecipientMemberChange(): void {
    this.resolvedPerson = null;
    this.personLocked = false;
    if (!this.selectedRecipientMemberId) {
      return;
    }
    const member = this.familyMembers.find((m) => m.id === this.selectedRecipientMemberId);
    if (!member) {
      return;
    }
    this.applyMemberAsRecipient(member);
  }

  applyMemberAsRecipient(member: FamilyMember): void {
    const fullName = this.getMemberFullName(member);
    const birthDate = this.canonicalMemberDateOfBirth(member);
    const gender = this.canonicalMemberGender(member);
    const fatherName = this.canonicalMemberFatherName(member);
    const motherName = this.canonicalMemberMotherName(member);
    this.formData['recipient_name'] = fullName;
    this.formData['recipient_birth_date'] = birthDate;
    this.formData['recipient_gender'] = gender || undefined;
    this.formData['father_name'] = fatherName;
    this.formData['mother_name'] = motherName;
    this.personDraft.first_name = member.first_name;
    this.personDraft.middle_name = member.middle_name || '';
    this.personDraft.last_name = member.last_name;
    this.personDraft.date_of_birth = birthDate;
    this.personDraft.gender = (gender as typeof this.personDraft.gender) || '';
    this.personDraft.father_name = fatherName;
    this.personDraft.mother_name = motherName;
    this.personLocked = true;
    if (member.id) {
      this.loadRecipientContext(member.id);
    }
    if (member.person_id) {
      this.personService.get(member.person_id).pipe(takeUntil(this.destroy$)).subscribe({
        next: (res) => {
          this.resolvedPerson = res.data;
          if (res.data.place_of_birth) {
            this.formData['recipient_birth_place'] = res.data.place_of_birth;
            this.personDraft.place_of_birth = res.data.place_of_birth;
          }
          if (res.data.father_name) {
            this.formData['father_name'] = res.data.father_name;
          }
          if (res.data.mother_name) {
            this.formData['mother_name'] = res.data.mother_name;
          }
          this.cdr.markForCheck();
        }
      });
    }
    this.cdr.detectChanges();
  }

  searchPersons(): void {
    const term = this.personQuery.trim();
    if (term.length < 2) {
      this.personResults = [];
      return;
    }
    this.searchingPersons = true;
    this.personService.search(term).pipe(takeUntil(this.destroy$)).subscribe({
      next: (res) => {
        this.personResults = res.data || [];
        this.searchingPersons = false;
        this.cdr.markForCheck();
      },
      error: () => {
        this.personResults = [];
        this.searchingPersons = false;
        this.cdr.markForCheck();
      }
    });
  }

  selectResolvedPerson(person: ParishPerson): void {
    this.resolvedPerson = person;
    this.personLocked = true;
    this.personQuery = '';
    this.personResults = [];
    this.formData['recipient_name'] = person.full_name_display
      || [person.first_name, person.middle_name, person.last_name].filter(Boolean).join(' ');
    this.formData['recipient_birth_date'] = person.date_of_birth || '';
    this.formData['recipient_birth_place'] = person.place_of_birth || '';
    this.formData['recipient_gender'] = person.gender || undefined;
    this.personDraft = {
      first_name: person.first_name,
      middle_name: person.middle_name || '',
      last_name: person.last_name,
      date_of_birth: person.date_of_birth || '',
      place_of_birth: person.place_of_birth || '',
      gender: (person.gender || '') as typeof this.personDraft.gender,
      father_name: person.father_name || '',
      mother_name: person.mother_name || '',
      phone: person.phone || '',
      email: person.email || '',
      address_line_1: person.address_line_1 || '',
      city: person.city || '',
    };
    this.cdr.detectChanges();
  }

  clearResolvedPerson(): void {
    this.resolvedPerson = null;
    this.personLocked = false;
    this.useMatchedPersonId = null;
    this.personMatches = [];
    this.acknowledgePersonMatch = false;
  }

  chooseMatchedPerson(match: PersonMatch): void {
    this.useMatchedPersonId = match.id;
    this.acknowledgePersonMatch = true;
    this.personService.get(match.id).pipe(takeUntil(this.destroy$)).subscribe({
      next: (res) => this.selectResolvedPerson(res.data),
    });
  }

  confirmCreateNewPerson(): void {
    this.acknowledgePersonMatch = true;
    this.useMatchedPersonId = null;
    this.personMatches = [];
    this.personLocked = false;
  }

  memberOptionLabel(member: FamilyMember): string {
    const name = this.getMemberFullName(member);
    const extras = [
      member.relationship_to_head,
      this.canonicalMemberDateOfBirth(member) || undefined,
    ].filter(Boolean);
    return extras.length ? `${name} (${extras.join(' · ')})` : name;
  }

  private canonicalMemberDateOfBirth(member?: FamilyMember | null): string {
    return String(member?.date_of_birth || member?.person?.date_of_birth || '').trim();
  }

  private canonicalMemberGender(member?: FamilyMember | null): string {
    return String(member?.gender || member?.person?.gender || '').trim();
  }

  private canonicalMemberFatherName(member?: FamilyMember | null): string {
    return String(member?.father_name || member?.person?.father_name || '').trim();
  }

  private canonicalMemberMotherName(member?: FamilyMember | null): string {
    return String(member?.mother_name || member?.person?.mother_name || '').trim();
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
    this.selectedRecipientMemberId = null;
    this.clearResolvedPerson();
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
    
    this.selectedRecipientMemberId = null;
    this.clearResolvedPerson();
    if (type === 'new') {
      this.showFamilyForm = false;
    }
    if (type === 'existing') {
      this.loadFamilies();
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
      this.loadFamilies();
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
      this.selectedRecipientMemberId = null;
      this.clearResolvedPerson();
      // Reset parent selections when family changes
      this.selectedFatherId = null;
      this.selectedMotherId = null;
      // Auto-populate parents if available
      if (this.isBaptism() && this.familySelectionType === 'existing') {
        this.parentSelectionMode = 'dropdown';
      }
    } else {
      this.familyMembers = [];
        this.selectedFatherId = null;
      this.selectedMotherId = null;
      this.parentSelectionMode = 'manual';
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
   * Get available fathers from family members
   */
  getAvailableFathers(): FamilyMember[] {
    if (!this.familyMembers.length) return [];
    
    return this.familyMembers.filter(member => {
      // Find members with relationship_to_head = 'father' or 'self' (if male)
      return (member.relationship_to_head === 'father') ||
             (member.relationship_to_head === 'self' && member.gender === 'male');
    });
  }

  /**
   * Get available mothers from family members
   */
  getAvailableMothers(): FamilyMember[] {
    if (!this.familyMembers.length) return [];
    
    return this.familyMembers.filter(member => {
      // Find members with relationship_to_head = 'mother' or 'spouse' (if female and head is male)
      return (member.relationship_to_head === 'mother') ||
             (member.relationship_to_head === 'spouse' && member.gender === 'female');
    });
  }

  /**
   * Get full name for a family member
   */
  getMemberFullName(member: FamilyMember): string {
    const parts = [member.first_name, member.middle_name, member.last_name].filter(Boolean);
    return parts.join(' ') || 'N/A';
  }

  /**
   * Handle father selection from dropdown
   */
  onFatherSelect(): void {
    if (!this.selectedFatherId) {
      this.formData['father_name'] = '';
      return;
    }

    const father = this.familyMembers.find(m => m.id === this.selectedFatherId);
    if (father) {
      this.formData['father_name'] = this.getMemberFullName(father);
    }
    this.cdr.detectChanges();
  }

  /**
   * Handle mother selection from dropdown
   */
  onMotherSelect(): void {
    if (!this.selectedMotherId) {
      this.formData['mother_name'] = '';
      return;
    }

    const mother = this.familyMembers.find(m => m.id === this.selectedMotherId);
    if (mother) {
      this.formData['mother_name'] = this.getMemberFullName(mother);
    }
    this.cdr.detectChanges();
  }

  /**
   * Auto-populate parents from family members
   */
  autoPopulateParents(): void {
    if (!this.familyMembers.length) return;

    // Find father
    const father = this.getAvailableFathers()[0];
    if (father) {
      this.selectedFatherId = father.id;
      this.formData['father_name'] = this.getMemberFullName(father);
    }

    // Find mother
    const mother = this.getAvailableMothers()[0];
    if (mother) {
      this.selectedMotherId = mother.id;
      this.formData['mother_name'] = this.getMemberFullName(mother);
    }
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
  private buildRecipientDraftFromMember(): SacramentParticipantDraft | null {
    if (!this.selectedRecipientMemberId) {
      return null;
    }
    const member = this.familyMembers.find((m) => m.id === this.selectedRecipientMemberId);
    if (!member) {
      return null;
    }
    return {
      role: 'recipient',
      source: 'member',
      family_member_id: member.id,
      display_name: this.getMemberFullName(member),
      external_date_of_birth: this.canonicalMemberDateOfBirth(member),
      external_gender: (this.canonicalMemberGender(member) as SacramentParticipantDraft['external_gender']) || undefined,
      father_name: this.canonicalMemberFatherName(member),
      mother_name: this.canonicalMemberMotherName(member),
    };
  }

  private buildRequestPayload(): SacramentCreateRequest {
    if (!this.currentTenantId) {
      throw new Error('Tenant ID is required');
    }

    if (this.usesPersonRecipientWorkflow() && !this.resolvedPerson) {
      const composed = [this.personDraft.first_name, this.personDraft.middle_name, this.personDraft.last_name]
        .filter(Boolean)
        .join(' ')
        .trim();
      if (composed) {
        this.formData['recipient_name'] = composed;
      }
      if (this.personDraft.date_of_birth) {
        this.formData['recipient_birth_date'] = this.personDraft.date_of_birth;
      }
      if (this.personDraft.place_of_birth) {
        this.formData['recipient_birth_place'] = this.personDraft.place_of_birth;
      }
      if (this.personDraft.gender) {
        this.formData['recipient_gender'] = this.personDraft.gender;
      }
      if (this.personDraft.father_name) {
        this.formData['father_name'] = this.personDraft.father_name;
      }
      if (this.personDraft.mother_name) {
        this.formData['mother_name'] = this.personDraft.mother_name;
      }
    }

    const payload = this.formService.buildRequestPayload(
      this.formData,
      this.currentTenantId,
      this.formData['family_id'] ? String(this.formData['family_id']) : null,
      this.formData['bcc_id'] ? String(this.formData['bcc_id']) : null
    );

    if (this.usesPersonRecipientWorkflow()) {
      payload.family_association = this.familySelectionType === null ? 'none' : this.familySelectionType;
      payload.family_member_id = this.selectedRecipientMemberId;
      payload.person_id = this.resolvedPerson?.id || undefined;
      payload.acknowledge_person_match = this.acknowledgePersonMatch || undefined;
      payload.use_person_id = this.useMatchedPersonId || undefined;
      if (this.familySelectionType === 'new') {
        payload.family = { ...this.newFamilyDraft, bcc_id: this.newFamilyDraft.bcc_id || undefined };
        payload.relationship_to_head = 'self';
      }
      if (!this.resolvedPerson) {
        payload.person = {
          first_name: this.personDraft.first_name,
          middle_name: this.personDraft.middle_name || undefined,
          last_name: this.personDraft.last_name,
          date_of_birth: this.personDraft.date_of_birth || undefined,
          place_of_birth: this.personDraft.place_of_birth || undefined,
          gender: this.personDraft.gender || undefined,
          father_name: this.personDraft.father_name || undefined,
          mother_name: this.personDraft.mother_name || undefined,
          phone: this.personDraft.phone || undefined,
          email: this.personDraft.email || undefined,
          address_line_1: this.personDraft.address_line_1 || undefined,
          city: this.personDraft.city || undefined,
        };
      }
    }

    if (!this.isEditMode && this.isBaptism() && this.useSharedPeopleControls) {
      const participants = this.formService.buildBaptismParticipants({
        recipient: this.buildRecipientDraftFromMember(),
        affiliation: this.affiliationDraft,
        minister: this.ministerDraft,
        formData: this.formData,
        selectedFatherId: this.selectedFatherId,
        selectedMotherId: this.selectedMotherId,
      });
      if (participants.length > 0) {
        payload.participants = participants;
      }
    }

    if ((!this.isEditMode || this.isCorrectionMode) && this.isMarriage() && this.useSharedPeopleControls) {
      const participants = this.formService.buildMarriageParticipants({
        bride: this.brideDraft,
        groom: this.groomDraft,
        brideAffiliation: this.brideAffiliationDraft,
        groomAffiliation: this.groomAffiliationDraft,
        witnesses: this.witnessDrafts,
        minister: this.ministerDraft,
        formData: this.formData,
      });
      if (participants.length > 0) {
        payload.participants = participants;
      }
      if (this.marriageClassificationCode) {
        payload.marriage_canonical_classification = this.marriageClassificationCode;
      }
      if (this.marriageRequiresDispensation && this.dispensationDraft.dispensation_type) {
        payload.dispensations = [{
          dispensation_type: this.dispensationDraft.dispensation_type,
          granting_authority: this.dispensationDraft.granting_authority || null,
          protocol_number: this.dispensationDraft.protocol_number || null,
          date_granted: this.dispensationDraft.date_granted || null,
        }];
      }
    }

    if (!this.isEditMode && this.isProgressiveParticipantCreate() && this.useSharedPeopleControls) {
      const participants = this.formService.buildProgressiveParticipants({
        recipient: this.isConfirmation() ? this.confirmandDraft : this.buildRecipientDraftFromMember(),
        minister: this.ministerDraft,
        formData: this.formData,
        includeSponsors: this.isConfirmation(),
        includeParents: this.isEucharist(),
        selectedFatherId: this.selectedFatherId,
        selectedMotherId: this.selectedMotherId,
      });
      if (participants.length > 0) {
        payload.participants = participants;
      }
      if (this.isEucharist()) {
        payload.event_subtype = String(this.formData['event_subtype'] || 'FIRST_COMMUNION');
      }
      if (this.isAnointing() && this.formData['place_classification']) {
        payload.place_classification = String(this.formData['place_classification']);
      }
      if (this.isReconciliation() && payload.notes) {
        payload.notes = String(payload.notes).slice(0, 250);
      }
    }

    return payload;
  }
}

