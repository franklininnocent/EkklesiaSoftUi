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

@Component({
  selector: 'app-sacrament-list',
  standalone: true,
  imports: [CommonModule, FormsModule],
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

  constructor(
    private sacramentService: SacramentService,
    private toastService: ToastService,
    private router: Router,
    private store: Store<AppState>,
    private datePipe: DatePipe
  ) {}

  ngOnInit(): void {
    this.loadCurrentUser();
    this.loadSacramentTypes();
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
   * Navigate to create page
   */
  onCreateSacrament(): void {
    this.router.navigate(['/settings/sacraments/create']);
  }

  /**
   * Navigate to edit page
   */
  onEditSacrament(sacrament: Sacrament): void {
    this.router.navigate(['/settings/sacraments/edit', sacrament.id]);
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
          this.toastService.success('Sacrament record deleted successfully.');
          this.loadSacraments();
        }
        this.cancelDelete();
      },
      error: (error) => {
        console.error('Error deleting sacrament:', error);
        this.toastService.error('Failed to delete sacrament record.');
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
}

