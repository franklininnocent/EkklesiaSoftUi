import {
  ChangeDetectionStrategy,
  ChangeDetectorRef,
  Component,
  OnDestroy,
  OnInit,
  inject,
} from '@angular/core';
import { CommonModule } from '@angular/common';
import { ActivatedRoute, Router } from '@angular/router';
import { Subject, finalize, takeUntil } from 'rxjs';

import { PageHeaderComponent } from '@shared/components/page-header/page-header.component';
import { ListToolbarComponent } from '@shared/components/list-toolbar/list-toolbar.component';
import {
  AdvancedSearchPanelComponent,
  SearchField,
} from '@shared/components/advanced-search-panel/advanced-search-panel.component';
import { DataTableComponent } from '@shared/components/data-table/data-table.component';
import { CfEmptyStateComponent } from '@shared/components/cf-empty-state/cf-empty-state.component';
import { LoadingSkeletonComponent } from '@shared/components/loading-skeleton/loading-skeleton.component';
import {
  ConfirmationModalComponent,
  ConfirmationResult,
} from '@shared/components/confirmation-modal/confirmation-modal.component';
import { StatusBadgeComponent, StatusBadgeTone } from '@shared/components/status-badge/status-badge.component';
import { ModalShellComponent } from '@shared/components';
import { AuthService } from '@core/services/auth.service';
import {
  PasswordRecoveryRequestItem,
  PasswordRecoveryService,
} from '@core/services/password-recovery.service';

type ConfirmAction = 'approve' | 'reject' | 'retry';

const REQUEST_ID_PATTERN =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

const STATUS_OPTIONS: Array<{ value: string; label: string }> = [
  { value: 'pending_approval', label: 'Pending approval' },
  { value: 'processing', label: 'Processing' },
  { value: 'completed', label: 'Completed' },
  { value: 'rejected', label: 'Rejected' },
  { value: 'expired', label: 'Expired' },
  { value: 'failed', label: 'Failed' },
  { value: 'delivery_failed', label: 'Delivery failed' },
];

