import {
  ChangeDetectionStrategy,
  ChangeDetectorRef,
  Component,
  EventEmitter,
  HostListener,
  Input,
  OnChanges,
  OnInit,
  Output,
  SimpleChanges,
  ViewChild,
  ElementRef,
  AfterViewInit
} from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormBuilder, FormGroup, FormArray, Validators, ReactiveFormsModule, FormsModule } from '@angular/forms';
import { FamilyService } from '../../../../core/services/family.service';
import { BCCService } from '../../../../core/services/bcc.service';
import { Family, BCC, FamilyMember } from '../../../../core/models/family.model';
import { FamilyMemberFormModalComponent, FamilyMemberFormValue } from '../family-member-form-modal/family-member-form-modal.component';
import { ModalShellComponent } from '@shared/components';
import { PhoneCodeService } from '../../../../core/services/phone-code.service';
import { AuthService } from '@core/services';
import { getCountryCallingCode, CountryCode, parsePhoneNumber, isValidPhoneNumber } from 'libphonenumber-js';
import { getErrorMessage, isFieldInvalid, markFormGroupTouched } from '../../../../core/validators/form-validation.helper';
import {
  extractMemberApiError,
  getMemberApiData,
  getMemberApiMessage,
  isMemberApiSuccess,
  prepareFamilyMemberPayload
} from '../../utils/prepare-family-member-payload.util';
import { ToastService } from '../../../../core/services/toast.service';
import { SubscriptionAccessService } from '@core/services/subscription-access.service';

@Component({
  selector: 'app-family-form',
  standalone: true,
  imports: [CommonModule, ReactiveFormsModule, FormsModule, FamilyMemberFormModalComponent, ModalShellComponent],
  templateUrl: './family-form.html',
  changeDetection: ChangeDetectionStrategy.Eager,
  styleUrls: ['./family-form.scss']
})
export class FamilyFormComponent implements OnInit, OnChanges, AfterViewInit {
  @Input() family: Family | null = null;
  @Input() bccs: BCC[] = []; // Optional: if parent provides BCCs, use them; otherwise load independently
  @Output() save = new EventEmitter<any>();
  @Output() cancel = new EventEmitter<void>();

  familyForm: FormGroup;
  activeTab = 'info'; // 'info' | 'members'
  loading = false;
  error: string | null = null;
  validationErrors: { [key: string]: string } = {}; // Store field-specific validation errors from backend
  showMemberModal = false;
  memberToEditIndex: number | null = null;
  memberModalSaving = false;
  memberModalError: string | null = null;
  // Phone code from unified service
  get callingCode(): string {
    return this.phoneCodeService.getPhoneCodeSync();
  }
  expandedMemberIndexes: Set<number> = new Set();
  /** Per-member collapsed sections inside an expanded card (personal / sacraments). */
  expandedMemberDetailSections: Map<number, Set<'personal' | 'sacraments'>> = new Map();
  memberSearchQuery = '';
  memberFilter: 'all' | 'active' | 'inactive' | 'children' | 'parents' | 'grandparents' | 'others' = 'all';
  memberActionsOpenIndex: number | null = null;
  readonly memberFilterOptions: Array<{
    id: 'all' | 'active' | 'inactive' | 'children' | 'parents' | 'grandparents' | 'others';
    label: string;
  }> = [
    { id: 'all', label: 'All' },
    { id: 'active', label: 'Active' },
    { id: 'inactive', label: 'Inactive' },
    { id: 'children', label: 'Children' },
    { id: 'parents', label: 'Parents' },
    { id: 'grandparents', label: 'Grandparents' },
    { id: 'others', label: 'Others' }
  ];
  activeBCCs: BCC[] = []; // Store active BCCs for dropdown

  @ViewChild('infoTabContent', { static: false }) infoTabContentRef!: ElementRef<HTMLDivElement>;
  @ViewChild('membersTabContent', { static: false }) membersTabContentRef!: ElementRef<HTMLDivElement>;

  // For Math methods in template
  Math = Math;

  constructor(
    private fb: FormBuilder,
    private familyService: FamilyService,
    private bccService: BCCService,
    private phoneCodeService: PhoneCodeService,
    private authService: AuthService,
    private toastService: ToastService,
    private subscriptionAccess: SubscriptionAccessService,
    private cdr: ChangeDetectorRef
  ) {
    this.familyForm = this.fb.group({
      family_name: ['', Validators.required],
      address_line_1: [''],
      address_line_2: [''],
      city: [''],
      postal_code: [''],
      updated_at: [''],
      bcc_id: [''],
      status: ['active'],
      notes: [''],
      members: this.fb.array([])
    });
  }

  ngOnChanges(changes: SimpleChanges): void {
    if (changes['family'] && !changes['family'].firstChange && this.family) {
      this.patchFormData();
      this.cdr.markForCheck();
    }
  }

  ngOnInit(): void {
    // Ensure phone code reflects current tenant's country
    this.initializePhoneCode();

    // If still defaulting to +1, hydrate from API once
    if (this.callingCode === '+1') {
      this.phoneCodeService.initializeFromApiOnce().subscribe({
        next: (res) => console.log('📞 Phone code hydrated from API:', res),
        error: (e) => console.warn('⚠️ Phone code API hydrate error', e)
      });
    }

    // Load active BCCs first, then patch form (important for edit mode)
    if (this.bccs && this.bccs.length > 0) {
      // Filter to only active BCCs (status is string: 'active', 'inactive', or 'suspended')
      this.activeBCCs = this.bccs.filter(bcc => bcc.status === 'active');
      // Patch form after BCCs are ready
      this.patchFormData();
    } else {
      // Load active BCCs independently, then patch form
      this.loadActiveBCCs();
    }

    // Watch for status changes to validate against active members
    this.familyForm.get('status')?.valueChanges.subscribe((status) => {
      this.validateStatusChange(status);
    });

    // Watch for member status changes (when members are added/edited)
    this.members.valueChanges.subscribe(() => {
      const currentStatus = this.familyForm.get('status')?.value;
      if (currentStatus === 'inactive') {
        this.validateStatusChange(currentStatus);
      }
    });
  }

  /**
   * Initialize phone code from tenant country
   */
  private initializePhoneCode(): void {
    try {
      const user = this.authService.currentUserValue as any;
      console.log('🔍 Family Form - Initializing phone code, user:', user);

      // Try to get country code from user's tenant
      let iso2: string | undefined = user?.tenant?.country_code || user?.tenant?.country?.iso2;

      // If not found in user, try localStorage
      if (!iso2) {
        try {
          iso2 = localStorage.getItem('tenant_country_code') || undefined;
          console.log('📦 Using cached tenant_country_code from localStorage:', iso2);
        } catch {}
      }

      if (iso2 && typeof iso2 === 'string' && iso2.length >= 2) {
        const upper = iso2.toUpperCase();
        try {
          const code = getCountryCallingCode(upper as CountryCode);
          if (code) {
            const phoneCode = `+${code}`;
            console.log(`✅ Setting phone code to ${phoneCode} for country ${upper}`);
            this.phoneCodeService.setPhoneCode(phoneCode);
            // Cache for other parts of app
            try { localStorage.setItem('tenant_country_code', upper); } catch {}
          } else {
            console.warn(`⚠️ Could not get calling code for ISO2: ${upper}`);
          }
        } catch (error) {
          console.error('❌ Error getting country calling code:', error);
        }
      } else {
        console.warn('⚠️ No country code found. User tenant:', user?.tenant);
        // Log current phone code to debug
        console.log('📞 Current phone code from service:', this.phoneCodeService.getPhoneCodeSync());
      }
    } catch (error) {
      console.error('❌ Error initializing phone code:', error);
    }
  }

  /**
   * Patch form with family data after BCCs are loaded
   */
  private patchFormData(): void {
    if (this.family) {
      // Extract bcc_id - handle both bcc_id and nested bcc.id
      const bccId = this.family.bcc_id || this.family.bcc?.id || null;
      
      // Patch form values
      const formValue = {
        ...this.family,
        bcc_id: bccId
      };
      
      this.familyForm.patchValue(formValue);
      
      if (this.family.updated_at) {
        this.familyForm.get('updated_at')?.setValue(this.family.updated_at);
      }
      
      this.collapseAllMemberCards();

      // Always reset member form array before loading fresh data
      while (this.members.length > 0) {
        this.members.removeAt(0);
      }
      
      // Load existing members
      // CRITICAL: Ensure all members are loaded with their IDs preserved
      if (this.family.members && this.family.members.length > 0) {
        console.log('Loading family members into form:', {
          memberCount: this.family.members.length,
          memberIds: this.family.members.map(m => ({ id: m.id, name: `${m.first_name} ${m.last_name}` }))
        });
        
        this.family.members.forEach(member => {
          // CRITICAL: Verify member has ID before adding
          if (member.id) {
            console.log('Adding member to form with ID:', { id: member.id, name: `${member.first_name} ${member.last_name}` });
          } else {
            console.warn('⚠️ Member without ID being added to form:', { name: `${member.first_name} ${member.last_name}` });
          }
          this.addMember(member);
        });
        
        // Verify all members have IDs in form
        console.log('Form members after loading:', 
          this.members.controls.map((c, i) => ({ 
            index: i, 
            id: c.get('id')?.value, 
            name: `${c.get('first_name')?.value} ${c.get('last_name')?.value}` 
          }))
        );
      }
    }
  }

