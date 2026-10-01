import { Component, OnInit, OnDestroy, ChangeDetectionStrategy, ChangeDetectorRef, inject } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { Router, ActivatedRoute } from '@angular/router';
import { Subject, takeUntil } from 'rxjs';
import { ToastService } from '@core/services/toast.service';
import { MemberService, MemberFilters } from '../../services/member.service';
import { BCCService } from '@core/services/bcc.service';
import { FamilyMember, BCC, Family } from '@core/models/family.model';
import { getMemberParentDisplayName } from '../../../family-management/utils/member-parent-display.util';
import { PaginationComponent } from '@shared/components';
import { PageHeaderComponent } from '@shared/components/page-header/page-header.component';
import { ListToolbarComponent } from '@shared/components/list-toolbar/list-toolbar.component';
import { DataTableComponent } from '@shared/components/data-table/data-table.component';
import { StatusBadgeComponent, StatusBadgeTone } from '@shared/components/status-badge/status-badge.component';
import { CfEmptyStateComponent } from '@shared/components/cf-empty-state/cf-empty-state.component';
import { LoadingSkeletonComponent } from '@shared/components/loading-skeleton/loading-skeleton.component';
import { AdvancedSearchPanelComponent, SearchField, ActiveFilter } from '@shared/components/advanced-search-panel/advanced-search-panel.component';
import { SortableDirective, SortEvent } from '@shared/directives/sortable.directive';
import { ModalShellComponent } from '@shared/components/modal-shell/modal-shell.component';
import { ImageViewerComponent } from '@shared/components/image-viewer/image-viewer.component';
import { cfFormatDate } from '@shared/utils/cf-intl.util';
import {
  MEMBER_AGE_BAND_ORDER,
  isMemberAgeBandKey,
  memberAgeBandFilterLabel,
} from '../../utils/member-age-groups.util';
import { MemberAgeBandKey } from '../../models/member-dashboard.model';

@Component({
  selector: 'app-member-list',
  standalone: true,
  imports: [
    CommonModule,
    FormsModule,
    PaginationComponent,
    AdvancedSearchPanelComponent,
    SortableDirective,
    PageHeaderComponent,
    ListToolbarComponent,
    DataTableComponent,
    StatusBadgeComponent,
    CfEmptyStateComponent,
    LoadingSkeletonComponent,
    ModalShellComponent,
    ImageViewerComponent,
  ],
  templateUrl: './member-list.component.html',
  styleUrls: ['./member-list.component.scss'],
  changeDetection: ChangeDetectionStrategy.OnPush
})
export class MemberListComponent implements OnInit, OnDestroy {
  private destroy$ = new Subject<void>();
  private cdr = inject(ChangeDetectorRef);

  // Data
  members: FamilyMember[] = [];
  bccs: BCC[] = [];

  // Pagination
  currentPage = 1;
  totalPages = 1;
  totalRecords = 0;
  perPage = 10;
  perPageOptions = [10, 20, 50, 100];

  // UI State
  loading = false;
  loaded = false;
  error: string | null = null;
  searchTerm = '';
  selectedStatus = '';
  selectedBccId = '';
  selectedProgression: MemberFilters['progression'] | '' = '';
  selectedAgeBand: MemberAgeBandKey | '' = '';
  selectedFamilyStatus = '';
  selectedGender = '';
  selectedMissing = '';
  selectedOccupation = '';
  selectedEducation = '';
  showHeadOnly = false;
  
  // Sorting state — default to member name ascending (API); header indicator only after user clicks
  sortColumn = 'name';
  sortDirection: 'asc' | 'desc' = 'asc';
  headerSortColumn = '';
  headerSortDirection: 'asc' | 'desc' | null = null;
  
  // Advanced search panel state
  showAdvancedSearch = false;
  searchFields: SearchField[] = [];

  get hasActiveFiltersOrSearch(): boolean {
    return this.getActiveFilterCount() > 0 || this.searchTerm.trim().length > 0;
  }

