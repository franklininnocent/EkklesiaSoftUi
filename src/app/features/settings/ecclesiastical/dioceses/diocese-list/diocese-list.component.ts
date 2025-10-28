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
    EmptyStateComponent
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
  perPage = 15;
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
  showFilters = false;
  showDeleteModal = false;
  showFormModal = false;
  dioceseToDelete: Diocese | null = null;
  selectedDiocese: Diocese | null = null;

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
          this.totalItems = response.data.meta?.total || 0;
          this.currentPage = response.data.meta?.current_page || 1;
          this.totalPages = response.data.meta?.last_page || 1;
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
      },
      error: (error) => console.error('Error loading countries:', error)
    });

    // Load denominations
    this.denominationService.getDenominations().subscribe({
      next: (response) => {
        this.denominations = response.data || [];
      },
      error: (error) => console.error('Error loading denominations:', error)
    });
  }

  onSearch(): void {
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

  toggleFilters(): void {
    this.showFilters = !this.showFilters;
  }

  getSortIcon(column: string): string {
    if (this.sortBy !== column) return '⇅';
    return this.sortOrder === 'asc' ? '↑' : '↓';
  }

  getStatusBadgeClass(active: boolean): string {
    return active ? 'badge-success' : 'badge-inactive';
  }

  getTypeBadge(isArchdiocese: boolean): string {
    return isArchdiocese ? 'Archdiocese' : 'Diocese';
  }

  /**
   * TrackBy function for ngFor performance optimization
   */
  trackByDioceseId(index: number, diocese: Diocese): string | number {
    return diocese.id;
  }
}

