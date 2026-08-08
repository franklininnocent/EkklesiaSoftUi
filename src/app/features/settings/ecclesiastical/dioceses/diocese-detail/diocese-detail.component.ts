import { Component, OnInit, ChangeDetectionStrategy } from '@angular/core';
import { CommonModule } from '@angular/common';
import { ActivatedRoute, Router, RouterModule } from '@angular/router';
import { DioceseService, BishopService } from '@core/services/ecclesiastical';
import { Diocese } from '@core/models/ecclesiastical';
import { ToastService } from '@core/services';
import { LoadingSkeletonComponent } from '@shared/components/loading-skeleton/loading-skeleton.component';
import { EmptyStateComponent } from '@shared/components/empty-state/empty-state.component';
import { ConfirmationModalComponent } from '@shared/components/confirmation-modal/confirmation-modal.component';
import { PageHeaderComponent } from '@shared/components/page-header/page-header.component';

@Component({
  selector: 'app-diocese-detail',
  standalone: true,
  imports: [
    CommonModule,
    RouterModule,
    LoadingSkeletonComponent,
    EmptyStateComponent,
    ConfirmationModalComponent,
    PageHeaderComponent
  ],
  templateUrl: './diocese-detail.component.html',
  changeDetection: ChangeDetectionStrategy.Eager,
  styleUrl: './diocese-detail.component.scss'
})
export class DioceseDetailComponent implements OnInit {
  diocese: Diocese | null = null;
  relatedBishops: any[] = [];
  loading = true;
  loadingBishops = true;
  showDeleteModal = false;

  get dioceseHeaderSubtitle(): string | undefined {
    if (!this.diocese) return undefined;
    const type = this.getTypeBadge(this.diocese.is_archdiocese);
    return this.diocese.code ? `${type} · ${this.diocese.code}` : type;
  }

  constructor(
    private route: ActivatedRoute,
    private router: Router,
    private dioceseService: DioceseService,
    private bishopService: BishopService,
    private toastService: ToastService
  ) {}

  ngOnInit(): void {
    const id = this.route.snapshot.paramMap.get('id');
    if (id) {
      this.loadDiocese(id);
      this.loadRelatedBishops(id);
    }
  }

  loadDiocese(id: string): void {
    this.loading = true;
    const numericId = parseInt(id, 10);
    this.dioceseService.getDiocese(numericId).subscribe({
      next: (response: any) => {
        this.diocese = response.data;
        this.loading = false;
      },
      error: (error: any) => {
        console.error('Error loading diocese:', error);
        this.toastService.error('Failed to load diocese details');
        this.loading = false;
        this.router.navigate(['/settings/ecclesiastical/dioceses']);
      }
    });
  }

  loadRelatedBishops(dioceseId: string): void {
    this.loadingBishops = true;
    const numericId = parseInt(dioceseId, 10);
    this.bishopService.getBishopsByDiocese(numericId).subscribe({
      next: (response: any) => {
        this.relatedBishops = response.data || [];
        this.loadingBishops = false;
      },
      error: (error: any) => {
        console.error('Error loading bishops:', error);
        this.relatedBishops = [];
        this.loadingBishops = false;
      }
    });
  }

  onEdit(): void {
    if (this.diocese) {
      this.router.navigate(['/settings/ecclesiastical/dioceses'], {
        queryParams: { edit: this.diocese.id }
      });
    }
  }

  onDelete(): void {
    this.showDeleteModal = true;
  }

  confirmDelete(): void {
    if (this.diocese) {
      this.dioceseService.deleteDiocese(this.diocese.id).subscribe({
        next: () => {
          this.toastService.success('Diocese deleted successfully');
          this.router.navigate(['/settings/ecclesiastical/dioceses']);
        },
        error: (error) => {
          console.error('Error deleting diocese:', error);
          this.toastService.error('Failed to delete diocese');
          this.showDeleteModal = false;
        }
      });
    }
  }

  cancelDelete(): void {
    this.showDeleteModal = false;
  }

  goBack(): void {
    this.router.navigate(['/settings/ecclesiastical/dioceses']);
  }

  viewBishop(bishopId: string): void {
    this.router.navigate(['/settings/ecclesiastical/bishops', bishopId]);
  }

  formatDate(date: string | null): string {
    if (!date) return 'N/A';
    return new Date(date).toLocaleDateString('en-US', {
      year: 'numeric',
      month: 'long',
      day: 'numeric'
    });
  }

  getStatusBadgeClass(active: boolean): string {
    return active ? 'badge-success' : 'badge-inactive';
  }

  getTypeBadge(isArchdiocese: boolean): string {
    return isArchdiocese ? 'Archdiocese' : 'Diocese';
  }
}

