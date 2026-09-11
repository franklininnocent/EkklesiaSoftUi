import {
  ChangeDetectionStrategy,
  ChangeDetectorRef,
  Component,
  EventEmitter,
  Input,
  OnChanges,
  OnDestroy,
  Output,
  SimpleChanges,
  inject,
  signal,
} from '@angular/core';
import { CommonModule } from '@angular/common';
import { HttpErrorResponse } from '@angular/common/http';
import { Subject, finalize, takeUntil } from 'rxjs';
import { ModalShellComponent } from '@shared/components/modal-shell/modal-shell.component';
import { DataTableComponent } from '@shared/components/data-table/data-table.component';
import { LoadingSkeletonComponent } from '@shared/components/loading-skeleton/loading-skeleton.component';
import { StatusBadgeComponent } from '@shared/components/status-badge/status-badge.component';
import { CfEmptyStateComponent } from '@shared/components/cf-empty-state/cf-empty-state.component';
import {
  ConfirmationModalComponent,
  ConfirmationResult,
} from '@shared/components/confirmation-modal/confirmation-modal.component';
import { AuthService } from '@core/services/auth.service';
import { ToastService } from '@core/services/toast.service';
import { ApplicationAccessApiService } from '../../services/application-access-api.service';
import { ApplicationAccessEvent, ApplicationAccessSession } from '../../models/application-access.model';
import {
  authorizationResultLabel,
  authorizationResultTone,
  contextLabel,
  identityLabel,
  riskTone,
  sessionStatusLabel,
  sessionStatusTone,
} from '../../utils/application-access-labels.util';
import { summarizeTimelineEvents } from '../../utils/application-access-timeline.util';

type PendingAction =
  | { type: 'revoke'; session: ApplicationAccessSession }
  | { type: 'block'; session: ApplicationAccessSession };