  openAdvancedSearch(): void {
    this.syncSearchFieldsWithFilters();
    this.showAdvancedSearch = true;
  }

  /**
   * Toggle advanced search panel
   */
  toggleAdvancedSearch(): void {
    this.showAdvancedSearch = !this.showAdvancedSearch;
    if (this.showAdvancedSearch) {
      // Sync search fields with current filter state when opening panel
      this.syncSearchFieldsWithFilters();
    }
  }

  // Detail Modal
  showDetailModal = false;
  selectedMember: FamilyMember | null = null;
  photoViewer: { src: string; alt: string; title: string; subtitle: string; nested: boolean } | null = null;
  private brokenAvatarIds = new Set<string>();
  loadingDetail = false;

  constructor(
    private memberService: MemberService,
    private bccService: BCCService,
    private router: Router,
    private route: ActivatedRoute,
    private toastService: ToastService
  ) {}

  ngOnInit(): void {
    this.initializeSearchFields();
    this.loadBCCs();
    this.applyQueryParams(this.route.snapshot.queryParamMap);
    this.route.queryParamMap
      .pipe(takeUntil(this.destroy$))
      .subscribe((params) => this.applyQueryParams(params));
  }

  private applyQueryParams(params: import('@angular/router').ParamMap): void {
    const progression = this.parseProgressionFilter(params.get('progression'));
    const ageBand = this.parseAgeBandFilter(params.get('age_band'));
    const status = params.get('status') ?? '';
    const familyStatus = params.get('family_status') ?? '';
    const bccId = params.get('bcc_id') ?? '';
    const gender = params.get('gender') ?? '';
    const missing = params.get('missing') ?? '';
    const occupation = params.get('occupation') ?? '';
    const education = params.get('education') ?? '';
    let changed = false;

    if (this.selectedProgression !== progression) {
      this.selectedProgression = progression;
      changed = true;
    }

    if (this.selectedAgeBand !== ageBand) {
      this.selectedAgeBand = ageBand;
      changed = true;
    }

    if (status && this.selectedStatus !== status) {
      this.selectedStatus = status;
      changed = true;
    }

    if (familyStatus && this.selectedFamilyStatus !== familyStatus) {
      this.selectedFamilyStatus = familyStatus;
      changed = true;
    }

    if (bccId && this.selectedBccId !== bccId) {
      this.selectedBccId = bccId;
      changed = true;
    }

    if (gender && this.selectedGender !== gender) {
      this.selectedGender = gender;
      changed = true;
    }

    if (missing && this.selectedMissing !== missing) {
      this.selectedMissing = missing;
      changed = true;
    }

    if (occupation && this.selectedOccupation !== occupation) {
      this.selectedOccupation = occupation;
      changed = true;
    }

    if (education && this.selectedEducation !== education) {
      this.selectedEducation = education;
      changed = true;
    }

    const bccField = this.searchFields.find((field) => field.key === 'bcc_id');
    if (bccField && bccId) {
      bccField.value = bccId;
    }

    this.syncSearchFieldsWithFilters();

    if (changed) {
      this.currentPage = 1;
      this.loadMembers();
    } else if (!this.loaded) {
      this.loadMembers();
    }
  }

  private parseProgressionFilter(value: string | null): MemberFilters['progression'] | '' {
    switch (value) {
      case 'baptized_without_communion':
      case 'baptized_without_confirmation':
      case 'female_unmarried_over_18':
      case 'male_unmarried_over_23':
        return value;
      default:
        return '';
    }
  }

  private parseAgeBandFilter(value: string | null): MemberAgeBandKey | '' {
    return isMemberAgeBandKey(value) ? value : '';
  }

