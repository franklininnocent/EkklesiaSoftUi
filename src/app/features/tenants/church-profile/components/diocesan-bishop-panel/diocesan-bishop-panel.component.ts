import { CommonModule } from '@angular/common';
import {
  ChangeDetectionStrategy,
  ChangeDetectorRef,
  Component,
  OnInit,
  inject,
} from '@angular/core';
import { HttpErrorResponse } from '@angular/common/http';
import { AuthService } from '@core/services/auth.service';
import { ChurchBishopUpdateService, ChurchProfileService } from '@core/services/church';
import { ToastService } from '@core/services';
import {
  BishopUpdateRequestItem,
  BishopUpdateRequestStatus,
  BishopUpdateRequestType,
  DiocesanAppointmentSummary,
  DiocesanLeadership,
} from '@core/models/ecclesiastical';
import { CfEmptyStateComponent } from '@shared/components/cf-empty-state/cf-empty-state.component';
import { LoadingSkeletonComponent } from '@shared/components/loading-skeleton/loading-skeleton.component';
import { ModalShellComponent } from '@shared/components/modal-shell/modal-shell.component';
import { BishopReportUpdateWizardComponent } from '../bishop-report-update-wizard/bishop-report-update-wizard.component';
import { BishopAvatarComponent } from '@shared/components/bishop-avatar/bishop-avatar.component';