  ngAfterViewInit(): void {
    this.scrollActiveTabToTop();
  }

  get members(): FormArray {
    return this.familyForm.get('members') as FormArray;
  }

  /**
   * Check if a member at the given index is the Family Head
   */
  private isHeadMemberAtIndex(index: number): boolean {
    const memberControl = this.members.at(index);
    if (!memberControl) {
      return false;
    }
    
    const relationship = String(memberControl.get('relationship_to_head')?.value || '').toLowerCase().trim();
    const firstName = String(memberControl.get('first_name')?.value || '').trim().toLowerCase();
    const lastName = String(memberControl.get('last_name')?.value || '').trim().toLowerCase();
    const memberName = `${firstName} ${lastName}`.trim().toLowerCase();
    
    // Get head member identifier
    const headName = this.family?.head_of_family || '';
    const headNameNormalized = headName.trim().toLowerCase();
    
    // Check if this is the head member
    if (relationship === 'self' || relationship === 'head' || relationship === 'head of family') {
      return true;
    }
    
    if (headNameNormalized) {
      if (memberName === headNameNormalized) {
        return true;
      }
      const headFirstPart = headNameNormalized.split(/\s+/)[0];
      if (firstName === headFirstPart) {
        return true;
      }
    }
    
    return false;
  }

  /**
   * Get array of indices for regular members (excluding Family Head)
   */
  getRegularMemberIndices(): number[] {
    const indices: number[] = [];
    for (let i = 0; i < this.members.length; i++) {
      if (!this.isHeadMemberAtIndex(i)) {
        indices.push(i);
      }
    }
    return indices;
  }

  /**
   * Get the count of regular members (excluding head)
   */
  get regularMembersCount(): number {
    return this.getRegularMemberIndices().length;
  }

  get filteredRegularMemberIndices(): number[] {
    const query = this.memberSearchQuery.trim().toLowerCase();
    return this.getRegularMemberIndices().filter((index) => {
      const member = this.members.at(index);
      const firstName = String(member.get('first_name')?.value || '').toLowerCase();
      const lastName = String(member.get('last_name')?.value || '').toLowerCase();
      const email = String(member.get('email')?.value || '').toLowerCase();
      const phone = String(member.get('phone')?.value || '').toLowerCase();
      const relationship = String(member.get('relationship_to_head')?.value || '').toLowerCase();
      const status = String(member.get('status')?.value || 'active').toLowerCase();

      const matchesQuery = !query || [firstName, lastName, email, phone, relationship]
        .some((v) => v.includes(query));
      if (!matchesQuery) {
        return false;
      }

      switch (this.memberFilter) {
        case 'active':
        case 'inactive':
          return status === this.memberFilter;
        case 'children':
          return ['son', 'daughter', 'grandson', 'granddaughter'].includes(relationship);
        case 'parents':
          return ['father', 'mother'].includes(relationship);
        case 'grandparents':
          return ['grandfather', 'grandmother'].includes(relationship);
        case 'others':
          return ![
            'son', 'daughter', 'grandson', 'granddaughter',
            'father', 'mother', 'grandfather', 'grandmother'
          ].includes(relationship);
        default:
          return true;
      }
    });
  }

  getStatusLabel(status: unknown): string {
    const normalized = String(status || 'active').toLowerCase();
    return normalized.charAt(0).toUpperCase() + normalized.slice(1);
  }

  getRelationshipLabel(relationship: unknown): string {
    const text = String(relationship || 'other').trim().toLowerCase();
    if (!text) {
      return 'Other';
    }
    return text
      .split(/[\s_]+/)
      .map((part) => part.charAt(0).toUpperCase() + part.slice(1))
      .join(' ');
  }

  getMemberInitials(index: number): string {
    const member = this.members.at(index);
    const first = String(member.get('first_name')?.value || '').trim();
    const last = String(member.get('last_name')?.value || '').trim();
    const initials = `${first.charAt(0)}${last.charAt(0)}`.trim();
    return (initials || 'U').toUpperCase();
  }

  getMemberDisplayName(index: number): string {
    const member = this.members.at(index)?.getRawValue();
    return this.getDisplayName(member);
  }

  getMemberStatusClass(index: number): string {
    const status = String(this.members.at(index).get('status')?.value || 'active').toLowerCase();
    return `em-status--${status}`;
  }

  getMemberRelationshipClass(index: number): string {
    const rel = String(this.members.at(index).get('relationship_to_head')?.value || 'other').toLowerCase();
    return `em-relationship--${rel.replace(/\s+/g, '-')}`;
  }

  getAvatarTone(index: number): string {
    const name = this.getMemberDisplayName(index);
    let hash = 0;
    for (let i = 0; i < name.length; i++) {
      hash = name.charCodeAt(i) + ((hash << 5) - hash);
    }
    const tone = Math.abs(hash) % 6;
    return `em-avatar--tone-${tone}`;
  }

  getMemberPhoneDisplay(index: number): string {
    const phone = String(this.members.at(index).get('phone')?.value || '').trim();
    if (!phone) {
      return '—';
    }
    return `${this.callingCode} ${phone}`;
  }

  getMemberEmailDisplay(index: number): string {
    const email = String(this.members.at(index).get('email')?.value || '').trim();
    return email || '—';
  }

  getFamilyAddressDisplay(): string {
    const parts = [
      this.familyForm.get('address_line_1')?.value,
      this.familyForm.get('address_line_2')?.value,
      this.familyForm.get('city')?.value,
      this.familyForm.get('postal_code')?.value
    ]
      .map((v) => (v ? String(v).trim() : ''))
      .filter(Boolean);
    return parts.length ? parts.join(', ') : '—';
  }

  getMemberCountByStatus(status: 'active' | 'inactive'): number {
    return this.getRegularMemberIndices().filter((index) => {
      const memberStatus = String(this.members.at(index).get('status')?.value || 'active').toLowerCase();
      return memberStatus === status;
    }).length;
  }

  setMemberFilter(filter: typeof this.memberFilter): void {
    this.memberFilter = filter;
    this.cdr.markForCheck();
  }

  clearMemberFilters(): void {
    this.memberSearchQuery = '';
    this.memberFilter = 'all';
    this.cdr.markForCheck();
  }

  formatMemberField(value: unknown): string {
    if (value === null || value === undefined) {
      return '—';
    }
    const text = String(value).trim();
    return text || '—';
  }

  formatMemberDate(value: unknown): string {
    if (!value) {
      return '—';
    }
    try {
      const date = new Date(String(value));
      if (Number.isNaN(date.getTime())) {
        return String(value);
      }
      return date.toLocaleDateString('en-US', {
        year: 'numeric',
        month: 'short',
        day: 'numeric'
      });
    } catch {
      return String(value);
    }
  }

  getMemberMeta(index: number): { updatedAt?: string; createdAt?: string } {
    const memberId = this.members.at(index).get('id')?.value;
    if (!memberId || !this.family?.members) {
      return {};
    }
    const cached = this.family.members.find((m) => m.id === memberId);
    return {
      updatedAt: cached?.updated_at,
      createdAt: cached?.created_at
    };
  }

  getMemberUpdatedLabel(index: number): string {
    const { updatedAt } = this.getMemberMeta(index);
    if (!updatedAt) {
      return 'Recently updated';
    }
    const date = new Date(updatedAt);
    if (Number.isNaN(date.getTime())) {
      return 'Recently updated';
    }
    const diffMs = Date.now() - date.getTime();
    const days = Math.floor(diffMs / (1000 * 60 * 60 * 24));
    if (days <= 0) {
      return 'Updated today';
    }
    if (days === 1) {
      return 'Updated yesterday';
    }
    if (days < 30) {
      return `Updated ${days} days ago`;
    }
    return `Updated ${this.formatMemberDate(updatedAt)}`;
  }

  toggleMemberActionsMenu(index: number, event: Event): void {
    event.stopPropagation();
    this.memberActionsOpenIndex = this.memberActionsOpenIndex === index ? null : index;
    this.cdr.markForCheck();
  }

  closeMemberActionsMenu(): void {
    if (this.memberActionsOpenIndex !== null) {
      this.memberActionsOpenIndex = null;
      this.cdr.markForCheck();
    }
  }