  /**
   * Initialize search fields for advanced search panel
   */
  initializeSearchFields(): void {
    this.searchFields = [
      {
        key: 'status',
        label: 'Status',
        type: 'select',
        group: 'Membership',
        options: [
          { value: 'active', label: 'Active' },
          { value: 'inactive', label: 'Inactive' },
          { value: 'deceased', label: 'Deceased' },
          { value: 'migrated', label: 'Migrated' }
        ],
        value: this.selectedStatus
      },
      {
        key: 'bcc_id',
        label: 'BCC',
        type: 'select',
        group: 'Membership',
        options: [], // Will be populated after BCCs are loaded
        value: this.selectedBccId
      },
      {
        key: 'is_head',
        label: 'Family Head',
        type: 'boolean',
        group: 'Household',
        placeholder: 'Family Heads Only',
        value: this.showHeadOnly
      },
      {
        key: 'age_band',
        label: 'Age group',
        type: 'select',
        group: 'Membership',
        options: MEMBER_AGE_BAND_ORDER.map((key) => ({
          value: key,
          label: memberAgeBandFilterLabel(key),
        })),
        value: this.selectedAgeBand
      }
    ];
  }

  ngOnDestroy(): void {
    this.destroy$.next();
    this.destroy$.complete();
  }

  /**
   * Load BCCs for filter dropdown
   */
  loadBCCs(): void {
    this.bccService.getBCCs({ status: 'active' })
      .pipe(takeUntil(this.destroy$))
      .subscribe({
        next: (response) => {
          this.bccs = response.data || [];
          // Update search field options
          const bccField = this.searchFields.find(f => f.key === 'bcc_id');
          if (bccField) {
            bccField.options = this.bccs.map(bcc => ({
              value: bcc.id,
              label: bcc.name
            }));
          }
          this.cdr.markForCheck();
        },
        error: (error) => {
          console.error('Error loading BCCs:', error);
        }
      });
  }

  /**
   * Load members with current filters
   */
  loadMembers(): void {
    this.loading = true;
    this.error = null;
    this.cdr.markForCheck();

    const filters: MemberFilters = {
      search: this.searchTerm || undefined,
      status: this.selectedStatus || undefined,
      bcc_id: this.selectedBccId || undefined,
      progression: this.selectedProgression || undefined,
      age_band: this.selectedAgeBand || undefined,
      family_status: this.selectedFamilyStatus || undefined,
      gender: this.selectedGender || undefined,
      missing: this.selectedMissing || undefined,
      occupation: this.selectedOccupation || undefined,
      education: this.selectedEducation || undefined,
      is_head: this.showHeadOnly ? 'true' : undefined,
      sort_by: this.sortColumn,
      sort_order: this.sortDirection,
      per_page: this.perPage,
      page: this.currentPage
    };

    this.memberService.getMembers(filters)
      .pipe(takeUntil(this.destroy$))
      .subscribe({
        next: (response) => {
          console.log('Members API Response:', response);
          if (response && response.success !== false) {
            this.members = response.data || [];
            this.totalRecords = response.total || 0;
            this.totalPages = response.last_page || 1;
            // Ensure currentPage is within valid range
            const apiPage = response.current_page || 1;
            this.currentPage = Math.max(1, Math.min(apiPage, this.totalPages));
            this.error = null;
            console.log(`Loaded ${this.members.length} members (Total: ${this.totalRecords}, Page: ${this.currentPage}/${this.totalPages})`);
          } else {
            console.error('API returned unsuccessful response:', response);
            this.members = [];
            this.error = 'Failed to load members.';
          }
          this.loading = false;
          this.loaded = true;
          this.cdr.markForCheck();
        },
        error: (error) => {
          console.error('Error loading members:', error);
          console.error('Error details:', {
            status: error?.status,
            statusText: error?.statusText,
            message: error?.message,
            error: error?.error
          });
          this.members = [];
          this.error = error?.error?.message || error?.message || 'Failed to load members. Please try again.';
          this.loading = false;
          this.loaded = true;
          this.cdr.markForCheck();
        }
      });
  }

  onListSearchChange(value: string): void {
    this.searchTerm = value ?? '';
    this.currentPage = 1;
    this.loadMembers();
  }

  /**
   * Quick search (search term only)
   */
  onQuickSearch(): void {
    this.currentPage = 1;
    this.loadMembers();
  }

