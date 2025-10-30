import { Component, OnInit } from '@angular/core';
import { CommonModule, DatePipe } from '@angular/common';
import { Router } from '@angular/router';
import { FormsModule } from '@angular/forms';
import { SacramentService } from '../../services/sacrament.service';
import { Sacrament, SacramentType, SacramentListParams } from '../../models/sacrament.model';
import { ToastService } from '@core/services/toast.service';
import { Store } from '@ngrx/store';
import { AppState } from '@core/store';
import { selectCurrentUser } from '@core/store/auth/auth.selectors';
import { take } from 'rxjs';
import { SacramentFormModalComponent } from '../sacrament-form-modal/sacrament-form-modal.component';
import { AdvancedSearchPanelComponent, SearchField, ActiveFilter } from '@shared/components/advanced-search-panel/advanced-search-panel.component';
import { PaginationComponent } from '@shared/components/pagination/pagination.component';

@Component({
  selector: 'app-sacrament-list',
  standalone: true,
  imports: [
    CommonModule, 
    FormsModule, 
    SacramentFormModalComponent,
    AdvancedSearchPanelComponent,
    PaginationComponent
  ],
  templateUrl: './sacrament-list.component.html',
  styleUrl: './sacrament-list.component.scss',
  providers: [DatePipe]
})
export class SacramentListComponent implements OnInit {
  sacraments: Sacrament[] = [];
  sacramentTypes: SacramentType[] = [];
  loading = false;
  
  // Pagination
  currentPage = 1;
  perPage = 20;
  totalItems = 0;
  totalPages = 1;
  
  // Filters
  searchTerm = '';
  selectedSacramentType: number | null = null;
  selectedStatus = '';
  dateFrom = '';
  dateTo = '';
  
  // Sorting
  sortBy = 'date_administered';
  sortDir: 'asc' | 'desc' = 'desc';
  
  // Current tenant ID
  currentTenantId: number | null = null;
  
  // Modal states
  showDeleteModal = false;
  sacramentToDelete: Sacrament | null = null;
  showFormModal = false;
  sacramentToEdit: Sacrament | null = null;
  
  // Advanced search panel state
  showAdvancedSearch = false;
  searchFields: SearchField[] = [];

  constructor(
    private sacramentService: SacramentService,
    private toastService: ToastService,
    private router: Router,
    private store: Store<AppState>,
    private datePipe: DatePipe
  ) {}

  ngOnInit(): void {
    this.initializeSearchFields();
    this.loadCurrentUser();
    this.loadSacramentTypes();
  }

  /**
   * Initialize search fields for advanced search panel
   */
  initializeSearchFields(): void {
    this.searchFields = [
      {
        key: 'sacrament_type_id',
        label: 'Sacrament Type',
        type: 'select',
        options: [], // Will be populated after sacrament types are loaded
        value: this.selectedSacramentType
      },
      {
        key: 'status',
        label: 'Status',
        type: 'select',
        options: [
          { value: 'active', label: 'Active' },
          { value: 'cancelled', label: 'Cancelled' },
          { value: 'conditional', label: 'Conditional' }
        ],
        value: this.selectedStatus
      },
      {
        key: 'date_from',
        label: 'Date From',
        type: 'date',
        value: this.dateFrom
      },
      {
        key: 'date_to',
        label: 'Date To',
        type: 'date',
        value: this.dateTo
      }
    ];
  }

  /**
   * Load current user to get tenant_id
   */
  loadCurrentUser(): void {
    this.store.select(selectCurrentUser).pipe(take(1)).subscribe({
      next: (user) => {
        if (user && user.tenant_id) {
          this.currentTenantId = user.tenant_id;
          this.loadSacraments();
        } else {
          this.toastService.error('You must be associated with a church to manage sacraments.');
        }
      },
      error: (error) => {
        console.error('Error loading user:', error);
        this.toastService.error('Failed to load user information.');
      }
    });
  }

