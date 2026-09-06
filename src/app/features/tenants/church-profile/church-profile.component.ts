/**
 * Church Profile Component
 * 
 * Comprehensive church management interface with tabs for:
 * - Church Profile (denomination, archdiocese, identity)
 * - Leadership Management (pastors, leaders)
 * - Statistics Tracking (membership, attendance, sacraments)
 * - Social Media Management (accounts, platforms)
 * 
 * Tenant = Church in this multi-tenant architecture
 */

import { Component, OnInit, OnDestroy, inject, ChangeDetectionStrategy, ChangeDetectorRef } from '@angular/core';
import { CommonModule } from '@angular/common';
import { ReactiveFormsModule, FormBuilder, FormGroup, Validators, FormsModule } from '@angular/forms';
import { ActivatedRoute, Router } from '@angular/router';
import { NgSelectModule } from '@ng-select/ng-select';
import { TenantService } from '@core/services/tenant.service';
import { FamilyService } from '@core/services/family.service';
import { BCCService } from '@core/services/bcc.service';
import { ToastService } from '@core/services/toast.service';
import { AuthService } from '@core/services/auth.service';
import { Tenant, TenantResponse } from '@core/models';
import { finalize, takeUntil, switchMap } from 'rxjs/operators';
import { getTenantCallingCode, tenantPhoneValidator } from '@core/validators/phone.validators';
import { GeographyService, Country } from '@core/services/geography.service';
import { PhoneCodeService } from '@core/services/phone-code.service';
import { PhoneInputComponent } from '@shared/components/phone-input/phone-input.component';
import { PageHeaderComponent } from '@shared/components/page-header/page-header.component';
import { ModalShellComponent } from '@shared/components/modal-shell/modal-shell.component';
import { ChurchLeaderWorkspaceComponent } from './components/church-leader-workspace/church-leader-workspace.component';
import { ChurchLeaderDetailComponent } from './components/church-leader-detail/church-leader-detail.component';
import { ChurchLeadershipGovernanceComponent } from './components/church-leadership-governance/church-leadership-governance.component';
import { Store } from '@ngrx/store';
import { selectCurrentTenant } from '@core/store/tenant/tenant.selectors';
import { HostListener } from '@angular/core';
import { environment } from '@environments/environment';
import { Subject } from 'rxjs';

// Import all church management services
import {
  DenominationService,
  ArchdioceseService,
  ChurchProfileService,
  ChurchLeadershipService,
  ChurchLeadershipGovernanceService,
  ChurchStatisticsService,
  ChurchSocialMediaService,
  PopeDetailsService
} from '@core/services/church';

// Import church models
import {
  Denomination,
  Archdiocese,
  ChurchProfile,
  ChurchLeadership,
  ChurchStatistic,
  ChurchSocialMedia,
  PopeDetails,
  CurrentLeadershipResponse,
} from '@core/models/church';

@Component({
  selector: 'app-church-profile',
  standalone: true,
  imports: [
    CommonModule,
    ReactiveFormsModule,
    FormsModule,
    NgSelectModule,
    PhoneInputComponent,
    ModalShellComponent,
    ChurchLeaderWorkspaceComponent,
    ChurchLeaderDetailComponent,
    ChurchLeadershipGovernanceComponent,
    PageHeaderComponent,
  ],
  templateUrl: './church-profile.component.html',
  styleUrl: './church-profile.component.scss',
  changeDetection: ChangeDetectionStrategy.OnPush
})
export class ChurchProfileComponent implements OnInit, OnDestroy {
  private destroy$ = new Subject<void>();
  private leadersLoadTrigger$ = new Subject<void>();
  private cdr = inject(ChangeDetectorRef);
  // Tab Management
  activeTab: 'profile' | 'leadership' | 'statistics' | 'social' = 'profile';

  // Church Profile Data
  churchProfile: Tenant | null = null;
  extendedProfile: ChurchProfile | null = null;
  popeDetails: PopeDetails | null = null;
  
  // Patron Image Upload State
  patronImagePreview: string | null = null;
  patronImageFile: File | null = null;
  uploadingPatronImage = false;
  
  // Lookup Data
  denominations: Denomination[] = [];
  archdioceses: Archdiocese[] = [];
  filteredArchdioceses: Archdiocese[] = [];
  
  // Leadership Data
  leaders: ChurchLeadership[] = [];
  governanceCurrent: CurrentLeadershipResponse | null = null;
  selectedLeader: ChurchLeadership | null = null;
  loadingLeaders = false;
  
  // Statistics Data
  statistics: ChurchStatistic[] = [];
  selectedStatistic: ChurchStatistic | null = null;
  
  // Social Media Data
  socialMedia: ChurchSocialMedia[] = [];
  selectedSocialMedia: ChurchSocialMedia | null = null;

  // UI State
  loading = true;
  saving = false;
  error: string | null = null;
  
  // Section-level editing state
  editingSections: {
    general: boolean;
    contact: boolean;
    identity: boolean;
  } = {
    general: false,
    contact: false,
    identity: false
  };
  
  showLeaderModal = false;
  showLeaderDetail = false;
  viewingLeader: ChurchLeadership | null = null;
  showStatisticModal = false;
  showSocialModal = false;
  showGeneralModal = false;
  
  // Country list (from geography service)
  countries: Country[] = [];
  loadingCountries = false;
  
  // Phone code (reactive from service)
  get callingCode(): string {
    return this.phoneCodeService.getPhoneCodeSync();
  }
  
  // Helper: Get max year for validation
  getMaxYear(): number {
    return new Date().getFullYear() + 1;
  }
  
  // Forms
  profileForm!: FormGroup;
  leaderForm!: FormGroup;
  statisticForm!: FormGroup;
  socialForm!: FormGroup;

  // Service Injections
  private tenantService = inject(TenantService);
  private toastService = inject(ToastService);
  public authService = inject(AuthService); // Made public for template access
  private fb = inject(FormBuilder);
  
  // Church Management Services
  private denominationService = inject(DenominationService);
  private archdioceseService = inject(ArchdioceseService);
  private churchProfileService = inject(ChurchProfileService);
  private leadershipService = inject(ChurchLeadershipService);
  private leadershipGovernanceService = inject(ChurchLeadershipGovernanceService);
  private statisticsService = inject(ChurchStatisticsService);
  private socialMediaService = inject(ChurchSocialMediaService);
  private popeDetailsService = inject(PopeDetailsService);
  
  // Geography and Phone Code Services
  private geographyService = inject(GeographyService);
  public phoneCodeService = inject(PhoneCodeService); // Made public for template access
  private store = inject(Store);
  private route = inject(ActivatedRoute);
  private router = inject(Router);
  private familyService = inject(FamilyService);
  private bccService = inject(BCCService);

  canEdit = false;
  designVariant: 'summary' | 'tiles' | 'definition' = 'summary';
  aboutExpanded = false;

  snapshotKpis: { label: string; value: string; hint?: string }[] = [
    { label: 'Members', value: '—', hint: 'Loading...' },
    { label: 'Families', value: '—', hint: 'Loading...' },
    { label: 'Ministries', value: '—', hint: 'Loading...' },
    { label: 'Volunteers', value: '—', hint: 'Loading...' }
  ];

  operationalMetrics: { label: string; percent: number }[] = [];
  private overviewMembers = 0;
  private overviewFamilies = 0;
  private overviewMinistries = 0;
  private overviewVolunteers = 0;
  private overviewActiveMembers = 0;
  private overviewBccUtilization = 84;
  
  // Social Media Platform Options
  socialPlatforms = [
    { value: 'facebook', label: 'Facebook', icon: '📘' },
    { value: 'twitter', label: 'Twitter', icon: '🐦' },
    { value: 'instagram', label: 'Instagram', icon: '📷' },
    { value: 'youtube', label: 'YouTube', icon: '📺' },
    { value: 'linkedin', label: 'LinkedIn', icon: '💼' },
    { value: 'tiktok', label: 'TikTok', icon: '🎵' },
    { value: 'whatsapp', label: 'WhatsApp', icon: '💬' }
  ];
  
  // Leadership Role Options
  leadershipRoles = [
    'Pastor',
    'Associate Pastor',
    'Youth Pastor',
    'Worship Leader',
    'Elder',
    'Deacon',
    'Ministry Leader',
    'Administrator',
    'Other'
  ];

  // Month Options for Statistics
  monthOptions = [
    { value: null, label: 'Annual' },
    { value: 1, label: 'January' },
    { value: 2, label: 'February' },
    { value: 3, label: 'March' },
    { value: 4, label: 'April' },
    { value: 5, label: 'May' },
    { value: 6, label: 'June' },
    { value: 7, label: 'July' },
    { value: 8, label: 'August' },
    { value: 9, label: 'September' },
    { value: 10, label: 'October' },
    { value: 11, label: 'November' },
    { value: 12, label: 'December' }
  ];

  constructor() {}

  /**
   * Get status badge color based on tenant active status
   */
  getStatusBadgeColor(): string {
    return this.churchProfile?.active === 1 ? 'success' : 'danger';
  }

  /**
   * Get status text
   */
  getStatusText(): string {
    return this.churchProfile?.active === 1 ? 'Active' : 'Inactive';
  }

  /**
   * Get plan badge color
   */
  getPlanBadgeColor(): string {
    const plan = this.churchProfile?.plan;
    switch (plan) {
      case 'enterprise':
        return 'primary';
      case 'premium':
        return 'success';
      case 'basic':
        return 'info';
      default:
        return 'secondary';
    }
  }

  /**
   * Resolve denomination name for display
   */
  getDenominationName(): string {
    if (!this.extendedProfile?.denomination_id) return 'Not Set';
    const denom = this.denominations.find(d => d.id === this.extendedProfile?.denomination_id);
    return denom?.name || 'Not Set';
  }

  /**
   * Resolve archdiocese/diocese name for display
   */
  getArchdioceseName(): string {
    if (!this.extendedProfile?.archdiocese_id) return 'Not Set';
    const arch = this.archdioceses.find(a => a.id === this.extendedProfile?.archdiocese_id);
    return arch?.name || 'Not Set';
  }

  /**
   * Switch design variant (kept for future use/UI toggle)
   */
  setDesignVariant(variant: 'summary' | 'tiles' | 'definition'): void {
    this.designVariant = variant;
  }