  /**
   * Clear search term
   */
  clearSearch(): void {
    this.searchTerm = '';
    this.currentPage = 1;
    this.loadMembers();
  }

  statusTone(status: string | undefined): StatusBadgeTone {
    switch (status) {
      case 'active':
        return 'success';
      case 'deceased':
        return 'critical';
      case 'migrated':
        return 'info';
      case 'inactive':
      default:
        return 'neutral';
    }
  }

  /**
   * Handle advanced search
   */
  onAdvancedSearch(searchValues: { [key: string]: any }): void {
    this.selectedStatus = searchValues['status'] || '';
    this.selectedBccId = searchValues['bcc_id'] || '';
    this.showHeadOnly = searchValues['is_head'] === true || searchValues['is_head'] === 'true';
    this.selectedAgeBand = isMemberAgeBandKey(searchValues['age_band']) ? searchValues['age_band'] : '';
    
    // Update search fields to reflect current filter state
    this.syncSearchFieldsWithFilters();
    
    this.currentPage = 1;
    this.loadMembers();
    this.showAdvancedSearch = false;
  }

  /**
   * Clear advanced search filters
   */
  onClearAdvancedSearch(): void {
    this.selectedStatus = '';
    this.selectedBccId = '';
    this.showHeadOnly = false;
    this.selectedAgeBand = '';
    this.selectedFamilyStatus = '';
    this.selectedGender = '';
    this.selectedMissing = '';
    this.selectedOccupation = '';
    this.selectedEducation = '';
    this.searchTerm = '';
    this.searchFields.forEach(field => {
      field.value = undefined;
    });
    this.currentPage = 1;
    this.loadMembers();
  }

  /**
   * Sync search fields with current filter state
   */
  syncSearchFieldsWithFilters(): void {
    const statusField = this.searchFields.find(f => f.key === 'status');
    if (statusField) {
      statusField.value = this.selectedStatus || undefined;
    }

    const bccField = this.searchFields.find(f => f.key === 'bcc_id');
    if (bccField) {
      bccField.value = this.selectedBccId || undefined;
    }

    const isHeadField = this.searchFields.find(f => f.key === 'is_head');
    if (isHeadField) {
      isHeadField.value = this.showHeadOnly || undefined;
    }

    const ageField = this.searchFields.find(f => f.key === 'age_band');
    if (ageField) {
      ageField.value = this.selectedAgeBand || undefined;
    }
  }

  /**
   * Get active filters for display
   */
  getActiveFilters(): ActiveFilter[] {
    const filters: ActiveFilter[] = [];

    if (this.selectedStatus) {
      filters.push({
        key: 'status',
        label: 'Status',
        value: this.selectedStatus,
        displayValue: this.selectedStatus.charAt(0).toUpperCase() + this.selectedStatus.slice(1)
      });
    }

    if (this.selectedBccId) {
      const bcc = this.bccs.find(b => b.id === this.selectedBccId);
      filters.push({
        key: 'bcc_id',
        label: 'BCC',
        value: this.selectedBccId,
        displayValue: bcc?.name || this.selectedBccId
      });
    }

    if (this.showHeadOnly) {
      filters.push({
        key: 'is_head',
        label: 'Type',
        value: true,
        displayValue: 'Family Heads Only'
      });
    }

    if (this.selectedProgression) {
      filters.push({
        key: 'progression',
        label: 'Progression',
        value: this.selectedProgression,
        displayValue: this.progressionLabel(this.selectedProgression),
      });
    }

    if (this.selectedAgeBand) {
      filters.push({
        key: 'age_band',
        label: 'Age group',
        value: this.selectedAgeBand,
        displayValue: memberAgeBandFilterLabel(this.selectedAgeBand),
      });
    }

    if (this.selectedFamilyStatus) {
      filters.push({
        key: 'family_status',
        label: 'Family status',
        value: this.selectedFamilyStatus,
        displayValue: this.selectedFamilyStatus.charAt(0).toUpperCase() + this.selectedFamilyStatus.slice(1),
      });
    }

    if (this.selectedGender) {
      const genderLabels: Record<string, string> = {
        male: 'Male',
        female: 'Female',
        other: 'Other',
        unknown: 'Gender not recorded',
      };
      filters.push({
        key: 'gender',
        label: 'Gender',
        value: this.selectedGender,
        displayValue: genderLabels[this.selectedGender] || this.selectedGender,
      });
    }

    if (this.selectedMissing) {
      const missingLabels: Record<string, string> = {
        dob: 'Missing date of birth',
        gender: 'Missing gender',
        relationship: 'Missing relationship',
      };
      filters.push({
        key: 'missing',
        label: 'Member data',
        value: this.selectedMissing,
        displayValue: missingLabels[this.selectedMissing] || this.selectedMissing,
      });
    }

    if (this.selectedOccupation) {
      filters.push({
        key: 'occupation',
        label: 'Occupation',
        value: this.selectedOccupation,
        displayValue: this.selectedOccupation === 'not_specified' || this.selectedOccupation === 'not_recorded'
          ? 'Not Recorded'
          : this.selectedOccupation,
      });
    }

    if (this.selectedEducation) {
      filters.push({
        key: 'education',
        label: 'Education',
        value: this.selectedEducation,
        displayValue: this.selectedEducation === 'not_specified'
          ? 'Not recorded'
          : this.selectedEducation === 'other'
            ? 'Other recorded'
            : this.selectedEducation,
      });
    }

    return filters;
  }

