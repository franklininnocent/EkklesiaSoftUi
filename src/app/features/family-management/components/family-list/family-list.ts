import { Component, OnInit, OnDestroy } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule, ReactiveFormsModule, FormBuilder, FormGroup } from '@angular/forms';
import { Router } from '@angular/router';
import { Subject, debounceTime, takeUntil, distinctUntilChanged } from 'rxjs';
import { FamilyService } from '../../../../core/services/family.service';
import { BCCService } from '../../../../core/services/bcc.service';
import { Family, BCC, FamilyStatistics } from '../../../../core/models/family.model';
import { FamilyFormComponent } from '../family-form/family-form';
import { AdvancedSearchPanelComponent, SearchField, ActiveFilter } from '@shared/components/advanced-search-panel/advanced-search-panel.component';
import { PaginationComponent } from '@shared/components/pagination/pagination.component';

@Component({
  selector: 'app-family-list',
  standalone: true,
  imports: [
    CommonModule, 
    FormsModule, 
    ReactiveFormsModule, 
    FamilyFormComponent,
    AdvancedSearchPanelComponent,
    PaginationComponent
  ],
  templateUrl: './family-list.html',
  styleUrls: ['./family-list.scss']
})
export class FamilyListComponent implements OnInit, OnDestroy {
  private destroy$ = new Subject<void>();
  
  // Data
  families: Family[] = [];
  bccs: BCC[] = [];
  statistics: FamilyStatistics | null = null;
  
  // Pagination
  currentPage = 1;
  totalPages = 1;
  totalRecords = 0;
  perPage = 20;
  perPageOptions = [10, 20, 50, 100];
  
  // UI State
  loading = false;
  error: string | null = null;
  showAdvancedSearch = false;
  showForm = false;
  selectedFamily: Family | null = null;
  
  // Search & Filter Form
  filterForm: FormGroup;
  searchFields: SearchField[] = [];
  searchTerm = '';
  
  // Expose Math and Object for template
  Math = Math;
  Object = Object;
  
  constructor(
    private familyService: FamilyService,
    private bccService: BCCService,
    private fb: FormBuilder,
    private router: Router
  ) {
    this.filterForm = this.fb.group({
      search: [''],
      status: [''],
      bcc_id: [''],
      city: [''],
      // Backend order remains consistent; active-first handled client-side
      sort_by: ['created_at'],
      sort_order: ['desc']
    });
  }