  @HostListener('document:click')
  onDocumentClick(): void {
    this.closeMemberActionsMenu();
  }

  onMemberAction(action: 'edit' | 'delete' | 'inactive' | 'sacraments', index: number, event: Event): void {
    event.stopPropagation();
    this.closeMemberActionsMenu();

    switch (action) {
      case 'edit':
        this.openEditMemberModal(index);
        break;
      case 'delete':
        this.removeMember(index);
        break;
      case 'inactive':
        this.markMemberInactive(index);
        break;
      case 'sacraments':
        if (!this.isMemberExpanded(index)) {
          this.toggleMember(index);
        }
        this.expandMemberDetailSection(index, 'sacraments');
        break;
    }
  }

  private markMemberInactive(index: number): void {
    const member = this.members.at(index);
    const currentStatus = String(member.get('status')?.value || 'active').toLowerCase();
    if (currentStatus === 'inactive') {
      return;
    }
    if (!confirm('Mark this member as inactive?')) {
      return;
    }

    const familyId = this.family?.id;
    const memberId = member.get('id')?.value;
    member.patchValue({ status: 'inactive' });

    if (!familyId || !memberId) {
      this.cdr.markForCheck();
      return;
    }

    const payload = prepareFamilyMemberPayload(member.getRawValue(), this.callingCode);
    payload['status'] = 'inactive';
    this.familyService.updateFamilyMember(String(familyId), String(memberId), payload).subscribe({
      next: (response) => {
        if (isMemberApiSuccess(response)) {
          this.toastService.success('Member marked as inactive', 'Success', 4000);
          this.reloadMembersFromServer(String(familyId));
        }
      },
      error: () => {
        this.toastService.error('Failed to update member status', 'Error', 4000);
      }
    });
  }

  /**
   * Strip country code from phone number for form storage
   * Form stores phone without country code (country code is displayed separately)
   */
  private stripCountryCodeFromPhone(phone: string | null | undefined): string {
    if (!phone) return '';
    const str = String(phone).trim();
    if (!str) return '';
    
    // If phone starts with +, it has country code - strip it
    if (str.startsWith('+')) {
      // Extract all digits
      const allDigits = str.replace(/\D/g, '');
      // Get current calling code digits
      const dialCode = this.callingCode || '';
      const dialCodeDigits = dialCode.replace(/\D/g, '');
      
      // If digits start with country code, remove it
      if (dialCodeDigits && allDigits.startsWith(dialCodeDigits)) {
        return allDigits.substring(dialCodeDigits.length);
      }
      // If we can't determine country code, just return digits (might be wrong but better than nothing)
      return allDigits;
    }
    
    // Phone doesn't have country code prefix - return as is (might already be just digits)
    return str;
  }

  /**
   * Add a new member to the form
   * CRITICAL: Checks if member already exists by ID before adding to prevent duplicates
   */
  addMember(member?: any): void {
    // CRITICAL: Preserve ID as string (UUID) if it exists
    const memberId = member?.id ? String(member.id).trim() : null;
    
    // CRITICAL: If member has an ID, check if it already exists in form
    if (memberId) {
      const existingIndex = this.findMemberIndexInForm(memberId);
      if (existingIndex !== null) {
        console.warn('⚠️ Member already exists in form, skipping duplicate add:', {
          memberId,
          existingIndex,
          memberName: `${member?.first_name} ${member?.last_name}`
        });
        // Member already exists - don't add duplicate
        return;
      }
    }
    
    // Strip country code from phone for form storage (country code is displayed separately in UI)
    const phoneForForm = this.stripCountryCodeFromPhone(member?.phone);
    
    const memberForm = this.fb.group({
      id: [memberId],
      first_name: [member?.first_name || '', Validators.required],
      middle_name: [member?.middle_name || ''],
      last_name: [member?.last_name || '', Validators.required],
      full_name: [member?.full_name || ''],
      full_name_display: [member?.full_name_display || ''],
      date_of_birth: [member?.date_of_birth || ''],
      gender: [member?.gender || ''],
      relationship_to_head: [member?.relationship_to_head || 'other', Validators.required],
      marital_status: [member?.marital_status || 'single'],
      phone: [phoneForForm],
      email: [member?.email || '', Validators.email],
      occupation: [member?.occupation || ''],
      education: [member?.education || ''],
      baptism_date: [member?.baptism_date || ''],
      baptism_place: [member?.baptism_place || ''],
      baptism_godparent_primary: [member?.baptism_godparent_primary || ''],
      baptism_godparent_secondary: [member?.baptism_godparent_secondary || ''],
      baptism_location_type: [member?.baptism_location_type || 'home_parish'],
      baptism_church_name: [member?.baptism_church_name || ''],
      baptism_church_address: [member?.baptism_church_address || ''],
      baptism_priest_name: [member?.baptism_priest_name || ''],
      baptism_priest_is_home: [member?.baptism_priest_is_home ?? true],
      first_communion_date: [member?.first_communion_date || ''],
      first_communion_place: [member?.first_communion_place || ''],
      confirmation_date: [member?.confirmation_date || ''],
      confirmation_place: [member?.confirmation_place || ''],
      marriage_date: [member?.marriage_date || ''],
      marriage_place: [member?.marriage_place || ''],
      marriage_spouse_name: [member?.marriage_spouse_name || ''],
      marriage_bride_full_name: [member?.marriage_bride_full_name || ''],
      marriage_bride_address: [member?.marriage_bride_address || ''],
      marriage_bride_church_type: [member?.marriage_bride_church_type || 'home_parish'],
      marriage_bride_church_name: [member?.marriage_bride_church_name || ''],
      marriage_bride_church_address: [member?.marriage_bride_church_address || ''],
      marriage_groom_full_name: [member?.marriage_groom_full_name || ''],
      marriage_groom_address: [member?.marriage_groom_address || ''],
      marriage_groom_church_type: [member?.marriage_groom_church_type || 'home_parish'],
      marriage_groom_church_name: [member?.marriage_groom_church_name || ''],
      marriage_groom_church_address: [member?.marriage_groom_church_address || ''],
      status: [member?.status || 'active'],
      is_primary_contact: [member?.is_primary_contact || false]
    });

    console.log('Adding member to form:', {
      id: memberId,
      name: `${member?.first_name} ${member?.last_name}`,
      hasId: !!memberId
    });
    
    this.members.push(memberForm);
  }

  openAddMemberModal(): void {
    this.memberToEditIndex = null;
    this.memberModalError = null;
    this.memberModalSaving = false;
    this.showMemberModal = true;
  }

  openEditMemberModal(index: number): void {
    this.memberToEditIndex = index;
    this.memberModalError = null;
    this.memberModalSaving = false;
    this.showMemberModal = true;
  }

  /**
   * Find a member's index in the form array by ID
   * Handles both string and null/undefined IDs
   */
  private findMemberIndexInForm(memberId: string | null | undefined): number | null {
    if (!memberId) {
      return null;
    }
    
    const searchId = String(memberId).trim();
    if (!searchId) {
      return null;
    }
    
    for (let i = 0; i < this.members.length; i++) {
      const formMemberId = this.members.at(i).get('id')?.value;
      if (formMemberId) {
        const formId = String(formMemberId).trim();
        if (formId && formId === searchId) {
          return i;
        }
      }
    }
    return null;
  }

  toggleMember(index: number): void {
    if (this.expandedMemberIndexes.has(index)) {
      this.expandedMemberIndexes.delete(index);
      this.expandedMemberDetailSections.delete(index);
    } else {
      this.expandedMemberIndexes.add(index);
      this.expandedMemberDetailSections.set(index, this.createDefaultMemberDetailSections());
    }
  }

  isMemberExpanded(index: number): boolean {
    return this.expandedMemberIndexes.has(index);
  }

  toggleMemberDetailSection(index: number, section: 'personal' | 'sacraments', event?: Event): void {
    event?.stopPropagation();
    if (!this.expandedMemberIndexes.has(index)) {
      this.expandedMemberIndexes.add(index);
      this.expandedMemberDetailSections.set(index, this.createDefaultMemberDetailSections());
      return;
    }
    const sections = this.expandedMemberDetailSections.get(index) ?? this.createDefaultMemberDetailSections();
    if (sections.has(section)) {
      sections.delete(section);
    } else {
      sections.add(section);
    }
    this.expandedMemberDetailSections.set(index, sections);
  }

  isMemberDetailSectionExpanded(index: number, section: 'personal' | 'sacraments'): boolean {
    return this.expandedMemberDetailSections.get(index)?.has(section) ?? false;
  }

  private collapseAllMemberCards(): void {
    this.expandedMemberIndexes.clear();
    this.expandedMemberDetailSections.clear();
  }