  private progressionLabel(key: NonNullable<MemberFilters['progression']>): string {
    const labels: Record<NonNullable<MemberFilters['progression']>, string> = {
      baptized_without_communion: 'Baptized, no First Communion (age 10+)',
      baptized_without_confirmation: 'Baptized, no Confirmation (age 10+)',
      female_unmarried_over_18: 'Female (>18) - Not Married',
      male_unmarried_over_23: 'Male (>23) - Not Married',
    };

    return labels[key];
  }

  /**
   * Get count of active filters
   */
  getActiveFilterCount(): number {
    return this.getActiveFilters().length;
  }

  /**
   * Remove single filter
   */
  removeFilter(filter: ActiveFilter): void {
    if (filter.key === 'status') {
      this.selectedStatus = '';
    } else if (filter.key === 'bcc_id') {
      this.selectedBccId = '';
    } else if (filter.key === 'is_head') {
      this.showHeadOnly = false;
    } else if (filter.key === 'progression') {
      this.selectedProgression = '';
    } else if (filter.key === 'age_band') {
      this.selectedAgeBand = '';
    } else if (filter.key === 'family_status') {
      this.selectedFamilyStatus = '';
    } else if (filter.key === 'gender') {
      this.selectedGender = '';
    } else if (filter.key === 'missing') {
      this.selectedMissing = '';
    } else if (filter.key === 'occupation') {
      this.selectedOccupation = '';
    } else if (filter.key === 'education') {
      this.selectedEducation = '';
    }

    // Update search field value
    const field = this.searchFields.find(f => f.key === filter.key);
    if (field) {
      field.value = undefined;
    }

    // Sync all fields after removal
    this.syncSearchFieldsWithFilters();

    this.currentPage = 1;
    this.loadMembers();
  }

  /**
   * Clear all filters
   */
  clearAllFilters(): void {
    this.selectedStatus = '';
    this.selectedBccId = '';
    this.selectedProgression = '';
    this.selectedAgeBand = '';
    this.selectedFamilyStatus = '';
    this.selectedGender = '';
    this.selectedMissing = '';
    this.selectedOccupation = '';
    this.selectedEducation = '';
    this.showHeadOnly = false;
    this.searchTerm = '';
    this.searchFields.forEach(field => {
      field.value = undefined;
    });
    this.currentPage = 1;
    this.loadMembers();
  }

  /**
   * Handle page change
   */
  onPageChange(page: number): void {
    if (page !== this.currentPage && page >= 1 && page <= this.totalPages) {
      this.currentPage = page;
      this.loadMembers();
    }
  }