  /**
   * Load sacrament types for filter dropdown
   */
  loadSacramentTypes(): void {
    this.sacramentService.getSacramentTypes().subscribe({
      next: (response) => {
        if (response.success) {
          this.sacramentTypes = response.data;
          // Update search field options
          const sacramentTypeField = this.searchFields.find(f => f.key === 'sacrament_type_id');
          if (sacramentTypeField) {
            sacramentTypeField.options = this.sacramentTypes.map(type => ({
              value: type.id,
              label: type.name
            }));
          }
        }
      },
      error: (error) => {
        console.error('Error loading sacrament types:', error);
      }
    });
  }

  /**
   * Load sacraments with current filters
   */
  loadSacraments(): void {
    if (!this.currentTenantId) {
      return;
    }

    this.loading = true;

    const params: SacramentListParams = {
      page: this.currentPage,
      per_page: this.perPage,
      tenant_id: this.currentTenantId,
      search: this.searchTerm || undefined,
      sacrament_type_id: this.selectedSacramentType || undefined,
      status: this.selectedStatus || undefined,
      date_from: this.dateFrom || undefined,
      date_to: this.dateTo || undefined,
      sort_by: this.sortBy,
      sort_dir: this.sortDir
    };

    this.sacramentService.getSacraments(params).subscribe({
      next: (response) => {
        if (response.success && response.data) {
          this.sacraments = response.data.data || [];
          this.totalItems = response.data.total || 0;
          this.currentPage = response.data.current_page || 1;
          this.totalPages = response.data.last_page || 1;
        }
        this.loading = false;
      },
      error: (error) => {
        console.error('Error loading sacraments:', error);
        this.toastService.error('Failed to load sacraments.');
        this.loading = false;
      }
    });
  }

  /**
   * Apply filters and reload
   */
  applyFilters(): void {
    this.currentPage = 1;
    this.loadSacraments();
  }

  /**
   * Clear all filters
   */
  clearFilters(): void {
    this.searchTerm = '';
    this.selectedSacramentType = null;
    this.selectedStatus = '';
    this.dateFrom = '';
    this.dateTo = '';
    this.currentPage = 1;
    this.loadSacraments();
  }

  /**
   * Handle sort column click
   */
  onSort(column: string): void {
    if (this.sortBy === column) {
      this.sortDir = this.sortDir === 'asc' ? 'desc' : 'asc';
    } else {
      this.sortBy = column;
      this.sortDir = 'asc';
    }
    this.loadSacraments();
  }

  /**
   * Get sort icon for column
   */
  getSortIcon(column: string): string {
    if (this.sortBy !== column) {
      return '↕️';
    }
    return this.sortDir === 'asc' ? '↑' : '↓';
  }

  /**
   * Show create modal
   */
  onCreateSacrament(): void {
    this.sacramentToEdit = null;
    this.showFormModal = true;
  }

  /**
   * Show edit modal
   */
  onEditSacrament(sacrament: Sacrament): void {
    this.sacramentToEdit = sacrament;
    this.showFormModal = true;
  }
  
  /**
   * Handle form save
   */
  onFormSave(): void {
    this.showFormModal = false;
    this.sacramentToEdit = null;
    this.loadSacraments();
  }
  
  /**
   * Handle form cancel
   */
  onFormCancel(): void {
    this.showFormModal = false;
    this.sacramentToEdit = null;
  }

  /**
   * Navigate to view page
   */
  onViewSacrament(sacrament: Sacrament): void {
    this.router.navigate(['/settings/sacraments/view', sacrament.id]);
  }

  /**
   * Show delete confirmation
   */
  onDeleteSacrament(sacrament: Sacrament): void {
    this.sacramentToDelete = sacrament;
    this.showDeleteModal = true;
  }

  /**
   * Confirm delete
   */
  confirmDelete(): void {
    if (!this.sacramentToDelete) return;

    this.sacramentService.deleteSacrament(this.sacramentToDelete.id).subscribe({
      next: (response) => {
        if (response.success) {
          this.toastService.success('Sacrament deleted successfully.');
          this.loadSacraments();
        }
        this.cancelDelete();
      },
      error: (error) => {
        console.error('Error deleting sacrament:', error);
        this.toastService.error('Failed to delete sacrament.');
        this.cancelDelete();
      }
    });
  }

  /**
   * Cancel delete
   */
  cancelDelete(): void {
    this.showDeleteModal = false;
    this.sacramentToDelete = null;
  }

