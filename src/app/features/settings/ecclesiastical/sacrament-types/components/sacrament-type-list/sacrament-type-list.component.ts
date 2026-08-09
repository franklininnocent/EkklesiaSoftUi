import { Component, OnInit, ChangeDetectionStrategy } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { SacramentTypeService } from '../../services/sacrament-type.service';
import { SacramentType, SacramentTypeListParams, SACRAMENT_CATEGORIES } from '../../models/sacrament-type.model';
import { LoadingSkeletonComponent } from '@shared/components/loading-skeleton/loading-skeleton.component';
import { EmptyStateComponent } from '@shared/components/empty-state/empty-state.component';
import { PaginationComponent } from '@shared/components/pagination/pagination.component';
import { PageHeaderComponent } from '@shared/components/page-header/page-header.component';
import { ToastService } from '@core/services/toast.service';
import { ModalShellComponent } from '@shared/components/modal-shell/modal-shell.component';

@Component({
  selector: 'app-sacrament-type-list',
  standalone: true,
  imports: [
    CommonModule,
    FormsModule,
    LoadingSkeletonComponent,
    EmptyStateComponent,
    PaginationComponent,
    PageHeaderComponent,
    ModalShellComponent,
  ],
  templateUrl: './sacrament-type-list.component.html',
  changeDetection: ChangeDetectionStrategy.Eager,
  styleUrls: ['./sacrament-type-list.component.scss']
})
export class SacramentTypeListComponent implements OnInit {
  sacramentTypes: SacramentType[] = [];
  loading = false;
  
  // Pagination
  currentPage = 1;
  perPage = 20;
  totalItems = 0;
  lastPage = 1;

  // Filters
  searchTerm = '';
  selectedCategory = '';
  selectedStatus = '';
  
  // Sorting
  sortBy = 'display_order';
  sortDir: 'asc' | 'desc' = 'asc';

  // Modal states
  showFormModal = false;
  showDeleteModal = false;
  selectedType: SacramentType | null = null;
  isEditMode = false;

  // Categories
  categories = SACRAMENT_CATEGORIES;

  constructor(
    private sacramentTypeService: SacramentTypeService,
    private toastService: ToastService
  ) {}

  ngOnInit(): void {
    this.loadSacramentTypes();
  }

  /**
   * Load sacrament types with current filters
   */
  loadSacramentTypes(): void {
    this.loading = true;

    const params: SacramentTypeListParams = {
      page: this.currentPage,
      per_page: this.perPage,
      sort_by: this.sortBy,
      sort_dir: this.sortDir
    };

    if (this.searchTerm) {
      params.search = this.searchTerm;
    }

    if (this.selectedCategory) {
      params.category = this.selectedCategory;
    }

    if (this.selectedStatus !== '') {
      params.active = this.selectedStatus === 'active';
    }

    this.sacramentTypeService.getSacramentTypes(params).subscribe({
      next: (response) => {
        if (response.success && response.data) {
          this.sacramentTypes = Array.isArray(response.data) ? response.data : (response.data as any).data || [];
          this.totalItems = (response.data as any).total || this.sacramentTypes.length;
          this.currentPage = (response.data as any).current_page || 1;
          this.lastPage = (response.data as any).last_page || 1;
        }
        this.loading = false;
      },
      error: (error) => {
        console.error('Error loading sacrament types:', error);
        this.toastService.error('Failed to load sacrament types');
        this.loading = false;
      }
    });
  }

  /**
   * Handle pagination change
   */
  onPageChange(page: number): void {
    this.currentPage = page;
    this.loadSacramentTypes();
  }

  /**
   * Handle page size change
   */
  onPageSizeChange(size: number): void {
    this.perPage = size;
    this.currentPage = 1;
    this.loadSacramentTypes();
  }

  /**
   * Handle search
   */
  onSearch(): void {
    this.currentPage = 1;
    this.loadSacramentTypes();
  }

  /**
   * Clear search
   */
  clearSearch(): void {
    this.searchTerm = '';
    this.currentPage = 1;
    this.loadSacramentTypes();
  }

  /**
   * Handle filter change
   */
  onFilterChange(): void {
    this.currentPage = 1;
    this.loadSacramentTypes();
  }

  /**
   * Clear all filters
   */
  clearFilters(): void {
    this.searchTerm = '';
    this.selectedCategory = '';
    this.selectedStatus = '';
    this.currentPage = 1;
    this.loadSacramentTypes();
  }

  /**
   * Handle sort
   */
  onSort(column: string): void {
    if (this.sortBy === column) {
      this.sortDir = this.sortDir === 'asc' ? 'desc' : 'asc';
    } else {
      this.sortBy = column;
      this.sortDir = 'asc';
    }
    this.loadSacramentTypes();
  }

  /**
   * Get sort icon
   */
  getSortIcon(column: string): string {
    if (this.sortBy !== column) return '↕️';
    return this.sortDir === 'asc' ? '↑' : '↓';
  }

  /**
   * Open create modal
   */
  onCreate(): void {
    this.selectedType = null;
    this.isEditMode = false;
    this.showFormModal = true;
  }

  /**
   * Open edit modal
   */
  onEdit(type: SacramentType): void {
    this.selectedType = type;
    this.isEditMode = true;
    this.showFormModal = true;
  }

  /**
   * Open delete confirmation modal
   */
  onDelete(type: SacramentType): void {
    this.selectedType = type;
    this.showDeleteModal = true;
  }

  /**
   * Confirm delete
   */
  confirmDelete(): void {
    if (!this.selectedType) return;

    this.sacramentTypeService.deleteSacramentType(this.selectedType.id).subscribe({
      next: (response) => {
        if (response.success) {
          this.toastService.success('Sacrament type deleted successfully');
          this.loadSacramentTypes();
        }
        this.showDeleteModal = false;
        this.selectedType = null;
      },
      error: (error) => {
        console.error('Error deleting sacrament type:', error);
        const errorMessage = error.error?.message || 'Failed to delete sacrament type';
        this.toastService.error(errorMessage);
        this.showDeleteModal = false;
      }
    });
  }

  /**
   * Cancel delete
   */
  cancelDelete(): void {
    this.showDeleteModal = false;
    this.selectedType = null;
  }

  /**
   * Handle form close
   */
  onFormClose(): void {
    this.showFormModal = false;
    this.selectedType = null;
    this.isEditMode = false;
  }

  /**
   * Handle form save
   */
  onFormSave(): void {
    this.showFormModal = false;
    this.selectedType = null;
    this.isEditMode = false;
    this.loadSacramentTypes();
  }

  /**
   * Get category badge class
   */
  getCategoryBadgeClass(category: string): string {
    const classes: { [key: string]: string } = {
      'initiation': 'badge-primary',
      'healing': 'badge-success',
      'service': 'badge-info',
      'other': 'badge-secondary'
    };
    return classes[category] || 'badge-secondary';
  }

  /**
   * Get category label
   */
  getCategoryLabel(category: string): string {
    const cat = this.categories.find(c => c.value === category);
    return cat ? cat.label : category;
  }

  /**
   * Format boolean value
   */
  formatBoolean(value: boolean): string {
    return value ? 'Yes' : 'No';
  }

  /**
   * Track by function for ngFor
   */
  trackByTypeId(index: number, type: SacramentType): number {
    return type.id;
  }
}