  ngOnInit(): void {
    this.initializeSearchFields();
    this.loadReferenceData();
    this.loadStatistics();
    this.loadFamilies();
    this.setupSearchDebounce();
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
        options: [
          { value: 'active', label: 'Active' },
          { value: 'inactive', label: 'Inactive' },
          { value: 'migrated', label: 'Migrated' }
        ],
        value: this.filterForm.get('status')?.value
      },
      {
        key: 'bcc_id',
        label: 'BCC',
        type: 'select',
        options: [], // Will be populated after BCCs are loaded
        value: this.filterForm.get('bcc_id')?.value
      },
      {
        key: 'city',
        label: 'City',
        type: 'text',
        placeholder: 'Enter city name',
        value: this.filterForm.get('city')?.value
      }
    ];
  }

  ngOnDestroy(): void {
    this.destroy$.next();
    this.destroy$.complete();
  }

  /**
   * Setup search input debounce
   */
  private setupSearchDebounce(): void {
    this.filterForm.get('search')?.valueChanges
      .pipe(
        debounceTime(300),
        distinctUntilChanged(),
        takeUntil(this.destroy$)
      )
      .subscribe(() => {
        this.currentPage = 1;
        this.loadFamilies();
      });
  }

  /**
   * Load reference data for filters
   */
  private loadReferenceData(): void {
    this.bccService.getBCCs({ status: 'active' }).subscribe({
      next: (response) => {
        this.bccs = response.data;
        // Update search field options
        const bccField = this.searchFields.find(f => f.key === 'bcc_id');
        if (bccField) {
          bccField.options = this.bccs.map(bcc => ({
            value: bcc.id,
            label: bcc.name
          }));
        }
      },
      error: (error) => console.error('Failed to load BCCs', error)
    });
  }

  /**
   * Load statistics
   */
  private loadStatistics(): void {
    this.familyService.getStatistics().subscribe({
      next: (response) => {
        if (response.success && response.data) {
          this.statistics = response.data;
        }
      },
      error: (error) => console.error('Failed to load statistics', error)
    });
  }

  /**
   * Load families with filters
   */
  loadFamilies(): void {
    this.loading = true;
    this.error = null;

    const filters = {
      ...this.filterForm.value,
      page: this.currentPage,
      per_page: this.perPage
    };

    // Remove empty filters
    Object.keys(filters).forEach(key => {
      if (filters[key] === '' || filters[key] === null) {
        delete filters[key];
      }
    });

    this.familyService.getFamilies(filters).subscribe({
      next: (response) => {
        this.families = response.data;
        // Ensure Active records appear first on the list (client-side safeguard)
        this.families.sort((a, b) => {
          const aActive = a.status === 'active' ? 1 : 0;
          const bActive = b.status === 'active' ? 1 : 0;
          if (bActive !== aActive) return bActive - aActive;
          return 0;
        });
        this.currentPage = response.current_page;
        this.totalPages = response.last_page;
        this.totalRecords = response.total;
        this.loading = false;
      },
      error: (error) => {
        this.error = 'Failed to load families. Please try again.';
        this.loading = false;
        console.error('Error loading families:', error);
      }
    });
  }

  /**
   * Handle advanced search
   */
  onAdvancedSearch(searchValues: { [key: string]: any }): void {
    this.filterForm.patchValue({
      status: searchValues['status'] || '',
      bcc_id: searchValues['bcc_id'] || '',
      city: searchValues['city'] || ''
    });
    this.currentPage = 1;
    this.loadFamilies();
    this.showAdvancedSearch = false;
  }

  /**
   * Clear advanced search filters
   */
  onClearAdvancedSearch(): void {
    this.filterForm.patchValue({
      status: '',
      bcc_id: '',
      city: ''
    });
    this.searchFields.forEach(field => {
      field.value = undefined;
    });
    this.currentPage = 1;
    this.loadFamilies();
  }

  /**
   * Quick search (search term only)
   */
  onQuickSearch(): void {
    this.filterForm.patchValue({ search: this.searchTerm });
    this.currentPage = 1;
    this.loadFamilies();
  }

  /**
   * Clear search term
   */
  clearSearch(): void {
    this.searchTerm = '';
    this.filterForm.patchValue({ search: '' });
    this.currentPage = 1;
    this.loadFamilies();
  }

  /**
   * Get active filters for display
   */
  getActiveFilters(): ActiveFilter[] {
    const filters: ActiveFilter[] = [];
    const values = this.filterForm.value;

    if (values.status) {
      const statusLabels: {[key: string]: string} = {
        'active': 'Active',
        'inactive': 'Inactive',
        'migrated': 'Migrated'
      };
      filters.push({
        key: 'status',
        label: 'Status',
        value: values.status,
        displayValue: statusLabels[values.status] || values.status
      });
    }

    // Parish Zone removed from filters

    if (values.bcc_id) {
      const bcc = this.bccs.find(b => b.id === values.bcc_id);
      filters.push({
        key: 'bcc_id',
        label: 'BCC',
        value: values.bcc_id,
        displayValue: bcc?.name || String(values.bcc_id)
      });
    }

    if (values.city) {
      filters.push({
        key: 'city',
        label: 'City',
        value: values.city,
        displayValue: values.city
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
    this.filterForm.patchValue({
      [filter.key]: ''
    });

    // Update search field value
    const field = this.searchFields.find(f => f.key === filter.key);
    if (field) {
      field.value = undefined;
    }

    this.currentPage = 1;
    this.loadFamilies();
  }

  /**
   * Clear all filters
   */
  clearAllFilters(): void {
    this.filterForm.reset({
      search: '',
      status: '',
      bcc_id: '',
      city: '',
      sort_by: 'created_at',
      sort_order: 'desc'
    });
    this.searchTerm = '';
    this.searchFields.forEach(field => {
      field.value = undefined;
    });
    this.currentPage = 1;
    this.loadFamilies();
  }

  /**
   * Handle page change
   */
  onPageChange(page: number): void {
    if (page >= 1 && page <= this.totalPages) {
      this.currentPage = page;
      this.loadFamilies();
    }
  }

  /**
   * Handle page size change
   */
  onPageSizeChange(pageSize: number): void {
    this.perPage = pageSize;
    this.currentPage = 1;
    this.loadFamilies();
  }

  /**
   * Change page (backward compatibility)
   */
  goToPage(page: number): void {
    this.onPageChange(page);
  }

  /**
   * Change items per page (backward compatibility)
   */
  changePerPage(perPage: number): void {
    this.onPageSizeChange(perPage);
  }

  /**
   * Sort by column
   */
  sortBy(column: string): void {
    const currentSort = this.filterForm.get('sort_by')?.value;
    const currentOrder = this.filterForm.get('sort_order')?.value;

    if (currentSort === column) {
      // Toggle order
      this.filterForm.patchValue({
        sort_order: currentOrder === 'asc' ? 'desc' : 'asc'
      });
    } else {
      // New column, default to ascending
      this.filterForm.patchValue({
        sort_by: column,
        sort_order: 'asc'
      });
    }

    this.loadFamilies();
  }

  /**
   * Get sort icon for column
   */
  getSortIcon(column: string): string {
    const currentSort = this.filterForm.get('sort_by')?.value;
    const currentOrder = this.filterForm.get('sort_order')?.value;

    if (currentSort !== column) return '↕';
    return currentOrder === 'asc' ? '↑' : '↓';
  }

  /**
   * View family details
   */
  viewFamily(family: Family): void {
    this.router.navigate(['/families', family.id]);
  }

  /**
   * Edit family
   */
  editFamily(family: Family): void {
    this.selectedFamily = family;
    this.showForm = true;
  }

  /**
   * Delete family
   */
  deleteFamily(family: Family): void {
    if (confirm(`Are you sure you want to delete "${family.family_name}"?`)) {
      this.familyService.deleteFamily(family.id).subscribe({
        next: () => {
          this.loadFamilies();
          this.loadStatistics();
          alert('Family deleted successfully');
        },
        error: (error) => {
          alert('Failed to delete family');
          console.error('Error deleting family:', error);
        }
      });
    }
  }

  /**
   * Create new family
   */
  createFamily(): void {
    this.selectedFamily = null;
    this.showForm = true;
  }

  /**
   * Handle form save
   */
  onFormSave(family: Family): void {
    this.showForm = false;
    this.selectedFamily = null;
    this.loadFamilies();
    this.loadStatistics();
    alert('Family saved successfully!');
  }

  /**
   * Handle form cancel
   */
  onFormCancel(): void {
    this.showForm = false;
    this.selectedFamily = null;
  }

  /**
   * Export families
   */
  exportFamilies(): void {
    console.log('Export families');
    // Implement export functionality
  }

  /**
   * Get status badge class
   */
  getStatusClass(status: string): string {
    switch (status) {
      case 'active': return 'badge-success';
      case 'inactive': return 'badge-secondary';
      case 'migrated': return 'badge-info';
      default: return 'badge-secondary';
    }
  }

  /**
   * Generate initials from a full name (e.g., "John Doe" -> "JD")
   */
  getInitials(name: string): string {
    if (!name) return '';
    const parts = name.trim().split(/\s+/).filter(Boolean);
    if (parts.length === 1) {
      return parts[0].slice(0, 2).toUpperCase();
    }
    const first = parts[0].charAt(0);
    const last = parts[parts.length - 1].charAt(0);
    return (first + last).toUpperCase();
  }

  // Track avatars that failed to load so we can fallback to initials
  private brokenAvatarIds = new Set<string>();

  isAvatarBroken(family: Family): boolean {
    return this.brokenAvatarIds.has(family.id);
  }

  onAvatarError(family: Family): void {
    this.brokenAvatarIds.add(family.id);
  }

  /**
   * Deterministically choose a color class for the initials avatar
   */
  getAvatarColorClass(seed: string | undefined): string {
    const text = (seed || '').trim();
    if (!text) return 'avatar-color-1';
    let hash = 0;
    for (let i = 0; i < text.length; i++) {
      hash = ((hash << 5) - hash) + text.charCodeAt(i);
      hash |= 0;
    }
    const idx = Math.abs(hash) % 8; // 8 palette options
    return `avatar-color-${idx + 1}`;
  }

  /**
   * Get page numbers for pagination
   */
  getPageNumbers(): number[] {
    const pages: number[] = [];
    const maxPagesToShow = 5;
    
    let startPage = Math.max(1, this.currentPage - Math.floor(maxPagesToShow / 2));
    let endPage = Math.min(this.totalPages, startPage + maxPagesToShow - 1);
    
    if (endPage - startPage < maxPagesToShow - 1) {
      startPage = Math.max(1, endPage - maxPagesToShow + 1);
    }
    
    for (let i = startPage; i <= endPage; i++) {
      pages.push(i);
    }
    
    return pages;
  }
}
