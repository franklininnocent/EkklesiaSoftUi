import { Component, OnInit } from '@angular/core';
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
    EmptyStateComponent
  ],
  templateUrl: './bishop-list.component.html',
  styleUrl: './bishop-list.component.scss'
})
export class BishopListComponent implements OnInit {
  bishops: Bishop[] = [];
  dioceses: any[] = [];
  titles: any[] = [];
  
  // Pagination
  currentPage = 1;
  perPage = 15;
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
  showFilters = false;
  showDeleteModal = false;
  showFormModal = false;
  bishopToDelete: Bishop | null = null;
  selectedBishop: Bishop | null = null;

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
    private toastService: ToastService
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
        if (response.data) {
          this.bishops = response.data.data || [];
          this.totalItems = response.data.meta?.total || 0;
          this.currentPage = response.data.meta?.current_page || 1;
          this.totalPages = response.data.meta?.last_page || 1;
        }
        this.loading = false;
      },
      error: (error) => {
        console.error('Error loading bishops:', error);
        this.toastService.error('Failed to load bishops');
        this.loading = false;
      }
    });
  }

  loadFilters(): void {
    // Load dioceses for filter
    this.dioceseService.getDioceses().subscribe({
      next: (response) => {
        this.dioceses = response.data?.data || [];
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
  }

  onSearch(): void {
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

  toggleFilters(): void {
    this.showFilters = !this.showFilters;
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
   * TrackBy function for ngFor performance optimization
   */
  trackByBishopId(index: number, bishop: Bishop): string | number {
    return bishop.id;
  }
}
