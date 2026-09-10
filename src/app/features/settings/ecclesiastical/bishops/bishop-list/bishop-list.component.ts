import { Component, OnInit, ChangeDetectorRef, ChangeDetectionStrategy } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { Router, ActivatedRoute, RouterModule } from '@angular/router';
import {
  BishopService,
  DioceseService,
  EcclesiasticalTitleService,
  extractBishopList,
  extractBishopPagination,
} from '@core/services/ecclesiastical';
import { Bishop, BishopListParams, EcclesiasticalTitle } from '@core/models/ecclesiastical';
import { ToastService } from '@core/services';
import { PaginationComponent } from '@shared/components/pagination/pagination.component';
import { ConfirmationModalComponent } from '@shared/components/confirmation-modal/confirmation-modal.component';
import { BishopFormModalComponent } from '../bishop-form-modal/bishop-form-modal.component';
import { LoadingSkeletonComponent } from '@shared/components/loading-skeleton/loading-skeleton.component';
import { EmptyStateComponent } from '@shared/components/empty-state/empty-state.component';
import { AdvancedSearchPanelComponent, SearchField } from '@shared/components/advanced-search-panel/advanced-search-panel.component';
import { PageHeaderComponent } from '@shared/components/page-header/page-header.component';
import { BishopAvatarComponent } from '@shared/components/bishop-avatar/bishop-avatar.component';

@Component({
  selector: 'app-bishop-list',
  standalone: true,
  imports: [
    CommonModule, 
    FormsModule,
    RouterModule,
    PaginationComponent, 
    ConfirmationModalComponent, 
    BishopFormModalComponent,
    LoadingSkeletonComponent,
    EmptyStateComponent,
    AdvancedSearchPanelComponent,
    PageHeaderComponent,
    BishopAvatarComponent,
  ],
  templateUrl: './bishop-list.component.html',
  changeDetection: ChangeDetectionStrategy.Eager,
  styleUrl: './bishop-list.component.scss'
})
export class BishopListComponent implements OnInit {
  bishops: Bishop[] = [];
  dioceses: any[] = [];
  titles: EcclesiasticalTitle[] = [];
  
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
  selectedIsCurrent: boolean | null = null;
  tenureFilter: 'all' | 'current' | 'historical' = 'all';
  sortBy = 'full_name';
  sortDir: 'asc' | 'desc' = 'asc';

  // UI State
  loading = false;
  showDeleteModal = false;
  showFormModal = false;
  loadingEditBishop = false;
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
    private titleService: EcclesiasticalTitleService,
    private router: Router,
    private route: ActivatedRoute,
    private toastService: ToastService,
    private cdr: ChangeDetectorRef
  ) {}

  ngOnInit(): void {
    this.loadBishops();
    this.loadFilters();
    this.route.queryParamMap.subscribe((params) => {
      const editId = params.get('edit');
      if (editId) {
        const bishop = this.bishops.find((b) => String(b.id) === editId);
        if (bishop) {
          this.onEditBishop(bishop);
        } else {
          this.bishopService.getBishop(parseInt(editId, 10)).subscribe({
            next: (res) => {
              if (res.data) this.onEditBishop(res.data);
            },
          });
        }
      }
    });
  }

  loadBishops(): void {
    this.loading = true;
    
    const params: BishopListParams = {
      page: this.currentPage,
      per_page: this.perPage,
      search: this.searchTerm || undefined,
      diocese_id: this.selectedDiocese || undefined,
      title_id: this.selectedTitle || undefined,
      status: this.selectedStatus || undefined,
      is_current: this.resolveIsCurrentFilter(),
      sort_by: this.sortBy,
      sort_dir: this.sortDir
    };

    this.bishopService.getBishops(params).subscribe({
      next: (response) => {
        if (response && response.success !== false) {
          this.bishops = [...extractBishopList(response)];
          const pagination = extractBishopPagination(response);
          this.totalItems = pagination.total;
          this.currentPage = pagination.currentPage;
          this.totalPages = pagination.lastPage;
        } else {
          this.bishops = [];
          this.totalItems = 0;
          this.totalPages = 0;
        }

        this.loading = false;
        this.cdr.markForCheck();
        this.cdr.detectChanges();
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
    this.dioceseService.getDioceseOptions().subscribe({
      next: (dioceses) => {
        this.dioceses = dioceses;
        this.initializeSearchFields();
        this.cdr.detectChanges();
      },
      error: (error) => console.error('Error loading dioceses:', error)
    });

    this.titleService.getTitleOptions().subscribe({
      next: (titles) => {
        this.titles = titles;
        this.initializeSearchFields();
        this.cdr.detectChanges();
      },
      error: (error) => console.error('Error loading ecclesiastical titles:', error)
    });
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
        options: this.titles.map(t => ({ value: t.id, label: t.title || t.name || '' }))
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
    if (searchValues['is_current'] !== undefined && searchValues['is_current'] !== null && searchValues['is_current'] !== '') {
      this.selectedIsCurrent = searchValues['is_current'] === true || searchValues['is_current'] === 'true';
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
    if (filter.key === 'is_current') this.selectedIsCurrent = null;
    
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
    this.selectedIsCurrent = null;
    this.tenureFilter = 'all';
    this.currentPage = 1;
    this.loadBishops();
  }

  setTenureFilter(filter: 'all' | 'current' | 'historical'): void {
    this.tenureFilter = filter;
    this.selectedIsCurrent = filter === 'all' ? null : filter === 'current';
    delete this.advancedSearchValues['is_current'];
    this.currentPage = 1;
    this.loadBishops();
  }

  private resolveIsCurrentFilter(): boolean | undefined {
    if (this.selectedIsCurrent !== null) {
      return this.selectedIsCurrent;
    }
    if (this.tenureFilter === 'current') {
      return true;
    }
    if (this.tenureFilter === 'historical') {
      return false;
    }
    return undefined;
  }

  getTenureLabel(bishop: Bishop): string {
    return bishop.is_current ? 'Current' : 'Historical';
  }

  getTenureBadgeClass(bishop: Bishop): string {
    return bishop.is_current ? 'badge-current' : 'badge-historical';
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
    this.loadingEditBishop = true;
    this.bishopService.getBishop(bishop.id).subscribe({
      next: (response) => {
        this.selectedBishop = response.data ?? bishop;
        this.showFormModal = true;
        this.loadingEditBishop = false;
        this.cdr.detectChanges();
      },
      error: (error) => {
        console.error('Error loading bishop for edit:', error);
        this.toastService.error('Failed to load bishop details for editing');
        this.loadingEditBishop = false;
        this.cdr.detectChanges();
      }
    });
  }

  onFormSaved(bishop: Bishop): void {
    this.showFormModal = false;
    this.selectedBishop = null;
    this.currentPage = 1;
    this.loadBishops();
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