  expandMemberDetailSection(index: number, section: 'personal' | 'sacraments'): void {
    if (!this.expandedMemberIndexes.has(index)) {
      this.expandedMemberIndexes.add(index);
      this.expandedMemberDetailSections.set(index, this.createDefaultMemberDetailSections());
      return;
    }
    const sections = this.expandedMemberDetailSections.get(index) ?? this.createDefaultMemberDetailSections();
    sections.add(section);
    this.expandedMemberDetailSections.set(index, sections);
  }

  /** Both detail sections expanded when a member card is first opened. */
  private createDefaultMemberDetailSections(): Set<'personal' | 'sacraments'> {
    return new Set<'personal' | 'sacraments'>(['personal', 'sacraments']);
  }

  /**
   * Get display name from a member
   */
  getDisplayName(member: any | null | undefined): string {
    if (!member) {
      return '—';
    }
    // Check API-returned fields in priority order
    const fullNameFields = [
      member.full_name_display,
      member.full_name,
      member.fullName
    ];
    
    for (const full of fullNameFields) {
      if (typeof full === 'string' && full.trim().length > 0) {
        return full.trim();
      }
    }
    
    // Build from parts
    const parts = [member.first_name, member.middle_name, member.last_name]
      .filter((p: string | undefined) => !!p && String(p).trim().length > 0)
      .map((p: string) => p.trim());
    const name = parts.join(' ').replace(/\s+/g, ' ').trim();
    return name || '—';
  }

  /**
   * Normalize name for comparison (remove extra spaces, lowercase)
   */
  private normalizeName(name: string): string {
    return (name || '').replace(/\s+/g, ' ').trim().toLowerCase();
  }

  /**
   * Get all possible name variations from a member
   */
  private getMemberNameVariations(member: any): string[] {
    const variations: string[] = [];
    
    // Check all possible full name fields from API
    const fullNameFields = [
      member.full_name,
      member.full_name_display,
      this.getDisplayName(member)
    ];
    
    fullNameFields.forEach(name => {
      if (name && typeof name === 'string' && name.trim()) {
        variations.push(this.normalizeName(name));
      }
    });
    
    return [...new Set(variations)]; // Remove duplicates
  }

  /**
   * Check if a member's name matches the target name
   */
  private nameMatches(member: any, targetName: string): boolean {
    const normalizedTarget = this.normalizeName(targetName);
    if (!normalizedTarget) return false;
    
    const memberVariations = this.getMemberNameVariations(member);
    
    // Exact match
    if (memberVariations.includes(normalizedTarget)) {
      return true;
    }
    
    // Split target and member names into parts for better matching
    const targetParts = normalizedTarget.split(/\s+/).filter(p => p.length > 0);
    
    for (const variation of memberVariations) {
      const variationParts = variation.split(/\s+/).filter(p => p.length > 0);
      
      // If both have at least 2 parts, check last name match first (most reliable)
      if (targetParts.length >= 2 && variationParts.length >= 2) {
        const targetLastName = targetParts[targetParts.length - 1];
        const variationLastName = variationParts[variationParts.length - 1];
        
        // Last names must match
        if (targetLastName === variationLastName) {
          // Check if first name matches (allows for middle names)
          const targetFirstName = targetParts[0];
          const variationFirstName = variationParts[0];
          
          if (targetFirstName === variationFirstName) {
            return true;
          }
          
          // Allow partial first name match (e.g., "Ann" matches "Annamae")
          if (targetFirstName.length >= 3 && variationFirstName.startsWith(targetFirstName)) {
            return true;
          }
          if (variationFirstName.length >= 3 && targetFirstName.startsWith(variationFirstName)) {
            return true;
          }
        }
      }
      
      // Check if target name is fully contained in variation or vice versa
      if (variation.includes(normalizedTarget) || normalizedTarget.includes(variation)) {
        // Additional check: ensure at least one meaningful word matches
        const commonWords = targetParts.filter(word => 
          word.length >= 2 && variationParts.includes(word)
        );
        if (commonWords.length >= 2 || (commonWords.length === 1 && targetParts.length === 1)) {
          return true;
        }
      }
    }
    
    return false;
  }

  /**
   * Get the family head member from the form array
   */
  getFamilyHead(): any | null {
    const membersArray = this.members.controls;
    if (!membersArray || membersArray.length === 0) {
      // No members in form, check if we have head_of_family from the original family
      if (this.family?.head_of_family) {
        return {
          first_name: this.family.head_of_family,
          last_name: '',
          full_name: this.family.head_of_family,
          relationship_to_head: 'self',
          phone: '',
          email: '',
          date_of_birth: '',
          gender: '',
          marital_status: '',
          occupation: '',
          is_from_db_name: true,
          head_profile_image_full_url: this.family.head_profile_image_full_url || null
        };
      }
      return null;
    }

    const candidates = membersArray.map(m => m.value);

    // 1) PRIORITY: If database specifies head_of_family on the family record, match it exactly
    const headName = (this.family?.head_of_family || '').trim();
    if (headName) {
      // Try exact match first
      let byName = candidates.find(m => this.nameMatches(m, headName));
      
      if (byName) {
        return byName;
      }
      
      // If no exact match, try fuzzy matching (last name priority)
      const headParts = this.normalizeName(headName).split(/\s+/);
      if (headParts.length >= 2) {
        const headLastName = headParts[headParts.length - 1];
        byName = candidates.find(m => {
          const memberVariations = this.getMemberNameVariations(m);
          const found = memberVariations.some(v => {
            const parts = v.split(/\s+/);
            const lastMatch = parts.length >= 2 && parts[parts.length - 1] === headLastName;
            const firstMatch = parts.length >= 1 && parts[0] === headParts[0];
            return lastMatch && (firstMatch || headParts.length === 1);
          });
          return found;
        });
        if (byName) {
          return byName;
        }
      }
      
      // If head_of_family is specified but we can't match any member, return a mock object
      if (!this.family) {
        return null;
      }
      return {
        first_name: this.family.head_of_family,
        last_name: '',
        full_name: this.family.head_of_family,
        relationship_to_head: 'self',
      phone: '',
      email: '',
        date_of_birth: '',
        gender: '',
        marital_status: '',
        occupation: '',
        is_from_db_name: true,
        head_profile_image_full_url: this.family.head_profile_image_full_url || null
      };
    }

    // 2) Prefer explicit self/head relationships (prioritize active members)
    const relPriority = ['self', 'head', 'head of family'];
    const byRelationship = candidates.find(m => {
      const rel = String(m.relationship_to_head || '').toLowerCase();
      return relPriority.includes(rel) && m.status === 'active';
    }) || candidates.find(m => {
      const rel = String(m.relationship_to_head || '').toLowerCase();
      return relPriority.includes(rel);
    }) || candidates.find(m => {
      const isPrimary = (m as any).is_primary_contact === true && m.status === 'active';
      return isPrimary;
    }) || candidates.find(m => {
      const isPrimary = (m as any).is_primary_contact === true;
      return isPrimary;
    });
    if (byRelationship) {
      return byRelationship;
    }

    // 3) Fallback: first active member, else first member
    return candidates.find(m => m.status === 'active') || candidates[0] || null;
  }

  /**
   * Get the index of the family head in the members array
   */
  getFamilyHeadIndex(): number | null {
    const members = this.members.controls;
    for (let i = 0; i < members.length; i++) {
      const rel = String(members[i].get('relationship_to_head')?.value || '').toLowerCase();
      if (rel === 'self' || rel === 'head' || rel === 'head of family') {
        return i;
      }
    }
    return null;
  }

  /**
   * Check if a member at index is the family head
   */
  isHeadMember(index: number): boolean {
    const member = this.members.at(index);
    const rel = String(member.get('relationship_to_head')?.value || '').toLowerCase();
    return rel === 'self' || rel === 'head' || rel === 'head of family';
  }