  /**
   * Handle page change
   */
  onPageChange(page: number): void {
    this.currentPage = page;
    this.loadSacraments();
  }

  /**
   * Handle page size change
   */
  onPageSizeChange(pageSize: number): void {
    this.perPage = pageSize;
    this.currentPage = 1;
    this.loadSacraments();
  }

  /**
   * Get status badge class
   */
  getStatusBadgeClass(status: string): string {
    const baseClass = 'status-badge';
    switch (status) {
      case 'active':
        return `${baseClass} status-active`;
      case 'cancelled':
        return `${baseClass} status-cancelled`;
      case 'conditional':
        return `${baseClass} status-conditional`;
      default:
        return baseClass;
    }
  }

  /**
   * Get sacrament type name
   */
  getSacramentTypeName(typeId: number): string {
    const type = this.sacramentTypes.find(t => t.id === typeId);
    return type ? type.name : 'N/A';
  }

  /**
   * Track by function for ngFor
   */
  trackBySacramentId(index: number, sacrament: Sacrament): number {
    return sacrament.id;
  }

  /**
   * Handle advanced search
   */
  onAdvancedSearch(searchValues: { [key: string]: any }): void {
    this.selectedSacramentType = searchValues['sacrament_type_id'] || null;
    this.selectedStatus = searchValues['status'] || '';
    this.dateFrom = searchValues['date_from'] || '';
    this.dateTo = searchValues['date_to'] || '';
    this.currentPage = 1;
    this.loadSacraments();
    this.showAdvancedSearch = false;
  }

  /**
   * Clear advanced search filters
   */
  onClearAdvancedSearch(): void {
    this.selectedSacramentType = null;
    this.selectedStatus = '';
    this.dateFrom = '';
    this.dateTo = '';
    this.currentPage = 1;
    this.loadSacraments();
  }

  /**
   * Quick search (search term only)
   */
  onQuickSearch(): void {
    this.currentPage = 1;
    this.loadSacraments();
  }

  /**
   * Clear search term
   */
  clearSearch(): void {
    this.searchTerm = '';
    this.currentPage = 1;
    this.loadSacraments();
  }

  /**
   * Get active filters for display
   */
  getActiveFilters(): ActiveFilter[] {
    const filters: ActiveFilter[] = [];

    if (this.selectedSacramentType) {
      const type = this.sacramentTypes.find(t => t.id === this.selectedSacramentType);
      filters.push({
        key: 'sacrament_type_id',
        label: 'Sacrament Type',
        value: this.selectedSacramentType,
        displayValue: type?.name || String(this.selectedSacramentType)
      });
    }

    if (this.selectedStatus) {
      filters.push({
        key: 'status',
        label: 'Status',
        value: this.selectedStatus,
        displayValue: this.selectedStatus.charAt(0).toUpperCase() + this.selectedStatus.slice(1)
      });
    }

    if (this.dateFrom) {
      filters.push({
        key: 'date_from',
        label: 'Date From',
        value: this.dateFrom,
        displayValue: this.datePipe.transform(this.dateFrom, 'MMM d, y') || this.dateFrom
      });
    }

    if (this.dateTo) {
      filters.push({
        key: 'date_to',
        label: 'Date To',
        value: this.dateTo,
        displayValue: this.datePipe.transform(this.dateTo, 'MMM d, y') || this.dateTo
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
    if (filter.key === 'sacrament_type_id') {
      this.selectedSacramentType = null;
    } else if (filter.key === 'status') {
      this.selectedStatus = '';
    } else if (filter.key === 'date_from') {
      this.dateFrom = '';
    } else if (filter.key === 'date_to') {
      this.dateTo = '';
    }

    // Update search field value
    const field = this.searchFields.find(f => f.key === filter.key);
    if (field) {
      field.value = undefined;
    }

    this.currentPage = 1;
    this.loadSacraments();
  }

  /**
   * Clear all filters
   */
  clearAllFilters(): void {
    this.selectedSacramentType = null;
    this.selectedStatus = '';
    this.dateFrom = '';
    this.dateTo = '';
    this.searchTerm = '';
    this.searchFields.forEach(field => {
      field.value = undefined;
    });
    this.currentPage = 1;
    this.loadSacraments();
  }
}


