import { ChangeDetectionStrategy, ChangeDetectorRef, Component, OnDestroy, OnInit, inject } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { RouterModule } from '@angular/router';
import { Subject, takeUntil } from 'rxjs';
import { AuthService } from '@core/services/auth.service';
import { ConfirmationDialogService } from '@core/services/confirmation-dialog.service';
import { ToastService } from '@core/services/toast.service';
import { CfEmptyStateComponent } from '@shared/components/cf-empty-state/cf-empty-state.component';
import { LoadingSkeletonComponent } from '@shared/components/loading-skeleton/loading-skeleton.component';
import { StatusBadgeComponent, StatusBadgeTone } from '@shared/components/status-badge/status-badge.component';
import { PageMeta, UpgradeRequestFilter } from '../../models/subscription-admin.models';
import { UpgradeRequest, UpgradeRequestStatus } from '../../models/tenant-subscription.models';
import {
  SubscriptionAdminService,
  subscriptionErrorCode,
  subscriptionErrorMessage,
} from '../../services/subscription-admin.service';
import { subscriptionAdminCapabilities } from '../../services/subscription-admin-access';
import { CfDatePipe } from '@shared/pipes/cf-date.pipe';

type ReviewAction = 'approve' | 'reject' | 'info';

const PER_PAGE = 25;