  /**
   * Handle per page change
   */
  onPerPageChange(perPage: number): void {
    if (perPage !== this.perPage && this.perPageOptions.includes(perPage)) {
      this.perPage = perPage;
      this.currentPage = 1;
      this.loadMembers();
    }
  }

  /**
   * Get full name for a member
   */
  getFullName(member: FamilyMember): string {
    const parts = [member.first_name, member.middle_name, member.last_name].filter(Boolean);
    return parts.join(' ') || 'N/A';
  }

  /** Up to two initials for the detail modal avatar when no photo exists. */
  getMemberInitials(member: FamilyMember): string {
    const letters = [member.first_name, member.last_name]
      .map((part) => (part || '').trim()[0])
      .filter((char) => !!char && /[a-z0-9]/i.test(char))
      .slice(0, 2)
      .join('');
    return (letters || 'M').toUpperCase();
  }

  /**
   * Check if member is a family head
   */
  isFamilyHead(member: FamilyMember): boolean {
    return member.relationship_to_head === 'self';
  }

  /**
   * Get BCC name for a member
   */
  getBCCName(member: FamilyMember): string {
    return member.family?.bcc?.name || 'N/A';
  }

  /**
   * Get father's name for a member
   * Looks for a member in the same family with relationship_to_head = 'father'
   * Or if the member is a child, the family head might be the father
   */
  getFatherName(member: FamilyMember): string | null {
    const apiName = member.display_father_name || member.father_name;
    if (apiName) {
      return apiName;
    }

    if (member.person?.father_name) {
      return member.person.father_name;
    }

    if (!member?.family_id) {
      return null;
    }

    // Search through all loaded members to find the father in the same family
    // First, try to find a member with relationship_to_head = 'father' in the same family
    const fatherMember = this.members.find(
      (m: FamilyMember) => 
        m.family_id === member.family_id && 
        m.relationship_to_head === 'father' && 
        m.id !== member.id
    );
    
    if (fatherMember) {
      return this.getFullName(fatherMember);
    }

    // If member is a child (son/daughter), the family head might be the father
    if (member.relationship_to_head === 'son' || member.relationship_to_head === 'daughter') {
      const familyHead = this.members.find(
        (m: FamilyMember) => 
          m.family_id === member.family_id && 
          m.relationship_to_head === 'self' && 
          m.gender === 'male' &&
          m.id !== member.id
      );
      
      if (familyHead) {
        return this.getFullName(familyHead);
      }
    }

    // If family members are loaded in the family object, check there too
    if (member.family?.members && Array.isArray(member.family.members)) {
      const fatherFromFamily = member.family.members.find(
        (m: FamilyMember) => m.relationship_to_head === 'father' && m.id !== member.id
      );
      
      if (fatherFromFamily) {
        return this.getFullName(fatherFromFamily);
      }

      // Check if family head is the father
      if (member.relationship_to_head === 'son' || member.relationship_to_head === 'daughter') {
        const familyHeadFromFamily = member.family.members.find(
          (m: FamilyMember) => m.relationship_to_head === 'self' && m.gender === 'male'
        );
        
        if (familyHeadFromFamily) {
          return this.getFullName(familyHeadFromFamily);
        }
      }
    }

    return null;
  }

  /**
   * Get status badge class
   */
  getStatusClass(status: string): string {
    switch (status) {
      case 'active':
        return 'status-active';
      case 'inactive':
        return 'status-inactive';
      case 'deceased':
        return 'status-deceased';
      case 'migrated':
        return 'status-migrated';
      default:
        return 'status-unknown';
    }
  }

  /**
   * View member details
   */
  viewMember(member: FamilyMember): void {
    this.selectedMember = member;
    this.showDetailModal = true;
    this.cdr.markForCheck();
  }

  /**
   * Close detail modal
   */
  closeDetailModal(): void {
    this.showDetailModal = false;
    this.selectedMember = null;
    this.photoViewer = null;
    this.cdr.markForCheck();
  }

