import { Component, OnInit, ChangeDetectionStrategy } from '@angular/core';
import { CommonModule } from '@angular/common';
import { ActivatedRoute, Router, RouterModule } from '@angular/router';
import { BishopService } from '@core/services/ecclesiastical';
import { Bishop } from '@core/models/ecclesiastical';
import { ToastService } from '@core/services';
import { LoadingSkeletonComponent } from '@shared/components/loading-skeleton/loading-skeleton.component';
import { ConfirmationModalComponent } from '@shared/components/confirmation-modal/confirmation-modal.component';

@Component({
  selector: 'app-bishop-detail',
  standalone: true,
  imports: [
    CommonModule,
    RouterModule,
    LoadingSkeletonComponent,
    ConfirmationModalComponent
  ],
  templateUrl: './bishop-detail.component.html',
  changeDetection: ChangeDetectionStrategy.Eager,
  styleUrl: './bishop-detail.component.scss'
})
export class BishopDetailComponent implements OnInit {
  bishop: Bishop | null = null;
  loading = true;
  showDeleteModal = false;

  constructor(
    private route: ActivatedRoute,
    private router: Router,
    private bishopService: BishopService,
    private toastService: ToastService
  ) {}

  ngOnInit(): void {
    const id = this.route.snapshot.paramMap.get('id');
    if (id) {
      this.loadBishop(id);
    }
  }

  loadBishop(id: string): void {
    this.loading = true;
    const numericId = parseInt(id, 10);
    this.bishopService.getBishop(numericId).subscribe({
      next: (response: any) => {
        this.bishop = response.data;
        this.loading = false;
      },
      error: (error: any) => {
        console.error('Error loading bishop:', error);
        this.toastService.error('Failed to load bishop details');
        this.loading = false;
        this.router.navigate(['/settings/ecclesiastical/bishops']);
      }
    });
  }

  onEdit(): void {
    if (this.bishop) {
      this.router.navigate(['/settings/ecclesiastical/bishops'], {
        queryParams: { edit: this.bishop.id }
      });
    }
  }

  onDelete(): void {
    this.showDeleteModal = true;
  }

  confirmDelete(): void {
    if (this.bishop) {
      this.bishopService.deleteBishop(this.bishop.id).subscribe({
        next: () => {
          this.toastService.success('Bishop deleted successfully');
          this.router.navigate(['/settings/ecclesiastical/bishops']);
        },
        error: (error) => {
          console.error('Error deleting bishop:', error);
          this.toastService.error('Failed to delete bishop');
          this.showDeleteModal = false;
        }
      });
    }
  }

  cancelDelete(): void {
    this.showDeleteModal = false;
  }

  goBack(): void {
    this.router.navigate(['/settings/ecclesiastical/bishops']);
  }

  viewDiocese(dioceseId: number | string): void {
    this.router.navigate(['/settings/ecclesiastical/dioceses', dioceseId.toString()]);
  }

  formatDate(date: string | null): string {
    if (!date) return 'N/A';
    return new Date(date).toLocaleDateString('en-US', {
      year: 'numeric',
      month: 'long',
      day: 'numeric'
    });
  }

  getStatusBadgeClass(status: string): string {
    const statusMap: { [key: string]: string } = {
      'active': 'badge-active',
      'retired': 'badge-retired',
      'deceased': 'badge-deceased',
      'inactive': 'badge-inactive'
    };
    return statusMap[status?.toLowerCase()] || 'badge-inactive';
  }

  getInitials(name: string): string {
    if (!name) return '??';
    const parts = name.split(' ');
    if (parts.length >= 2) {
      return (parts[0][0] + parts[parts.length - 1][0]).toUpperCase();
    }
    return name.substring(0, 2).toUpperCase();
  }

  calculateAge(birthDate: string | null): string {
    if (!birthDate) return 'N/A';
    const today = new Date();
    const birth = new Date(birthDate);
    let age = today.getFullYear() - birth.getFullYear();
    const monthDiff = today.getMonth() - birth.getMonth();
    if (monthDiff < 0 || (monthDiff === 0 && today.getDate() < birth.getDate())) {
      age--;
    }
    return `${age} years`;
  }

  calculateYearsOfService(ordinationDate: string | null): string {
    if (!ordinationDate) return 'N/A';
    const today = new Date();
    const ordination = new Date(ordinationDate);
    const years = today.getFullYear() - ordination.getFullYear();
    return `${years} years`;
  }
}

