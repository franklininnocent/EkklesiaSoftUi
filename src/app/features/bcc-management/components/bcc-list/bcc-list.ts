import { Component, OnInit, OnDestroy } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule, ReactiveFormsModule, FormBuilder, FormGroup } from '@angular/forms';
import { Router } from '@angular/router';
import { Subject, debounceTime, takeUntil, distinctUntilChanged } from 'rxjs';
import { BCCService } from '../../../../core/services/bcc.service';
import { BCC, BCCStatistics } from '../../../../core/models/family.model';
import { BCCFormComponent } from '../bcc-form/bcc-form';
import { AdvancedSearchPanelComponent, SearchField, ActiveFilter } from '@shared/components/advanced-search-panel/advanced-search-panel.component';
import { PaginationComponent } from '@shared/components/pagination/pagination.component';

@Component({
  selector: 'app-bcc-list',
  standalone: true,
  imports: [
    CommonModule, 
    FormsModule, 
    ReactiveFormsModule, 
    BCCFormComponent,
    AdvancedSearchPanelComponent,
    PaginationComponent
  ],
  templateUrl: './bcc-list.html',
  styleUrls: ['./bcc-list.scss']
})
export class BCCListComponent implements OnInit, OnDestroy {
  private destroy$ = new Subject<void>();
  
  // Data
  bccs: BCC[] = [];
  statistics: BCCStatistics | null = null;
  
  // Pagination
  currentPage = 1;
  totalPages = 1;
  totalRecords = 0;
  perPage = 20;
  perPageOptions = [10, 20, 50, 100];
  
  // UI State
  loading = false;
  error: string | null = null;
  showForm = false;
  selectedBCC: BCC | null = null;
  
  // Search & Filter Form
  filterForm: FormGroup;
  searchTerm = '';
  
  // Advanced search panel
  showAdvancedSearch = false;
  searchFields: SearchField[] = [];
  
  // For Math methods in template
  Math = Math;
  Object = Object;

  constructor(
    private bccService: BCCService,
    private fb: FormBuilder,
    private router: Router
  ) {
    this.filterForm = this.fb.group({
      search: [''],
      status: [''],
      has_space: [''],
      meeting_day: [''],
      sort_by: ['created_at'],
      sort_order: ['desc']
    });
  }