  /**
   * Open General Information modal
   */
  openGeneralModal(): void {
    if (!this.canEdit) {
      this.toastService.warning('You do not have permission to edit.', 'Permission Denied');
      return;
    }
    
    // Ensure profile is loaded
    if (!this.extendedProfile) {
      this.loadExtendedProfile();
      // Wait a bit for profile to load
      setTimeout(() => {
        this.setupGeneralModal();
      }, 300);
      return;
    }
    
    this.setupGeneralModal();
  }

  /**
   * Setup General Modal - Separate method for reusability
   */
  private setupGeneralModal(): void {
    console.log('🔧 setupGeneralModal called');
    console.log('Extended profile:', this.extendedProfile);
    console.log('Profile form exists:', !!this.profileForm);
    
    if (!this.profileForm) {
      console.error('❌ profileForm is not initialized');
      this.toastService.error('Form is not initialized. Please refresh the page.', 'Error');
      return;
    }
    
    // Ensure countries are loaded
    if (this.countries.length === 0 && !this.loadingCountries) {
      console.log('📥 Loading countries...');
      this.loadCountries();
    }
    
    // Populate form FIRST before enabling fields
    if (this.extendedProfile) {
      console.log('📝 Populating form with extended profile data');
      this.populateProfileForm(this.extendedProfile);
    }
    
    // Enable both general and contact fields for combined editing
    console.log('✅ Enabling form fields...');
    this.startEditSection('general');
    this.editingSections.contact = true;
    
    // Explicitly enable contact fields
    const phoneControl = this.profileForm.get('phone');
    const emailControl = this.profileForm.get('email');
    const websiteControl = this.profileForm.get('website');
    const patronNameControl = this.profileForm.get('patron_name');
    
    if (phoneControl) phoneControl.enable({ emitEvent: false });
    if (emailControl) emailControl.enable({ emitEvent: false });
    if (websiteControl) websiteControl.enable({ emitEvent: false });
    if (patronNameControl) patronNameControl.enable({ emitEvent: false });
    
    // Ensure archdioceses are loaded and filtered correctly
    this.ensureArchdiocesesLoaded();
    
    console.log('✅ Form setup complete. Opening modal...');
    this.showGeneralModal = true;
    console.log('✅ Modal should now be visible');
  }

  /**
   * Close General Information modal
   */
  closeGeneralModal(): void {
    this.showGeneralModal = false;
    if (this.editingSections.general || this.editingSections.contact) {
      // Cancel both sections to restore and disable fields
      this.cancelEditSection('general');
      this.cancelEditSection('contact');
    }
  }