  /**
   * Navigate to family details page
   */
  viewFamilyDetails(): void {
    if (!this.selectedMember) {
      console.error('No member selected');
      return;
    }

    // Get family_id from member or family relationship
    const familyId = this.selectedMember.family_id || this.selectedMember.family?.id;
    
    if (!familyId) {
      console.error('Family ID not available for member:', this.selectedMember);
      this.toastService.error('Family information not available for this member');
      return;
    }

    // Close modal first
    this.closeDetailModal();
    
    // Use setTimeout to ensure modal closes before navigation
    setTimeout(() => {
      this.router.navigate(['/families', familyId]).catch(error => {
        console.error('Navigation error:', error);
        this.toastService.error('Failed to navigate to family details');
      });
    }, 100);
  }

  /**
   * Role shown once in the identity strip. The dialog title already carries the name.
   */
  getRelationshipLabel(member: FamilyMember): string {
    if (this.isFamilyHead(member)) {
      return 'Family head';
    }

    const relationship = (member.relationship_to_head || '').trim();
    if (!relationship) {
      return 'Member';
    }

    return relationship.replace(/_/g, ' ');
  }

  /**
   * Format date for display
   */
  formatDate(date: string | null | undefined): string {
    if (!date) return 'N/A';
    return cfFormatDate(date) || 'N/A';
  }

  /**
   * Format sacrament date for display
   */
  formatSacramentDate(date: string | null | undefined): string {
    if (!date) return '—';
    return this.formatDate(date);
  }

  /**
   * Household address as separate lines so a stored trailing comma
   * does not collapse into "Oak Ave,, Apartment".
   */
  getMemberAddressLines(member: FamilyMember | null | undefined = this.selectedMember): string[] {
    return this.buildAddressLines(member?.family);
  }

  /**
   * Single-line address for compact surfaces (table cells).
   */
  getMemberAddress(): string | null {
    const lines = this.getMemberAddressLines(this.selectedMember);
    return lines.length ? lines.join(', ') : null;
  }

  /**
   * Handle column sorting
   */
  onSort(event: SortEvent): void {
    // Map frontend column names to backend sort field names
    let backendSortColumn = event.column;

    if (event.column === 'name') {
      backendSortColumn = 'name';
    } else if (event.column === 'address') {
      // Backend handles 'address' directly
      backendSortColumn = 'address';
    } else if (event.column === 'bcc') {
      // Backend handles 'bcc' directly
      backendSortColumn = 'bcc';
    } else if (event.column === 'father_name') {
      // Backend handles 'father_name' (though it's a fallback to last_name)
      backendSortColumn = 'father_name';
    }
    
    this.headerSortColumn = event.column;
    this.headerSortDirection = event.direction ?? 'asc';
    this.sortColumn = backendSortColumn;
    this.sortDirection = event.direction ?? 'asc';
    this.currentPage = 1; // Reset to first page when sorting
    this.loadMembers();
  }

  /**
   * Get formatted address for table display (from family head's address)
   * Returns address formatted for display, allowing wrapping to two lines
   * Format: line1, line2, city, state - postal_code, country
   */
  getMemberAddressForTable(member: FamilyMember): string | null {
    const lines = this.getMemberAddressLines(member);
    return lines.length ? lines.join(', ') : null;
  }

  private buildAddressLines(family: Family | null | undefined): string[] {
    if (!family) {
      return [];
    }

    const lines: string[] = [];
    const line1 = this.cleanAddressPart(family.address_line_1);
    const line2 = this.cleanAddressPart(family.address_line_2);
    if (line1) {
      lines.push(line1);
    }
    if (line2) {
      lines.push(line2);
    }

    const locality = [this.cleanAddressPart(family.city), this.cleanAddressPart(family.state?.name)]
      .filter((part): part is string => !!part)
      .join(', ');
    const postal = this.cleanAddressPart(family.postal_code);
    const cityLine = [locality, postal].filter((part): part is string => !!part).join(' ');
    if (cityLine) {
      lines.push(cityLine);
    }

    const country = this.cleanAddressPart(family.country?.name);
    if (country) {
      lines.push(country);
    }

    return lines;
  }

