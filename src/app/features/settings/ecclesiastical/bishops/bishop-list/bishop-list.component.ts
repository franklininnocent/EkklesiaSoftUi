import { Component, OnInit, ChangeDetectorRef, ChangeDetectionStrategy } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { Router } from '@angular/router';
import { BishopService, DioceseService } from '@core/services/ecclesiastical';
import { Bishop, BishopListParams } from '@core/models/ecclesiastical';
import { ToastService } from '@core/services';
import { PaginationComponent } from '@shared/components/pagination/pagination.component';
import { ConfirmationModalComponent } from '@shared/components/confirmation-modal/confirmation-modal.component';
import { BishopFormModalComponent } from '../bishop-form-modal/bishop-form-modal.component';
import { LoadingSkeletonComponent } from '@shared/components/loading-skeleton/loading-skeleton.component';
import { EmptyStateComponent } from '@shared/components/empty-state/empty-state.component';
import { AdvancedSearchPanelComponent, SearchField } from '@shared/components/advanced-search-panel/advanced-search-panel.component';
import { PageHeaderComponent } from '@shared/components/page-header/page-header.component';

@Component({
  selector: 'app-bishop-list',
  standalone: true,
  imports: [
    CommonModule, 
    FormsModule, 
    PaginationComponent, 
    ConfirmationModalComponent, 
    BishopFormModalComponent,
    LoadingSkeletonComponent,
    EmptyStateComponent,
    AdvancedSearchPanelComponent,
    PageHeaderComponent,
  ],
  templateUrl: './bishop-list.component.html',
  changeDetection: ChangeDetectionStrategy.Eager,
  styleUrl: './bishop-list.component.scss'
})
export class BishopListComponent implements OnInit {
  bishops: Bishop[] = [];
  dioceses: any[] = [];
  titles: any[] = [];
  
  // Pagination
  currentPage = 1;
  perPage = 20; // Increased to 20 for better screen utilization
  totalItems = 0;
  totalPages = 0;

  // Filters
  searchTerm = '';
  selectedDiocese: number | null = null;
  selectedTitle: number | null = null;
  selectedStatus: string | null = null;
  sortBy = 'full_name';
  sortDir: 'asc' | 'desc' = 'asc';

  // UI State
  loading = false;
  showDeleteModal = false;
  showFormModal = false;
  bishopToDelete: Bishop | null = null;
  selectedBishop: Bishop | null = null;

  // Advanced Search
  searchFields: SearchField[] = [];
  showAdvancedSearch = false;
  advancedSearchValues: { [key: string]: any } = {};
  
  // Quick Search
  private searchTimeout: any;

  // Status options
  statusOptions = [
    { value: 'active', label: 'Active' },
    { value: 'retired', label: 'Retired' },
    { value: 'deceased', label: 'Deceased' },
    { value: 'inactive', label: 'Inactive' }
  ];

  constructor(
    private bishopService: BishopService,
    private dioceseService: DioceseService,
    private router: Router,
    private toastService: ToastService,
    private cdr: ChangeDetectorRef
  ) {}

  ngOnInit(): void {
    this.loadBishops();
    this.loadFilters();
  }

  loadBishops(): void {
    this.loading = true;
    
    const params: BishopListParams = {
      page: this.currentPage,
      per_page: this.perPage,
      search: this.searchTerm || undefined,
      diocese_id: this.selectedDiocese || undefined,
      title_id: this.selectedTitle || undefined,
      is_active: this.selectedStatus ? (this.selectedStatus === 'active') : undefined,
      sort_by: this.sortBy,
      sort_dir: this.sortDir
    };

    this.bishopService.getBishops(params).subscribe({
      next: (response) => {
        console.log('Bishops API Response:', response);
        console.log('Response.data:', response.data);
        
        if (response && response.success !== false && response.data) {
          // Handle both nested and direct data structures
          let bishopsData: Bishop[] = [];
          
          if (Array.isArray(response.data)) {
            // Direct array response
            bishopsData = response.data;
          } else if (response.data.data && Array.isArray(response.data.data)) {
            // Nested data structure (paginated response)
            bishopsData = response.data.data;
            this.totalItems = response.data.total || 0;
            this.currentPage = response.data.current_page || 1;
            this.totalPages = response.data.last_page || 1;
          } else if (response.data && typeof response.data === 'object') {
            // Try to extract array from object
            const dataObj = response.data;
            if (Array.isArray(dataObj)) {
              bishopsData = dataObj;
            } else if (dataObj.data && Array.isArray(dataObj.data)) {
              bishopsData = dataObj.data;
            }
          }
          
          console.log('Extracted bishops:', bishopsData);
          console.log('Bishops count:', bishopsData.length);
          
          // Create new array reference to trigger change detection
          this.bishops = Array.from(bishopsData);
          
          console.log('Final bishops array length:', this.bishops.length);
        } else {
          console.warn('API response indicates failure:', response);
          this.bishops = [];
        }
        
        this.loading = false;
        
        // Force change detection to update the view
        this.cdr.markForCheck();
        this.cdr.detectChanges();
        
        console.log('After change detection - bishops.length:', this.bishops.length);
      },
      error: (error) => {
        console.error('Error loading bishops:', error);
        this.toastService.error('Failed to load bishops');
        this.loading = false;
        this.cdr.detectChanges();
      }
    });
  }