@Component({
  selector: 'app-application-access-investigation-modal',
  standalone: true,
  imports: [
    CommonModule,
    ModalShellComponent,
    DataTableComponent,
    LoadingSkeletonComponent,
    StatusBadgeComponent,
    CfEmptyStateComponent,
    ConfirmationModalComponent,
  ],
  templateUrl: './application-access-investigation-modal.component.html',
  styleUrl: './application-access-investigation-modal.component.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class ApplicationAccessInvestigationModalComponent implements OnChanges, OnDestroy {
  private readonly api = inject(ApplicationAccessApiService);
  private readonly auth = inject(AuthService);
  private readonly toast = inject(ToastService);
  private readonly cdr = inject(ChangeDetectorRef);
  private readonly destroy$ = new Subject<void>();

  @Input({ required: true }) sessionId!: string;
  @Output() closed = new EventEmitter<void>();
  @Output() sessionUpdated = new EventEmitter<ApplicationAccessSession>();

  readonly canInvestigate =
    this.auth.hasPermission('application_access.investigate') || this.auth.isSuperAdmin();
  readonly canRevokeSession =
    this.auth.hasPermission('application_access.revoke_session') || this.auth.isSuperAdmin();
  readonly canBlockIp = this.auth.hasPermission('application_access.block_ip') || this.auth.isSuperAdmin();

  readonly loading = signal(true);
  readonly error = signal<string | null>(null);
  readonly session = signal<ApplicationAccessSession | null>(null);
  readonly timeline = signal<ApplicationAccessEvent[]>([]);
  readonly timelineLoading = signal(false);
  readonly timelineCursor = signal<string | null>(null);
  readonly timelineHasMore = signal(false);
  readonly pendingAction = signal<PendingAction | null>(null);
  readonly confirmOpen = signal(false);
  readonly actionBusy = signal(false);

  identityLabel = identityLabel;
  contextLabel = contextLabel;
  sessionStatusLabel = sessionStatusLabel;
  sessionStatusTone = sessionStatusTone;
  riskTone = riskTone;
  authorizationResultLabel = authorizationResultLabel;
  authorizationResultTone = authorizationResultTone;

  ngOnChanges(changes: SimpleChanges): void {
    if (changes['sessionId'] && this.sessionId) {
      this.loadSession();
      this.resetTimeline();
      this.loadTimeline(false);
    }
  }

  ngOnDestroy(): void {
    this.destroy$.next();
    this.destroy$.complete();
  }

  get timelineSummary() {
    return summarizeTimelineEvents(this.timeline());
  }

  displayEmail(session: ApplicationAccessSession): string {
    return session.user?.email || '—';
  }

  deviceSummary(session: ApplicationAccessSession): string {
    const parts = [session.device_type, session.operating_system, session.browser].filter(Boolean);
    return parts.length ? parts.join(' · ') : session.user_agent || '—';
  }

  tenantLabel(session: ApplicationAccessSession): string {
    const tenantId = session.tenant_id ?? session.user?.tenant_id;
    return tenantId ? `Parish #${tenantId}` : 'Platform';
  }

  supportLabel(session: ApplicationAccessSession): string {
    return session.support_session_id ? `Support session ${session.support_session_id}` : 'None';
  }

  eventSummary(event: ApplicationAccessEvent): string {
    const route = event.normalized_route || event.route_name || '—';
    return `${event.event_type} · ${route}`;
  }

  close(): void {
    this.closed.emit();
  }

  loadMoreTimeline(): void {
    if (!this.timelineHasMore() || this.timelineLoading()) {
      return;
    }

    this.loadTimeline(true);
  }

  requestRevoke(): void {
    const session = this.session();
    if (!session || !this.canRevokeSession || session.status !== 'ACTIVE') {
      return;
    }

    this.pendingAction.set({ type: 'revoke', session });
    this.confirmOpen.set(true);
    this.cdr.markForCheck();
  }

  requestBlockIp(): void {
    const session = this.session();
    if (!session?.ip_address || !this.canBlockIp) {
      return;
    }

    this.pendingAction.set({ type: 'block', session });
    this.confirmOpen.set(true);
    this.cdr.markForCheck();
  }

  confirmMessage(): string {
    const pending = this.pendingAction();
    if (!pending) {
      return '';
    }

    if (pending.type === 'revoke') {
      return `This ends session ${pending.session.session_reference} immediately.`;
    }

    return (
      `Block ${pending.session.ip_address} from the API? ` +
      'Shared office or parish networks (NAT) may block other people at the same location.'
    );
  }

  confirmTitle(): string {
    const pending = this.pendingAction();
    if (!pending) {
      return '';
    }

    return pending.type === 'revoke' ? 'Sign this person out?' : 'Block this IP address?';
  }

  confirmText(): string {
    const pending = this.pendingAction();
    return pending?.type === 'revoke' ? 'Sign out' : 'Block IP';
  }

  onConfirmAction(result: ConfirmationResult): void {
    this.confirmOpen.set(false);
    const pending = this.pendingAction();
    this.pendingAction.set(null);

    if (!result.confirmed || !pending) {
      this.cdr.markForCheck();
      return;
    }

    this.actionBusy.set(true);

    if (pending.type === 'revoke') {
      this.api
        .revokeSession(pending.session.id)
        .pipe(
          finalize(() => {
            this.actionBusy.set(false);
            this.cdr.markForCheck();
          }),
          takeUntil(this.destroy$)
        )
        .subscribe({
          next: (response) => {
            this.toast.success(response.message);
            this.session.set(response.session);
            this.sessionUpdated.emit(response.session);
          },
          error: (error: HttpErrorResponse) => {
            this.toast.error(this.readError(error, 'Could not revoke that session.'));
          },
        });
      return;
    }

    this.api
      .createIpBlock({
        ip_address: pending.session.ip_address!,
        reason: `Blocked during investigation of session ${pending.session.session_reference}`,
      })
      .pipe(
        finalize(() => {
          this.actionBusy.set(false);
          this.cdr.markForCheck();
        }),
        takeUntil(this.destroy$)
      )
      .subscribe({
        next: () => {
          this.toast.success('IP block rule created.');
        },
        error: (error: HttpErrorResponse) => {
          this.toast.error(this.readError(error, 'Could not block that IP address.'));
        },
      });
  }

  closeConfirm(): void {
    this.confirmOpen.set(false);
    this.pendingAction.set(null);
    this.cdr.markForCheck();
  }

  private loadSession(): void {
    this.loading.set(true);
    this.error.set(null);

    this.api
      .getSession(this.sessionId)
      .pipe(
        finalize(() => {
          this.loading.set(false);
          this.cdr.markForCheck();
        }),
        takeUntil(this.destroy$)
      )
      .subscribe({
        next: (session) => this.session.set(session),
        error: (error: HttpErrorResponse) => {
          this.error.set(this.readError(error, 'Could not load this session.'));
        },
      });
  }

  private resetTimeline(): void {
    this.timeline.set([]);
    this.timelineCursor.set(null);
    this.timelineHasMore.set(false);
  }

  private loadTimeline(append: boolean): void {
    this.timelineLoading.set(true);

    this.api
      .getSessionTimeline(this.sessionId, {
        per_page: 50,
        cursor: append ? this.timelineCursor() ?? undefined : undefined,
      })
      .pipe(
        finalize(() => {
          this.timelineLoading.set(false);
          this.cdr.markForCheck();
        }),
        takeUntil(this.destroy$)
      )
      .subscribe({
        next: (response) => {
          this.timeline.set(append ? [...this.timeline(), ...response.data] : response.data);
          this.timelineCursor.set(response.meta.next_cursor ?? null);
          this.timelineHasMore.set(!!response.meta.has_more);
        },
        error: (error: HttpErrorResponse) => {
          this.toast.error(this.readError(error, 'Could not load session timeline.'));
        },
      });
  }

  private readError(error: HttpErrorResponse, fallback: string): string {
    return error.error?.message || error.message || fallback;
  }
}