  /**
   * Save both General and Contact sections together
   */
  saveGeneralAndContact(): void {
    console.log('💾 saveGeneralAndContact called');
    console.log('Form valid:', this.profileForm.valid);
    console.log('Form value:', this.profileForm.value);
    console.log('Form raw value:', this.profileForm.getRawValue());
    
    // Check if form exists
    if (!this.profileForm) {
      console.error('❌ profileForm is not initialized');
      this.toastService.error('Form is not initialized. Please refresh the page.', 'Error');
      return;
    }
    
    // Check if form is valid (only validate enabled fields)
    // Since all fields are optional, we should allow submission even if some fields are invalid
    // But we need to handle email validation specifically
    const emailControl = this.profileForm.get('email');
    if (emailControl && emailControl.enabled && emailControl.value && emailControl.invalid) {
      emailControl.markAsTouched();
      this.toastService.warning('Please enter a valid email address.', 'Validation Error');
      return;
    }
    
    // Check founded_year validation
    const foundedYearControl = this.profileForm.get('founded_year');
    if (foundedYearControl && foundedYearControl.enabled && foundedYearControl.value && foundedYearControl.invalid) {
      foundedYearControl.markAsTouched();
      this.toastService.warning('Please enter a valid founded year (1000 - ' + new Date().getFullYear() + ').', 'Validation Error');
      return;
    }

    this.saving = true;
    
    // Get raw form value (includes disabled fields)
    const formData = this.profileForm.getRawValue();
    
    // Ensure country_id is included if it was set
    if (!formData.country_id && this.profileForm.get('country_id')?.value) {
      formData.country_id = this.profileForm.get('country_id')?.value;
    }
    
    // Clean up the data - remove null/undefined values that might cause issues
    Object.keys(formData).forEach(key => {
      if (formData[key] === null || formData[key] === undefined || formData[key] === '') {
        // Keep null for fields that should be cleared
        if (['denomination_id', 'archdiocese_id', 'bishop_id', 'country_id'].includes(key)) {
          formData[key] = null;
        } else if (['phone', 'email', 'website'].includes(key)) {
          formData[key] = formData[key] || '';
        }
      }
    });
    
    // Normalize website URL - prepend https:// if no protocol is present
    if (formData.website && typeof formData.website === 'string' && formData.website.trim()) {
      let website = formData.website.trim();
      
      // Remove leading/trailing whitespace
      website = website.trim();
      
      // If it doesn't start with http:// or https://, prepend https://
      if (!website.match(/^https?:\/\//i)) {
        // Remove any leading slashes
        website = website.replace(/^\/+/, '');
        formData.website = 'https://' + website;
      }
    }
    
    console.log('📤 Submitting form data:', formData);

    this.churchProfileService.updateProfile(formData)
      .pipe(
        finalize(() => {
          this.saving = false;
          this.cdr.markForCheck();
        }),
        takeUntil(this.destroy$)
      )
      .subscribe({
        next: (response) => {
          if (response.success) {
            this.extendedProfile = response.data;
            
            // Reload profile to get updated data
            this.loadExtendedProfile();
            
            this.editingSections.general = false;
            this.editingSections.contact = false;
            this.cdr.markForCheck();

            // Upload patron image if selected (before disabling fields)
            if (this.patronImageFile) {
              this.uploadPatronImageFile();
            }
            
            // Disable the fields for both sections
            const sectionFields = [
              'denomination_id', 'archdiocese_id', 'bishop_id', 'founded_year',
              'phone', 'email', 'website', 'country_id', 'patron_name'
            ];
            sectionFields.forEach(field => {
              this.profileForm.get(field)?.disable({ emitEvent: false });
            });

            // If no patron image to upload, close modal
            if (!this.patronImageFile) {
              this.toastService.success('General & Contact Information updated successfully!', 'Success');
              if (this.showGeneralModal) {
                this.showGeneralModal = false;
              }
            }

          } else {
            console.error('❌ Update failed - response not successful:', response);
            this.toastService.error('Failed to update profile. Please try again.', 'Error');
          }
        },
        error: (err: any) => {
          console.error('❌ Error saving profile:', err);
          console.error('Error details:', {
            message: err?.message,
            error: err?.error,
            status: err?.status,
            statusText: err?.statusText,
            url: err?.url
          });
          
          let errorMessage = 'Failed to update profile. Please try again.';
          if (err?.error?.message) {
            errorMessage = err.error.message;
          } else if (err?.message) {
            errorMessage = err.message;
          } else if (typeof err?.error === 'string') {
            errorMessage = err.error;
          }
          
          this.toastService.error(errorMessage, 'Error');
        }
      });
  }


  /**
   * Get official address from tenant
   */
  getOfficialAddress(): any {
    if (!this.churchProfile?.addresses || this.churchProfile.addresses.length === 0) {
      return null;
    }
    return this.churchProfile.addresses.find(addr => addr.address_type === 'official') || null;
  }

  /**
   * Format address for display
   */
  formatAddress(address: any): string {
    if (!address) return 'No address available';

    const parts: string[] = [];
    if (address.line1) parts.push(address.line1);
    if (address.line2) parts.push(address.line2);
    if (address.district) parts.push(address.district);
    if (address.state_province) parts.push(address.state_province);
    if (address.country) parts.push(address.country);
    if (address.pin_zip_code) parts.push(address.pin_zip_code);

    return parts.join(', ');
  }

  /**
   * Get formatted address lines for structured display
   */
  getAddressLines(address: any): { line1?: string; line2?: string; cityState?: string; country?: string; postalCode?: string } {
    if (!address) return {};

    const lines: any = {};
    if (address.line1) lines.line1 = address.line1;
    if (address.line2) lines.line2 = address.line2;

    // Combine city, district, and state
    const cityParts: string[] = [];
    if (address.district) cityParts.push(address.district);
    if (address.state_province) cityParts.push(address.state_province);
    if (cityParts.length > 0) lines.cityState = cityParts.join(', ');

    if (address.country) lines.country = address.country;
    if (address.pin_zip_code) lines.postalCode = address.pin_zip_code;

    return lines;
  }

  /**
   * Get primary contact name
   */
  getPrimaryContactName(): string {
    return this.churchProfile?.primary_contact?.name || 
           this.churchProfile?.primaryContact?.name || 
           'N/A';
  }

  /**
   * Get primary contact email
   */
  getPrimaryContactEmail(): string {
    return this.churchProfile?.primary_contact?.email || 
           this.churchProfile?.primaryContact?.email || 
           'N/A';
  }

  /**
   * Get primary contact phone
   */
  getPrimaryContactPhone(): string {
    return this.churchProfile?.primary_contact?.contact_number || 
           this.churchProfile?.primaryContact?.contact_number || 
           'N/A';
  }

  /**
   * Get secondary contact name
   */
  getSecondaryContactName(): string {
    return this.churchProfile?.secondary_contact?.name || 
           this.churchProfile?.secondaryContact?.name || 
           'N/A';
  }

  /**
   * Get secondary contact email
   */
  getSecondaryContactEmail(): string {
    return this.churchProfile?.secondary_contact?.email || 
           this.churchProfile?.secondaryContact?.email || 
           'N/A';
  }

  /**
   * Get secondary contact phone
   */
  getSecondaryContactPhone(): string {
    return this.churchProfile?.secondary_contact?.contact_number || 
           this.churchProfile?.secondaryContact?.contact_number || 
           'N/A';
  }

  ngOnInit(): void {
    this.checkPermissions();
    this.initializeForms();
    this.setupLeadersLoading();
    this.loadAllData();
    
    // Check for tab query parameter
    this.route.queryParams
      .pipe(takeUntil(this.destroy$))
      .subscribe(params => {
        if (params['tab'] && ['profile', 'leadership', 'statistics', 'social'].includes(params['tab'])) {
          this.setActiveTab(params['tab'] as 'profile' | 'leadership' | 'statistics' | 'social');
        }
        this.cdr.markForCheck();
      });
  }

  /**
   * Check if current user has permission to edit church profile
   */
  private checkPermissions(): void {
    const currentUser = this.authService.currentUserValue;
    
    // Align with backend guardrails: tenant admin/primary admin/church.settings.edit only.
    const hasChurchSettingsEdit = this.authService.hasPermission('church.settings.edit');
    const isPrimaryAdmin = currentUser?.is_primary_admin === true;
    const isTenantAdmin = this.authService.isTenantAdmin();
    
    const hasTenant = !!currentUser?.tenant_id;
    
    this.canEdit = hasTenant && (hasChurchSettingsEdit || isPrimaryAdmin || isTenantAdmin);
    
    // Comprehensive debug logging
    console.log('🔍 Church Profile Edit Permission Check:', {
      canEdit: this.canEdit,
      hasChurchSettingsEdit,
      isPrimaryAdmin,
      isTenantAdmin,
      hasTenant,
      userType: currentUser?.user_type,
      tenantId: currentUser?.tenant_id,
      userId: currentUser?.id,
      userName: currentUser?.name
    });
  }

  /**
   * Initialize all forms
   */
  private initializeForms(): void {
    // Church Profile Form (Extended) - Organized by sections
    this.profileForm = this.fb.group({
      // General Information Section
      denomination_id: [{ value: null, disabled: true }],
      archdiocese_id: [{ value: null, disabled: true }],
      bishop_id: [{ value: null, disabled: true }],
      founded_year: [{ value: null, disabled: true }, [Validators.min(1000), Validators.max(new Date().getFullYear() + 1)]],
      country_id: [{ value: null, disabled: true }], // Country selection for phone code updates
      
      // Contact Information Section
      phone: [{ value: '', disabled: true }, Validators.maxLength(20)],
      email: [{ value: '', disabled: true }, [Validators.email, Validators.maxLength(255)]],
      website: [{ value: '', disabled: true }, Validators.maxLength(255)],
      
      // Patron Information Section
      patron_name: [{ value: '', disabled: true }, Validators.maxLength(255)],
      
      // Identity Section (Mission, Vision, etc.)
      about: [{ value: '', disabled: true }, Validators.maxLength(5000)],
      vision: [{ value: '', disabled: true }, Validators.maxLength(2000)],
      mission: [{ value: '', disabled: true }, Validators.maxLength(2000)],
      core_values: [{ value: '', disabled: true }, Validators.maxLength(2000)],
      service_times: [{ value: '', disabled: true }, Validators.maxLength(1000)]
    });

    // Leadership Form
    this.leaderForm = this.fb.group({
      full_name: ['', [Validators.required, Validators.maxLength(255)]],
      role: ['', [Validators.required, Validators.maxLength(100)]],
      title: ['', Validators.maxLength(100)],
      email: ['', [Validators.email, Validators.maxLength(255)]],
      phone: ['', [Validators.maxLength(15), Validators.pattern(/^[0-9]*$/)]],
      appointed_date: [''],
      relieved_date: [''],
      start_date: [''],
      end_date: [''],
      biography: ['', Validators.maxLength(2000)],
      is_primary: [0],
      active: [1],
      display_order: [0]
    });

    // Watch for relieved_date changes and automatically set active to 0
    this.leaderForm.get('relieved_date')?.valueChanges
      .pipe(takeUntil(this.destroy$))
      .subscribe(relievedDate => {
        if (relievedDate && relievedDate.trim() !== '') {
          this.leaderForm.patchValue({ active: 0 }, { emitEvent: false });
        }
    });

    // Statistics Form
    this.statisticForm = this.fb.group({
      year: [new Date().getFullYear(), [Validators.required, Validators.min(1900), Validators.max(2100)]],
      month: [null, [Validators.min(1), Validators.max(12)]],
      membership_count: [null, Validators.min(0)],
      weekly_attendance: [null, Validators.min(0)],
      baptisms: [null, Validators.min(0)],
      confirmations: [null, Validators.min(0)],
      marriages: [null, Validators.min(0)],
      funerals: [null, Validators.min(0)],
      tithes_offerings: [null, Validators.min(0)],
      notes: ['', Validators.maxLength(500)]
    });

    // Social Media Form
    this.socialForm = this.fb.group({
      platform: ['', Validators.required],
      url: ['', [Validators.required, Validators.maxLength(255)]],
      username: ['', Validators.maxLength(100)],
      follower_count: [null, Validators.min(0)],
      is_primary: [0],
      active: [1],
      display_order: [0]
    });

    // Disable forms initially
    this.profileForm.disable();
  }

  /**
   * Load all data
   */
  private loadAllData(): void {
    this.loading = true;
    
    // Load church profile
    this.loadChurchProfile();
    
    // Load lookup data
    this.loadDenominations();
    this.loadArchdioceses();
    this.loadCountries();
    
    // Load management data based on active tab
    this.loadTabData();
  }

  /**
   * Load data for active tab
   */
  private loadTabData(): void {
    switch (this.activeTab) {
      case 'profile':
        this.loadExtendedProfile();
        this.loadLeaders();
        this.loadGovernanceCurrent();
        this.loadStatistics();
        this.loadOverviewMetrics();
        break;
      case 'leadership':
        this.loadLeaders();
        break;
      case 'statistics':
        this.loadStatistics();
        break;
      case 'social':
        this.loadSocialMedia();
        break;
    }
  }

  /**
   * Change active tab
   */
  setActiveTab(tab: 'profile' | 'leadership' | 'statistics' | 'social'): void {
    this.activeTab = tab;
    this.loadTabData();
  }

  // ===============================================================
  // DATA LOADING METHODS
  // ===============================================================

  /**
   * Load base church profile (tenant)
   */
  private loadChurchProfile(): void {
    this.tenantService.getChurchProfile()
      .pipe(
        finalize(() => {
          this.loading = false;
          this.cdr.markForCheck();
        }),
        takeUntil(this.destroy$)
      )
      .subscribe({
        next: (response: TenantResponse) => {
          if (response.success && response.data) {
            this.churchProfile = response.data;
          }
          this.cdr.markForCheck();
        },
        error: (err: Error) => {
          this.error = err.message;
          this.toastService.error(this.error, 'Error');
          this.cdr.markForCheck();
        }
      });
  }

  /**
   * Load denominations
   */
  private loadDenominations(): void {
    this.denominationService.getDenominations()
      .pipe(takeUntil(this.destroy$))
      .subscribe({
      next: (response) => {
        if (response.success) {
          this.denominations = response.data;
        }
      },
      error: (err: Error) => {
        console.error('Failed to load denominations:', err);
      }
    });
  }

  /**
   * Load archdioceses
   */
  private loadArchdioceses(): void {
    this.archdioceseService.getArchdioceses()
      .pipe(takeUntil(this.destroy$))
      .subscribe({
      next: (response) => {
        if (response.success && response.data) {
          this.archdioceses = response.data;
          
          // Check if there's a denomination already selected in the form
          const selectedDenomination = this.profileForm.get('denomination_id')?.value;
          if (selectedDenomination) {
            // Filter by the selected denomination
            this.onDenominationChange(selectedDenomination);
          } else {
            // No denomination selected, show all archdioceses
            this.filteredArchdioceses = this.archdioceses;
          }
        } else {
          this.archdioceses = [];
          this.filteredArchdioceses = [];
        }
      },
      error: (err: Error) => {
        console.error('Failed to load archdioceses:', err);
        this.archdioceses = [];
        this.filteredArchdioceses = [];
        this.toastService.error('Failed to load archdioceses. Please refresh the page.', 'Error');
      }
    });
  }

  /**
   * Load countries from geography service (for country selection dropdown)
   */
  private loadCountries(): void {
    this.loadingCountries = true;
    this.geographyService.getCountries()
      .pipe(takeUntil(this.destroy$))
      .subscribe({
      next: (response) => {
        if (response.success && response.data) {
          this.countries = response.data;
          console.log(`✅ Loaded ${this.countries.length} countries`);
          
          // Initialize phone code based on current country if available
          const currentCountryId = this.profileForm.get('country_id')?.value;
          if (currentCountryId) {
            this.onCountryChange(currentCountryId);
          }
        }
        this.loadingCountries = false;
      },
      error: (err: Error) => {
        console.error('Failed to load countries:', err);
        this.toastService.error('Failed to load countries', 'Error');
        this.loadingCountries = false;
      }
    });
  }
  
  /**
   * Handle country change and update phone code
   * Called when country dropdown selection changes
   * This method uses the centralized PhoneCodeService for automatic phone code updates
   */
  /**
   * Handle country change - updates phone code and triggers archdiocese filtering
   */
  onCountryChange(countryId: number | null): void {
    // Update phone code first
    if (!countryId || countryId === 0) {
      // Reset to default if no country selected
      this.phoneCodeService.resetToDefault();
      // Still trigger archdiocese filtering (will show all if no filters)
      this.filterArchdioceses();
      return;
    }
    
    // Update phone code using the centralized service
    // This automatically updates the callingCode getter which the template uses
    this.phoneCodeService.updatePhoneCodeByCountryId(countryId, this.countries)
      .pipe(takeUntil(this.destroy$))
      .subscribe({
      next: (result) => {
        if (result.success) {
          console.log(`✅ Phone code updated to ${result.phoneCode} for country: ${result.countryName}`);
          // Force change detection to update the phone code display
        } else {
          console.warn('Failed to update phone code:', result.error);
        }
        // After phone code update, filter archdioceses
        this.filterArchdioceses();
      },
      error: (error) => {
        console.error('Error updating phone code:', error);
        // Still try to filter archdioceses even if phone code update failed
        this.filterArchdioceses();
      }
    });
  }

  /**
   * Load extended church profile
   */
  private loadExtendedProfile(): void {
    this.churchProfileService.getProfile()
      .pipe(takeUntil(this.destroy$))
      .subscribe({
      next: (response) => {
        if (response.success) {
          this.extendedProfile = response.data;
          
          // Debug: Log patron image data
          if (this.extendedProfile) {
            console.log('Patron image data loaded:', {
              patron_name: this.extendedProfile.patron_name,
              patron_image_path: this.extendedProfile.patron_image_path,
              patron_image_url: this.extendedProfile.patron_image_url,
              constructedUrl: this.getPatronImageUrl('300x300')
            });
          }
          
          this.populateProfileForm(response.data);
          this.refreshOperationalMetrics();
          this.cdr.markForCheck();
          
          // After form is populated, if denomination is selected, filter archdioceses
          if (response.data.denomination_id) {
            // Use setTimeout to ensure form value is set, then check for archdioceses
            setTimeout(() => {
              if (this.archdioceses.length > 0) {
                // Archdioceses already loaded, filter immediately
                console.log('Profile loaded with denomination, filtering archdioceses');
                this.onDenominationChange(response.data.denomination_id);
              } else {
                // Wait for archdioceses to load, then filter
                console.log('Waiting for archdioceses to load before filtering...');
                const checkLoaded = setInterval(() => {
                  if (this.archdioceses.length > 0) {
                    clearInterval(checkLoaded);
                    console.log('Archdioceses loaded, now filtering for denomination:', response.data.denomination_id);
                    this.onDenominationChange(response.data.denomination_id);
                  }
                }, 50);
                // Clear after 3 seconds max to avoid infinite loop
                setTimeout(() => {
                  clearInterval(checkLoaded);
                  if (this.archdioceses.length === 0) {
                    console.error('Timeout waiting for archdioceses to load');
                  }
                }, 3000);
              }
            }, 100);
          }
        }
      },
      error: (err: Error) => {
        console.error('Failed to load extended profile:', err);
      }
    });

    // Load pope details
    this.loadPopeDetails();
  }

  /**
   * Load pope details
   */
  private loadPopeDetails(): void {
    this.popeDetailsService.getPopeDetails()
      .pipe(takeUntil(this.destroy$))
      .subscribe({
      next: (response) => {
        if (response.success) {
          this.popeDetails = response.data;
        }
      },
      error: (err: Error) => {
        console.error('Failed to load pope details:', err);
        // Set to null on error - won't break the UI
        this.popeDetails = null;
      }
    });
  }

  /**
   * Get backend storage base URL
   * Constructs the correct backend URL for storage files
   */
  private getStorageBaseUrl(): string {
    // Get backend base URL from environment (remove /api suffix if present)
    const baseUrl = environment.apiUrl.replace('/api', '');
    // Ensure it ends with /storage/
    return baseUrl.endsWith('/') ? `${baseUrl}storage/` : `${baseUrl}/storage/`;
  }

  /**
   * Get pope image URL (with thumbnail fallback)
   */
  getPopeImageUrl(size: '128x128' | '300x300' | 'original' = '300x300'): string | null {
    if (!this.popeDetails) {
      return null;
    }

    // Priority 1: Use direct URL if available (for original size)
    if (size === 'original' && this.popeDetails.pope_image_url) {
      return this.popeDetails.pope_image_url;
    }

    // Priority 2: Construct thumbnail URL from image path
    const imagePath = this.popeDetails.pope_image_path;
    if (imagePath) {
      if (size !== 'original') {
        // Construct thumbnail path
        const pathInfo = imagePath.split('.');
        const extension = pathInfo.pop();
        const basePath = pathInfo.join('.');
        const thumbnailPath = `${basePath}_${size}.${extension}`;
        
        // Construct full URL from storage path
        const baseUrl = this.getStorageBaseUrl();
        const thumbnailUrl = baseUrl + thumbnailPath;
        
        // Return thumbnail URL if available, otherwise fall back to original
        return thumbnailUrl;
      } else {
        // For original, construct URL from path
        const baseUrl = this.getStorageBaseUrl();
        return baseUrl + imagePath;
      }
    }

    // Priority 3: Fallback to direct URL (even if not original size)
    if (this.popeDetails.pope_image_url) {
      return this.popeDetails.pope_image_url;
    }

    // No image available
    return null;
  }

  /**
   * Get pope name for display
   */
  getPopeName(): string {
    return this.popeDetails?.pope_name || 'Not Set';
  }

  /**
   * Handle pope image error - try fallback
   */
  handlePopeImageError(event: any): void {
    const img = event.target;
    
    // Try original size as fallback
    if (this.popeDetails?.pope_image_url) {
      if (img.src !== this.popeDetails.pope_image_url) {
        img.src = this.popeDetails.pope_image_url;
        return;
      }
    }
    
    // If still failing, hide the image
    img.style.display = 'none';
    console.warn('Failed to load pope image:', img.src);
  }

  /**
   * Get patron image URL (with thumbnail fallback)
   */
  getPatronImageUrl(size: '128x128' | '300x300' | 'original' = '300x300'): string | null {
    if (!this.extendedProfile) {
      return null;
    }

    const imagePath = this.extendedProfile.patron_image_path;
    const imageUrl = this.extendedProfile.patron_image_url;

    // If no path or URL, return null
    if (!imagePath && !imageUrl) {
      return null;
    }

    // For original size, prefer URL, then path
    if (size === 'original') {
      if (imageUrl) {
        return imageUrl;
      }
      if (imagePath) {
        const baseUrl = this.getStorageBaseUrl();
        return baseUrl + imagePath;
      }
      return null;
    }

    // For thumbnails, try to construct from path first
    if (imagePath) {
      try {
        const pathParts = imagePath.split('.');
        if (pathParts.length >= 2) {
          const extension = pathParts.pop();
          const basePath = pathParts.join('.');
          const thumbnailPath = `${basePath}_${size}.${extension}`;
          const baseUrl = this.getStorageBaseUrl();
          return baseUrl + thumbnailPath;
        } else {
          // Path doesn't have extension, use as-is
          const baseUrl = this.getStorageBaseUrl();
          return baseUrl + imagePath;
        }
      } catch (e) {
        console.warn('Error constructing thumbnail URL:', e);
        // Fallback to original path
        if (imagePath) {
          const baseUrl = this.getStorageBaseUrl();
          return baseUrl + imagePath;
        }
      }
    }

    // Fallback to original URL if path construction failed
    if (imageUrl) {
      return imageUrl;
    }

    return null;
  }

  /**
   * Handle patron image file selection
   */
  onPatronImageSelected(event: Event): void {
    const input = event.target as HTMLInputElement;
    if (input.files && input.files.length > 0) {
      const file = input.files[0];
      
      // Validate file type
      const allowedTypes = ['image/jpeg', 'image/jpg', 'image/png', 'image/webp'];
      if (!allowedTypes.includes(file.type)) {
        this.toastService.error('Invalid file type. Please upload JPG, PNG, or WEBP image.', 'Error');
        return;
      }

      // Validate file size (3MB max)
      if (file.size > 3 * 1024 * 1024) {
        this.toastService.error('File size exceeds 3MB limit.', 'Error');
        return;
      }

      this.patronImageFile = file;

      // Create preview
      const reader = new FileReader();
      reader.onload = (e: any) => {
        this.patronImagePreview = e.target.result;
      };
      reader.readAsDataURL(file);
    }
  }

  /**
   * Upload patron image file
   */
  private uploadPatronImageFile(): void {
    if (!this.patronImageFile) {
      return;
    }

    this.uploadingPatronImage = true;
    this.churchProfileService.uploadPatronImage(this.patronImageFile).subscribe({
      next: (response) => {
        if (response.success) {
          this.patronImagePreview = null;
          this.patronImageFile = null;
          
          // Update extended profile with new image data
          if (this.extendedProfile) {
            this.extendedProfile.patron_image_path = response.data.patron_image_path;
            this.extendedProfile.patron_image_url = response.data.patron_image_url;
          }

          this.toastService.success('Patron image uploaded successfully!', 'Success');
          
          // Reload profile to get latest data
          this.loadExtendedProfile();
          
          if (this.showGeneralModal) {
            this.showGeneralModal = false;
          }
        }
        this.uploadingPatronImage = false;
      },
      error: (err: any) => {
        console.error('Error uploading patron image:', err);
        this.toastService.error('Failed to upload patron image. Please try again.', 'Error');
        this.uploadingPatronImage = false;
      }
    });
  }

  /**
   * Get patron image URL with comprehensive fallback
   */
  getPatronImageUrlWithFallback(): string {
    if (!this.extendedProfile) {
      return '';
    }

    // Try thumbnail first
    const thumbnailUrl = this.getPatronImageUrl('300x300');
    if (thumbnailUrl) {
      return thumbnailUrl;
    }

    // Try original size
    const originalUrl = this.getPatronImageUrl('original');
    if (originalUrl) {
      return originalUrl;
    }

    // Try direct URL
    if (this.extendedProfile.patron_image_url) {
      return this.extendedProfile.patron_image_url;
    }

    // Construct from path
    return this.getPatronImagePathUrl();
  }

  /**
   * Get patron image URL directly from path
   */
  getPatronImagePathUrl(): string {
    if (!this.extendedProfile?.patron_image_path) {
      return '';
    }
    const baseUrl = this.getStorageBaseUrl();
    return baseUrl + this.extendedProfile.patron_image_path;
  }

  /**
   * Handle patron image error - try fallback
   */
  handlePatronImageError(event: any): void {
    const img = event.target;
    
    // Try original size as fallback
    if (this.extendedProfile?.patron_image_url) {
      if (img.src !== this.extendedProfile.patron_image_url) {
        img.src = this.extendedProfile.patron_image_url;
        return;
      }
    }
    
    // Try original path URL
    if (this.extendedProfile?.patron_image_path) {
      const baseUrl = this.getStorageBaseUrl();
      const originalUrl = baseUrl + this.extendedProfile.patron_image_path;
      if (img.src !== originalUrl) {
        img.src = originalUrl;
        return;
      }
    }
    
    // If still failing, hide the image
    img.style.display = 'none';
    console.warn('Failed to load patron image:', {
      attemptedUrl: img.src,
      patron_image_url: this.extendedProfile?.patron_image_url,
      patron_image_path: this.extendedProfile?.patron_image_path
    });
  }

  /**
   * Remove patron image
   */
  removePatronImage(): void {
    if (!this.extendedProfile?.patron_image_path) {
      this.patronImagePreview = null;
      this.patronImageFile = null;
      return;
    }

    this.uploadingPatronImage = true;
    this.churchProfileService.deletePatronImage().subscribe({
      next: (response) => {
        if (response.success) {
          this.patronImagePreview = null;
          this.patronImageFile = null;
          
          // Update extended profile
          if (this.extendedProfile) {
            this.extendedProfile.patron_image_path = undefined;
            this.extendedProfile.patron_image_url = undefined;
          }

          this.toastService.success('Patron image removed successfully!', 'Success');
          
          // Reload profile
          this.loadExtendedProfile();
        }
        this.uploadingPatronImage = false;
      },
      error: (err: any) => {
        console.error('Error deleting patron image:', err);
        this.toastService.error('Failed to remove patron image. Please try again.', 'Error');
        this.uploadingPatronImage = false;
      }
    });
  }

  /**
   * Load church leaders (both active and inactive)
   * Backend already sorts the data, so no client-side sorting needed
   */
  private setupLeadersLoading(): void {
    this.leadersLoadTrigger$
      .pipe(
        switchMap(() => {
          this.loadingLeaders = true;
          this.cdr.markForCheck();
          return this.leadershipService.getLeaders({}).pipe(
            finalize(() => {
              this.loadingLeaders = false;
              this.cdr.markForCheck();
            })
          );
        }),
        takeUntil(this.destroy$)
      )
      .subscribe({
        next: (response) => {
          if (response.success && response.data) {
            this.leaders = response.data;
            this.overviewMinistries = this.leaders.filter((l) => Number(l.active) === 1).length;
            this.refreshSnapshotDisplay();
            this.refreshOperationalMetrics();
            this.cdr.markForCheck();
          } else {
            console.error('Failed to load leaders:', response);
            this.toastService.error('Failed to load leaders. Please try again.', 'Error');
            this.leaders = [];
            this.cdr.markForCheck();
          }
        },
        error: (err: Error) => {
          console.error('Error loading leaders:', err);
          this.toastService.error(err.message || 'Failed to load leaders. Please try again.', 'Error');
          this.leaders = [];
          this.cdr.markForCheck();
        }
      });
  }

  private loadLeaders(): void {
    this.leadersLoadTrigger$.next();
  }

  private loadGovernanceCurrent(): void {
    this.leadershipGovernanceService.getCurrent().pipe(takeUntil(this.destroy$)).subscribe({
      next: (response) => {
        if (response.success && response.data) {
          this.governanceCurrent = response.data;
          this.overviewMinistries = response.data.active_count;
          this.refreshOperationalMetrics();
          this.cdr.markForCheck();
        }
      },
      error: () => {
        // Profile tab can still fall back to legacy leaders.
      },
    });
  }

  private mergeLeaderIntoList(leader: ChurchLeadership): void {
    const index = this.leaders.findIndex((item) => item.id === leader.id);
    if (index >= 0) {
      this.leaders = [
        ...this.leaders.slice(0, index),
        leader,
        ...this.leaders.slice(index + 1)
      ];
    } else {
      this.leaders = [leader, ...this.leaders];
    }
    this.overviewMinistries = this.leaders.filter((l) => Number(l.active) === 1).length;
    this.refreshSnapshotDisplay();
    this.refreshOperationalMetrics();
    this.cdr.markForCheck();
  }

  /**
   * Load church statistics
   */
  private loadStatistics(): void {
    this.statisticsService.getStatistics({ limit: 12 }).subscribe({
      next: (response) => {
        if (response.success) {
          this.statistics = response.data;
          this.refreshOperationalMetrics();
          this.cdr.markForCheck();
        }
      },
      error: (err: Error) => {
        this.toastService.error(err.message, 'Error');
      }
    });
  }

  /**
   * Load social media accounts
   */
  private loadSocialMedia(): void {
    this.socialMediaService.getSocialMedia({ active: 1 }).subscribe({
      next: (response) => {
        if (response.success) {
          this.socialMedia = response.data;
        }
      },
      error: (err: Error) => {
        this.toastService.error(err.message, 'Error');
      }
    });
  }

  // ===============================================================
  // CHURCH PROFILE MANAGEMENT
  // ===============================================================

  /**
   * Populate profile form with data
   */
  private populateProfileForm(profile: ChurchProfile): void {
    this.profileForm.patchValue({
      denomination_id: profile.denomination_id,
      archdiocese_id: profile.archdiocese_id,
      bishop_id: profile.bishop_id,
      founded_year: profile.founded_year,
      country_id: this.getCountryIdFromName(profile.country) || this.getCountryIdFromTenantAddress(),
      phone: profile.phone,
      email: profile.email,
      website: profile.website,
      patron_name: profile.patron_name || '',
      about: profile.about,
      vision: profile.vision,
      mission: profile.mission,
      core_values: profile.core_values,
      service_times: profile.service_times
    });
  }

  /**
   * Get state_id from tenant's addresses (if available)
   * State filtering is optional - if not available, filtering will proceed without it
   */
  private getTenantStateId(): number | null {
    try {
      const tenant = this.store.selectSignal(selectCurrentTenant)();
      if (!tenant) return null;
      
      // Check addresses array for primary/default address with state_id
      if (tenant.addresses && Array.isArray(tenant.addresses)) {
        const primaryAddress = tenant.addresses.find(
          addr => addr.is_default === true || addr.address_type === 'official'
        ) || tenant.addresses[0];
        
        if (primaryAddress?.state_id) {
          return primaryAddress.state_id;
        }
      }
      
      return null;
    } catch (err) {
      console.warn('Could not get tenant state_id:', err);
      return null;
    }
  }

  /**
   * Unified method to filter archdioceses by denomination, country, and state
   */
  private filterArchdioceses(): void {
    const denominationId = this.profileForm.get('denomination_id')?.value;
    const countryId = this.profileForm.get('country_id')?.value;
    const stateId = this.getTenantStateId(); // Get from tenant's official address

    console.log('🔍 Filtering archdioceses with:', {
      denomination_id: denominationId,
      country_id: countryId,
      state_id: stateId
    });

    // Build filter object
    const filters: {
      denomination_id?: number;
      country_id?: number;
      state_id?: number;
    } = {};

    if (denominationId) {
      filters.denomination_id = denominationId;
    }
    if (countryId) {
      filters.country_id = countryId;
    }
    if (stateId) {
      filters.state_id = stateId;
    }

    // If no filters are selected, show all archdioceses
    if (Object.keys(filters).length === 0) {
      console.log('No filters selected, showing all archdioceses');
      this.filteredArchdioceses = this.archdioceses || [];
      return;
    }

    // Call API with filters
    this.archdioceseService.getArchdioceses(filters).subscribe({
      next: (response) => {
        console.log('✅ Archdioceses API response:', response);
        if (response.success && response.data) {
          if (response.data.length > 0) {
            this.filteredArchdioceses = response.data;
            console.log(`✅ Loaded ${response.data.length} filtered archdioceses`);
          } else {
            // Filter returned 0 results - show empty list
            console.warn('⚠️ No archdioceses found with current filters');
            this.filteredArchdioceses = [];
            this.toastService.info(
              'No archdioceses found matching the selected filters. Please adjust your filters to see results.',
              'No Results',
              5000
            );
          }
        } else {
          // Empty response or failed - fall back to all archdioceses
          console.warn('⚠️ Filtering returned empty response, falling back to all archdioceses');
          this.filteredArchdioceses = this.archdioceses || [];
        }
      },
      error: (err) => {
        console.error('❌ Failed to filter archdioceses:', err);
        // On error, fall back to showing all archdioceses
        this.filteredArchdioceses = this.archdioceses || [];
        this.toastService.warning('Could not filter archdioceses. Showing all available options.', 'Warning');
      }
    });
  }

  /**
   * Handle denomination change - triggers unified filtering
   */
  onDenominationChange(denominationId: number | null | any): void {
    // Handle ng-select change event - it can return the value directly or an object
    const id = typeof denominationId === 'object' && denominationId !== null 
      ? denominationId.id 
      : denominationId;
    
    console.log('📝 Denomination changed to:', id);
    
    // Enable/disable archdiocese control based on denomination
    const archdioceseControl = this.profileForm.get('archdiocese_id');
    if (archdioceseControl) {
      if (id) {
        archdioceseControl.enable({ emitEvent: false });
      } else {
        archdioceseControl.disable({ emitEvent: false });
        archdioceseControl.setValue(null, { emitEvent: false });
      }
    }
    
    this.filterArchdioceses();
  }

  /**
   * Ensure archdioceses are loaded and filtered based on current filters (denomination, country, state)
   */
  private ensureArchdiocesesLoaded(): void {
    // If archdioceses haven't been loaded yet, load them first, then filter
    if (this.archdioceses.length === 0) {
      console.log('📥 Loading archdioceses...');
      this.archdioceseService.getArchdioceses()
      .pipe(takeUntil(this.destroy$))
      .subscribe({
        next: (response) => {
          console.log('✅ Archdioceses loaded, total:', response.data?.length || 0);
          if (response.success && response.data) {
            this.archdioceses = response.data;
            
            // Now apply unified filtering based on current form values
            this.filterArchdioceses();
          } else {
            console.warn('⚠️ Failed to load archdioceses - empty response');
            this.archdioceses = [];
            this.filteredArchdioceses = [];
          }
        },
        error: (err) => {
          console.error('❌ Failed to load archdioceses:', err);
          this.archdioceses = [];
          this.filteredArchdioceses = [];
        }
      });
    } else {
      // Archdioceses already loaded, just apply unified filtering
      console.log('✅ Archdioceses already loaded, applying filters');
      this.filterArchdioceses();
    }
  }

  /**
   * Start editing a specific section
   */
  startEditSection(section: 'general' | 'contact' | 'identity'): void {
    if (!this.canEdit) {
      this.toastService.warning('You do not have permission to edit.', 'Permission Denied');
      return;
    }
    
    this.editingSections[section] = true;
    
    // Enable fields for this section
    if (section === 'general') {
      const controlsToEnable = [
        'denomination_id',
        'founded_year',
        'country_id'
      ];
      
      controlsToEnable.forEach(controlName => {
        const control = this.profileForm.get(controlName);
        if (control) {
          control.enable({ emitEvent: false });
        }
      });
      
      // Enable archdiocese_id only if denomination is selected
      const archdioceseControl = this.profileForm.get('archdiocese_id');
      const denominationId = this.profileForm.get('denomination_id')?.value;
      if (archdioceseControl) {
        if (denominationId) {
          archdioceseControl.enable({ emitEvent: false });
        } else {
          archdioceseControl.disable({ emitEvent: false });
        }
      }
      
      // Update phone code based on current country selection
      const countryId = this.profileForm.get('country_id')?.value;
      if (countryId) {
        this.onCountryChange(countryId);
      } else {
        // If no country selected, use default
        this.phoneCodeService.resetToDefault();
      }
    } else if (section === 'contact') {
      const controlsToEnable = ['phone', 'email', 'website'];
      controlsToEnable.forEach(controlName => {
        const control = this.profileForm.get(controlName);
        if (control) {
          control.enable({ emitEvent: false });
        }
      });
    } else if (section === 'identity') {
      const controlsToEnable = ['about', 'vision', 'mission', 'core_values', 'service_times'];
      controlsToEnable.forEach(controlName => {
        const control = this.profileForm.get(controlName);
        if (control) {
          control.enable({ emitEvent: false });
        }
      });
    }
  }

  /**
   * Cancel editing a specific section
   */
  cancelEditSection(section: 'general' | 'contact' | 'identity'): void {
    this.editingSections[section] = false;
    
    // Disable fields for this section and restore values
    if (this.extendedProfile) {
      this.populateProfileForm(this.extendedProfile);
    }
    
    if (section === 'general') {
      this.profileForm.get('denomination_id')?.disable();
      this.profileForm.get('archdiocese_id')?.disable();
      this.profileForm.get('bishop_id')?.disable();
      this.profileForm.get('founded_year')?.disable();
      // Country is always disabled - read-only from tenant
    } else if (section === 'contact') {
      this.profileForm.get('phone')?.disable();
      this.profileForm.get('email')?.disable();
      this.profileForm.get('website')?.disable();
    } else if (section === 'identity') {
      this.profileForm.get('about')?.disable();
      this.profileForm.get('vision')?.disable();
      this.profileForm.get('mission')?.disable();
      this.profileForm.get('core_values')?.disable();
      this.profileForm.get('service_times')?.disable();
    }
  }

  /**
   * Save a specific section
   */
  saveSection(section: 'general' | 'contact' | 'identity'): void {
    // Validate fields for this section
    let sectionFields: string[] = [];
    
    if (section === 'general') {
      sectionFields = ['denomination_id', 'archdiocese_id', 'bishop_id', 'founded_year'];
      // Country is NOT included - it's read-only from tenant creation
    } else if (section === 'contact') {
      sectionFields = ['phone', 'email', 'website'];
    } else if (section === 'identity') {
      sectionFields = ['about', 'vision', 'mission', 'core_values', 'service_times'];
    }
    
    // Check if section fields are valid
    const sectionInvalid = sectionFields.some(field => this.profileForm.get(field)?.invalid);
    
    if (sectionInvalid) {
      this.toastService.warning('Please fill in all required fields correctly.', 'Validation Error');
      return;
    }

    this.saving = true;
    
    // Get all form values (disabled fields are included with getRawValue)
    const formData = this.profileForm.getRawValue();

    this.churchProfileService.updateProfile(formData)
      .pipe(
        finalize(() => {
          this.saving = false;
          this.cdr.markForCheck();
        }),
        takeUntil(this.destroy$)
      )
      .subscribe({
        next: (response) => {
          if (response.success) {
            this.extendedProfile = response.data;
            this.editingSections[section] = false;
            
            // Disable the section fields
            sectionFields.forEach(field => {
              this.profileForm.get(field)?.disable();
            });
            
            this.toastService.success(`${this.getSectionTitle(section)} updated successfully!`, 'Success');

            // Close modal if open for this section
            if (section === 'general' && this.showGeneralModal) {
              this.showGeneralModal = false;
            }
          }
        },
        error: (err: Error) => {
          this.toastService.error(err.message, 'Error');
        }
      });
  }

  /**
   * Get section title for display
   */
  getSectionTitle(section: 'general' | 'contact' | 'identity'): string {
    const titles = {
      general: 'General Information',
      contact: 'Contact Information',
      identity: 'Church Identity'
    };
    return titles[section];
  }

  /**
   * Check if any section is being edited
   */
  isAnySectonEditing(): boolean {
    return this.editingSections.general || this.editingSections.contact || this.editingSections.identity;
  }

  // ===============================================================
  // LEADERSHIP MANAGEMENT
  // ===============================================================

  /**
   * Open leader detail panel
   */
  openLeaderDetail(leader: ChurchLeadership): void {
    this.viewingLeader = leader;
    this.showLeaderDetail = true;
    this.cdr.markForCheck();
  }

  /**
   * Close leader detail panel
   */
  closeLeaderDetail(): void {
    this.showLeaderDetail = false;
    this.viewingLeader = null;
    this.cdr.markForCheck();
  }

  /**
   * Open edit from detail panel
   */
  onLeaderDetailEdit(leader: ChurchLeadership): void {
    this.closeLeaderDetail();
    this.openEditLeaderModal(leader);
  }

  /**
   * Delete from detail panel
   */
  onLeaderDetailDelete(leader: ChurchLeadership): void {
    this.deleteLeader(leader);
  }

  /**
   * Open new leader modal
   */
  openNewLeaderModal(): void {
    if (!this.canEdit) {
      this.toastService.warning('You do not have permission to add leaders.', 'Permission Denied');
      return;
    }
    this.selectedLeader = null;
    this.showLeaderModal = true;
    this.cdr.markForCheck();
  }

  /**
   * Format date for HTML date input (YYYY-MM-DD)
   */
  private formatDateForInput(dateString: string | null | undefined): string {
    if (!dateString) return '';
    try {
      const date = new Date(dateString);
      if (isNaN(date.getTime())) return '';
      const year = date.getFullYear();
      const month = String(date.getMonth() + 1).padStart(2, '0');
      const day = String(date.getDate()).padStart(2, '0');
      return `${year}-${month}-${day}`;
    } catch {
      return '';
    }
  }

  /**
   * Open edit leader modal
   */
  openEditLeaderModal(leader: ChurchLeadership): void {
    if (!this.canEdit) {
      this.toastService.warning('You do not have permission to edit leaders.', 'Permission Denied');
      return;
    }
    this.selectedLeader = leader;
    this.showLeaderModal = true;
    this.cdr.markForCheck();
  }

  /**
   * Close leader workspace
   */
  closeLeaderModal(): void {
    this.showLeaderModal = false;
    this.selectedLeader = null;
    this.loadLeaders();
    this.cdr.markForCheck();
  }

  onLeaderWorkspaceSaved(leader?: ChurchLeadership): void {
    if (leader) {
      this.mergeLeaderIntoList(leader);
    }
    this.loadLeaders();
  }

  /**
   * Handle keyboard events for modal accessibility
   */
  @HostListener('document:keydown', ['$event'])
  handleKeyboardEvent(event: KeyboardEvent): void {
    // Close modal on Escape key
    if (event.key === 'Escape' && !this.saving) {
      event.preventDefault();
      // General Information uses app-modal-shell (owns Escape).
      if (this.showLeaderModal) {
        this.closeLeaderModal();
      } else if (this.showStatisticModal) {
        this.closeStatisticModal();
      } else if (this.showSocialModal) {
        this.closeSocialModal();
      }
    }
  }

  ngOnDestroy(): void {
    this.destroy$.next();
    this.destroy$.complete();
    // Cleanup is handled by Angular
  }

  /**
   * Delete leader
   */
  deleteLeader(leader: ChurchLeadership): void {
    if (!this.canEdit) {
      this.toastService.warning('You do not have permission to delete leaders.', 'Permission Denied');
      return;
    }

    if (!confirm(`Are you sure you want to delete ${leader.full_name}?`)) {
      return;
    }

    this.leadershipService.deleteLeader(leader.id).subscribe({
      next: (response) => {
        if (response.success) {
          if (this.viewingLeader?.id === leader.id) {
            this.closeLeaderDetail();
          }
          this.loadLeaders();
          this.toastService.success('Leader deleted successfully!', 'Success');
        }
      },
      error: (err: Error) => {
        this.toastService.error(err.message, 'Error');
      }
    });
  }

  // ===============================================================
  // STATISTICS MANAGEMENT
  // ===============================================================

  /**
   * Open new statistic modal
   */
  openNewStatisticModal(): void {
    if (!this.canEdit) {
      this.toastService.warning('You do not have permission to add statistics.', 'Permission Denied');
      return;
    }
    this.selectedStatistic = null;
    this.statisticForm.reset({ year: new Date().getFullYear() });
    this.showStatisticModal = true;
  }

  /**
   * Open edit statistic modal
   */
  openEditStatisticModal(statistic: ChurchStatistic): void {
    if (!this.canEdit) {
      this.toastService.warning('You do not have permission to edit statistics.', 'Permission Denied');
      return;
    }
    this.selectedStatistic = statistic;
    this.statisticForm.patchValue(statistic);
    this.showStatisticModal = true;
  }

  /**
   * Close statistic modal
   */
  closeStatisticModal(): void {
    this.showStatisticModal = false;
    this.selectedStatistic = null;
    this.statisticForm.reset();
  }

  /**
   * Save statistic
   */
  saveStatistic(): void {
    if (this.statisticForm.invalid) {
      this.toastService.warning('Please fill in all required fields.', 'Validation Error');
      return;
    }

    this.saving = true;
    const formData = this.statisticForm.value;

    const request = this.selectedStatistic
      ? this.statisticsService.updateStatistic(this.selectedStatistic.id, formData)
      : this.statisticsService.createStatistic(formData);

    request.pipe(finalize(() => this.saving = false)).subscribe({
      next: (response) => {
        if (response.success) {
          this.loadStatistics();
          this.closeStatisticModal();
          this.toastService.success(
            this.selectedStatistic ? 'Statistic updated successfully!' : 'Statistic added successfully!',
            'Success'
          );
        }
      },
      error: (err: Error) => {
        this.toastService.error(err.message, 'Error');
      }
    });
  }

  /**
   * Delete statistic
   */
  deleteStatistic(statistic: ChurchStatistic): void {
    if (!this.canEdit) {
      this.toastService.warning('You do not have permission to delete statistics.', 'Permission Denied');
      return;
    }

    if (!confirm(`Are you sure you want to delete this statistic?`)) {
      return;
    }

    this.statisticsService.deleteStatistic(statistic.id).subscribe({
      next: (response) => {
        if (response.success) {
          this.loadStatistics();
          this.toastService.success('Statistic deleted successfully!', 'Success');
        }
      },
      error: (err: Error) => {
        this.toastService.error(err.message, 'Error');
      }
    });
  }

  // ===============================================================
  // SOCIAL MEDIA MANAGEMENT
  // ===============================================================

  /**
   * Open new social media modal
   */
  openNewSocialModal(): void {
    if (!this.canEdit) {
      this.toastService.warning('You do not have permission to add social media accounts.', 'Permission Denied');
      return;
    }
    this.selectedSocialMedia = null;
    this.socialForm.reset({ active: 1, is_primary: 0, display_order: 0 });
    this.showSocialModal = true;
  }

  /**
   * Open edit social media modal
   */
  openEditSocialModal(social: ChurchSocialMedia): void {
    if (!this.canEdit) {
      this.toastService.warning('You do not have permission to edit social media accounts.', 'Permission Denied');
      return;
    }
    this.selectedSocialMedia = social;
    this.socialForm.patchValue(social);
    this.showSocialModal = true;
  }

  /**
   * Close social media modal
   */
  closeSocialModal(): void {
    this.showSocialModal = false;
    this.selectedSocialMedia = null;
    this.socialForm.reset();
  }

  /**
   * Save social media
   */
  saveSocialMedia(): void {
    if (this.socialForm.invalid) {
      this.toastService.warning('Please fill in all required fields.', 'Validation Error');
      return;
    }

    this.saving = true;
    const formData = this.socialForm.value;

    const request = this.selectedSocialMedia
      ? this.socialMediaService.updateSocialMedia(this.selectedSocialMedia.id, formData)
      : this.socialMediaService.createSocialMedia(formData);

    request.pipe(finalize(() => this.saving = false)).subscribe({
      next: (response) => {
        if (response.success) {
          this.loadSocialMedia();
          this.closeSocialModal();
          this.toastService.success(
            this.selectedSocialMedia ? 'Social media account updated successfully!' : 'Social media account added successfully!',
            'Success'
          );
        }
      },
      error: (err: Error) => {
        this.toastService.error(err.message, 'Error');
      }
    });
  }

  /**
   * Delete social media
   */
  deleteSocialMedia(social: ChurchSocialMedia): void {
    if (!this.canEdit) {
      this.toastService.warning('You do not have permission to delete social media accounts.', 'Permission Denied');
      return;
    }

    if (!confirm(`Are you sure you want to delete this social media account?`)) {
      return;
    }

    this.socialMediaService.deleteSocialMedia(social.id).subscribe({
      next: (response) => {
        if (response.success) {
          this.loadSocialMedia();
          this.toastService.success('Social media account deleted successfully!', 'Success');
        }
      },
      error: (err: Error) => {
        this.toastService.error(err.message, 'Error');
      }
    });
  }

  /**
   * Get platform icon for social media
   */
  getPlatformIcon(platform: string): string {
    const platformData = this.socialPlatforms.find(p => p.value === platform);
    return platformData ? platformData.icon : '🔗';
  }
  
  /**
   * Get country ID from country name (helper method)
   */
  private getCountryIdFromName(countryName: string | null | undefined): number | null {
    if (!countryName || this.countries.length === 0) {
      return null;
    }
    
    const country = this.countries.find(c => 
      c.name.toLowerCase() === countryName.toLowerCase() ||
      c.name === countryName
    );
    
    return country?.id || null;
  }
  
  /**
   * Get country ID from tenant's official address (fallback method)
   */
  private getCountryIdFromTenantAddress(): number | null {
    if (this.churchProfile?.addresses && this.churchProfile.addresses.length > 0) {
      const officialAddress = this.churchProfile.addresses.find(addr => addr.address_type === 'official');
      if (officialAddress?.country) {
        return this.getCountryIdFromName(officialAddress.country);
      }
    }
    return null;
  }
  
  /**
   * Get the country from the tenant's official address
   * Country is set at tenant creation and can now be edited
   */
  getTenantCountry(): string {
    if (this.churchProfile?.addresses && this.churchProfile.addresses.length > 0) {
      const officialAddress = this.churchProfile.addresses.find(addr => addr.address_type === 'official');
      return officialAddress?.country || 'Not Set';
    }
    return 'Not Set';
  }

  /**
   * Get diocese name
   */
  getDioceseName(): string {
    if (this.extendedProfile?.archdiocese?.name) {
      return this.extendedProfile.archdiocese.name;
    }
    return 'Not Set';
  }

  /**
   * Format diocese location
   */
  formatDioceseLocation(): string {
    const parts: string[] = [];
    if (this.extendedProfile?.archdiocese?.headquarters_city) {
      parts.push(this.extendedProfile.archdiocese.headquarters_city);
    }
    if (this.extendedProfile?.archdiocese?.country) {
      parts.push(this.extendedProfile.archdiocese.country);
    }
    return parts.join(', ') || 'Location not specified';
  }

  /**
   * Check if diocese has address information
   */
  hasDioceseAddress(): boolean {
    return !!(
      this.extendedProfile?.archdiocese?.headquarters_city ||
      this.extendedProfile?.archdiocese?.country
    );
  }

  /**
   * Get diocese address line 1 (if available from address relationship)
   */
  getDioceseAddressLine1(): string {
    if (!this.extendedProfile?.archdiocese) {
      return '';
    }

    // If archdiocese has addresses relationship loaded
    // @ts-ignore - addresses might be available if loaded
    const addresses = this.extendedProfile.archdiocese.addresses;
    if (addresses && Array.isArray(addresses) && addresses.length > 0) {
      const officialAddress = addresses.find((addr: any) => addr.address_type === 'official' || addr.is_default);
      if (officialAddress?.line1) {
        return officialAddress.line1;
      }
    }

    // Fallback: use headquarters_city if available
    return this.extendedProfile.archdiocese.headquarters_city || '';
  }

  /**
   * Get diocese address line 2
   */
  getDioceseAddressLine2(): string {
    if (!this.extendedProfile?.archdiocese) {
      return '';
    }

    // @ts-ignore - addresses might be available if loaded
    const addresses = this.extendedProfile.archdiocese.addresses;
    if (addresses && Array.isArray(addresses) && addresses.length > 0) {
      const officialAddress = addresses.find((addr: any) => addr.address_type === 'official' || addr.is_default);
      if (officialAddress?.line2) {
        return officialAddress.line2;
      }
    }

    return '';
  }

  /**
   * Get diocese city and state
   */
  getDioceseAddressCityState(): string {
    if (!this.extendedProfile?.archdiocese) {
      return '';
    }

    const parts: string[] = [];
    
    // Check if archdiocese has addresses relationship loaded
    // @ts-ignore - addresses might be available if loaded
    const addresses = this.extendedProfile.archdiocese.addresses;
    if (addresses && Array.isArray(addresses) && addresses.length > 0) {
      const officialAddress = addresses.find((addr: any) => addr.address_type === 'official' || addr.is_default);
      if (officialAddress) {
        if (officialAddress.city) parts.push(officialAddress.city);
        if (officialAddress.state_province) parts.push(officialAddress.state_province);
        if (officialAddress.district) parts.push(officialAddress.district);
        if (officialAddress.pin_zip_code) parts.push(officialAddress.pin_zip_code);
      }
    } else {
      // Fallback to basic archdiocese fields
      if (this.extendedProfile.archdiocese.headquarters_city) {
        parts.push(this.extendedProfile.archdiocese.headquarters_city);
      }
      if (this.extendedProfile.archdiocese.region) {
        parts.push(this.extendedProfile.archdiocese.region);
      }
    }

    return parts.join(', ') || '';
  }

  /**
   * Format website URL for display (remove protocol)
   */
  formatWebsiteUrl(url: string | null | undefined): string {
    if (!url) return '';
    
    // Remove protocol and www for cleaner display
    return url
      .replace(/^https?:\/\//, '')
      .replace(/^www\./, '')
      .replace(/\/$/, ''); // Remove trailing slash
  }

  /**
   * Format date for display
   */
  formatDate(dateString: string | null | undefined): string {
    if (!dateString) return 'Not specified';
    try {
      const date = new Date(dateString);
      return date.toLocaleDateString('en-US', { year: 'numeric', month: 'long', day: 'numeric' });
    } catch {
      return dateString;
    }
  }

  /**
   * Get website URL from multiple sources
   */
  getWebsiteUrl(): string | null {
    // Try extendedProfile first
    if (this.extendedProfile?.website) {
      return this.extendedProfile.website;
    }
    
    // Try form value
    const formWebsite = this.profileForm.get('website')?.value;
    if (formWebsite && formWebsite.trim() !== '') {
      return formWebsite;
    }
    
    return null;
  }

  get identityFields(): { icon: string; label: string; value: string }[] {
    return [
      {
        icon: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M12 2l3.09 6.26L22 9.27l-5 4.87 1.18 6.88L12 17.77l-6.18 3.25L7 14.14 2 9.27l6.91-1.01L12 2z"/></svg>',
        label: 'Patron Saint',
        value: this.extendedProfile?.patron_name || 'Not set'
      },
      {
        icon: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M3 9l9-7 9 7v11a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2z"/></svg>',
        label: 'Denomination',
        value: this.getDenominationName()
      },
      {
        icon: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><circle cx="12" cy="10" r="3"/><path d="M21 10c0 7-9 13-9 13S3 17 3 10a9 9 0 0 1 18 0z"/></svg>',
        label: 'Diocese',
        value: this.getArchdioceseName()
      },
      {
        icon: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><rect x="3" y="4" width="18" height="18" rx="2"/><line x1="16" y1="2" x2="16" y2="6"/><line x1="8" y1="2" x2="8" y2="6"/><line x1="3" y1="10" x2="21" y2="10"/></svg>',
        label: 'Established',
        value: this.getFoundedYear() || 'Not set'
      },
      {
        icon: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M3 9l9-7 9 7v11a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2z"/><polyline points="9 22 9 12 15 12 15 22"/></svg>',
        label: 'Church Type',
        value: 'Parish Church'
      },
      {
        icon: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M22 11.08V12a10 10 0 1 1-5.93-9.14"/><polyline points="22 4 12 14.01 9 11.01"/></svg>',
        label: 'Canonical Status',
        value: this.churchProfile?.active === 1 ? 'Active Parish' : 'Inactive Parish'
      }
    ];
  }

  getChurchSubtitle(): string {
    if (this.churchProfile?.slogan) return this.churchProfile.slogan;
    if (this.extendedProfile?.patron_name) return `Dedicated to ${this.extendedProfile.patron_name}`;
    return '';
  }

  getFoundedYear(): string | null {
    const year = this.extendedProfile?.founded_year || this.churchProfile?.founded_year;
    return year ? String(year) : null;
  }

  getProfileEmail(): string | null {
    return this.extendedProfile?.email || this.churchProfile?.email || this.churchProfile?.primary_contact?.email || this.churchProfile?.primaryContact?.email || null;
  }

  getProfilePhone(): string | null {
    return this.extendedProfile?.phone
      || this.churchProfile?.phone
      || this.churchProfile?.primary_contact?.contact_number
      || this.churchProfile?.primaryContact?.contact_number
      || null;
  }

  getParishPriest(): ChurchLeadership | { full_name: string; role: string; title?: string; id?: number } | null {
    const pastorAssignment = this.governanceCurrent?.assignments.find(
      (assignment) =>
        assignment.status === 'active' &&
        assignment.role?.category === 'PARISH_CLERGY' &&
        this.isPrimaryPastorRoleTitle(assignment.role?.title || ''),
    );

    if (pastorAssignment?.person) {
      return {
        id: 0,
        full_name: pastorAssignment.person.full_name,
        role: pastorAssignment.role?.title || 'Pastor',
        title: pastorAssignment.role?.title || undefined,
      };
    }

    const activeLeaders = this.leaders.filter(l => l.active === 1);
    const primary = activeLeaders.find(l => l.is_primary === 1)
      || activeLeaders.find(l => (l.role || '').toLowerCase().includes('pastor') && !(l.role || '').toLowerCase().includes('associate'));
    if (primary) return primary;
    if (this.churchProfile?.pastor_name) {
      return {
        id: 0,
        tenant_id: this.churchProfile.id,
        full_name: this.churchProfile.pastor_name,
        role: 'Parish Priest',
        title: 'Parish Administrator',
        is_primary: 1,
        display_order: 0,
        active: 1
      };
    }
    return null;
  }

  getAssistantPriests(): Array<{ full_name: string; role: string; title?: string }> {
    const priest = this.getParishPriest();
    const primaryPastorPersonId = this.governanceCurrent?.assignments.find(
      (assignment) =>
        assignment.status === 'active' &&
        assignment.role?.category === 'PARISH_CLERGY' &&
        this.isPrimaryPastorRoleTitle(assignment.role?.title || ''),
    )?.person?.id;

    const fromGovernance =
      this.governanceCurrent?.assignments
        .filter(
          (assignment) =>
            assignment.status === 'active' &&
            assignment.role?.category === 'PARISH_CLERGY' &&
            assignment.person?.id !== primaryPastorPersonId &&
            this.isAssistantClergyRoleTitle(assignment.role?.title || ''),
        )
        .map((assignment) => ({
          full_name: assignment.person?.full_name || '',
          role: assignment.role?.title || 'Clergy',
          title: assignment.role?.title,
        })) || [];

    if (fromGovernance.length) {
      return fromGovernance.slice(0, 3);
    }

    return this.leaders
      .filter(l => l.active === 1 && (l.role || '').toLowerCase().includes('associate'))
      .filter(l => !priest || l.id !== priest.id)
      .slice(0, 3);
  }

  get leadershipTabBadgeCount(): number {
    return this.governanceCurrent?.active_count ?? this.leaders.length;
  }

  private isPrimaryPastorRoleTitle(title: string): boolean {
    const normalized = title.trim().toLowerCase();
    if (!normalized) {
      return false;
    }

    if (normalized === 'pastor' || normalized === 'parochial administrator') {
      return true;
    }

    if (normalized.includes('associate') || normalized.includes('assistant') || normalized.includes('vicar')) {
      return false;
    }

    return normalized.includes('pastor') || normalized.includes('priest');
  }

  private isAssistantClergyRoleTitle(title: string): boolean {
    const normalized = title.trim().toLowerCase();
    if (!normalized) {
      return false;
    }

    if (normalized === 'parochial vicar' || normalized === 'deacon') {
      return true;
    }

    return (
      normalized.includes('vicar') ||
      normalized.includes('deacon') ||
      normalized.includes('associate') ||
      normalized.includes('assistant')
    );
  }

  onGovernanceCurrentChanged(current: CurrentLeadershipResponse | null): void {
    this.governanceCurrent = current;
    if (current) {
      this.overviewMinistries = current.active_count;
    }
  }

  getAboutText(): string {
    const about = this.extendedProfile?.about || this.profileForm?.get('about')?.value || this.churchProfile?.about;
    if (about && String(about).trim()) return String(about).trim();
    const founded = this.getFoundedYear();
    const patron = this.extendedProfile?.patron_name;
    const diocese = this.getArchdioceseName();
    if (this.churchProfile?.name) {
      return `${this.churchProfile.name}${founded ? ` was established in ${founded}` : ''}${diocese !== 'Not Set' ? ` and serves under ${diocese}` : ''}${patron ? `, dedicated to ${patron}` : ''}. Add a parish narrative to share your mission, history, and community story.`;
    }
    return 'Add a parish narrative to describe your church history, mission, and community impact.';
  }

  isAboutLong(): boolean {
    return this.getAboutText().length > 280;
  }

  startEditNarrative(): void {
    if (!this.canEdit) {
      this.toastService.warning('You do not have permission to edit.', 'Permission Denied');
      return;
    }
    this.startEditSection('identity');
    this.aboutExpanded = true;
    this.cdr.markForCheck();
  }

  copyToClipboard(value: string): void {
    if (!value) return;
    navigator.clipboard?.writeText(value).then(() => {
      this.toastService.success('Copied to clipboard', 'Contact');
    }).catch(() => {
      this.toastService.error('Unable to copy value', 'Contact');
    });
  }

  navigateToSettings(): void {
    this.router.navigate(['/settings']);
  }

  onGenerateReport(): void {
    this.toastService.info('Report generation will be available in a future release.', 'Coming Soon');
  }

  onViewPublicProfile(): void {
    this.toastService.info('Public profile preview will be available in a future release.', 'Coming Soon');
  }

  private loadOverviewMetrics(): void {
    this.familyService.getStatistics().pipe(takeUntil(this.destroy$)).subscribe({
      next: (response) => {
        if (response.success && response.data) {
          this.overviewMembers = response.data.total_members || this.churchProfile?.membership_count || 0;
          this.overviewFamilies = response.data.total_families || 0;
          this.overviewActiveMembers = response.data.active_members || this.overviewMembers;
          this.refreshSnapshotDisplay();
          this.refreshOperationalMetrics();
        }
        this.cdr.markForCheck();
      },
      error: () => this.cdr.markForCheck()
    });

    this.bccService.getStatistics().pipe(takeUntil(this.destroy$)).subscribe({
      next: (response) => {
        if (response.success && response.data) {
          this.overviewVolunteers = response.data.total_leaders || 0;
          this.overviewBccUtilization = response.data.utilization_percentage || this.overviewBccUtilization;
          if (!this.overviewMinistries) {
            this.overviewMinistries = response.data.active_bccs || response.data.total_bccs || 0;
          }
          this.refreshSnapshotDisplay();
          this.refreshOperationalMetrics();
        }
        this.cdr.markForCheck();
      },
      error: () => this.cdr.markForCheck()
    });
  }

  private refreshSnapshotDisplay(): void {
    const fmt = (n: number) => (n > 0 ? n.toLocaleString('en-US') : '—');
    this.snapshotKpis = [
      { label: 'Members', value: fmt(this.overviewMembers), hint: 'Registered parish members' },
      { label: 'Families', value: fmt(this.overviewFamilies), hint: 'Active family records' },
      { label: 'Ministries', value: fmt(this.overviewMinistries), hint: 'Active ministry leaders' },
      { label: 'Volunteers', value: fmt(this.overviewVolunteers), hint: 'BCC and volunteer leaders' }
    ];
  }

  private refreshOperationalMetrics(): void {
    const latest = this.statistics[0];
    const membershipHealth = this.overviewMembers > 0
      ? Math.min(100, Math.round((this.overviewActiveMembers / this.overviewMembers) * 100))
      : (latest?.membership_count ? 92 : 78);

    const sacramentalScore = this.statistics.length > 0
      ? Math.min(100, 70 + Math.min(30, (latest.baptisms || 0) + (latest.confirmations || 0) + (latest.marriages || 0)))
      : 82;

    this.operationalMetrics = [
      { label: 'Membership Health', percent: membershipHealth },
      { label: 'Sacramental Records', percent: sacramentalScore },
      { label: 'Volunteer Engagement', percent: this.overviewBccUtilization },
      { label: 'Profile Completeness', percent: this.computeProfileCompleteness() }
    ];
  }

  private computeProfileCompleteness(): number {
    const checks = [
      !!this.churchProfile?.name,
      !!this.churchProfile?.logo_full_url,
      !!this.extendedProfile?.patron_name,
      this.getDenominationName() !== 'Not Set',
      this.getArchdioceseName() !== 'Not Set',
      !!this.getFoundedYear(),
      !!this.getProfileEmail(),
      !!this.getProfilePhone(),
      !!this.getWebsiteUrl(),
      !!this.getOfficialAddress(),
      !!this.getAboutText() && !this.getAboutText().startsWith('Add a parish narrative')
    ];
    const filled = checks.filter(Boolean).length;
    return Math.round((filled / checks.length) * 100);
  }
}

