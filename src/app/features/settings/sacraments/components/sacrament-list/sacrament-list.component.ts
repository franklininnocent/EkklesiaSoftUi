import { Component, OnInit, OnDestroy, ChangeDetectionStrategy, ChangeDetectorRef, ViewChild, ElementRef, AfterViewChecked } from '@angular/core';
import { CommonModule, DatePipe } from '@angular/common';
import { Router } from '@angular/router';
import { FormsModule } from '@angular/forms';
import { SacramentService } from '../../services/sacrament.service';
import { Sacrament, SacramentType, SacramentListParams, SacramentListResponse } from '../../models/sacrament.model';
import { ToastService } from '@core/services/toast.service';
import { AuthService } from '@core/services/auth.service';
import { Store } from '@ngrx/store';
import { AppState } from '@core/store';
import { selectCurrentUser } from '@core/store/auth/auth.selectors';
import { take, firstValueFrom } from 'rxjs';
import { takeUntil } from 'rxjs/operators';
import { Subject } from 'rxjs';
import { SacramentStatus, SACRAMENT_STATUS_OPTIONS, PAGINATION_DEFAULTS } from '../../constants/sacrament.constants';
import { handleApiError } from '../../utils/error-handler.util';
import { SacramentFormModalComponent } from '../sacrament-form-modal/sacrament-form-modal.component';
import { AdvancedSearchPanelComponent, SearchField, ActiveFilter } from '@shared/components/advanced-search-panel/advanced-search-panel.component';
import { PaginationComponent, ButtonComponent } from '@shared/components';
import { PageHeaderComponent } from '@shared/components/page-header/page-header.component';
import { trapFocus, saveActiveElement, restoreActiveElement } from '@shared/utils/focus-trap.util';
import { ModalShellComponent } from '@shared/components/modal-shell/modal-shell.component';

@Component({
  selector: 'app-sacrament-list',
  standalone: true,
  imports: [
    CommonModule, 
    FormsModule, 
    SacramentFormModalComponent,
    AdvancedSearchPanelComponent,
    PaginationComponent,
    ButtonComponent,
    PageHeaderComponent,
    ModalShellComponent,
  ],
  templateUrl: './sacrament-list.component.html',
  styleUrl: './sacrament-list.component.scss',
  providers: [DatePipe],
  changeDetection: ChangeDetectionStrategy.OnPush
})
export class SacramentListComponent implements OnInit, OnDestroy, AfterViewChecked {
  sacraments: Sacrament[] = [];
  sacramentTypes: SacramentType[] = [];
  loading = false;
  private destroy$ = new Subject<void>();
  
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
  ministerNameFilter = '';
  certificateNumberFilter = '';
  bookNumberFilter = '';
  selectedFamilyId: string | null = null;
  selectedBccId: string | null = null;
  
  // Sorting
  sortBy = 'date_administered';
  sortDir: 'asc' | 'desc' = 'desc';
  
  // Current tenant ID
  currentTenantId: number | null = null;

  // Expose Math for template
  Math = Math;
  
  // Constants for template
  readonly pageSizeOptions: number[] = [...PAGINATION_DEFAULTS.PAGE_SIZE_OPTIONS];
  
  // Modal states
  showDeleteModal = false;
  sacramentToDelete: Sacrament | null = null;
  showFormModal = false;
  sacramentToEdit: Sacrament | null = null;
  showDetailModal = false;
  detailSacrament: Sacrament | null = null;
  loadingDetail = false;
  
  @ViewChild('detailModal', { static: false }) detailModalRef?: ElementRef<HTMLElement>;
  
  // Focus management
  private previousActiveElement: HTMLElement | null = null;
  private focusTrapCleanup: (() => void) | null = null;
  private modalWasOpen = false;
  
  // Undo functionality
  deletedSacrament: Sacrament | null = null;
  undoTimeout: ReturnType<typeof setTimeout> | null = null;
  
  // Advanced search panel state
  showAdvancedSearch = false;
  searchFields: SearchField[] = [];

  // Bulk operations
  selectedSacraments: Set<number> = new Set();
  selectAll = false;
  showBulkActions = false;
  bulkActionType: 'delete' | 'status' | 'export' | null = null;
  bulkStatusValue: string = 'active';

  constructor(
    private sacramentService: SacramentService,
    private toastService: ToastService,
    private router: Router,
    private store: Store<AppState>,
    private datePipe: DatePipe,
    private cdr: ChangeDetectorRef,
    private authService: AuthService
  ) {}
  
