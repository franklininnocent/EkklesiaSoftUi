import { Component, OnInit, ChangeDetectionStrategy } from '@angular/core';
import { CommonModule } from '@angular/common';
import { ActivatedRoute, Router, RouterModule } from '@angular/router';
import { DioceseService } from '@core/services/ecclesiastical';
import {
  BishopAppointment,
  Diocese,
  DiocesanAppointmentSummary,
  DiocesanLeadership,
} from '@core/models/ecclesiastical';
import { AuthService, ToastService } from '@core/services';
import { LoadingSkeletonComponent } from '@shared/components/loading-skeleton/loading-skeleton.component';
import { EmptyStateComponent } from '@shared/components/empty-state/empty-state.component';
import { ConfirmationModalComponent } from '@shared/components/confirmation-modal/confirmation-modal.component';
import { PageHeaderComponent } from '@shared/components/page-header/page-header.component';
import { AppointSuccessorModalComponent } from '../appoint-successor-modal/appoint-successor-modal.component';
import { BishopAvatarComponent } from '@shared/components/bishop-avatar/bishop-avatar.component';

@Component({
  selector: 'app-diocese-detail',
  standalone: true,
  imports: [
    CommonModule,
    RouterModule,
    LoadingSkeletonComponent,
    EmptyStateComponent,
    ConfirmationModalComponent,
    PageHeaderComponent,
    BishopAvatarComponent,
    AppointSuccessorModalComponent,
  ],
  templateUrl: './diocese-detail.component.html',
  changeDetection: ChangeDetectionStrategy.Eager,
  styleUrl: './diocese-detail.component.scss'
})
export class DioceseDetailComponent implements OnInit {
  diocese: Diocese | null = null;
  leadership: DiocesanLeadership | null = null;
  appointmentHistory: BishopAppointment[] = [];
  loading = true;
  loadingLeadership = true;
  showDeleteModal = false;
  showSuccessorModal = false;
  canManageAppointments = false;

  get dioceseHeaderSubtitle(): string | undefined {
    if (!this.diocese) return undefined;
    const type = this.getTypeBadge(this.diocese.is_archdiocese);
    return this.diocese.code ? `${type} · ${this.diocese.code}` : type;
  }

  get currentOrdinary(): DiocesanAppointmentSummary | null {
    return this.leadership?.ordinary ?? null;
  }

  constructor(
    private route: ActivatedRoute,
    private router: Router,
    private dioceseService: DioceseService,
    private authService: AuthService,
    private toastService: ToastService
  ) {}

  ngOnInit(): void {
    this.canManageAppointments = this.authService.hasEcclesiasticalPermission('bishops.manage_appointments');
    const id = this.route.snapshot.paramMap.get('id');
    if (id) {
      this.loadDiocese(id);
      this.loadLeadership(id);
      this.loadAppointmentHistory(id);
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

  loadLeadership(dioceseId: string): void {
    this.loadingLeadership = true;
    const numericId = parseInt(dioceseId, 10);
    this.dioceseService.getLeadership(numericId).subscribe({
      next: (response) => {
        this.leadership = response.data ?? null;
        this.loadingLeadership = false;
      },
      error: (error) => {
        console.error('Error loading diocese leadership:', error);
        this.leadership = null;
        this.loadingLeadership = false;
      }
    });
  }

  openSuccessorModal(): void {
    this.showSuccessorModal = true;
  }

  onSuccessorAppointed(): void {
    const id = this.route.snapshot.paramMap.get('id');
    if (!id) {
      return;
    }
    this.showSuccessorModal = false;
    this.loadLeadership(id);
    this.loadAppointmentHistory(id);
  }

  onSuccessorCancelled(): void {
    this.showSuccessorModal = false;
  }

  loadAppointmentHistory(dioceseId: string): void {
    const numericId = parseInt(dioceseId, 10);
    this.dioceseService.getLeadershipHistory(numericId, { per_page: 50 }).subscribe({
      next: (response) => {
        this.appointmentHistory = response.data?.data ?? [];
      },
      error: (error) => {
        console.error('Error loading bishop history:', error);
        this.appointmentHistory = [];
      }
    });
  }

  isVacant(): boolean {
    return this.leadership?.leadership_state === 'vacant' || !this.currentOrdinary;
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

  viewBishop(bishopId: number | string): void {
    this.router.navigate(['/settings/ecclesiastical/bishops', bishopId]);
  }

  formatDate(date: string | null | undefined): string {
    if (!date) return 'N/A';
    return new Date(date).toLocaleDateString('en-US', {
      year: 'numeric',
      month: 'long',
      day: 'numeric'
    });
  }

  formatTenure(appointment: BishopAppointment): string {
    const start = appointment.effective_date || appointment.appointed_date;
    const end = appointment.ended_date;
    const startLabel = start ? this.formatDate(start) : 'Unknown';
    const endLabel = end ? this.formatDate(end) : (appointment.is_current ? 'Present' : '—');
    return `${startLabel} – ${endLabel}`;
  }

  formatRole(role?: string): string {
    if (!role) return 'Bishop';
    return role.replace(/_/g, ' ').replace(/\b\w/g, (char) => char.toUpperCase());
  }

  formatAppointmentStatus(appointment: BishopAppointment): string {
    if (appointment.is_current) {
      return 'Current';
    }
    if (appointment.end_reason) {
      return appointment.end_reason.replace(/_/g, ' ').replace(/\b\w/g, (char) => char.toUpperCase());
    }
    return appointment.appointment_status?.replace(/_/g, ' ') ?? 'Historical';
  }

  getStatusBadgeClass(active: boolean): string {
    return active ? 'badge-success' : 'badge-inactive';
  }

  getTypeBadge(isArchdiocese: boolean): string {
    return isArchdiocese ? 'Archdiocese' : 'Diocese';
  }
}