  private cleanAddressPart(value: string | null | undefined): string | null {
    if (!value) {
      return null;
    }

    const cleaned = value
      .replace(/,+/g, ',')
      .replace(/\s*,\s*/g, ', ')
      .replace(/^[,\s]+|[,\s]+$/g, '')
      .replace(/\s{2,}/g, ' ')
      .trim();

    return cleaned || null;
  }

  /**
   * Check if sacrament is completed
   */
  isSacramentCompleted(member: FamilyMember, sacramentType: string): boolean {
    if (!member) return false;
    
    switch (sacramentType.toLowerCase()) {
      case 'baptism':
        return !!member.baptism_date;
      case 'first_communion':
      case 'first holy communion':
      case 'eucharist':
        return !!member.first_communion_date;
      case 'confirmation':
        return !!member.confirmation_date;
      case 'marriage':
      case 'matrimony':
        return !!member.marriage_date;
      default:
        return false;
    }
  }

  /**
   * Get parent information for member
   */
  getParentInfo(): { father?: string; mother?: string } | null {
    if (!this.selectedMember) return null;

    const member = this.selectedMember;
    let father = this.presentName(getMemberParentDisplayName(member, 'father'))
      || this.presentName(this.getFatherName(member));
    let mother = this.presentName(getMemberParentDisplayName(member, 'mother'));

    if (member.marriage_bride_full_name) {
      father = father || this.presentName(member.marriage_groom_father_name);
      mother = mother || this.presentName(member.marriage_groom_mother_name);
    } else if (member.marriage_groom_full_name) {
      father = father || this.presentName(member.marriage_bride_father_name);
      mother = mother || this.presentName(member.marriage_bride_mother_name);
    }

    if (!father && !mother) {
      return null;
    }

    return { father, mother };
  }

  private presentName(value: string | null | undefined): string | undefined {
    const trimmed = (value || '').trim();
    return trimmed || undefined;
  }

  /**
   * Head photos live on the nested family record, not on FamilyMember.
   * Non-heads have no person photo in this architecture — return null for initials.
   */
  getMemberPhotoUrl(member: FamilyMember | null | undefined): string | null {
    if (!member || !this.isFamilyHead(member) || this.isAvatarBroken(member)) {
      return null;
    }

    const family = member.family;
    if (!family) {
      return null;
    }

    if (family.head_profile_image_full_url?.trim()) {
      return family.head_profile_image_full_url;
    }

    if (family.head_profile_image_url?.trim()) {
      return family.head_profile_image_url;
    }

    if (family.head_avatar_url?.trim()) {
      return family.head_avatar_url;
    }

    return null;
  }

  isAvatarBroken(member: FamilyMember): boolean {
    return this.brokenAvatarIds.has(member.id);
  }

  onAvatarError(member: FamilyMember): void {
    this.brokenAvatarIds.add(member.id);
    this.cdr.markForCheck();
  }

  getAvatarColorClass(seed: string | undefined): string {
    const text = (seed || '').trim();
    if (!text) {
      return 'avatar-color-1';
    }
    let hash = 0;
    for (let i = 0; i < text.length; i++) {
      hash = ((hash << 5) - hash) + text.charCodeAt(i);
      hash |= 0;
    }
    const idx = Math.abs(hash) % 8;
    return `avatar-color-${idx + 1}`;
  }

  openPhotoViewer(member: FamilyMember, event: Event, nested = false): void {
    event.stopPropagation();
    event.preventDefault();

    const photoUrl = this.getMemberPhotoUrl(member);
    if (!photoUrl) {
      return;
    }

    this.photoViewer = {
      src: photoUrl,
      alt: this.getFullName(member),
      title: this.getFullName(member),
      subtitle: this.isFamilyHead(member) ? 'Family head' : (member.relationship_to_head || 'Member'),
      nested,
    };
    this.cdr.detectChanges();
  }

  closePhotoViewer(): void {
    this.photoViewer = null;
    this.cdr.detectChanges();
  }
}