/** Ekklesia review queue for plan requests sent by churches. Approval changes the plan server-side. */
@Component({
  selector: 'app-upgrade-requests-page',
  standalone: true,
  imports: [
    CfDatePipe,CommonModule, FormsModule, RouterModule, CfEmptyStateComponent, LoadingSkeletonComponent, StatusBadgeComponent],
  templateUrl: './upgrade-requests.page.html',
  styleUrls: ['../../styles/subscription-admin.scss'],
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class UpgradeRequestsPage implements OnInit, OnDestroy {
  private readonly api = inject(SubscriptionAdminService);
  private readonly auth = inject(AuthService);
  private readonly dialog = inject(ConfirmationDialogService);
  private readonly toast = inject(ToastService);
  private readonly cdr = inject(ChangeDetectorRef);
  private readonly destroy$ = new Subject<void>();
  private readonly reload$ = new Subject<void>();

  readonly can = subscriptionAdminCapabilities(this.auth);
  readonly filters: { value: UpgradeRequestFilter; label: string }[] = [
    { value: 'OPEN', label: 'Needs a decision' },
    { value: 'PENDING', label: 'Waiting for review' },
    { value: 'INFO_REQUESTED', label: 'Waiting for the church' },
    { value: 'APPROVED', label: 'Approved' },
    { value: 'REJECTED', label: 'Declined' },
    { value: 'ALL', label: 'Everything' },
  ];

  requests: UpgradeRequest[] = [];
  meta: (PageMeta & { open_count: number }) | null = null;
  status: UpgradeRequestFilter = 'OPEN';
  page = 1;
  loading = false;
  error: string | null = null;

  activeId: number | null = null;
  action: ReviewAction | null = null;
  note = '';
  busy = false;

  ngOnInit(): void {
    if (this.can.requests) this.load();
  }

  ngOnDestroy(): void {
    this.reload$.next();
    this.destroy$.next();
    this.destroy$.complete();
  }

  applyFilter(): void {
    this.page = 1;
    this.load();
  }

  goTo(page: number): void {
    if (!this.meta || page < 1 || page > this.meta.last_page) return;
    this.page = page;
    this.load();
  }

  isOpen(request: UpgradeRequest): boolean {
    return request.status === 'PENDING' || request.status === 'INFO_REQUESTED';
  }

  /** Approving changes the plan, which also needs the tenant-management permission on the API. */
  canApprove(request: UpgradeRequest): boolean {
    return request.status === 'PENDING' && this.can.tenants;
  }

  statusLabel(status: UpgradeRequestStatus): string {
    switch (status) {
      case 'PENDING':
        return 'Waiting for review';
      case 'INFO_REQUESTED':
        return 'Waiting for the church';
      case 'APPROVED':
        return 'Approved';
      case 'REJECTED':
        return 'Declined';
      default:
        return 'Cancelled';
    }
  }

  statusTone(status: UpgradeRequestStatus): StatusBadgeTone {
    switch (status) {
      case 'APPROVED':
        return 'success';
      case 'PENDING':
        return 'warning';
      case 'REJECTED':
        return 'critical';
      default:
        return 'neutral';
    }
  }

  intervalLabel(interval: string | null): string {
    return interval === 'MONTHLY' ? 'Monthly' : interval === 'ANNUAL' ? 'Yearly' : interval === 'CUSTOM' ? 'Custom' : 'Not specified';
  }

  start(request: UpgradeRequest, action: ReviewAction): void {
    this.activeId = request.id;
    this.action = action;
    this.note = '';
    this.cdr.markForCheck();
  }

  cancel(): void {
    this.activeId = null;
    this.action = null;
    this.note = '';
    this.cdr.markForCheck();
  }

  get noteRequired(): boolean {
    return this.action === 'reject' || this.action === 'info';
  }

  get noteValid(): boolean {
    return !this.noteRequired || this.note.trim().length >= 3;
  }

  submit(request: UpgradeRequest): void {
    if (!this.action || this.busy || !this.noteValid) return;
    if (this.action === 'approve') {
      this.approve(request, false);
      return;
    }
    const note = this.note.trim();
    const call =
      this.action === 'reject' ? this.api.rejectUpgradeRequest(request.id, note) : this.api.requestUpgradeInfo(request.id, note);
    const done = this.action === 'reject' ? 'Request declined. The church has been told.' : 'Asked the church for more information.';
    this.run(call, done);
  }

  private approve(request: UpgradeRequest, confirmImpact: boolean): void {
    this.busy = true;
    this.cdr.markForCheck();
    this.api
      .approveUpgradeRequest(request.id, { note: this.note.trim() || null, confirm_impact: confirmImpact })
      .pipe(takeUntil(this.destroy$))
      .subscribe({
        next: () => this.finish(`${request.tenant?.name ?? 'The church'} is now on ${request.requested_plan?.name ?? 'the new plan'}.`),
        error: (err) => {
          this.busy = false;
          this.cdr.markForCheck();
          if (subscriptionErrorCode(err) === 'PLAN_CHANGE_REQUIRES_CONFIRMATION' && !confirmImpact) {
            this.dialog
              .confirm({
                title: 'Check before approving',
                message: `${subscriptionErrorMessage(err, 'This church uses more than the new plan allows.')} Nothing will be deleted; the church keeps its records.`,
                confirmText: 'Approve anyway',
                variant: 'primary',
              })
              .pipe(takeUntil(this.destroy$))
              .subscribe(({ confirmed }) => {
                if (confirmed) this.approve(request, true);
              });
            return;
          }
          this.toast.error(subscriptionErrorMessage(err, 'Unable to approve this request.'), 'Not approved');
        },
      });
  }

  private run(call: ReturnType<SubscriptionAdminService['rejectUpgradeRequest']>, done: string): void {
    this.busy = true;
    this.cdr.markForCheck();
    call.pipe(takeUntil(this.destroy$)).subscribe({
      next: () => this.finish(done),
      error: (err) => {
        this.busy = false;
        this.toast.error(subscriptionErrorMessage(err, 'Unable to update this request.'), 'Not saved');
        this.cdr.markForCheck();
      },
    });
  }

  private finish(message: string): void {
    this.busy = false;
    this.toast.success(message, 'Saved');
    this.cancel();
    this.load();
  }

  load(): void {
    this.reload$.next();
    this.loading = true;
    this.error = null;
    this.cdr.markForCheck();
    this.api
      .upgradeRequests({ status: this.status, page: this.page, perPage: PER_PAGE })
      .pipe(takeUntil(this.reload$), takeUntil(this.destroy$))
      .subscribe({
        next: (res) => {
          this.requests = res.data;
          this.meta = res.meta;
          this.loading = false;
          this.cdr.markForCheck();
        },
        error: (err) => {
          this.error = subscriptionErrorMessage(err, 'Unable to load plan requests.');
          this.loading = false;
          this.cdr.markForCheck();
        },
      });
  }

  trackById(_index: number, request: UpgradeRequest): number {
    return request.id;
  }
}