  onMemberModalSave(value: FamilyMemberFormValue): void {
    this.memberModalError = null;

    const familyId = this.family?.id || null;
    const isEdit = this.memberToEditIndex !== null;

    if (isEdit) {
      const index = this.memberToEditIndex as number;
      const memberId = this.resolveExistingMemberId(index, value);

      if (!familyId) {
        this.patchMemberFormGroupWithFormValue(index, value, memberId);
        this.switchTab('members');
        this.closeMemberModal();
        return;
      }

      if (!memberId) {
        this.memberModalError = 'Cannot update member: Missing member ID. Please refresh and try again.';
        return;
      }

      value.id = memberId;
      this.memberModalSaving = true;
      const payload = this.prepareMemberPayload(value);

      this.familyService.updateFamilyMember(familyId, memberId, payload).subscribe({
        next: (response) => {
          this.memberModalSaving = false;
          if (isMemberApiSuccess(response)) {
            const savedMember = getMemberApiData<FamilyMember>(response);
            if (savedMember) {
              this.applyMemberUpdateFromResponse(index, savedMember);
              this.upsertFamilyMemberCache(savedMember);
            }
            this.finishMemberModalSuccess(
              getMemberApiMessage(response, 'Member updated successfully'),
              familyId
            );
          } else {
            this.memberModalError = getMemberApiMessage(response, 'Failed to update family member.');
            this.cdr.markForCheck();
          }
        },
        error: (error) => {
          this.memberModalSaving = false;
          this.memberModalError = this.extractApiError(error, 'Failed to update family member.');
        }
      });

      return;
    }

    if (!familyId) {
      this.addMember(value);
      this.switchTab('members');
      this.closeMemberModal();
      return;
    }

    this.memberModalSaving = true;
    const payload = this.prepareMemberPayload(value);

    this.familyService.addFamilyMember(familyId, payload).subscribe({
      next: (response) => {
        this.memberModalSaving = false;
        if (isMemberApiSuccess(response)) {
          const savedMember = getMemberApiData<FamilyMember>(response);
          if (savedMember) {
            this.addMember(savedMember);
            this.upsertFamilyMemberCache(savedMember);
          }
          this.finishMemberModalSuccess(
            getMemberApiMessage(response, 'Member added successfully'),
            familyId
          );
        } else {
          this.memberModalError = getMemberApiMessage(response, 'Failed to add family member.');
          this.cdr.markForCheck();
        }
      },
      error: (error) => {
        this.memberModalSaving = false;
        this.memberModalError = this.extractApiError(error, 'Failed to add family member.');
      }
    });
  }

  onMemberModalCancel(): void {
    this.closeMemberModal();
  }

  /**
   * Remove a member from the form
   */
  removeMember(index: number): void {
    if (confirm('Are you sure you want to remove this member?')) {
      this.members.removeAt(index);
    }
  }

  private finishMemberModalSuccess(message: string, familyId: string): void {
    this.closeMemberModal();
    this.toastService.success(message, 'Success', 4000);
    this.switchTab('members');
    this.reloadMembersFromServer(familyId);
  }

  private reloadMembersFromServer(familyId: string): void {
    this.familyService.getFamily(familyId).subscribe({
      next: (res) => {
        if (res.success && res.data) {
          if (this.family) {
            this.family.members = res.data.members ?? [];
          }
          this.patchFormData();
        }
        this.cdr.markForCheck();
      },
      error: (err) => {
        console.error('Error refreshing members list:', err);
        this.cdr.markForCheck();
      }
    });
  }

  private closeMemberModal(): void {
    this.showMemberModal = false;
    this.memberToEditIndex = null;
    this.memberModalError = null;
    this.memberModalSaving = false;
    this.cdr.markForCheck();
  }

  private patchMemberFormGroupWithFormValue(index: number, value: FamilyMemberFormValue, memberId?: string | null): void {
    const group = this.members.at(index) as FormGroup | null;
    if (!group) {
        return;
      }
      
    const patchValue: any = {
      ...value,
      status: value.status || group.get('status')?.value || 'active'
    };

    if (memberId) {
      patchValue.id = memberId;
    }

    group.patchValue(patchValue);

    if (patchValue.id) {
      group.get('id')?.setValue(patchValue.id, { emitEvent: false });
    }
  }

  private applyMemberUpdateFromResponse(index: number, member: FamilyMember): void {
    const group = this.members.at(index) as FormGroup | null;
    if (!group) {
      return;
    }

    const phoneForForm = this.stripCountryCodeFromPhone(member.phone);

    group.patchValue({
      id: member.id,
      first_name: member.first_name || '',
      middle_name: member.middle_name || '',
      last_name: member.last_name || '',
      full_name: member.full_name || `${member.first_name} ${member.last_name}`.trim(),
      full_name_display: (member as any).full_name_display || member.full_name || `${member.first_name} ${member.last_name}`.trim(),
      date_of_birth: member.date_of_birth || '',
      gender: member.gender || '',
      relationship_to_head: member.relationship_to_head || 'other',
      marital_status: member.marital_status || 'single',
      phone: phoneForForm,
      email: member.email || '',
      occupation: member.occupation || '',
      education: member.education || '',
      baptism_date: member.baptism_date || '',
      baptism_place: member.baptism_place || '',
      baptism_godparent_primary: member.baptism_godparent_primary || '',
      baptism_godparent_secondary: member.baptism_godparent_secondary || '',
      baptism_location_type: member.baptism_location_type || 'home_parish',
      baptism_church_name: member.baptism_church_name || '',
      baptism_church_address: member.baptism_church_address || '',
      baptism_priest_name: member.baptism_priest_name || '',
      baptism_priest_is_home: member.baptism_priest_is_home ?? true,
      first_communion_date: member.first_communion_date || '',
      first_communion_place: member.first_communion_place || '',
      confirmation_date: member.confirmation_date || '',
      confirmation_place: member.confirmation_place || '',
      marriage_date: member.marriage_date || '',
      marriage_place: member.marriage_place || '',
      marriage_spouse_name: member.marriage_spouse_name || '',
      marriage_bride_full_name: member.marriage_bride_full_name || '',
      marriage_bride_address: member.marriage_bride_address || '',
      marriage_bride_church_type: member.marriage_bride_church_type || 'home_parish',
      marriage_bride_church_name: member.marriage_bride_church_name || '',
      marriage_bride_church_address: member.marriage_bride_church_address || '',
      marriage_groom_full_name: member.marriage_groom_full_name || '',
      marriage_groom_address: member.marriage_groom_address || '',
      marriage_groom_church_type: member.marriage_groom_church_type || 'home_parish',
      marriage_groom_church_name: member.marriage_groom_church_name || '',
      marriage_groom_church_address: member.marriage_groom_church_address || '',
      status: member.status || 'active',
      is_primary_contact: member.is_primary_contact ?? false
    });

    group.get('id')?.setValue(member.id, { emitEvent: false });
  }

  private prepareMemberPayload(value: FamilyMemberFormValue): Record<string, unknown> {
    return prepareFamilyMemberPayload(value, this.callingCode);
  }

  private upsertFamilyMemberCache(member: FamilyMember): void {
    if (!this.family) {
      return;
    }

    if (!Array.isArray(this.family.members)) {
      this.family.members = [member];
      return;
    }

    const existingIndex = this.family.members.findIndex(m => m.id === member.id);
    if (existingIndex >= 0) {
      this.family.members[existingIndex] = member;
    } else {
      this.family.members.push(member);
    }
  }

  private resolveExistingMemberId(index: number, value: FamilyMemberFormValue): string | null {
    const group = this.members.at(index) as FormGroup | null;
    let existingId = group?.get('id')?.value || value.id || null;

    if (!existingId && this.family?.members) {
      if (index < this.family.members.length && this.family.members[index]?.id) {
        existingId = this.family.members[index].id;
      }

      if (!existingId) {
        const searchFirst = group?.get('first_name')?.value || value.first_name;
        const searchLast = group?.get('last_name')?.value || value.last_name;

        const exactMatch = this.family.members.find(m =>
          m.first_name === searchFirst && m.last_name === searchLast && m.id
        );

        if (exactMatch?.id) {
          existingId = exactMatch.id;
        } else {
          const newNameMatch = this.family.members.find(m =>
            m.first_name === value.first_name && m.last_name === value.last_name && m.id
          );
          if (newNameMatch?.id) {
            existingId = newNameMatch.id;
          }
        }
      }
    }

    if (!existingId) {
      return null;
    }

    const normalizedId = String(existingId).trim();
    if (group) {
      group.get('id')?.setValue(normalizedId, { emitEvent: false });
    }
    return normalizedId;
  }

  private extractApiError(error: unknown, fallback: string): string {
    return extractMemberApiError(error, fallback);
  }

  /**
   * Switch between tabs
   */
  switchTab(tab: string): void {
    this.activeTab = tab;
    if (tab === 'members') {
      this.collapseAllMemberCards();
    }
    // Ensure new tab content starts at the top
    setTimeout(() => this.scrollActiveTabToTop(), 50);
  }

  private scrollActiveTabToTop(): void {
    const ref = this.activeTab === 'info' ? this.infoTabContentRef : this.membersTabContentRef;
    if (ref?.nativeElement) {
      ref.nativeElement.scrollTop = 0;
    }
  }