  ngOnInit(): void {
    this.initializeSearchFields();
    this.loadReferenceData();
    this.loadStatistics();
    this.loadBCCs();
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
          { value: 'inactive', label: 'Inactive' }
        ],
        value: this.filterForm.get('status')?.value
      },
      {
        key: 'has_space',
        label: 'Has Space Available',
        type: 'select',
        options: [
          { value: '1', label: 'Yes' },
          { value: '0', label: 'No' }
        ],
        value: this.filterForm.get('has_space')?.value
      },
      {
        key: 'meeting_day',
        label: 'Meeting Day',
        type: 'select',
        options: [
          { value: 'Monday', label: 'Monday' },
          { value: 'Tuesday', label: 'Tuesday' },
          { value: 'Wednesday', label: 'Wednesday' },
          { value: 'Thursday', label: 'Thursday' },
          { value: 'Friday', label: 'Friday' },
          { value: 'Saturday', label: 'Saturday' },
          { value: 'Sunday', label: 'Sunday' }
        ],
        value: this.filterForm.get('meeting_day')?.value
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
        this.loadBCCs();
      });
  }

  /**
   * Load reference data for filters
   */
  private loadReferenceData(): void {}

  /**
   * Load statistics
   */
  private loadStatistics(): void {
    this.bccService.getStatistics().subscribe({
      next: (response) => {
        if (response.success && response.data) {
          this.statistics = response.data;
        }
      },
      error: (error) => console.error('Failed to load statistics', error)
    });
  }

  /**
   * Load BCCs with filters
   */
  loadBCCs(): void {
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

    this.bccService.getBCCs(filters).subscribe({
      next: (response) => {
        this.bccs = response.data;
        this.currentPage = response.current_page;
        this.totalPages = response.last_page;
        this.totalRecords = response.total;
        this.loading = false;
      },
      error: (error) => {
        this.error = 'Failed to load BCCs. Please try again.';
        this.loading = false;
        console.error('Error loading BCCs:', error);
      }
    });
  }

  /**
   * Handle advanced search
   */
  onAdvancedSearch(searchValues: { [key: string]: any }): void {
    this.filterForm.patchValue({
      status: searchValues['status'] || '',
      has_space: searchValues['has_space'] || '',
      meeting_day: searchValues['meeting_day'] || ''
    });
    this.currentPage = 1;
    this.loadBCCs();
    this.showAdvancedSearch = false;
  }

  /**
   * Clear advanced search filters
   */
  onClearAdvancedSearch(): void {
    this.filterForm.patchValue({
      status: '',
      has_space: '',
      meeting_day: ''
    });
    this.searchFields.forEach(field => {
      field.value = undefined;
    });
    this.currentPage = 1;
    this.loadBCCs();
  }

  /**
   * Quick search (search term only)
   */
  onQuickSearch(): void {
    this.filterForm.patchValue({ search: this.searchTerm });
  }

  /**
   * Clear search term
   */
  clearSearch(): void {
    this.searchTerm = '';
    this.filterForm.patchValue({ search: '' });
  }

  /**
   * Get active filters for display
   */
  getActiveFilters(): ActiveFilter[] {
    const filters: ActiveFilter[] = [];
    const values = this.filterForm.value;

    if (values.status) {
      filters.push({
        key: 'status',
        label: 'Status',
        value: values.status,
        displayValue: values.status.charAt(0).toUpperCase() + values.status.slice(1)
      });
    }

    // Parish Zone removed

    if (values.has_space) {
      filters.push({
        key: 'has_space',
        label: 'Has Space',
        value: values.has_space,
        displayValue: values.has_space === '1' ? 'Yes' : 'No'
      });
    }

    if (values.meeting_day) {
      filters.push({
        key: 'meeting_day',
        label: 'Meeting Day',
        value: values.meeting_day,
        displayValue: values.meeting_day
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
    this.filterForm.patchValue({ [filter.key]: '' });
    
    // Update search field value
    const field = this.searchFields.find(f => f.key === filter.key);
    if (field) {
      field.value = undefined;
    }

    this.currentPage = 1;
    this.loadBCCs();
  }

  /**
   * Clear all filters
   */
  clearAllFilters(): void {
    this.filterForm.reset({
      search: '',
      status: '',
      has_space: '',
      meeting_day: '',
      sort_by: 'created_at',
      sort_order: 'desc'
    });
    this.searchTerm = '';
    this.searchFields.forEach(field => {
      field.value = undefined;
    });
    this.currentPage = 1;
    this.loadBCCs();
  }

  /**
   * Change page
   */
  goToPage(page: number): void {
    if (page >= 1 && page <= this.totalPages) {
      this.currentPage = page;
      this.loadBCCs();
    }
  }

  /**
   * Handle page change from pagination component
   */
  onPageChange(page: number): void {
    this.currentPage = page;
    this.loadBCCs();
  }

  /**
   * Handle page size change from pagination component
   */
  onPageSizeChange(pageSize: number): void {
    this.perPage = pageSize;
    this.currentPage = 1;
    this.loadBCCs();
  }

  /**
   * Change items per page
   */
  changePerPage(perPage: number): void {
    this.perPage = perPage;
    this.currentPage = 1;
    this.loadBCCs();
  }

  /**
   * Sort by column
   */
  sortBy(column: string): void {
    const currentSort = this.filterForm.get('sort_by')?.value;
    const currentOrder = this.filterForm.get('sort_order')?.value;

    if (currentSort === column) {
      this.filterForm.patchValue({
        sort_order: currentOrder === 'asc' ? 'desc' : 'asc'
      });
    } else {
      this.filterForm.patchValue({
        sort_by: column,
        sort_order: 'asc'
      });
    }

    this.loadBCCs();
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
   * View BCC details
   */
  viewBCC(bcc: BCC): void {
    this.router.navigate(['/bccs', bcc.id]);
  }

  /**
   * Edit BCC
   */
  editBCC(bcc: BCC): void {
    this.selectedBCC = bcc;
    this.showForm = true;
  }

  /**
   * Delete BCC
   */
  deleteBCC(bcc: BCC): void {
    if (confirm(`Are you sure you want to delete "${bcc.name}"?`)) {
      this.bccService.deleteBCC(bcc.id).subscribe({
        next: () => {
          this.loadBCCs();
          this.loadStatistics();
          alert('BCC deleted successfully');
        },
        error: (error) => {
          alert('Failed to delete BCC');
          console.error('Error deleting BCC:', error);
        }
      });
    }
  }

  /**
   * Create new BCC
   */
  createBCC(): void {
    this.selectedBCC = null;
    this.showForm = true;
  }

  /**
   * Handle form save
   */
  onFormSave(bcc: BCC): void {
    this.showForm = false;
    this.selectedBCC = null;
    this.loadBCCs();
    this.loadStatistics();
    alert('BCC saved successfully!');
  }

  /**
   * Handle form cancel
   */
  onFormCancel(): void {
    this.showForm = false;
    this.selectedBCC = null;
  }

  /**
   * Export BCCs
   */
  exportBCCs(): void {
    console.log('Export BCCs');
  }

  /**
   * Get capacity percentage for a BCC
   */
  getCapacityPercentage(bcc: BCC): number {
    const count = bcc.current_family_count || 0;
    // Capacity removed; return 0 or based on a default to avoid division
    return 0;
  }

  /**
   * Get capacity class based on percentage
   */
  getCapacityClass(percentage: number): string {
    if (percentage >= 90) return 'capacity-high';
    if (percentage >= 70) return 'capacity-medium';
    return 'capacity-low';
  }

  /**
   * Get status badge class
   */
  getStatusClass(status: string): string {
    switch (status) {
      case 'active': return 'badge-success';
      case 'inactive': return 'badge-secondary';
      case 'suspended': return 'badge-warning';
      default: return 'badge-secondary';
    }
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
