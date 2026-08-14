import { Component, OnInit, OnDestroy, ChangeDetectionStrategy, ChangeDetectorRef, ViewChild, ElementRef, AfterViewChecked, HostListener } from '@angular/core';
import { CommonModule, DatePipe } from '@angular/common';
import { ActivatedRoute, Router, RouterLink } from '@angular/router';
import { FormsModule } from '@angular/forms';
import { SacramentService } from '../../services/sacrament.service';
import { Sacrament, SacramentType, SacramentListParams, SacramentListResponse, SacramentParticipant } from '../../models/sacrament.model';
import { ToastService } from '@core/services/toast.service';
import { AuthService } from '@core/services/auth.service';
import { Store } from '@ngrx/store';
import { AppState } from '@core/store';
import { selectCurrentUser } from '@core/store/auth/auth.selectors';
import { take, firstValueFrom } from 'rxjs';
import { takeUntil } from 'rxjs/operators';
import { Subject } from 'rxjs';
import { PAGINATION_DEFAULTS } from '../../constants/sacrament.constants';
import { handleApiError } from '../../utils/error-handler.util';
import { SacramentFormModalComponent } from '../sacrament-form-modal/sacrament-form-modal.component';
import { SacramentDefinitionService } from '../../services/sacrament-definition.service';
import { AdvancedSearchPanelComponent, SearchField, ActiveFilter } from '@shared/components/advanced-search-panel/advanced-search-panel.component';
import { PaginationComponent } from '@shared/components';
import { PageHeaderComponent } from '@shared/components/page-header/page-header.component';
import { ListToolbarComponent } from '@shared/components/list-toolbar/list-toolbar.component';
import { DataTableComponent } from '@shared/components/data-table/data-table.component';
import { CfEmptyStateComponent } from '@shared/components/cf-empty-state/cf-empty-state.component';
import { StatusBadgeComponent } from '@shared/components/status-badge/status-badge.component';
import { LoadingSkeletonComponent } from '@shared/components/loading-skeleton/loading-skeleton.component';
import { trapFocus, saveActiveElement, restoreActiveElement } from '@shared/utils/focus-trap.util';
import { ModalShellComponent } from '@shared/components/modal-shell/modal-shell.component';
import { ConfirmationModalComponent } from '@shared/components/confirmation-modal/confirmation-modal.component';
import { VoidSacramentDialogComponent } from '../shared/void-sacrament-dialog/void-sacrament-dialog.component';
import { CorrectSacramentDialogComponent } from '../shared/correct-sacrament-dialog/correct-sacrament-dialog.component';
import { HttpErrorResponse } from '@angular/common/http';