  /**
   * Submit the form
   */
  onSubmit(): void {
    if (this.subscriptionAccess.isReadOnly()) {
      this.toastService.warning('Read-only mode: renew subscription to save families.', 'Read-only');
      return;
    }
    // Re-validate status before submission
    const status = this.familyForm.get('status')?.value;
    if (status === 'inactive') {
      this.validateStatusChange(status);
    }

    if (!this.familyForm.valid) {
      markFormGroupTouched(this.familyForm);
      // Switch to info tab if validation fails and we're on members tab
      if (this.activeTab === 'members') {
        this.switchTab('info');
      }
      return;
    }
    
    if (this.familyForm.valid) {
      this.loading = true;
      this.error = null;
      // CRITICAL: Use getRawValue() to ensure all fields including null IDs are included
      const formData = { ...this.familyForm.getRawValue() };

      // Get tenant country code for validation
      const getTenantCountryCode = (): string => {
        try {
          const user = this.authService.currentUserValue as any;
          const iso2 = user?.tenant?.country_code || user?.tenant?.country?.iso2;
          if (iso2 && typeof iso2 === 'string' && iso2.length === 2) {
            return iso2.toUpperCase();
          }
          // Try localStorage
          const cached = localStorage.getItem('tenant_country_code');
          if (cached && cached.length === 2) {
            return cached.toUpperCase();
          }
        } catch {}
        return 'IN'; // Default to IN if not found
      };

      const tenantCountry = getTenantCountryCode();
      const dialCode = this.callingCode || '';
      const dialCodeDigits = dialCode.replace(/\D/g, ''); // Extract digits from dial code (e.g., "+91" -> "91")
      
      const toE164 = (raw: any): any => {
        // Return null for empty/null/undefined values (backend expects null for nullable fields)
        if (raw === null || raw === undefined) return null;
        const str = String(raw).trim();
        if (!str || str === '') return null; // Empty string becomes null
        
        // Extract all digits from the input (removes any non-digit characters)
        const allDigits = str.replace(/\D/g, '');
        if (!allDigits || allDigits === '') return null; // No digits found
        
        let e164Number: string;
        
        // IMPORTANT: Form stores phone WITHOUT country code (country code is displayed separately)
        // So we should always prepend the country code unless it's already there
        if (str.startsWith('+')) {
          // Phone already has country code prefix - use as is but validate
          // This shouldn't happen if form is working correctly, but handle it
          if (dialCodeDigits && allDigits.length <= dialCodeDigits.length) {
            // Only country code, no actual phone number
            return null;
          }
          e164Number = str;
        } else {
          // Phone is just digits (expected case from form)
          // Check if digits accidentally include country code
          if (dialCodeDigits && allDigits.startsWith(dialCodeDigits)) {
            // Digits include country code - remove it first, then add back with +
            const phoneDigits = allDigits.substring(dialCodeDigits.length);
            if (!phoneDigits || phoneDigits === '') {
              // Only country code, no actual phone number
              return null;
            }
            // Reconstruct with proper format
            e164Number = `${dialCode}${phoneDigits}`;
          } else {
            // Digits don't include country code - prepend it (normal case)
            if (!dialCode || dialCode === '') {
              // No dial code available
              return null;
            }
            e164Number = `${dialCode}${allDigits}`;
          }
        }
        
        // CRITICAL: Validate and format using libphonenumber-js
        try {
          // Parse the phone number (it should have country code at this point)
          const phoneNumber = parsePhoneNumber(e164Number);
          
          if (!phoneNumber) {
            return null;
          }
          
          // Format in E.164
          const formatted = phoneNumber.format('E.164');
          
          // Basic sanity check - must be valid E.164 format
          if (!formatted || !formatted.startsWith('+') || formatted.length < 8 || formatted.length > 20) {
            console.warn('⚠️ Formatted phone number failed sanity check, setting to null:', {
              original: raw,
              formatted: formatted,
              length: formatted?.length
            });
            return null;
          }
          
          // Get detected country
          const detectedCountry = phoneNumber.country;
          
          // If phone number can be parsed and formatted, send it
          // Backend will do the final validation - we're just ensuring proper format here
          // Only reject if it's clearly malformed (e.g., too short, no country detected)
          
          // Basic validation: must have detected country and reasonable length
          if (!detectedCountry) {
            console.warn('⚠️ Could not detect country from phone number, setting to null:', {
              original: raw,
              formatted: formatted
            });
            return null;
          }
          
          // If country matches tenant country, validate it's actually valid
          const countryMatches = detectedCountry.toUpperCase() === tenantCountry.toUpperCase();
          if (countryMatches) {
            // For tenant country, validate using libphonenumber
            // Be lenient - if it can be parsed and has reasonable format, send it
            // Backend will do final validation
            const isValid = phoneNumber.isValid() || isValidPhoneNumber(formatted, detectedCountry as CountryCode);
            
            // For Indian numbers, ensure proper format
            if (tenantCountry === 'IN' && detectedCountry === 'IN') {
              const digitsOnly = formatted.replace(/\D/g, '');
              // Indian mobile numbers: 91 (country) + 10 digits = 12 digits total
              // Indian landlines might have area codes, so allow 12-13 digits
              if (digitsOnly.length < 12 || digitsOnly.length > 13) {
                console.warn('⚠️ Indian phone number has wrong length, setting to null:', {
                  original: raw,
                  formatted: formatted,
                  digitsOnly: digitsOnly,
                  length: digitsOnly.length,
                  expected: '12-13 digits (91 + 10-11 digits)'
                });
                return null;
              }
              
              // Additional validation: Indian mobile numbers should start with 6-9 after country code
              const numberAfterCountry = digitsOnly.substring(2); // Skip "91"
              if (numberAfterCountry.length === 10) {
                const firstDigit = numberAfterCountry.charAt(0);
                // Indian mobile numbers start with 6, 7, 8, or 9
                if (!['6', '7', '8', '9'].includes(firstDigit)) {
                  console.warn('⚠️ Indian mobile number does not start with 6-9, might be invalid:', {
                    original: raw,
                    formatted: formatted,
                    numberAfterCountry: numberAfterCountry,
                    firstDigit: firstDigit,
                    note: 'Sending anyway - backend will validate'
                  });
                  // Still send it - might be a landline or valid number
                }
              }
            }
            
            // If validation fails, still send it if it can be parsed and formatted
            // Backend will do the final validation
            if (!isValid) {
              console.warn('⚠️ Phone number failed strict validation, but sending anyway (backend will validate):', {
                original: raw,
                formatted: formatted,
                detectedCountry: detectedCountry,
                tenantCountry: tenantCountry,
                isValid: phoneNumber.isValid(),
                isValidPhoneNumber: isValidPhoneNumber(formatted, detectedCountry as CountryCode),
                note: 'Sending to backend for final validation'
              });
              // Still send it - backend will catch if it's truly invalid
            }
          }
          
          // Phone number is valid (or for different country) - send it
          // Backend will do final validation
          console.log('✅ Phone number processed successfully:', {
            original: raw,
            formatted: formatted,
            detectedCountry: detectedCountry,
            tenantCountry: tenantCountry,
            countryMatches: countryMatches,
            isValid: phoneNumber.isValid()
          });
          return formatted;
        } catch (error: any) {
          // Parsing/validation failed
          console.warn('⚠️ Phone number processing exception, setting to null:', {
            original: raw,
            e164: e164Number,
            country: tenantCountry,
            error: error?.message || error
          });
          return null;
        }
      };

      if (Array.isArray(formData.members)) {
        // CRITICAL: Log BEFORE processing to see raw form data
        console.log('🔍 Raw form members BEFORE processing:', 
          formData.members.map((m: any, idx: number) => ({
            index: idx,
            id: m?.id,
            idType: typeof m?.id,
            idValue: m?.id,
            firstName: m?.first_name,
            lastName: m?.last_name,
            hasId: !!(m?.id !== undefined && m?.id !== null && m?.id !== '')
          }))
        );
        
        // CRITICAL: Deduplicate members by ID before sending to prevent duplicate updates/creates
        const memberMap = new Map<string, any>();
        const membersWithIds: any[] = [];
        const membersWithoutIds: any[] = [];
        
        formData.members.forEach((m: any, idx: number) => {
          // CRITICAL: Get ID directly from form control, not from m.id (in case it was lost)
          const formMemberControl = this.members.at(idx);
          const formMemberId = formMemberControl?.get('id')?.value;
          
          // Use form control ID if available, otherwise fall back to m.id
          let memberId = (formMemberId !== undefined && formMemberId !== null && formMemberId !== '') 
            ? String(formMemberId).trim() 
            : (m?.id !== undefined && m?.id !== null && m?.id !== '') 
              ? String(m.id).trim() 
              : null;
          
          // CRITICAL: If ID is still missing and we have original family data, try to find it
          // This is a last resort to prevent creating duplicates when editing existing members
          if (!memberId && this.family?.members && this.family.members.length > 0) {
            const firstName = m?.first_name || formMemberControl?.get('first_name')?.value || '';
            const lastName = m?.last_name || formMemberControl?.get('last_name')?.value || '';
            const relationship = m?.relationship_to_head || formMemberControl?.get('relationship_to_head')?.value || '';
            
            // Try to find matching member in original family data
            const matchingMember = this.family.members.find(fm => {
              // Match by name and relationship (most reliable)
              if (fm.first_name === firstName && fm.last_name === lastName && fm.relationship_to_head === relationship) {
                return true;
              }
              // Fallback: match by name only (if relationship was changed)
              if (fm.first_name === firstName && fm.last_name === lastName) {
                return true;
              }
              return false;
            });
            
            if (matchingMember?.id) {
              memberId = String(matchingMember.id).trim();
              console.log('⚠️ Restored missing member ID by matching with original family data:', {
                index: idx,
                memberId,
                name: `${firstName} ${lastName}`
              });
              // Update the form control with the restored ID
              formMemberControl?.get('id')?.setValue(memberId, { emitEvent: false });
            }
          }
          
          // CRITICAL: Preserve the member ID for updates
          // Process phone number and ensure null for empty/invalid values
          // Get phone from form control first (most reliable), then fall back to member data
          const formPhoneValue = formMemberControl?.get('phone')?.value;
          const rawPhone = formPhoneValue !== undefined && formPhoneValue !== null && formPhoneValue !== '' 
            ? formPhoneValue 
            : m?.phone;
          
          const processedPhone = toE164(rawPhone);
          // Explicitly set to null if empty string or falsy (backend expects null for nullable fields)
          const finalPhone = (processedPhone === null || processedPhone === undefined || processedPhone === '') 
            ? null 
            : processedPhone;
          
          const memberWithId = {
            ...m,
            phone: finalPhone
          };
          
          // Log phone processing for debugging
          console.log('📞 Phone processing for member:', {
            index: idx,
            memberName: `${m?.first_name} ${m?.last_name}`,
            formPhoneValue: formPhoneValue,
            memberPhoneValue: m?.phone,
            rawPhone: rawPhone,
            rawPhoneType: typeof rawPhone,
            processedPhone: processedPhone,
            processedPhoneType: typeof processedPhone,
            finalPhone: finalPhone,
            finalPhoneType: typeof finalPhone,
            isNull: finalPhone === null,
            isEmpty: finalPhone === '',
            relationship: m?.relationship_to_head || formMemberControl?.get('relationship_to_head')?.value,
            callingCode: dialCode,
            tenantCountry: tenantCountry
          });
          
          // Explicitly set ID from form control or member data
          if (memberId) {
            memberWithId.id = memberId;
            
            // Deduplicate: if we've seen this ID before, keep the first one (or merge if needed)
            if (memberMap.has(memberWithId.id)) {
              console.warn('⚠️ Duplicate member ID found in form, keeping first occurrence:', {
                id: memberWithId.id,
                firstName: memberWithId.first_name,
                lastName: memberWithId.last_name,
                duplicateIndex: idx
              });
              // Skip this duplicate
              return;
            }
            
            memberMap.set(memberWithId.id, memberWithId);
            membersWithIds.push(memberWithId);
            
            console.log('✅ Member with ID preserved:', {
              index: idx,
              id: memberWithId.id,
              name: `${memberWithId.first_name} ${memberWithId.last_name}`,
              source: formMemberId ? 'formControl' : 'memberData'
            });
          } else {
            // Member without ID - will be created as new
            // CRITICAL: Explicitly set id to null to ensure backend treats it as new
            memberWithId.id = null;
            membersWithoutIds.push(memberWithId);
            
            console.log('🆕 Member without ID (will be created):', {
              index: idx,
              name: `${memberWithId.first_name} ${memberWithId.last_name}`
            });
          }
        });
        
        // Combine: members with IDs first (updates), then new members (creates)
        formData.members = [...membersWithIds, ...membersWithoutIds];
        
        // FINAL CLEANUP: Ensure all member phone fields are properly formatted
        // Note: Phone numbers should already be validated and formatted by toE164() above
        // This cleanup just ensures null values are properly set
        formData.members = formData.members.map((m: any) => {
          let phoneValue = m.phone;
          
          // Convert any falsy, empty, or whitespace-only value to null
          if (!phoneValue || 
              phoneValue === '' || 
              phoneValue === undefined ||
              (typeof phoneValue === 'string' && phoneValue.trim() === '')) {
            phoneValue = null;
          } else if (typeof phoneValue === 'string') {
            // Phone should already be in E.164 format from toE164()
            // Just ensure it's a valid string (starts with + and has reasonable length)
            const trimmed = phoneValue.trim();
            if (trimmed.startsWith('+') && trimmed.length >= 8 && trimmed.length <= 20) {
              // Valid E.164 format - keep it
              phoneValue = trimmed;
            } else {
              // Not a valid E.164 format - set to null
              console.warn('⚠️ Invalid phone format in final cleanup, setting to null:', {
                original: phoneValue,
                trimmed: trimmed,
                member: `${m.first_name} ${m.last_name}`
              });
              phoneValue = null;
            }
          }
          
          // Return member with cleaned phone value
          return { ...m, phone: phoneValue };
        });
        
        // Log summary with phone numbers for debugging
        console.log('📤 FINAL PAYLOAD - Submitting family with members:', {
          totalMembers: formData.members.length,
          membersWithIds: membersWithIds.length,
          membersWithoutIds: membersWithoutIds.length,
          tenantCountry: tenantCountry,
          callingCode: dialCode,
          memberDetails: formData.members.map((m: any, idx: number) => ({
            index: idx,
            id: m.id,
            name: `${m.first_name} ${m.last_name}`,
            relationship: m.relationship_to_head,
            phone: m.phone,
            phoneType: typeof m.phone,
            phoneIsNull: m.phone === null,
            phoneIsEmpty: m.phone === '',
            phoneStringified: JSON.stringify(m.phone),
            phoneLength: m.phone ? String(m.phone).length : 0
          })),
          // Log the exact payload structure
          exactPayload: JSON.stringify(formData.members.map((m: any) => ({
            id: m.id,
            first_name: m.first_name,
            last_name: m.last_name,
            phone: m.phone
          })), null, 2)
        });
      }
      
      // Convert empty bcc_id string to null for proper backend handling
      if (formData.bcc_id === '' || formData.bcc_id === null) {
        formData.bcc_id = null;
      }

      const apiCall = this.family
        ? this.familyService.updateFamily(this.family.id, formData)
        : this.familyService.createFamily(formData);

      apiCall.subscribe({
        next: (response) => {
          this.loading = false;
          if (response.success) {
            this.save.emit(response.data);
          } else {
            this.error = response.message || 'Failed to save family';
          }
        },
        error: (error) => {
          this.loading = false;
          this.handleValidationErrors(error);
          console.error('Error saving family:', error);
        }
      });
    } else {
      // Mark all fields as touched to show validation errors
      this.markFormGroupTouched(this.familyForm);
      this.error = 'Please fill in all required fields correctly.';
    }
  }

