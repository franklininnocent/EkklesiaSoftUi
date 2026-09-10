import { CommonModule } from '@angular/common';
import {
  ChangeDetectionStrategy,
  ChangeDetectorRef,
  Component,
  OnInit,
  inject,
} from '@angular/core';
import { FormsModule } from '@angular/forms';
import { RouterModule } from '@angular/router';
import { AuthService } from '@core/services/auth.service';
import { BishopUpdateRequestService } from '@core/services/ecclesiastical';
import { ToastService } from '@core/services';
import {
  BishopUpdateRequestItem,
  BishopUpdateRequestReview,
  BishopUpdateRequestStatus,
} from '@core/models/ecclesiastical';
import { CfEmptyStateComponent } from '@shared/components/cf-empty-state/cf-empty-state.component';
import { LoadingSkeletonComponent } from '@shared/components/loading-skeleton/loading-skeleton.component';
import { PageHeaderComponent } from '@shared/components/page-header/page-header.component';
import { BishopAvatarComponent } from '@shared/components/bishop-avatar/bishop-avatar.component';

@Component({
  selector: 'app-bishop-update-queue',
  standalone: true,
  imports: [
    CommonModule,
    FormsModule,
    RouterModule,
    CfEmptyStateComponent,
    LoadingSkeletonComponent,
    PageHeaderComponent,
    BishopAvatarComponent,
  ],
  changeDetection: ChangeDetectionStrategy.OnPush,
  templateUrl: './bishop-update-queue.component.html',
  styleUrl: './bishop-update-queue.component.scss',
})
export class BishopUpdateQueueComponent implements OnInit {
  private readonly api = inject(BishopUpdateRequestService);
  readonly auth = inject(AuthService);
  private readonly toast = inject(ToastService);
  private readonly cdr = inject(ChangeDetectorRef);

  requests: BishopUpdateRequestItem[] = [];
  selected: BishopUpdateRequestReview | null = null;
  loading = false;
  detailLoading = false;
  saving = false;
  canReview = false;
  canApprove = false;
  canReject = false;
  canClarify = false;
  statusFilter: BishopUpdateRequestStatus | 'pending' | '' = 'pending';
  clarifyText = '';
  rejectReason = '';

  readonly statusOptions: { value: BishopUpdateRequestStatus | 'pending' | ''; label: string }[] = [
    { value: 'pending', label: 'Pending review' },
    { value: 'submitted', label: 'Submitted' },
    { value: 'under_review', label: 'Under review' },
    { value: 'changes_requested', label: 'Changes requested' },
    { value: 'applied', label: 'Approved' },
    { value: 'rejected', label: 'Rejected' },
    { value: '', label: 'All' },
  ];

  ngOnInit(): void {
    this.canReview = this.auth.hasEcclesiasticalPermission('bishops.review_requests');
    this.canApprove = this.auth.hasEcclesiasticalPermission('bishops.approve_requests');
    this.canReject = this.auth.hasEcclesiasticalPermission('bishops.reject_requests');
    this.canClarify = this.auth.hasEcclesiasticalPermission('bishops.request_clarification');
    if (this.canReview) {
      this.load();
    }
  }

  load(): void {
    this.loading = true;
    this.api.list({
      status: this.statusFilter || undefined,
      per_page: 50,
    }).subscribe({
      next: (res) => {
        this.requests = res.data?.data ?? [];
        this.loading = false;
        this.cdr.markForCheck();
      },
      error: () => {
        this.toast.error('Could not load bishop suggestions.');
        this.loading = false;
        this.cdr.markForCheck();
      },
    });
  }

  onFilterChange(): void {
    this.selected = null;
    this.load();
  }

  openReview(item: BishopUpdateRequestItem): void {
    this.detailLoading = true;
    this.selected = null;
    this.clarifyText = '';
    this.rejectReason = '';
    this.api.get(item.id).subscribe({
      next: (res) => {
        this.selected = res.data ?? null;
        this.detailLoading = false;
        if (this.selected?.request.status === 'submitted') {
          this.api.markUnderReview(item.id).subscribe({
            next: (marked) => {
              if (this.selected) {
                this.selected.request = marked.data ?? this.selected.request;
              }
              this.cdr.markForCheck();
            },
          });
        }
        this.cdr.markForCheck();
      },
      error: () => {
        this.toast.error('Could not load this suggestion.');
        this.detailLoading = false;
        this.cdr.markForCheck();
      },
    });
  }