@Component({
  selector: 'app-sacrament-list',
  standalone: true,
  imports: [
    CommonModule,
    FormsModule,
    RouterLink,
    SacramentFormModalComponent,
    AdvancedSearchPanelComponent,
    PaginationComponent,
    PageHeaderComponent,
    ListToolbarComponent,
    DataTableComponent,
    CfEmptyStateComponent,
    StatusBadgeComponent,
    LoadingSkeletonComponent,
    ModalShellComponent,
    ConfirmationModalComponent,
    VoidSacramentDialogComponent,
    CorrectSacramentDialogComponent,
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
  correctionReason: string | null = null;
  showDetailModal = false;
  detailSacrament: Sacrament | null = null;
  loadingDetail = false;
  showVoidDialog = false;
  sacramentToVoid: Sacrament | null = null;
  voiding = false;
  showCorrectDialog = false;
  sacramentToCorrect: Sacrament | null = null;
  
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
  bulkStatusValue: string = 'registered';

  /** Bulk confirmation / export chooser (replaces native confirm/prompt). */
  showBulkConfirmModal = false;
  bulkConfirmTitle = '';
  bulkConfirmMessage = '';
  bulkConfirmAction: (() => void) | null = null;
  showExportFormatModal = false;
  loadError: string | null = null;
  loaded = false;
  showOverflowMenu = false;

  constructor(
    private sacramentService: SacramentService,
    private toastService: ToastService,
    private router: Router,
    private route: ActivatedRoute,
    private store: Store<AppState>,
    private datePipe: DatePipe,
    private cdr: ChangeDetectorRef,
    private authService: AuthService,
    private definitionService: SacramentDefinitionService
  ) {}

  get isTenantAdmin(): boolean {
    return this.authService.isTenantAdmin();
  }

  get canMigrate(): boolean {
    return this.authService.hasPermission('sacraments.migration.view');
  }

  get holyOrdersEnabled(): boolean {
    const holyOrders = this.sacramentTypes.find((type) => {
      const code = (type.code || '').toUpperCase().replace(/[\s-]/g, '_');
      return ['HOLY_ORDERS', 'HOLYORDERS', 'ORDINATION'].includes(code);
    });
    return !!holyOrders && holyOrders.enabled_for_tenant !== false;
  }

  get canVoid(): boolean {
    return this.authService.hasPermission('sacraments.void');
  }

  get canCorrect(): boolean {
    return this.authService.hasPermission('sacraments.correct');
  }

  get hasActiveFilters(): boolean {
    return this.getActiveFilterCount() > 0 || !!this.searchTerm;
  }

  get drawerFilterCount(): number {
    return this.getActiveFilterCount();
  }

  @HostListener('document:click', ['$event'])
  onDocumentClick(event: MouseEvent): void {
    if (!this.showOverflowMenu) {
      return;
    }
    const target = event.target as HTMLElement | null;
    if (target && !target.closest('.sacrament-list__overflow')) {
      this.showOverflowMenu = false;
      this.cdr.markForCheck();
    }
  }

  @HostListener('document:keydown.escape')
  onEscape(): void {
    if (this.showOverflowMenu) {
      this.showOverflowMenu = false;
      this.cdr.markForCheck();
    }
  }

  ngOnInit(): void {
    this.initializeSearchFields();
    this.loadCurrentUser();
    this.loadSacramentTypes();
    this.definitionService.load().pipe(take(1)).subscribe({
      next: () => this.cdr.markForCheck(),
      error: () => undefined,
    });
    this.route.queryParamMap.pipe(takeUntil(this.destroy$)).subscribe((params) => {
      const editId = params.get('edit');
      const create = params.get('create');
      if (editId) {
        const id = Number(editId);
        if (!Number.isNaN(id)) {
          this.openEditById(id);
        }
        void this.router.navigate([], {
          relativeTo: this.route,
          queryParams: { edit: null },
          queryParamsHandling: 'merge',
          replaceUrl: true,
        });
      } else if (create === '1') {
        this.onCreateSacrament();
        void this.router.navigate([], {
          relativeTo: this.route,
          queryParams: { create: null },
          queryParamsHandling: 'merge',
          replaceUrl: true,
        });
      }
    });
  }

  /** Open edit modal from deep link / certificate page (UX-0). */
  openEditById(id: number): void {
    this.sacramentService
      .getSacrament(id)
      .pipe(takeUntil(this.destroy$))
      .subscribe({
        next: (response) => {
          if (response.success && response.data) {
            this.correctionReason = null;
            this.sacramentToEdit = response.data;
            this.showFormModal = true;
            this.cdr.markForCheck();
          }
        },
        error: () => {
          this.toastService.error('Could not open sacrament for editing.');
          this.cdr.markForCheck();
        },
      });
  }

  showParticipantsInDetail(): boolean {
    return this.definitionService.isParticipantsV1Enabled()
      && !!this.detailSacrament?.participants?.length;
  }

  participantDisplayName(p: SacramentParticipant): string {
    return p.snapshot_json?.full_name || p.external_full_name || '—';
  }

  participantRoleLabel(role: string): string {
    const map: Record<string, string> = {
      recipient: 'Recipient',
      bride: 'Bride',
      groom: 'Groom',
      father: 'Father',
      mother: 'Mother',
      godfather: 'Godfather',
      godmother: 'Godmother',
      sponsor: 'Sponsor',
      witness: 'Witness',
      minister: 'Minister',
      candidate: 'Candidate',
      co_consecrator: 'Co-consecrator',
    };
    return map[role] || role.replace(/_/g, ' ');
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
          { value: 'registered', label: 'Registered' },
          { value: 'conditional', label: 'Conditional' },
          { value: 'voided', label: 'Voided' },
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
    this.sacramentService.getSacramentTypes({ includeInactive: true })
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
    this.loadError = null;

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
        this.loaded = true;
        this.cdr.markForCheck();
      },
      error: (error) => {
        const errorMessage = handleApiError(error, 'Failed to load sacraments');
        this.loadError = errorMessage;
        this.toastService.error(errorMessage);
        this.loading = false;
        this.loaded = true;
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
    this.correctionReason = null;
    this.sacramentToEdit = null;
    this.showFormModal = true;
  }

  /**
   * Show edit modal
   */
  onEditSacrament(sacrament: Sacrament): void {
    this.correctionReason = null;
    this.sacramentToEdit = sacrament;
    this.showFormModal = true;
  }
  
  /**
   * Handle form save
   */
  onFormSave(): void {
    this.showFormModal = false;
    this.sacramentToEdit = null;
    this.correctionReason = null;
    this.loadSacraments();
  }

  /** Save and Add Another — refresh list, keep modal open. */
  onFormSavedContinue(): void {
    this.loadSacraments();
  }
  
  /**
   * Handle form cancel
   */
  onFormCancel(): void {
    this.showFormModal = false;
    this.sacramentToEdit = null;
    this.correctionReason = null;
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
    this.correctionReason = null;
    this.sacramentToEdit = sacrament;
    this.showFormModal = true;
    this.cdr.markForCheck();
  }

  canVoidSacrament(sacrament: Sacrament | null | undefined): boolean {
    if (!sacrament || !this.canVoid) {
      return false;
    }
    const status = (sacrament.status || '').toLowerCase();
    return status !== 'voided' && status !== 'cancelled';
  }

  canCorrectSacrament(sacrament: Sacrament | null | undefined): boolean {
    if (!sacrament || !this.canCorrect) {
      return false;
    }
    const status = (sacrament.status || '').toLowerCase();
    return status !== 'voided' && status !== 'cancelled';
  }

  openVoidDialog(sacrament: Sacrament): void {
    if (!this.canVoidSacrament(sacrament)) {
      return;
    }
    this.ensureSacramentForLifecycle(sacrament, (full) => {
      this.sacramentToVoid = full;
      this.showVoidDialog = true;
      this.cdr.markForCheck();
    });
  }

  cancelVoid(): void {
    if (this.voiding) {
      return;
    }
    this.showVoidDialog = false;
    this.sacramentToVoid = null;
    this.cdr.markForCheck();
  }

  confirmVoid(event: { reason: string }): void {
    if (!this.sacramentToVoid || this.voiding) {
      return;
    }

    const target = this.sacramentToVoid;
    this.voiding = true;
    this.cdr.markForCheck();
    this.sacramentService
      .voidSacrament(target.id, {
        lock_version: target.lock_version ?? 0,
        reason: event.reason,
      })
      .pipe(takeUntil(this.destroy$))
      .subscribe({
        next: (response) => {
          this.voiding = false;
          if (response.success) {
            this.toastService.success(
              'Record marked Voided. It remains visible in the register.'
            );
            this.showVoidDialog = false;
            this.sacramentToVoid = null;
            this.closeDetailModal();
            this.loadSacraments();
          } else {
            this.toastService.error(response.message || 'Failed to void sacrament.');
          }
          this.cdr.markForCheck();
        },
        error: (error: unknown) => {
          this.voiding = false;
          this.handleLifecycleConflict(error, 'Failed to void sacrament.');
          this.cdr.markForCheck();
        },
      });
  }

  openCorrectDialog(sacrament: Sacrament): void {
    if (!this.canCorrectSacrament(sacrament)) {
      return;
    }
    this.ensureSacramentForLifecycle(sacrament, (full) => {
      this.sacramentToCorrect = full;
      this.showCorrectDialog = true;
      this.cdr.markForCheck();
    });
  }

  cancelCorrect(): void {
    this.showCorrectDialog = false;
    this.sacramentToCorrect = null;
    this.cdr.markForCheck();
  }

  confirmCorrect(event: { reason: string }): void {
    if (!this.sacramentToCorrect) {
      return;
    }
    const target = this.sacramentToCorrect;
    this.correctionReason = event.reason;
    this.sacramentToEdit = target;
    this.showCorrectDialog = false;
    this.sacramentToCorrect = null;
    this.closeDetailModal();
    this.showFormModal = true;
    this.cdr.markForCheck();
  }

  /**
   * Lifecycle APIs need lock_version; list rows may omit it.
   */
  private ensureSacramentForLifecycle(
    sacrament: Sacrament,
    onReady: (full: Sacrament) => void
  ): void {
    if (sacrament.lock_version != null) {
      onReady(sacrament);
      return;
    }
    this.sacramentService
      .getSacrament(sacrament.id)
      .pipe(takeUntil(this.destroy$))
      .subscribe({
        next: (response) => {
          if (response.success && response.data) {
            onReady(response.data);
          } else {
            this.toastService.error('Could not load this record. Try again.');
          }
          this.cdr.markForCheck();
        },
        error: (error) => {
          this.toastService.error(handleApiError(error, 'Could not load this record.'));
          this.cdr.markForCheck();
        },
      });
  }

  private handleLifecycleConflict(error: unknown, fallback: string): void {
    const status =
      error instanceof HttpErrorResponse
        ? error.status
        : (error as { status?: number })?.status;
    if (status === 409) {
      this.toastService.error(
        'This record was changed by someone else. Reload and try again.'
      );
      return;
    }
    this.toastService.error(handleApiError(error, fallback));
  }

  /**
   * Navigate to certificate view page
   */
  viewCertificate(sacrament: Sacrament): void {
    this.router.navigate(['/sacraments/view', sacrament.id]);
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
   * Undo delete via restore API (ADR-07: restore clears soft-delete only).
   */
  undoDelete(): void {
    if (!this.deletedSacrament) return;

    const id = this.deletedSacrament.id;
    this.sacramentService
      .restoreSacrament(id)
      .pipe(takeUntil(this.destroy$))
      .subscribe({
        next: (response) => {
          if (response.success) {
            this.toastService.success('Sacrament restored to the register.');
            this.loadSacraments();
          } else {
            this.toastService.error(response.message || 'Could not restore sacrament.');
          }
          this.deletedSacrament = null;
          if (this.undoTimeout) {
            clearTimeout(this.undoTimeout);
            this.undoTimeout = null;
          }
          this.cdr.markForCheck();
        },
        error: (error) => {
          this.toastService.error(handleApiError(error, 'Could not restore sacrament.'));
          this.cdr.markForCheck();
        },
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

  statusLabel(status: string | undefined): string {
    switch (status) {
      case 'registered':
      case 'active':
        return 'Registered';
      case 'conditional':
        return 'Conditional';
      case 'voided':
      case 'cancelled':
        return 'Voided';
      default:
        return status ? status.charAt(0).toUpperCase() + status.slice(1) : '—';
    }
  }

  statusTone(status: string | undefined): 'success' | 'warning' | 'critical' | 'neutral' {
    switch (status) {
      case 'registered':
      case 'active':
        return 'success';
      case 'conditional':
        return 'warning';
      case 'voided':
      case 'cancelled':
        return 'critical';
      default:
        return 'neutral';
    }
  }

  registrySummary(sacrament: Sacrament): string {
    const parts: string[] = [];
    if (sacrament.book_number) {
      parts.push(`Bk ${sacrament.book_number}`);
    }
    if (sacrament.page_number) {
      parts.push(`p.${sacrament.page_number}`);
    }
    return parts.length ? parts.join(' · ') : '—';
  }

  onSearchChange(value: string): void {
    this.searchTerm = value;
    this.onQuickSearch();
  }

  openFilters(): void {
    this.showAdvancedSearch = true;
    this.cdr.markForCheck();
  }

  retryLoad(): void {
    this.loadSacraments();
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
   * Bulk export selected sacraments — opens format chooser (no native prompt).
   */
  onBulkExport(): void {
    if (this.selectedSacraments.size === 0) {
      this.toastService.error('Please select at least one sacrament to export.');
      return;
    }
    this.showExportFormatModal = true;
    this.cdr.markForCheck();
  }

  confirmExportFormat(format: 'pdf' | 'csv'): void {
    this.showExportFormatModal = false;
    const selectedData = this.sacraments.filter((s) => this.selectedSacraments.has(s.id));
    this.exportSacraments(selectedData, 'selected', format);
    this.cdr.markForCheck();
  }

  cancelExportFormat(): void {
    this.showExportFormatModal = false;
    this.cdr.markForCheck();
  }

  /**
   * Export sacraments to PDF or Excel
   */
  exportSacraments(
    sacraments: Sacrament[],
    exportType: 'all' | 'selected' | 'filtered' = 'all',
    format: 'pdf' | 'csv' = 'csv'
  ): void {
    if (!sacraments || sacraments.length === 0) {
      this.toastService.error('No sacraments to export.');
      return;
    }
    if (format === 'pdf') {
      this.exportToPDF(sacraments, exportType);
    } else {
      this.exportToExcel(sacraments, exportType);
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
   * Bulk status update — Voided is not offered here (requires per-record void + reason).
   */
  onBulkStatusUpdate(status: string): void {
    if (this.selectedSacraments.size === 0) {
      this.toastService.error('Please select at least one sacrament.');
      return;
    }
    if (status === 'voided') {
      this.toastService.info(
        'To void a record, open it and use Void with a reason. Bulk void is not available.',
        'Use Void on each record'
      );
      return;
    }

    const ids = Array.from(this.selectedSacraments);
    const statusLabel = this.statusLabel(status);
    this.bulkConfirmTitle = `Set status to ${statusLabel}?`;
    this.bulkConfirmMessage = `Update ${ids.length} selected record(s) to ${statusLabel}?`;
    this.bulkConfirmAction = () => this.executeBulkStatusUpdate(ids, status, statusLabel);
    this.showBulkConfirmModal = true;
    this.cdr.markForCheck();
  }

  private executeBulkStatusUpdate(ids: number[], status: string, statusLabel: string): void {
    this.sacramentService
      .bulkUpdateStatus(ids, status)
      .pipe(takeUntil(this.destroy$))
      .subscribe({
        next: (response) => {
          if (response.success) {
            this.toastService.success(
              response.message || `Successfully updated ${ids.length} sacrament(s) to ${statusLabel}`
            );
            this.clearSelection();
            this.loadSacraments();
          } else {
            this.toastService.error(response.message || 'Failed to update sacraments');
          }
          this.cdr.markForCheck();
        },
        error: (error) => {
          this.toastService.error(error.message || 'Failed to update sacraments');
          this.cdr.markForCheck();
        },
      });
  }

  /**
   * Bulk delete with confirmation modal (no native confirm).
   */
  onBulkDelete(): void {
    if (this.selectedSacraments.size === 0) {
      this.toastService.error('Please select at least one sacrament.');
      return;
    }

    const ids = Array.from(this.selectedSacraments);
    const count = ids.length;
    this.bulkConfirmTitle = 'Remove from register view?';
    this.bulkConfirmMessage = `Remove ${count} selected sacrament record(s) from the register view? This is a soft delete; administrators can restore records.`;
    this.bulkConfirmAction = () => this.executeBulkDelete(ids, count);
    this.showBulkConfirmModal = true;
    this.cdr.markForCheck();
  }

  private executeBulkDelete(ids: number[], count: number): void {
    this.sacramentService
      .bulkDelete(ids)
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
          this.toastService.error(error.message || 'Failed to delete sacraments');
          this.cdr.markForCheck();
        },
      });
  }

  confirmBulkAction(): void {
    const action = this.bulkConfirmAction;
    this.showBulkConfirmModal = false;
    this.bulkConfirmAction = null;
    if (action) {
      action();
    }
    this.cdr.markForCheck();
  }

  cancelBulkAction(): void {
    this.showBulkConfirmModal = false;
    this.bulkConfirmAction = null;
    this.cdr.markForCheck();
  }

  ngOnDestroy(): void {
    this.destroy$.next();
    this.destroy$.complete();
  }
}