  /**
   * Mark all fields as touched to trigger validation display
   */
  private markFormGroupTouched(formGroup: FormGroup | FormArray): void {
    Object.keys(formGroup.controls).forEach(key => {
      const control = formGroup.get(key);
      control?.markAsTouched();

      if (control instanceof FormGroup || control instanceof FormArray) {
        this.markFormGroupTouched(control);
      }
    });
  }

  /**
   * Cancel and close the form
   */
  onCancel(): void {
    if (this.familyForm.dirty) {
      if (confirm('You have unsaved changes. Are you sure you want to cancel?')) {
        this.cancel.emit();
      }
    } else {
      this.cancel.emit();
    }
  }

  /**
   * Handle validation errors from backend
   */
  private handleValidationErrors(error: any): void {
    this.validationErrors = {};
    
    // Get error message
    const errorMessage = error?.error?.message || 'Failed to save family. Please try again.';
    this.error = errorMessage;
    
    // Parse validation errors from backend
    if (error?.error?.errors && typeof error.error.errors === 'object') {
      const backendErrors = error.error.errors;
      
      // Process each error field
      Object.keys(backendErrors).forEach(fieldPath => {
        const errorMessages = Array.isArray(backendErrors[fieldPath]) 
          ? backendErrors[fieldPath] 
          : [backendErrors[fieldPath]];
        
        const errorMessage = errorMessages[0] || 'Invalid value';
        
        // Handle nested fields like "members.0.phone"
        if (fieldPath.startsWith('members.')) {
          const match = fieldPath.match(/^members\.(\d+)\.(.+)$/);
          if (match) {
            const memberIndex = parseInt(match[1], 10);
            const memberField = match[2];
            
            // Store error for member field
            const errorKey = `members.${memberIndex}.${memberField}`;
            this.validationErrors[errorKey] = errorMessage;
            
            // Mark the form control as invalid
            if (this.members.at(memberIndex)) {
              const control = this.members.at(memberIndex).get(memberField);
              if (control) {
                control.setErrors({ backend: errorMessage });
                control.markAsTouched();
              }
            }
            
            // Switch to members tab if not already there
            if (this.activeTab !== 'members') {
              this.switchTab('members');
            }
            
            // Expand the member card and relevant section to show the error
            this.expandedMemberIndexes.add(memberIndex);
            const sacramentFields = new Set([
              'baptism_date',
              'baptism_place',
              'baptism_church_name',
              'first_communion_date',
              'confirmation_date',
              'marriage_date',
              'marriage_place',
              'marriage_spouse_name'
            ]);
            const section: 'personal' | 'sacraments' = sacramentFields.has(memberField)
              ? 'sacraments'
              : 'personal';
            this.expandMemberDetailSection(memberIndex, section);
          }
        } else {
          // Handle top-level fields
          this.validationErrors[fieldPath] = errorMessage;
          
          // Mark the form control as invalid
          const control = this.familyForm.get(fieldPath);
          if (control) {
            control.setErrors({ backend: errorMessage });
            control.markAsTouched();
          }
          
          // Switch to appropriate tab based on field
        if (['family_name', 'address_line_1', 'address_line_2', 'city', 'postal_code', 
             'bcc_id', 'status', 'notes'].includes(fieldPath)) {
            if (this.activeTab !== 'info') {
              this.switchTab('info');
            }
          }
        }
      });
      
      // Build a user-friendly summary message
      const errorFields = Object.keys(this.validationErrors);
      if (errorFields.length > 0) {
        const fieldLabels: { [key: string]: string } = {
          'family_name': 'Family Name',
          'phone': 'Phone Number',
          'first_name': 'First Name',
          'last_name': 'Last Name',
          'relationship_to_head': 'Relationship to Head'
        };
        
        const fieldNames = errorFields.map(field => {
          if (field.startsWith('members.')) {
            const match = field.match(/^members\.(\d+)\.(.+)$/);
            if (match) {
              const memberIndex = parseInt(match[1], 10);
              const memberField = match[2];
              const memberName = this.members.at(memberIndex)?.get('first_name')?.value || 
                                `Member ${memberIndex + 1}`;
              const fieldLabel = fieldLabels[memberField] || memberField;
              return `${fieldLabel} (${memberName})`;
            }
          }
          return fieldLabels[field] || field;
        });
        
        this.error = `Please fix the following errors:\n• ${fieldNames.join('\n• ')}`;
        
        // Also log for debugging
        console.error('📋 Validation errors:', {
          errors: this.validationErrors,
          fieldNames: fieldNames
        });
      }
    }
  }