@Component({
  selector: 'app-forgot-password-requests-page',
  standalone: true,
  imports: [
    CommonModule,
    PageHeaderComponent,
    ListToolbarComponent,
    AdvancedSearchPanelComponent,
    DataTableComponent,
    CfEmptyStateComponent,
    LoadingSkeletonComponent,
    ConfirmationModalComponent,
    StatusBadgeComponent,
    ModalShellComponent,
  ],
  templateUrl: './forgot-password-requests.page.html',
  styleUrl: './forgot-password-requests.page.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class ForgotPasswordRequestsPage implements OnInit, OnDestroy {
  private readonly recoveryApi = inject(PasswordRecoveryService);
  private readonly auth = inject(AuthService);
  private readonly cdr = inject(ChangeDetectorRef);
  private readonly route = inject(ActivatedRoute);
  private readonly router = inject(Router);
  private readonly destroy$ = new Subject<void>();
  private deepLinkHandled = false;

  get canView(): boolean {
    return this.auth.canViewPasswordRecoveryRequests();
  }

  get canProcess(): boolean {
    return this.auth.canProcessPasswordRecoveryRequests();
  }

  get hasActiveFilters(): boolean {
    return !!(this.emailSearch.trim() || this.statusFilter);
  }

  get drawerFilterCount(): number {
    return this.statusFilter ? 1 : 0;
  }

  emailSearch = '';
  statusFilter = '';
  showFilters = false;
  searchFields: SearchField[] = [];

  rows: PasswordRecoveryRequestItem[] = [];
  loading = false;
  loaded = false;
  processing = false;
  error: string | null = null;
  success: string | null = null;

  detailOpen = false;
  selected: PasswordRecoveryRequestItem | null = null;
  detailLoading = false;

  confirmOpen = false;
  confirmAction: ConfirmAction | null = null;
  pendingRequest: PasswordRecoveryRequestItem | null = null;

  ngOnInit(): void {
    this.initSearchFields();
    if (this.canView) {
      this.reload();
      this.openDeepLinkedRequest();
    }
  }

  ngOnDestroy(): void {
    this.destroy$.next();
    this.destroy$.complete();
  }

  onSearchChange(value: string): void {
    this.emailSearch = value;
    this.reload();
  }

  onAdvancedSearch(values: { [key: string]: unknown }): void {
    this.statusFilter = String(values['status'] ?? '').trim();
    this.syncSearchFieldValues();
    this.showFilters = false;
    this.reload();
  }

  onClearAdvancedSearch(): void {
    this.statusFilter = '';
    this.searchFields.forEach((field) => {
      field.value = undefined;
    });
    this.reload();
    this.cdr.markForCheck();
  }

  reload(): void {
    this.loading = true;
    this.error = null;

    this.recoveryApi
      .listRequests({
        status: this.statusFilter || undefined,
        email: this.emailSearch.trim() || undefined,
        per_page: 50,
      })
      .pipe(
        finalize(() => {
          this.loading = false;
          this.loaded = true;
          this.cdr.markForCheck();
        }),
        takeUntil(this.destroy$)
      )
      .subscribe({
        next: (response) => {
          this.rows = response.data ?? [];
        },
        error: () => {
          this.error = 'Unable to load password recovery requests.';
        },
      });
  }

  openDetail(row: PasswordRecoveryRequestItem): void {
    this.openDetailById(row.id, row);
  }

  closeDetail(): void {
    this.detailOpen = false;
    this.selected = null;
    this.cdr.markForCheck();
  }

  requestApprove(row: PasswordRecoveryRequestItem): void {
    this.pendingRequest = row;
    this.confirmAction = 'approve';
    this.confirmOpen = true;
    this.cdr.markForCheck();
  }

  requestReject(row: PasswordRecoveryRequestItem): void {
    this.pendingRequest = row;
    this.confirmAction = 'reject';
    this.confirmOpen = true;
    this.cdr.markForCheck();
  }

  requestRetry(row: PasswordRecoveryRequestItem): void {
    this.pendingRequest = row;
    this.confirmAction = 'retry';
    this.confirmOpen = true;
    this.cdr.markForCheck();
  }

  get confirmTitle(): string {
    switch (this.confirmAction) {
      case 'approve':
        return 'Approve password recovery?';
      case 'reject':
        return 'Reject password recovery?';
      case 'retry':
        return 'Resend temporary password?';
      default:
        return 'Confirm action';
    }
  }

  get confirmMessage(): string {
    const email = this.pendingRequest?.requester_email ?? 'this user';
    switch (this.confirmAction) {
      case 'approve':
        return `A temporary password will be emailed to ${email}. They must change it after signing in.`;
      case 'reject':
        return `Reject the password recovery request for ${email}?`;
      case 'retry':
        return `Send another temporary password email to ${email}?`;
      default:
        return '';
    }
  }

  get confirmText(): string {
    switch (this.confirmAction) {
      case 'approve':
        return 'Approve';
      case 'reject':
        return 'Reject';
      case 'retry':
        return 'Resend email';
      default:
        return 'Confirm';
    }
  }

  onConfirm(result: ConfirmationResult): void {
    this.confirmOpen = false;
    const row = this.pendingRequest;
    const action = this.confirmAction;
    this.pendingRequest = null;
    this.confirmAction = null;

    if (!result.confirmed || !row || !action || !this.canProcess) {
      this.cdr.markForCheck();
      return;
    }

    this.processing = true;
    this.error = null;
    this.success = null;
    this.cdr.markForCheck();

    const request$ =
      action === 'approve'
        ? this.recoveryApi.approveRequest(row.id)
        : action === 'reject'
          ? this.recoveryApi.rejectRequest(row.id)
          : this.recoveryApi.retryDelivery(row.id);

    request$
      .pipe(
        finalize(() => {
          this.processing = false;
          this.cdr.markForCheck();
        }),
        takeUntil(this.destroy$)
      )
      .subscribe({
        next: (response) => {
          this.success = response.message;
          if (this.detailOpen && this.selected?.id === row.id) {
            this.closeDetail();
          }
          this.reload();
        },
        error: (err) => {
          this.error = err.error?.message || 'Unable to process this request.';
        },
      });
  }

  statusLabel(status: string): string {
    return status.replace(/_/g, ' ');
  }

  statusTone(status: string): StatusBadgeTone {
    switch (status) {
      case 'completed':
        return 'success';
      case 'pending_approval':
        return 'warning';
      case 'processing':
        return 'info';
      case 'rejected':
      case 'failed':
      case 'delivery_failed':
        return 'critical';
      case 'expired':
        return 'neutral';
      default:
        return 'neutral';
    }
  }

  classificationLabel(value: string): string {
    return value.replace(/_/g, ' ');
  }

  private initSearchFields(): void {
    this.searchFields = [
      {
        key: 'status',
        label: 'Status',
        type: 'select',
        options: STATUS_OPTIONS,
        value: this.statusFilter || undefined,
      },
    ];
  }

  private syncSearchFieldValues(): void {
    const statusField = this.searchFields.find((field) => field.key === 'status');
    if (statusField) {
      statusField.value = this.statusFilter || undefined;
    }
  }

  private openDeepLinkedRequest(): void {
    if (this.deepLinkHandled) {
      return;
    }

    const requestId = String(this.route.snapshot.queryParamMap.get('request') ?? '').trim();
    if (!REQUEST_ID_PATTERN.test(requestId)) {
      return;
    }

    this.deepLinkHandled = true;
    this.openDetailById(requestId);
    void this.router.navigate([], {
      relativeTo: this.route,
      queryParams: { request: null },
      queryParamsHandling: 'merge',
      replaceUrl: true,
    });
  }

  private openDetailById(requestId: string, fallback?: PasswordRecoveryRequestItem): void {
    this.detailOpen = true;
    this.selected = fallback ?? ({ id: requestId } as PasswordRecoveryRequestItem);
    this.detailLoading = true;
    this.cdr.markForCheck();

    this.recoveryApi
      .getRequest(requestId)
      .pipe(
        finalize(() => {
          this.detailLoading = false;
          this.cdr.markForCheck();
        }),
        takeUntil(this.destroy$)
      )
      .subscribe({
        next: (response) => {
          this.selected = response.data;
        },
        error: () => {
          this.error = 'Unable to load request details.';
          this.closeDetail();
        },
      });
  }
}