  loadFilters(): void {
    // Load dioceses for filter (with minimal params to get all for dropdown)
    this.dioceseService.getDioceses({ per_page: 1000, page: 1 }).subscribe({
      next: (response) => {
        this.dioceses = response.data?.data || [];
        this.initializeSearchFields();
      },
      error: (error) => console.error('Error loading dioceses:', error)
    });

    // Note: We need an endpoint to get ecclesiastical titles
    // For now, using hardcoded values
    this.titles = [
      { id: 1, name: 'Archbishop' },
      { id: 2, name: 'Bishop' },
      { id: 3, name: 'Cardinal' },
      { id: 4, name: 'Auxiliary Bishop' },
      { id: 5, name: 'Emeritus Archbishop' },
      { id: 6, name: 'Emeritus Bishop' }
    ];
    this.initializeSearchFields();
  }

  initializeSearchFields(): void {
    this.searchFields = [
      {
        key: 'full_name',
        label: 'Bishop Name',
        type: 'text',
        placeholder: 'Search by name...'
      },
      {
        key: 'diocese_id',
        label: 'Diocese',
        type: 'select',
        options: this.dioceses.map(d => ({ value: d.id, label: d.name }))
      },
      {
        key: 'title_id',
        label: 'Title',
        type: 'select',
        options: this.titles.map(t => ({ value: t.id, label: t.name }))
      },
      {
        key: 'status',
        label: 'Status',
        type: 'select',
        options: this.statusOptions
      },
      {
        key: 'ordained_from',
        label: 'Ordained From',
        type: 'date'
      },
      {
        key: 'ordained_to',
        label: 'Ordained To',
        type: 'date'
      },
      {
        key: 'is_current',
        label: 'Current Position',
        type: 'boolean',
        placeholder: 'Currently serving'
      }
    ];
  }

  onAdvancedSearch(searchValues: { [key: string]: any }): void {
    this.advancedSearchValues = searchValues;
    
    // Map advanced search values to existing filter properties
    if (searchValues['full_name']) {
      this.searchTerm = searchValues['full_name'];
    }
    if (searchValues['diocese_id']) {
      this.selectedDiocese = searchValues['diocese_id'];
    }
    if (searchValues['title_id']) {
      this.selectedTitle = searchValues['title_id'];
    }
    if (searchValues['status']) {
      this.selectedStatus = searchValues['status'];
    }

    this.currentPage = 1;
    this.showAdvancedSearch = false; // Auto-close panel after applying
    this.loadBishops();
  }

  onClearAdvancedSearch(): void {
    this.advancedSearchValues = {};
    this.clearFilters();
    this.showAdvancedSearch = false; // Auto-close panel after clearing
  }

  onToggleAdvancedSearch(isExpanded: boolean): void {
    this.showAdvancedSearch = isExpanded;
  }

  /**
   * Get active filters with labels for display
   */
  getActiveFilters(): Array<{ key: string; label: string; value: any; displayValue: string }> {
    const activeFilters: Array<{ key: string; label: string; value: any; displayValue: string }> = [];

    Object.keys(this.advancedSearchValues).forEach(key => {
      const value = this.advancedSearchValues[key];
      if (value !== '' && value !== null && value !== undefined) {
        const field = this.searchFields.find(f => f.key === key);
        if (field) {
          let displayValue = value;

          // Format display value based on field type
          if (field.type === 'select' && field.options) {
            const option = field.options.find(opt => opt.value === value);
            displayValue = option ? option.label : value;
          } else if (field.type === 'boolean') {
            displayValue = value ? 'Yes' : 'No';
          } else if (field.type === 'date') {
            displayValue = new Date(value).toLocaleDateString();
          }

          activeFilters.push({
            key,
            label: field.label,
            value,
            displayValue: displayValue.toString()
          });
        }
      }
    });

    return activeFilters;
  }

  /**
   * Remove a single filter chip
   */
  removeFilter(filter: { key: string; label: string; value: any; displayValue: string }): void {
    delete this.advancedSearchValues[filter.key];
    
    // Also clear mapped properties
    if (filter.key === 'full_name') this.searchTerm = '';
    if (filter.key === 'diocese_id') this.selectedDiocese = null;
    if (filter.key === 'title_id') this.selectedTitle = null;
    if (filter.key === 'status') this.selectedStatus = null;
    
    this.currentPage = 1;
    this.loadBishops();
  }