  /**
   * Check if a form control has an error
   */
  hasError(controlName: string): boolean {
    // Check both frontend validation and backend validation errors
    return isFieldInvalid(controlName, this.familyForm) || !!this.validationErrors[controlName];
  }

  /**
   * Get user-friendly error message for a form control
   */
  getErrorMessage(controlName: string): string {
    // First check for backend validation error
    if (this.validationErrors[controlName]) {
      return this.validationErrors[controlName];
    }
    // Check for custom validation errors
    if (controlName === 'status' && this.familyForm.get('status')?.errors?.['hasActiveMembers']) {
      return 'Cannot set Family to inactive with active members';
    }
    // Then check for frontend validation error
    return getErrorMessage(controlName, this.familyForm);
  }

  /**
   * Check if a member form control has an error
   */
  hasMemberError(index: number, controlName: string): boolean {
    const control = this.members.at(index).get(controlName);
    const errorKey = `members.${index}.${controlName}`;
    return !!(control && control.invalid && control.touched) || !!this.validationErrors[errorKey];
  }

  /**
   * Get error message for a member form control
   */
  getMemberErrorMessage(index: number, controlName: string): string {
    const errorKey = `members.${index}.${controlName}`;
    if (this.validationErrors[errorKey]) {
      return this.validationErrors[errorKey];
    }
    const control = this.members.at(index).get(controlName);
    if (control?.errors) {
      if (control.errors['required']) {
        return `${this.getFieldLabel(controlName)} is required`;
      }
      if (control.errors['email']) {
        return 'Please enter a valid email address';
      }
      if (control.errors['phone']) {
        return 'Please enter a valid phone number';
      }
    }
    return '';
  }

  /**
   * Get user-friendly field label
   */
  private getFieldLabel(fieldName: string): string {
    const labels: { [key: string]: string } = {
      'first_name': 'First Name',
      'last_name': 'Last Name',
      'middle_name': 'Middle Name',
      'phone': 'Phone Number',
      'email': 'Email',
      'relationship_to_head': 'Relationship to Head',
      'date_of_birth': 'Date of Birth',
      'gender': 'Gender',
      'marital_status': 'Marital Status',
      'family_name': 'Family Name'
    };
    return labels[fieldName] || fieldName;
  }

  /**
   * Get all completed sacraments for a person with their dates
   * Returns array of { name: string; date: string; place?: string; spouse?: string } objects
   */
  getCompletedSacraments(person: any): Array<{ name: string; date: string; place?: string; spouse?: string }> {
    const sacraments: Array<{ name: string; date: string; place?: string; spouse?: string }> = [];

    // Baptism
    if (person.baptism_date) {
      sacraments.push({
        name: 'Baptism',
        date: person.baptism_date,
        place: person.baptism_place
      });
    }

    // First Communion
    if (person.first_communion_date) {
      sacraments.push({
        name: 'First Communion',
        date: person.first_communion_date,
        place: person.first_communion_place
      });
    }

    // Confirmation
    if (person.confirmation_date) {
      sacraments.push({
        name: 'Confirmation',
        date: person.confirmation_date,
        place: person.confirmation_place
      });
    }

    // Marriage (if applicable)
    if (person.marriage_date) {
      sacraments.push({
        name: 'Marriage',
        date: person.marriage_date,
        place: person.marriage_place,
        spouse: person.marriage_spouse_name
      });
    }

    // Sort by date (oldest first)
    return sacraments.sort((a, b) => {
      const dateA = new Date(a.date);
      const dateB = new Date(b.date);
      return dateA.getTime() - dateB.getTime();
    });
  }

  /**
   * Format date for display (converts YYYY-MM-DD to readable format)
   */
  formatSacramentDate(dateString: string): string {
    if (!dateString) return '';
    try {
      const date = new Date(dateString);
      return date.toLocaleDateString('en-US', { 
        year: 'numeric', 
        month: 'long', 
        day: 'numeric' 
      });
    } catch {
      return dateString;
    }
  }

  /**
   * Load active BCCs for dropdown
   */
  private loadActiveBCCs(): void {
    this.bccService.getBCCs({ status: 'active', per_page: 1000 }).subscribe({
      next: (response) => {
        if (response.success && response.data) {
          this.activeBCCs = response.data;
          // Patch form after BCCs are loaded
          this.patchFormData();
        }
      },
      error: (error) => {
        console.error('Failed to load active BCCs:', error);
        this.activeBCCs = [];
        // Still patch form even if BCCs fail to load
        this.patchFormData();
      }
    });
  }

  /**
   * Validate status change - prevent inactive if there are active members or head
   */
  private validateStatusChange(status: string): void {
    const statusControl = this.familyForm.get('status');
    
    if (!statusControl) {
      return;
    }

    // Only validate when trying to set to inactive
    if (status === 'inactive') {
      const activeMemberCount = this.getActiveMemberCountInternal();
      
      if (activeMemberCount > 0) {
        statusControl.setErrors({
          hasActiveMembers: true
        });
        this.error = `Cannot set Family to inactive. There ${activeMemberCount === 1 ? 'is' : 'are'} ${activeMemberCount} active ${activeMemberCount === 1 ? 'member' : 'members'} (including family head) in this family. Please deactivate the members first.`;
      } else {
        statusControl.setErrors(null);
        // Clear error only if it was related to active members
        if (this.error && this.error.includes('active member')) {
          this.error = null;
        }
      }
    } else {
      // Clear error when status is not inactive
      statusControl.setErrors(null);
      if (this.error && this.error.includes('active member')) {
        this.error = null;
      }
    }
  }

  /**
   * Get count of active members (including family head) in this family (private method)
   */
  private getActiveMemberCountInternal(): number {
    let count = 0;

    // Check all members in the form array
    for (let i = 0; i < this.members.length; i++) {
      const memberControl = this.members.at(i);
      const memberStatus = memberControl.get('status')?.value;
      
      if (memberStatus === 'active') {
        count++;
      }
    }

    return count;
  }

  /**
   * Get active member count (for template)
   */
  getActiveMemberCount(): number {
    return this.getActiveMemberCountInternal();
  }
}