  closeReview(): void {
    this.selected = null;
    this.cdr.markForCheck();
  }

  approve(): void {
    if (!this.selected || !this.canApprove) return;
    this.saving = true;
    this.api.approve(this.selected.request.id, this.selected.request.version).subscribe({
      next: () => {
        this.toast.success('Suggestion approved and applied');
        this.saving = false;
        this.selected = null;
        this.load();
        this.cdr.markForCheck();
      },
      error: () => {
        this.toast.error('Could not approve this suggestion.');
        this.saving = false;
        this.cdr.markForCheck();
      },
    });
  }

  reject(): void {
    if (!this.selected || !this.canReject || !this.rejectReason.trim()) return;
    this.saving = true;
    this.api.reject(this.selected.request.id, this.rejectReason.trim(), this.selected.request.version).subscribe({
      next: () => {
        this.toast.success('Suggestion rejected');
        this.saving = false;
        this.selected = null;
        this.load();
        this.cdr.markForCheck();
      },
      error: () => {
        this.toast.error('Could not reject this suggestion.');
        this.saving = false;
        this.cdr.markForCheck();
      },
    });
  }

  requestClarification(): void {
    if (!this.selected || !this.clarifyText.trim()) return;
    this.saving = true;
    this.api.requestClarification(this.selected.request.id, this.clarifyText.trim()).subscribe({
      next: () => {
        this.toast.success('Clarification requested');
        this.saving = false;
        this.selected = null;
        this.load();
        this.cdr.markForCheck();
      },
      error: () => {
        this.toast.error('Could not request clarification.');
        this.saving = false;
        this.cdr.markForCheck();
      },
    });
  }

  formatType(type: string): string {
    if (type === 'change_current_bishop' || type === 'create_bishop') {
      return 'New bishop';
    }
    return type.replace(/_/g, ' ');
  }

  proposedName(item: BishopUpdateRequestItem): string {
    const name = item.proposed_bishop_data?.['full_name'];
    return typeof name === 'string' && name.trim() ? name : '—';
  }

  formatStatus(status: string): string {
    if (status === 'submitted' || status === 'under_review' || status === 'draft') {
      return 'Pending';
    }
    if (status === 'applied' || status === 'approved') {
      return 'Approved';
    }
    if (status === 'changes_requested') {
      return 'Needs changes';
    }
    return status.replace(/_/g, ' ');
  }

  ordinaryName(): string | null {
    const ordinary = this.selected?.diff?.current_leadership?.['ordinary'] as { bishop_name?: string } | undefined;
    return ordinary?.bishop_name ?? this.currentValue('full_name');
  }

  currentValue(field: string): string | null {
    const value = this.selected?.diff?.current_bishop?.[field];
    return typeof value === 'string' && value.trim() ? value : null;
  }

  proposedValue(field: string): string | null {
    const value = this.selected?.diff?.proposed_bishop?.[field];
    return typeof value === 'string' && value.trim() ? value : null;
  }

  appointmentValue(field: string): string | null {
    const value = this.selected?.diff?.proposed_appointment?.[field];
    return typeof value === 'string' && value.trim() ? value : null;
  }

  proposedFields(): { label: string; value: string }[] {
    const labels: Record<string, string> = {
      full_name: 'Name',
      given_name: 'Given name',
      family_name: 'Family name',
      religious_name: 'Religious name',
      date_of_birth: 'Date of birth',
      ordained_priest_date: 'Ordained priest',
      ordained_bishop_date: 'Ordained bishop',
      email: 'Email',
      phone: 'Phone',
      education: 'Education',
      biography: 'Biography',
    };

    return Object.entries(labels)
      .map(([key, label]) => {
        const value = this.proposedValue(key);
        return value ? { label, value } : null;
      })
      .filter((item): item is { label: string; value: string } => item !== null);
  }

  duplicateIds(): number[] {
    return this.selected?.diff?.potential_duplicate_bishop_ids ?? [];
  }

  proposedPhotoUrl(): string | null {
    return this.selected?.diff?.proposed_photo_public_url
      || this.selected?.request.pending_photo_public_url
      || null;
  }

  currentPhotoUrl(): string | null {
    const url = this.selected?.diff?.current_bishop?.['photo_public_url'];
    return typeof url === 'string' && url.trim() ? url : null;
  }
}
