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

import { Component, OnInit, inject } from '@angular/core';
import { CommonModule } from '@angular/common';
import { ReactiveFormsModule, FormBuilder, FormGroup, Validators } from '@angular/forms';
import { NgSelectModule } from '@ng-select/ng-select';
import { TenantService } from '@core/services/tenant.service';
import { ToastService } from '@core/services/toast.service';
import { AuthService } from '@core/services/auth.service';
import { Tenant, TenantResponse } from '@core/models';
import { finalize } from 'rxjs/operators';
import { getTenantCallingCode, tenantPhoneValidator } from '@core/validators/phone.validators';

// Import all church management services
import {
  DenominationService,
  ArchdioceseService,
  ChurchProfileService,
  ChurchLeadershipService,
  ChurchStatisticsService,
  ChurchSocialMediaService
} from '@core/services/church';

// Import church models
import {
  Denomination,
  Archdiocese,
  ChurchProfile,
  ChurchLeadership,
  ChurchStatistic,
  ChurchSocialMedia
} from '@core/models/church';

@Component({
  selector: 'app-church-profile',
  standalone: true,
  imports: [CommonModule, ReactiveFormsModule, NgSelectModule],
  templateUrl: './church-profile.component.html',
  styleUrl: './church-profile.component.scss'
})
export class ChurchProfileComponent implements OnInit {
  // Tab Management
  activeTab: 'profile' | 'leadership' | 'statistics' | 'social' = 'profile';

  // Church Profile Data
  churchProfile: Tenant | null = null;
  extendedProfile: ChurchProfile | null = null;
  
  // Lookup Data
  denominations: Denomination[] = [];
  archdioceses: Archdiocese[] = [];
  filteredArchdioceses: Archdiocese[] = [];
  
  // Leadership Data
  leaders: ChurchLeadership[] = [];
  selectedLeader: ChurchLeadership | null = null;
  
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
  showStatisticModal = false;
  showSocialModal = false;
  showGeneralModal = false;
  
  // Country list
  countries: string[] = [];
  
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
  private statisticsService = inject(ChurchStatisticsService);
  private socialMediaService = inject(ChurchSocialMediaService);

  canEdit = false;
  designVariant: 'summary' | 'tiles' | 'definition' = 'summary';
  
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

  callingCode: string = getTenantCallingCode();

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
    // Enable both general and contact fields for combined editing
    this.startEditSection('general');
    this.editingSections.contact = true;
    this.profileForm.get('phone')?.enable();
    this.profileForm.get('email')?.enable();
    this.profileForm.get('website')?.enable();
    this.showGeneralModal = true;
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
    // Validate fields from both sections
    const sectionFields = [
      'denomination_id', 'archdiocese_id', 'bishop_id', 'founded_year',
      'phone', 'email', 'website'
    ];

    const sectionInvalid = sectionFields.some(field => this.profileForm.get(field)?.invalid);
    if (sectionInvalid) {
      this.toastService.warning('Please fill in all required fields correctly.', 'Validation Error');
      return;
    }

    this.saving = true;
    const formData = this.profileForm.getRawValue();