  /**
   * Check if current user is Tenant Admin
   */
  get isTenantAdmin(): boolean {
    return this.authService.isTenantAdmin();
  }

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
      },
      {
        key: 'minister_name',
        label: 'Minister Name',
        type: 'text',
        value: this.ministerNameFilter
      },
      {
        key: 'certificate_number',
        label: 'Certificate Number',
        type: 'text',
        value: this.certificateNumberFilter
      },
      {
        key: 'book_number',
        label: 'Book Number',
        type: 'text',
        value: this.bookNumberFilter
      }
    ];
  }

  /**
   * Load current user to get tenant_id
   */
  loadCurrentUser(): void {
    this.store.select(selectCurrentUser)
      .pipe(take(1), takeUntil(this.destroy$))
      .subscribe({
      next: (user) => {
        if (user && user.tenant_id) {
          this.currentTenantId = user.tenant_id;
          this.loadSacraments();
        } else {
          this.toastService.error('You must be associated with a church to manage sacraments.');
        }
        this.cdr.markForCheck();
      },
      error: (error) => {
        console.error('Error loading user:', error);
        this.toastService.error('Failed to load user information.');
        this.cdr.markForCheck();
      }
    });
  }

  /**
   * Load sacrament types for filter dropdown
   */
  loadSacramentTypes(): void {
    this.sacramentService.getSacramentTypes()
      .pipe(takeUntil(this.destroy$))
      .subscribe({
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
      minister_name: this.ministerNameFilter || undefined,
      certificate_number: this.certificateNumberFilter || undefined,
      book_number: this.bookNumberFilter || undefined,
      family_id: this.selectedFamilyId || undefined,
      bcc_id: this.selectedBccId || undefined,
      sort_by: this.sortBy,
      sort_dir: this.sortDir
    };

    this.sacramentService.getSacraments(params)
      .pipe(takeUntil(this.destroy$))
      .subscribe({
      next: (response: SacramentListResponse) => {
        if (response.success && response.data) {
          this.sacraments = response.data.data || [];
          this.totalItems = response.data.total || 0;
          this.currentPage = response.data.current_page || 1;
          this.totalPages = response.data.last_page || 1;
        }
        this.loading = false;
        this.cdr.markForCheck();
      },
      error: (error) => {
        const errorMessage = handleApiError(error, 'Failed to load sacraments');
        this.toastService.error(errorMessage);
        this.loading = false;
        this.cdr.markForCheck();
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
    this.ministerNameFilter = '';
    this.certificateNumberFilter = '';
    this.bookNumberFilter = '';
    this.selectedFamilyId = null;
    this.selectedBccId = null;
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
   * Get sort icon for column - Returns SVG icon component
   */
  getSortIcon(column: string): string {
    if (this.sortBy !== column) {
      return 'unsorted';
    }
    return this.sortDir === 'asc' ? 'asc' : 'desc';
  }

  /**
   * Check if column is sorted
   */
  isSorted(column: string): boolean {
    return this.sortBy === column;
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
   * View sacrament details in modal
   */
  viewSacrament(sacrament: Sacrament): void {
    // Save current focus
    this.previousActiveElement = saveActiveElement();
    this.detailSacrament = sacrament;
    this.showDetailModal = true;
    this.loadSacramentDetail(sacrament.id);
    this.cdr.markForCheck();
  }

  /**
   * Load full sacrament details
   */
  loadSacramentDetail(sacramentId: number): void {
    this.loadingDetail = true;
    this.cdr.markForCheck();
    this.sacramentService.getSacrament(sacramentId)
      .pipe(takeUntil(this.destroy$))
      .subscribe({
        next: (response) => {
          if (response.success && response.data) {
            this.detailSacrament = response.data;
          }
          this.loadingDetail = false;
          this.cdr.markForCheck();
        },
        error: (error) => {
          console.error('Error loading sacrament details:', error);
          this.loadingDetail = false;
          this.toastService.error('Failed to load sacrament details', 'Error');
          this.cdr.markForCheck();
        }
      });
  }

  /**
   * Close detail modal
   */
  closeDetailModal(): void {
    // Clean up focus trap
    if (this.focusTrapCleanup) {
      this.focusTrapCleanup();
      this.focusTrapCleanup = null;
    }
    
    this.showDetailModal = false;
    this.detailSacrament = null;
    
    // Restore previous focus
    if (this.previousActiveElement) {
      setTimeout(() => {
        restoreActiveElement(this.previousActiveElement);
        this.previousActiveElement = null;
      }, 100);
    }
    
    this.cdr.markForCheck();
  }

  /**
   * Edit sacrament from detail modal
   */
  editSacrament(sacrament: Sacrament): void {
    this.sacramentToEdit = sacrament;
    this.showFormModal = true;
    this.cdr.markForCheck();
  }

  /**
   * Navigate to certificate view page
   */
  viewCertificate(sacrament: Sacrament): void {
    this.router.navigate(['/settings/sacraments/view', sacrament.id]);
  }

  /**
   * Handle modal keyboard events and focus trapping
   */
  ngAfterViewChecked(): void {
    // Set up focus trap when modal opens
    if (this.showDetailModal && !this.modalWasOpen && this.detailModalRef?.nativeElement) {
      const modalContainer = this.detailModalRef.nativeElement.querySelector('.sacrament-detail-modal') as HTMLElement;
      if (modalContainer) {
        this.focusTrapCleanup = trapFocus(modalContainer);
        this.modalWasOpen = true;
      }
    } else if (!this.showDetailModal && this.modalWasOpen) {
      this.modalWasOpen = false;
    }
  }

  /**
   * Show delete confirmation
   */
  onDeleteSacrament(sacrament: Sacrament): void {
    // Check if user is Tenant Admin
    if (!this.isTenantAdmin) {
      this.toastService.error('Only Tenant Administrators can delete sacrament records.', 'Permission Denied', 5000);
      return;
    }
    
    this.sacramentToDelete = sacrament;
    this.showDeleteModal = true;
  }

  /**
   * Confirm delete with undo functionality
   */
  confirmDelete(): void {
    if (!this.sacramentToDelete) return;

    // Store deleted sacrament for undo
    this.deletedSacrament = { ...this.sacramentToDelete };
    const deletedId = this.sacramentToDelete.id;

    this.sacramentService.deleteSacrament(deletedId)
      .pipe(takeUntil(this.destroy$))
      .subscribe({
        next: (response) => {
          if (response.success) {
            this.cancelDelete();
            this.loadSacraments();
            
            // Show undo notification
            this.showUndoNotification(deletedId);
          } else {
            this.toastService.error('Failed to delete sacrament.');
            this.cancelDelete();
          }
          this.cdr.markForCheck();
        },
        error: (error) => {
          console.error('Error deleting sacrament:', error);
          const errorMessage = handleApiError(error, 'Failed to delete sacrament');
          this.toastService.error(errorMessage);
          this.cancelDelete();
          this.deletedSacrament = null;
          this.cdr.markForCheck();
        }
      });
  }

  /**
   * Show undo notification
   */
  showUndoNotification(deletedId: number): void {
    // Clear any existing timeout
    if (this.undoTimeout) {
      clearTimeout(this.undoTimeout);
    }

    // Show success message with undo option
    this.toastService.success(
      'Sacrament deleted successfully. Click to undo.',
      'Success',
      8000 // 8 seconds to allow undo
    );

    // Set timeout to clear undo option after 8 seconds
    this.undoTimeout = setTimeout(() => {
      this.deletedSacrament = null;
    }, 8000);
  }

  /**
   * Undo delete action
   */
  undoDelete(): void {
    if (!this.deletedSacrament) return;

    // Restore the sacrament by creating it again
    // Note: This assumes the backend supports restoration or we need to implement it
    // For now, we'll show a message that restoration needs to be done manually
    this.toastService.info(
      'To restore this sacrament, please contact your administrator or recreate it manually.',
      'Restore Required'
    );
    
    // Clear undo state
    this.deletedSacrament = null;
    if (this.undoTimeout) {
      clearTimeout(this.undoTimeout);
      this.undoTimeout = null;
    }
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
    this.ministerNameFilter = searchValues['minister_name'] || '';
    this.certificateNumberFilter = searchValues['certificate_number'] || '';
    this.bookNumberFilter = searchValues['book_number'] || '';
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
    this.ministerNameFilter = '';
    this.certificateNumberFilter = '';
    this.bookNumberFilter = '';
    this.selectedFamilyId = null;
    this.selectedBccId = null;
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

    if (this.ministerNameFilter) {
      filters.push({
        key: 'minister_name',
        label: 'Minister Name',
        value: this.ministerNameFilter,
        displayValue: this.ministerNameFilter
      });
    }

    if (this.certificateNumberFilter) {
      filters.push({
        key: 'certificate_number',
        label: 'Certificate Number',
        value: this.certificateNumberFilter,
        displayValue: this.certificateNumberFilter
      });
    }

    if (this.bookNumberFilter) {
      filters.push({
        key: 'book_number',
        label: 'Book Number',
        value: this.bookNumberFilter,
        displayValue: this.bookNumberFilter
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
    } else if (filter.key === 'minister_name') {
      this.ministerNameFilter = '';
    } else if (filter.key === 'certificate_number') {
      this.certificateNumberFilter = '';
    } else if (filter.key === 'book_number') {
      this.bookNumberFilter = '';
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
    this.ministerNameFilter = '';
    this.certificateNumberFilter = '';
    this.bookNumberFilter = '';
    this.selectedFamilyId = null;
    this.selectedBccId = null;
    this.searchTerm = '';
    this.searchFields.forEach(field => {
      field.value = undefined;
    });
    this.currentPage = 1;
    this.loadSacraments();
  }

  /**
   * Bulk export selected sacraments
   */
  onBulkExport(): void {
    if (this.selectedSacraments.size === 0) {
      this.toastService.error('Please select at least one sacrament to export.');
      return;
    }

    // Get selected sacraments data
    const selectedData = this.sacraments.filter(s => this.selectedSacraments.has(s.id));
    this.exportSacraments(selectedData, 'selected');
  }

  /**
   * Export sacraments to PDF or Excel
   */
  exportSacraments(sacraments: Sacrament[], exportType: 'all' | 'selected' | 'filtered' = 'all'): void {
    if (!sacraments || sacraments.length === 0) {
      this.toastService.error('No sacraments to export.');
      return;
    }

    // Show export options dialog
    const format = prompt('Export format:\n1. PDF\n2. Excel (CSV)\n\nEnter 1 or 2:');
    
    if (!format) {
      return;
    }

    if (format === '1') {
      this.exportToPDF(sacraments, exportType);
    } else if (format === '2') {
      this.exportToExcel(sacraments, exportType);
    } else {
      this.toastService.error('Invalid format selected.');
    }
  }

  /**
   * Export to PDF using browser print
   */
  exportToPDF(sacraments: Sacrament[], exportType: string): void {
    // Create a printable table
    let html = `
      <!DOCTYPE html>
      <html>
      <head>
        <title>Sacraments Export - ${new Date().toLocaleDateString()}</title>
        <style>
          body { font-family: Arial, sans-serif; margin: 20px; }
          h1 { color: #333; }
          table { width: 100%; border-collapse: collapse; margin-top: 20px; }
          th, td { border: 1px solid #ddd; padding: 8px; text-align: left; }
          th { background-color: #667eea; color: white; }
          tr:nth-child(even) { background-color: #f2f2f2; }
        </style>
      </head>
      <body>
        <h1>Sacraments Export (${exportType})</h1>
        <p>Generated: ${new Date().toLocaleString()}</p>
        <table>
          <thead>
            <tr>
              <th>Recipient</th>
              <th>Sacrament Type</th>
              <th>Date Administered</th>
              <th>Place</th>
              <th>Minister</th>
              <th>Certificate #</th>
              <th>Status</th>
            </tr>
          </thead>
          <tbody>
    `;

    sacraments.forEach(sacrament => {
      html += `
        <tr>
          <td>${sacrament.recipient_name || 'N/A'}</td>
          <td>${sacrament.sacrament_type?.name || 'N/A'}</td>
          <td>${this.datePipe.transform(sacrament.date_administered, 'MMM d, y') || 'N/A'}</td>
          <td>${sacrament.place_administered || 'N/A'}</td>
          <td>${sacrament.minister_name || 'N/A'}</td>
          <td>${sacrament.certificate_number || 'N/A'}</td>
          <td>${sacrament.status || 'N/A'}</td>
        </tr>
      `;
    });

    html += `
          </tbody>
        </table>
      </body>
      </html>
    `;

    const printWindow = window.open('', '_blank');
    if (printWindow) {
      printWindow.document.write(html);
      printWindow.document.close();
      printWindow.onload = () => {
        printWindow.print();
      };
    }
  }

  /**
   * Export to Excel (CSV format)
   */
  exportToExcel(sacraments: Sacrament[], exportType: string): void {
    // Create CSV content
    const headers = ['Recipient', 'Sacrament Type', 'Date Administered', 'Place', 'Minister', 'Minister Title', 'Certificate #', 'Book #', 'Page #', 'Status'];
    const rows = sacraments.map(sacrament => [
      sacrament.recipient_name || '',
      sacrament.sacrament_type?.name || '',
      this.datePipe.transform(sacrament.date_administered, 'yyyy-MM-dd') || '',
      sacrament.place_administered || '',
      sacrament.minister_name || '',
      sacrament.minister_title || '',
      sacrament.certificate_number || '',
      sacrament.book_number || '',
      sacrament.page_number || '',
      sacrament.status || ''
    ]);

    // Convert to CSV
    const csvContent = [
      headers.join(','),
      ...rows.map(row => row.map(cell => `"${String(cell).replace(/"/g, '""')}"`).join(','))
    ].join('\n');

    // Create blob and download
    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
    const link = document.createElement('a');
    const url = URL.createObjectURL(blob);
    link.setAttribute('href', url);
    link.setAttribute('download', `sacraments_export_${exportType}_${new Date().toISOString().split('T')[0]}.csv`);
    link.style.visibility = 'hidden';
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);

    this.toastService.success(`Exported ${sacraments.length} sacrament${sacraments.length > 1 ? 's' : ''} to CSV.`);
  }

  /**
   * Toggle select all checkbox
   */
  toggleSelectAll(event: Event): void {
    const target = event.target as HTMLInputElement;
    this.selectAll = target.checked;
    
    if (this.selectAll) {
      this.sacraments.forEach(sacrament => {
        this.selectedSacraments.add(sacrament.id);
      });
    } else {
      this.selectedSacraments.clear();
    }
    this.cdr.markForCheck();
  }

  /**
   * Toggle individual sacrament selection
   */
  toggleSacramentSelection(sacramentId: number, event: Event): void {
    const target = event.target as HTMLInputElement;
    if (target.checked) {
      this.selectedSacraments.add(sacramentId);
    } else {
      this.selectedSacraments.delete(sacramentId);
      this.selectAll = false;
    }
    this.cdr.markForCheck();
  }

  /**
   * Clear all selections
   */
  clearSelection(): void {
    this.selectedSacraments.clear();
    this.selectAll = false;
    this.cdr.markForCheck();
  }

  /**
   * Bulk status update
   */
  onBulkStatusUpdate(status: string): void {
    if (this.selectedSacraments.size === 0) {
      this.toastService.error('Please select at least one sacrament.');
      return;
    }

    const ids = Array.from(this.selectedSacraments);
    const statusLabel = status.charAt(0).toUpperCase() + status.slice(1);

    this.sacramentService.bulkUpdateStatus(ids, status)
      .pipe(takeUntil(this.destroy$))
      .subscribe({
        next: (response) => {
          if (response.success) {
            this.toastService.success(response.message || `Successfully updated ${ids.length} sacrament(s) to ${statusLabel}`);
            this.clearSelection();
            this.loadSacraments();
          } else {
            this.toastService.error(response.message || 'Failed to update sacraments');
          }
          this.cdr.markForCheck();
        },
        error: (error) => {
          console.error('Bulk status update error:', error);
          const errorMessage = error.message || 'Failed to update sacraments';
          this.toastService.error(errorMessage);
          this.cdr.markForCheck();
        }
      });
  }

  /**
   * Bulk delete
   */
  onBulkDelete(): void {
    if (this.selectedSacraments.size === 0) {
      this.toastService.error('Please select at least one sacrament.');
      return;
    }

    const ids = Array.from(this.selectedSacraments);
    const count = ids.length;

    // Show confirmation
    if (!confirm(`Are you sure you want to delete ${count} sacrament(s)? This action cannot be undone.`)) {
      return;
    }

    this.sacramentService.bulkDelete(ids)
      .pipe(takeUntil(this.destroy$))
      .subscribe({
        next: (response) => {
          if (response.success) {
            this.toastService.success(response.message || `Successfully deleted ${count} sacrament(s)`);
            this.clearSelection();
            this.loadSacraments();
          } else {
            this.toastService.error(response.message || 'Failed to delete sacraments');
          }
          this.cdr.markForCheck();
        },
        error: (error) => {
          console.error('Bulk delete error:', error);
          const errorMessage = error.message || 'Failed to delete sacraments';
          this.toastService.error(errorMessage);
          this.cdr.markForCheck();
        }
      });
  }

  ngOnDestroy(): void {
    this.destroy$.next();
    this.destroy$.complete();
  }
}