@Component({
  selector: 'app-diocesan-bishop-panel',
  standalone: true,
  imports: [
    CommonModule,
    CfEmptyStateComponent,
    LoadingSkeletonComponent,
    ModalShellComponent,
    BishopReportUpdateWizardComponent,
    BishopAvatarComponent,
  ],
  templateUrl: './diocesan-bishop-panel.component.html',
  styleUrl: './diocesan-bishop-panel.component.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class DiocesanBishopPanelComponent implements OnInit {
  private readonly api = inject(ChurchBishopUpdateService);
  private readonly churchProfileService = inject(ChurchProfileService);
  private readonly auth = inject(AuthService);
  private readonly toast = inject(ToastService);
  private readonly cdr = inject(ChangeDetectorRef);

  leadership: DiocesanLeadership | null = null;
  requests: BishopUpdateRequestItem[] = [];
  loadingLeadership = false;
  loadingRequests = false;
  leadershipError: string | null = null;
  noDioceseLinked = false;
  requestsError: string | null = null;
  showWizard = false;
  editingRequest: BishopUpdateRequestItem | null = null;
  wizardInitialType: BishopUpdateRequestType | null = null;
  selectedRequest: BishopUpdateRequestItem | null = null;
  detailLoading = false;

  canViewLeadership = false;
  canSubmitUpdate = false;
  canViewRequests = false;

  ngOnInit(): void {
    this.canViewLeadership = this.auth.hasTenantPermission('bishops.view')
      || this.auth.hasTenantPermission('bishops.submit_update_request')
      || this.auth.hasTenantPermission('bishops.view_own_requests');
    this.canSubmitUpdate = this.auth.hasTenantPermission('bishops.submit_update_request');
    this.canViewRequests = this.auth.hasTenantPermission('bishops.view_own_requests');

    if (this.canViewLeadership) {
      this.loadLeadership();
    }
    if (this.canViewRequests) {
      this.loadRequests();
    }
  }

  loadLeadership(): void {
    this.loadingLeadership = true;
    this.leadershipError = null;
    this.noDioceseLinked = false;
    this.churchProfileService.getDiocesanLeadership().subscribe({
      next: (response) => {
        this.leadership = response.data ?? null;
        this.loadingLeadership = false;
        this.cdr.markForCheck();
      },
      error: (err: HttpErrorResponse) => {
        const message = this.readApiMessage(err, 'Could not load diocesan bishop information.');
        if (this.isNoDioceseError(message)) {
          this.noDioceseLinked = true;
          this.leadership = null;
        } else {
          this.leadershipError = message;
        }
        this.loadingLeadership = false;
        this.cdr.markForCheck();
      },
    });
  }

  loadRequests(): void {
    this.loadingRequests = true;
    this.requestsError = null;
    this.api.list({ per_page: 20 }).subscribe({
      next: (response) => {
        this.requests = response.data?.data ?? [];
        this.loadingRequests = false;
        this.cdr.markForCheck();
      },
      error: (err: HttpErrorResponse) => {
        this.requestsError = this.readApiMessage(err, 'Could not load your bishop suggestions.');
        this.loadingRequests = false;
        this.cdr.markForCheck();
      },
    });
  }

  openSuggestionWizard(): void {
    if (!this.leadership || !this.canSubmitUpdate) {
      return;
    }
    this.editingRequest = null;
    this.wizardInitialType = null;
    this.showWizard = true;
    this.cdr.markForCheck();
  }

  openEditWizard(request: BishopUpdateRequestItem): void {
    if (!this.leadership || !request.is_editable || !this.canSubmitUpdate) {
      return;
    }
    this.closeDetail();
    this.editingRequest = request;
    this.wizardInitialType = request.request_type === 'change_current_bishop'
      ? 'change_current_bishop'
      : null;
    this.showWizard = true;
    this.cdr.markForCheck();
  }

  onWizardCompleted(): void {
    this.showWizard = false;
    this.editingRequest = null;
    this.wizardInitialType = null;
    this.loadRequests();
    this.loadLeadership();
    this.cdr.markForCheck();
  }

  onWizardCancel(): void {
    this.showWizard = false;
    this.editingRequest = null;
    this.wizardInitialType = null;
    this.cdr.markForCheck();
  }

  openDetail(request: BishopUpdateRequestItem): void {
    this.selectedRequest = request;
    this.detailLoading = true;
    this.cdr.markForCheck();

    this.api.get(request.id).subscribe({
      next: (response) => {
        this.selectedRequest = response.data ?? request;
        this.detailLoading = false;
        this.cdr.markForCheck();
      },
      error: () => {
        this.selectedRequest = request;
        this.detailLoading = false;
        this.cdr.markForCheck();
      },
    });
  }

  closeDetail(): void {
    this.selectedRequest = null;
    this.detailLoading = false;
    this.cdr.markForCheck();
  }

  auxiliaryAppointments(): DiocesanAppointmentSummary[] {
    if (!this.leadership?.current_appointments?.length) {
      return [];
    }
    return this.leadership.current_appointments.filter(
      (item) => item.canonical_role && !['archbishop', 'diocesan_bishop'].includes(item.canonical_role)
    );
  }

  isVacant(): boolean {
    return this.leadership?.leadership_state === 'vacant' || !this.leadership?.ordinary;
  }

  statusLabel(): string {
    switch (this.leadership?.leadership_state) {
      case 'vacant':
        return 'Seat vacant';
      case 'administrator':
        return 'Diocesan administrator';
      case 'active':
        return 'In office';
      default:
        return this.isVacant() ? 'Seat vacant' : 'In office';
    }
  }

  statusTone(): 'success' | 'warning' | 'neutral' {
    if (this.leadership?.leadership_state === 'vacant' || this.isVacant()) {
      return 'warning';
    }
    if (this.leadership?.leadership_state === 'active' && this.leadership?.ordinary) {
      return 'success';
    }
    return 'neutral';
  }

  ordinaryDisplayTitle(ordinary: DiocesanAppointmentSummary): string {
    if (ordinary.title) {
      return ordinary.title;
    }
    return 'Diocesan Bishop';
  }

  formatRole(role?: string): string {
    if (!role) {
      return 'Bishop';
    }
    return role.replace(/_/g, ' ');
  }

  formatStatus(status: BishopUpdateRequestStatus): string {
    const labels: Record<BishopUpdateRequestStatus, string> = {
      draft: 'Pending',
      submitted: 'Pending',
      under_review: 'Under review',
      changes_requested: 'Needs changes',
      approved: 'Approved',
      applied: 'Approved',
      rejected: 'Rejected',
    };
    return labels[status] ?? status;
  }

  formatType(type: string): string {
    const labels: Record<string, string> = {
      change_current_bishop: 'New bishop appointment',
      create_bishop: 'New bishop appointment',
      correct_information: 'Correct information',
      update_image: 'Update photo',
      add_auxiliary: 'Auxiliary bishop',
      add_coadjutor: 'Coadjutor bishop',
      update_bishop: 'Update bishop record',
      update_appointment: 'Update appointment',
    };
    return labels[type] ?? type.replace(/_/g, ' ');
  }

  statusToneForRequest(status: BishopUpdateRequestStatus): string {
    switch (status) {
      case 'applied':
      case 'approved':
        return 'success';
      case 'rejected':
        return 'danger';
      case 'changes_requested':
        return 'warning';
      case 'under_review':
        return 'info';
      default:
        return 'neutral';
    }
  }

  proposedBishopName(item: BishopUpdateRequestItem): string {
    const name = item.proposed_bishop_data?.['full_name'];
    return typeof name === 'string' && name.trim() ? name.trim() : '—';
  }

  submitterName(item: BishopUpdateRequestItem): string {
    return item.submitted_by_user?.name ?? '—';
  }

  reviewerSummary(item: BishopUpdateRequestItem): string {
    if (!item.reviewed_at) {
      return '—';
    }
    const reviewer = item.reviewer?.name ?? 'Ekklesia Admin';
    return `${reviewer} · ${new Date(item.reviewed_at).toLocaleDateString('en-GB', {
      day: 'numeric',
      month: 'short',
      year: 'numeric',
    })}`;
  }

  submissionDate(item: BishopUpdateRequestItem): string | null {
    return item.submitted_at ?? item.reviewed_at ?? null;
  }

  private isNoDioceseError(message: string): boolean {
    const normalized = message.toLowerCase();
    return normalized.includes('linked to a diocese') || normalized.includes('archdiocese');
  }

  private readApiMessage(err: HttpErrorResponse, fallback: string): string {
    const apiMessage = err.error?.message;
    if (typeof apiMessage === 'string' && apiMessage.trim()) {
      return apiMessage.trim();
    }
    return fallback;
  }
}