    this.churchProfileService.updateProfile(formData)
      .pipe(finalize(() => this.saving = false))
      .subscribe({
        next: (response) => {
          if (response.success) {
            this.extendedProfile = response.data;
            this.editingSections.general = false;
            this.editingSections.contact = false;

            // Disable the fields for both sections
            sectionFields.forEach(field => {
              this.profileForm.get(field)?.disable();
            });

            this.toastService.success('General & Contact Information updated successfully!', 'Success');

            if (this.showGeneralModal) {
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
   * Format date for display
   */
  formatDate(dateString: string | undefined): string {
    if (!dateString) return 'N/A';
    return new Date(dateString).toLocaleDateString('en-US', {
      year: 'numeric',
      month: 'long',
      day: 'numeric'
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
    this.loadAllData();
  }

  /**
   * Check if current user has permission to edit church profile
   */
  private checkPermissions(): void {
    const currentUser = this.authService.currentUserValue;
    
    // Allow tenant administrators to edit their own church profile
    const hasManageTenants = this.authService.hasPermission('manage_tenants');
    const isPrimaryAdmin = currentUser?.is_primary_admin === true;
    const isTenantAdmin = currentUser?.user_type === 2; // 2 = tenant_admin
    
    // Allow ANY logged-in user with a tenant_id to edit their church profile
    // This is appropriate since they can only edit their OWN church's profile
    const hasTenant = !!currentUser?.tenant_id;
    
    this.canEdit = hasManageTenants || isPrimaryAdmin || isTenantAdmin || hasTenant;
    
    // Comprehensive debug logging
    console.log('🔍 Church Profile Edit Permission Check:', {
      canEdit: this.canEdit,
      hasManageTenants,
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
      // Country is NOT included - it comes from tenant creation and is read-only
      
      // Contact Information Section
      phone: [{ value: '', disabled: true }, Validators.maxLength(20)],
      email: [{ value: '', disabled: true }, [Validators.email, Validators.maxLength(255)]],
      website: [{ value: '', disabled: true }, Validators.maxLength(255)],
      
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
      phone: ['', tenantPhoneValidator()],
      appointed_date: [''],
      start_date: [''],
      end_date: [''],
      biography: ['', Validators.maxLength(2000)],
      is_primary: [0],
      active: [1],
      display_order: [0]
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
      .pipe(finalize(() => this.loading = false))
      .subscribe({
        next: (response: TenantResponse) => {
          if (response.success && response.data) {
            this.churchProfile = response.data;
          }
        },
        error: (err: Error) => {
          this.error = err.message;
          this.toastService.error(this.error, 'Error');
        }
      });
  }

  /**
   * Load denominations
   */
  private loadDenominations(): void {
    this.denominationService.getDenominations().subscribe({
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
    this.archdioceseService.getArchdioceses().subscribe({
      next: (response) => {
        if (response.success) {
          this.archdioceses = response.data;
          this.filteredArchdioceses = response.data;
        }
      },
      error: (err: Error) => {
        console.error('Failed to load archdioceses:', err);
      }
    });
  }

  /**
   * Load countries from archdioceses
   */
  private loadCountries(): void {
    this.archdioceseService.getCountries().subscribe({
      next: (response) => {
        if (response.success) {
          this.countries = response.data.sort();
        }
      },
      error: (err: Error) => {
        console.error('Failed to load countries:', err);
      }
    });
  }

  /**
   * Load extended church profile
   */
  private loadExtendedProfile(): void {
    this.churchProfileService.getProfile().subscribe({
      next: (response) => {
        if (response.success) {
          this.extendedProfile = response.data;
          this.populateProfileForm(response.data);
        }
      },
      error: (err: Error) => {
        console.error('Failed to load extended profile:', err);
      }
    });
  }

  /**
   * Load church leaders
   */
  private loadLeaders(): void {
    this.leadershipService.getLeaders({ active: 1 }).subscribe({
      next: (response) => {
        if (response.success) {
          this.leaders = response.data;
        }
      },
      error: (err: Error) => {
        this.toastService.error(err.message, 'Error');
      }
    });
  }

  /**
   * Load church statistics
   */
  private loadStatistics(): void {
    this.statisticsService.getStatistics({ limit: 12 }).subscribe({
      next: (response) => {
        if (response.success) {
          this.statistics = response.data;
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
      country: profile.country,
      phone: profile.phone,
      email: profile.email,
      website: profile.website,
      about: profile.about,
      vision: profile.vision,
      mission: profile.mission,
      core_values: profile.core_values,
      service_times: profile.service_times
    });
  }

  /**
   * Filter archdioceses by selected denomination
   */
  onDenominationChange(denominationId: number): void {
    if (denominationId) {
      this.archdioceseService.getArchdioceses({ denomination_id: denominationId }).subscribe({
        next: (response) => {
          if (response.success) {
            this.filteredArchdioceses = response.data;
          }
        }
      });
    } else {
      this.filteredArchdioceses = this.archdioceses;
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
      this.profileForm.get('denomination_id')?.enable();
      this.profileForm.get('archdiocese_id')?.enable();
      this.profileForm.get('bishop_id')?.enable();
      this.profileForm.get('founded_year')?.enable();
      // Country is NOT editable - it's set at tenant creation
    } else if (section === 'contact') {
      this.profileForm.get('phone')?.enable();
      this.profileForm.get('email')?.enable();
      this.profileForm.get('website')?.enable();
    } else if (section === 'identity') {
      this.profileForm.get('about')?.enable();
      this.profileForm.get('vision')?.enable();
      this.profileForm.get('mission')?.enable();
      this.profileForm.get('core_values')?.enable();
      this.profileForm.get('service_times')?.enable();
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
      .pipe(finalize(() => this.saving = false))
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
   * Open new leader modal
   */
  openNewLeaderModal(): void {
    if (!this.canEdit) {
      this.toastService.warning('You do not have permission to add leaders.', 'Permission Denied');
      return;
    }
    this.selectedLeader = null;
    this.leaderForm.reset({ active: 1, is_primary: 0, display_order: 0 });
    this.showLeaderModal = true;
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
    this.leaderForm.patchValue(leader);
    this.showLeaderModal = true;
  }

  /**
   * Close leader modal
   */
  closeLeaderModal(): void {
    this.showLeaderModal = false;
    this.selectedLeader = null;
    this.leaderForm.reset();
  }

  /**
   * Save leader (create or update)
   */
  saveLeader(): void {
    if (this.leaderForm.invalid) {
      this.toastService.warning('Please fill in all required fields.', 'Validation Error');
      return;
    }

    this.saving = true;
    const formData = this.leaderForm.value;

    const request = this.selectedLeader
      ? this.leadershipService.updateLeader(this.selectedLeader.id, formData)
      : this.leadershipService.createLeader(formData);

    request.pipe(finalize(() => this.saving = false)).subscribe({
      next: (response) => {
        if (response.success) {
          this.loadLeaders();
          this.closeLeaderModal();
          this.toastService.success(
            this.selectedLeader ? 'Leader updated successfully!' : 'Leader added successfully!',
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
   * Get the country from the tenant's official address
   * Country is set at tenant creation and is read-only
   */
  getTenantCountry(): string {
    if (this.churchProfile?.addresses && this.churchProfile.addresses.length > 0) {
      const officialAddress = this.churchProfile.addresses.find(addr => addr.address_type === 'official');
      return officialAddress?.country || 'Not Set';
    }
    return 'Not Set';
  }
}