  /**
   * Clear all filters
   */
  clearAllFilters(): void {
    this.advancedSearchValues = {};
    this.clearFilters();
  }

  onSearch(): void {
    this.currentPage = 1;
    this.loadBishops();
  }

  /**
   * Quick search with debouncing (300ms delay)
   */
  onQuickSearch(): void {
    // Clear previous timeout
    if (this.searchTimeout) {
      clearTimeout(this.searchTimeout);
    }

    // Set new timeout for debounced search
    this.searchTimeout = setTimeout(() => {
      this.currentPage = 1;
      this.loadBishops();
    }, 300);
  }

  /**
   * Clear search term and refresh results
   */
  clearSearch(): void {
    this.searchTerm = '';
    this.currentPage = 1;
    this.loadBishops();
  }

  onFilterChange(): void {
    this.currentPage = 1;
    this.loadBishops();
  }

  clearFilters(): void {
    this.searchTerm = '';
    this.selectedDiocese = null;
    this.selectedTitle = null;
    this.selectedStatus = null;
    this.currentPage = 1;
    this.loadBishops();
  }

  onSort(column: string): void {
    if (this.sortBy === column) {
      this.sortDir = this.sortDir === 'asc' ? 'desc' : 'asc';
    } else {
      this.sortBy = column;
      this.sortDir = 'asc';
    }
    this.loadBishops();
  }

  onPageChange(page: number): void {
    this.currentPage = page;
    this.loadBishops();
  }

  onPageSizeChange(pageSize: number): void {
    this.perPage = pageSize;
    this.currentPage = 1; // Reset to first page
    this.loadBishops();
  }

  onCreateBishop(): void {
    this.selectedBishop = null;
    this.showFormModal = true;
  }

  onEditBishop(bishop: Bishop): void {
    this.selectedBishop = bishop;
    this.showFormModal = true;
  }

  onFormSaved(bishop: Bishop): void {
    this.showFormModal = false;
    this.selectedBishop = null;
    this.loadBishops(); // Refresh the list
  }

  onFormCancelled(): void {
    this.showFormModal = false;
    this.selectedBishop = null;
  }

  onViewBishop(bishop: Bishop): void {
    this.router.navigate(['/settings/ecclesiastical/bishops', bishop.id]);
  }

  onDeleteBishop(bishop: Bishop): void {
    this.bishopToDelete = bishop;
    this.showDeleteModal = true;
  }

  confirmDelete(): void {
    if (this.bishopToDelete) {
      this.bishopService.deleteBishop(this.bishopToDelete.id).subscribe({
        next: () => {
          this.toastService.success('Bishop deleted successfully');
          this.showDeleteModal = false;
          this.bishopToDelete = null;
          this.loadBishops();
        },
        error: (error) => {
          console.error('Error deleting bishop:', error);
          this.toastService.error('Failed to delete bishop');
        }
      });
    }
  }

  cancelDelete(): void {
    this.showDeleteModal = false;
    this.bishopToDelete = null;
  }

  getSortIcon(column: string): string {
    if (this.sortBy !== column) return '⇅';
    return this.sortDir === 'asc' ? '↑' : '↓';
  }

  getStatusBadgeClass(status: string): string {
    const statusMap: Record<string, string> = {
      active: 'badge-active',
      retired: 'badge-retired',
      deceased: 'badge-deceased',
      inactive: 'badge-inactive'
    };
    return statusMap[status] || 'badge-inactive';
  }

  getStatusLabel(status: string): string {
    const labelMap: Record<string, string> = {
      active: 'Active',
      retired: 'Retired',
      deceased: 'Deceased',
      inactive: 'Inactive'
    };
    return labelMap[status] || status;
  }

  getPhotoUrl(bishop: Bishop): string {
    return bishop.photo_url || 'assets/images/default-bishop.png';
  }

  hasPhoto(bishop: Bishop): boolean {
    return !!bishop.photo_url;
  }

  getInitials(bishop: Bishop): string {
    const given = bishop.given_name || bishop.full_name?.split(' ')[0] || '';
    const family = bishop.family_name || bishop.full_name?.split(' ').pop() || '';
    return `${given.charAt(0)}${family.charAt(0)}`.toUpperCase();
  }

  /**
   * Get count of active filters for badge display
   */
  getActiveFilterCount(): number {
    return this.getActiveFilters().length;
  }

  /**
   * TrackBy function for ngFor performance optimization
   */
  trackByBishopId(index: number, bishop: Bishop): string | number {
    return bishop.id;
  }
}
