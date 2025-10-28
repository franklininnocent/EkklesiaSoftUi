import { Component, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { Router } from '@angular/router';
import { DioceseService } from '@core/services/ecclesiastical';
import { GeographyService, DenominationService } from '@core/services';
import { Diocese, DioceseListParams } from '@core/models/ecclesiastical';
import { ToastService } from '@core/services';
import { PaginationComponent } from '@shared/components/pagination/pagination.component';
import { ConfirmationModalComponent } from '@shared/components/confirmation-modal/confirmation-modal.component';
import { DioceseFormModalComponent } from '../diocese-form-modal/diocese-form-modal.component';
import { LoadingSkeletonComponent } from '@shared/components/loading-skeleton/loading-skeleton.component';
import { EmptyStateComponent } from '@shared/components/empty-state/empty-state.component';
import { AdvancedSearchPanelComponent, SearchField } from '@shared/components/advanced-search-panel/advanced-search-panel.component';

@Component({
  selector: 'app-diocese-list',
  standalone: true,
  imports: [
    CommonModule, 
    FormsModule, 
    PaginationComponent, 
    ConfirmationModalComponent, 
    DioceseFormModalComponent,
    LoadingSkeletonComponent,
    EmptyStateComponent,
    AdvancedSearchPanelComponent
  ],
  templateUrl: './diocese-list.component.html',
  styleUrl: './diocese-list.component.scss'
})
export class DioceseListComponent implements OnInit {
  dioceses: Diocese[] = [];
  countries: any[] = [];
  denominations: any[] = [];
  
  // Pagination
  currentPage = 1;
  perPage = 20; // Increased to 20 for better screen utilization
  totalItems = 0;
  totalPages = 0;

  // Filters
  searchTerm = '';
  selectedCountry: number | null = null;
  selectedDenomination: number | null = null;
  activeFilter: boolean | null = null;
  sortBy = 'name';
  sortOrder: 'asc' | 'desc' = 'asc';

  // UI State
  loading = false;
  showDeleteModal = false;
  showFormModal = false;
  dioceseToDelete: Diocese | null = null;
  selectedDiocese: Diocese | null = null;

  // Advanced Search
  searchFields: SearchField[] = [];
  showAdvancedSearch = false;
  advancedSearchValues: { [key: string]: any } = {};
  
  // Quick Search
  private searchTimeout: any;

  constructor(
    private dioceseService: DioceseService,
    private geographyService: GeographyService,
    private denominationService: DenominationService,
    private router: Router,
    private toastService: ToastService
  ) {}

  ngOnInit(): void {
    this.loadDioceses();
    this.loadFilters();
  }

  loadDioceses(): void {
    this.loading = true;
    
    const params: DioceseListParams = {
      page: this.currentPage,
      per_page: this.perPage,
      search: this.searchTerm || undefined,
      country_id: this.selectedCountry || undefined,
      denomination_id: this.selectedDenomination || undefined,
      is_active: this.activeFilter !== null ? this.activeFilter : undefined,
      sort_by: this.sortBy,
      sort_order: this.sortOrder
    };

    this.dioceseService.getDioceses(params).subscribe({
      next: (response) => {
        if (response.data) {
          this.dioceses = response.data.data || [];
          this.totalItems = response.data.total || 0;
          this.currentPage = response.data.current_page || 1;
          this.totalPages = response.data.last_page || 1;
        }
        this.loading = false;
      },
      error: (error) => {
        console.error('Error loading dioceses:', error);
        this.toastService.error('Failed to load dioceses');
        this.loading = false;
      }
    });
  }

  loadFilters(): void {
    // Load countries
    this.geographyService.getCountries().subscribe({
      next: (response) => {
        this.countries = response.data || [];
        this.initializeSearchFields();
      },
      error: (error) => console.error('Error loading countries:', error)
    });

    // Load denominations
    this.denominationService.getDenominations().subscribe({
      next: (response) => {
        this.denominations = response.data || [];
        this.initializeSearchFields();
      },
      error: (error) => console.error('Error loading denominations:', error)
    });
  }

  initializeSearchFields(): void {
    this.searchFields = [
      {
        key: 'name',
        label: 'Diocese Name',
        type: 'text',
        placeholder: 'Search by name...'
      },
      {
        key: 'code',
        label: 'Diocese Code',
        type: 'text',
        placeholder: 'Enter code...'
      },
      {
        key: 'country_id',
        label: 'Country',
        type: 'select',
        options: this.countries.map(c => ({ value: c.id, label: c.name }))
      },
      {
        key: 'denomination_id',
        label: 'Denomination',
        type: 'select',
        options: this.denominations.map(d => ({ value: d.id, label: d.name }))
      },
      {
        key: 'is_archdiocese',
        label: 'Type',
        type: 'select',
        options: [
          { value: true, label: 'Archdiocese' },
          { value: false, label: 'Diocese' }
        ]
      },
      {
        key: 'active',
        label: 'Status',
        type: 'select',
        options: [
          { value: true, label: 'Active' },
          { value: false, label: 'Inactive' }
        ]
      },
      {
        key: 'city',
        label: 'City',
        type: 'text',
        placeholder: 'Search by city...'
      },
      {
        key: 'established_date_from',
        label: 'Established From',
        type: 'date'
      },
      {
        key: 'established_date_to',
        label: 'Established To',
        type: 'date'
      }
    ];
  }

  onAdvancedSearch(searchValues: { [key: string]: any }): void {
    this.advancedSearchValues = searchValues;
    
    // Map advanced search values to existing filter properties
    if (searchValues['name']) {
      this.searchTerm = searchValues['name'];
    }
    if (searchValues['country_id']) {
      this.selectedCountry = searchValues['country_id'];
    }
    if (searchValues['denomination_id']) {
      this.selectedDenomination = searchValues['denomination_id'];
    }
    if (searchValues['active'] !== undefined) {
      this.activeFilter = searchValues['active'];
    }

    this.currentPage = 1;
    this.showAdvancedSearch = false; // Auto-close panel after applying
    this.loadDioceses();
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
    if (filter.key === 'name') this.searchTerm = '';
    if (filter.key === 'country_id') this.selectedCountry = null;
    if (filter.key === 'denomination_id') this.selectedDenomination = null;
    if (filter.key === 'active') this.activeFilter = null;
    
    this.currentPage = 1;
    this.loadDioceses();
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
    this.loadDioceses();
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
      this.loadDioceses();
    }, 300);
  }

  /**
   * Clear search term and refresh results
   */
  clearSearch(): void {
    this.searchTerm = '';
    this.currentPage = 1;
    this.loadDioceses();
  }

  onFilterChange(): void {
    this.currentPage = 1;
    this.loadDioceses();
  }

  clearFilters(): void {
    this.searchTerm = '';
    this.selectedCountry = null;
    this.selectedDenomination = null;
    this.activeFilter = null;
    this.currentPage = 1;
    this.loadDioceses();
  }

  onSort(column: string): void {
    if (this.sortBy === column) {
      this.sortOrder = this.sortOrder === 'asc' ? 'desc' : 'asc';
    } else {
      this.sortBy = column;
      this.sortOrder = 'asc';
    }
    this.loadDioceses();
  }

  onPageChange(page: number): void {
    this.currentPage = page;
    this.loadDioceses();
  }

  onPageSizeChange(pageSize: number): void {
    this.perPage = pageSize;
    this.currentPage = 1; // Reset to first page
    this.loadDioceses();
  }

  onCreateDiocese(): void {
    this.selectedDiocese = null;
    this.showFormModal = true;
  }

  onEditDiocese(diocese: Diocese): void {
    this.selectedDiocese = diocese;
    this.showFormModal = true;
  }

  onFormSaved(diocese: Diocese): void {
    this.showFormModal = false;
    this.selectedDiocese = null;
    this.loadDioceses(); // Refresh the list
  }

  onFormCancelled(): void {
    this.showFormModal = false;
    this.selectedDiocese = null;
  }

  onViewDiocese(diocese: Diocese): void {
    this.router.navigate(['/settings/ecclesiastical/dioceses', diocese.id]);
  }

  onDeleteDiocese(diocese: Diocese): void {
    this.dioceseToDelete = diocese;
    this.showDeleteModal = true;
  }

  confirmDelete(): void {
    if (this.dioceseToDelete) {
      this.dioceseService.deleteDiocese(this.dioceseToDelete.id).subscribe({
        next: () => {
          this.toastService.success('Diocese deleted successfully');
          this.showDeleteModal = false;
          this.dioceseToDelete = null;
          this.loadDioceses();
        },
        error: (error) => {
          console.error('Error deleting diocese:', error);
          this.toastService.error('Failed to delete diocese');
        }
      });
    }
  }

  cancelDelete(): void {
    this.showDeleteModal = false;
    this.dioceseToDelete = null;
  }

  getSortIcon(column: string): string {
    if (this.sortBy !== column) return '⇅';
    return this.sortOrder === 'asc' ? '↑' : '↓';
  }

  getStatusBadgeClass(active: boolean): string {
    return active ? 'badge-success' : 'badge-inactive';
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
  trackByDioceseId(index: number, diocese: Diocese): string | number {
    return diocese.id;
  }
}

