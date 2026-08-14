import { Component, OnInit, OnDestroy, ChangeDetectionStrategy, ChangeDetectorRef, inject } from '@angular/core';
import { CommonModule, DatePipe } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { Router } from '@angular/router';
import { Subject, takeUntil } from 'rxjs';
import { ToastService } from '@core/services/toast.service';
import { MemberService, MemberFilters } from '../../services/member.service';
import { BCCService } from '@core/services/bcc.service';
import { FamilyMember, BCC } from '@core/models/family.model';
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
  ],
  templateUrl: './member-list.component.html',
  styleUrls: ['./member-list.component.scss'],
  providers: [DatePipe],
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
  showHeadOnly = false;
  
  // Sorting state
  sortColumn: string = ''; // Backend sort column name
  sortDirection: 'asc' | 'desc' | null = null;
  frontendSortColumn: string = ''; // Frontend column name for UI display
  
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
  loadingDetail = false;

  // Expose DatePipe for template
  datePipe = new DatePipe('en-US');

  constructor(
    private memberService: MemberService,
    private bccService: BCCService,
    private router: Router,
    private toastService: ToastService
  ) {}

  ngOnInit(): void {
    this.initializeSearchFields();
    this.loadBCCs();
    this.loadMembers();
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
      is_head: this.showHeadOnly ? 'true' : undefined,
      sort_by: this.sortColumn || undefined,
      sort_order: this.sortDirection || undefined,
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

    return filters;
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
   * Format date for display
   */
  formatDate(date: string | null | undefined): string {
    if (!date) return 'N/A';
    return this.datePipe.transform(date, 'MMM d, y') || date;
  }

  /**
   * Format sacrament date for display
   */
  formatSacramentDate(date: string | null | undefined): string {
    if (!date) return '—';
    return this.formatDate(date);
  }

  /**
   * Get full address for member (from family if member doesn't have own address)
   */
  getMemberAddress(): string | null {
    if (!this.selectedMember?.family) {
      return null;
    }

    const family = this.selectedMember.family;
    const addressParts: string[] = [];

    // Address line 1
    if (family.address_line_1) {
      addressParts.push(family.address_line_1.trim());
    }

    // Address line 2
    if (family.address_line_2) {
      addressParts.push(family.address_line_2.trim());
    }

    // City
    if (family.city) {
      addressParts.push(family.city.trim());
    }

    // State (if available)
    if (family.state?.name) {
      addressParts.push(family.state.name.trim());
    }

    // Postal code
    if (family.postal_code) {
      addressParts.push(family.postal_code.trim());
    }

    // Country (if available)
    if (family.country?.name) {
      addressParts.push(family.country.name.trim());
    }

    // If we have any address parts, join them with commas and return
    if (addressParts.length > 0) {
      return addressParts.join(', ');
    }

    return null;
  }

  /**
   * Handle column sorting
   */
  onSort(event: SortEvent): void {
    // Map frontend column names to backend sort field names
    let backendSortColumn = event.column;
    
    if (event.column === 'last_name') {
      // Backend expects 'name' to sort by both last_name and first_name
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
    
    // Store both frontend and backend column names
    this.frontendSortColumn = event.column;
    this.sortColumn = backendSortColumn;
    this.sortDirection = event.direction;
    this.currentPage = 1; // Reset to first page when sorting
    this.loadMembers();
  }

  /**
   * Get formatted address for table display (from family head's address)
   * Returns address formatted for display, allowing wrapping to two lines
   * Format: line1, line2, city, state - postal_code, country
   */
  getMemberAddressForTable(member: FamilyMember): string | null {
    if (!member?.family) {
      return null;
    }

    const family = member.family;
    const addressParts: string[] = [];

    // Address line 1
    if (family.address_line_1) {
      addressParts.push(family.address_line_1.trim());
    }

    // Address line 2
    if (family.address_line_2) {
      addressParts.push(family.address_line_2.trim());
    }

    // City
    if (family.city) {
      addressParts.push(family.city.trim());
    }

    // State (if available)
    if (family.state?.name) {
      addressParts.push(family.state.name.trim());
    }

    // Postal code (with dash separator if state exists)
    if (family.postal_code) {
      addressParts.push(family.postal_code.trim());
    }

    // Country (if available)
    if (family.country?.name) {
      addressParts.push(family.country.name.trim());
    }

    // If we have any address parts, join them with commas and return
    // The CSS will handle wrapping to two lines if needed
    if (addressParts.length > 0) {
      return addressParts.join(', ');
    }

    return null;
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

    // For marriage, check if member is bride or groom
    if (this.selectedMember.marriage_bride_full_name) {
      // Member is groom
      return {
        father: this.selectedMember.marriage_groom_father_name || undefined,
        mother: this.selectedMember.marriage_groom_mother_name || undefined
      };
    } else if (this.selectedMember.marriage_groom_full_name) {
      // Member is bride
      return {
        father: this.selectedMember.marriage_bride_father_name || undefined,
        mother: this.selectedMember.marriage_bride_mother_name || undefined
      };
    }

    // For non-head members, try to get from family head if relationship indicates parent-child
    const relationship = this.selectedMember.relationship_to_head?.toLowerCase();
    if (relationship === 'son' || relationship === 'daughter' || relationship === 'child') {
      // Could potentially get from family head, but for now return null
      // as we don't have parent fields in FamilyMember model
      return null;
    }

    return null;
  }

  /**
   * Get member photo URL (if available)
   */
  getMemberPhotoUrl(): string | null {
    // Check if member has a photo field (may not exist in current model)
    const member = this.selectedMember as any;
    return member?.photo_url || member?.profile_image_url || member?.profile_image_full_url || null;
  }
}

