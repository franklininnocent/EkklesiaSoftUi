import { CommonModule } from '@angular/common';
import { ChangeDetectionStrategy, ChangeDetectorRef, Component, OnInit, inject } from '@angular/core';
import { FormBuilder, ReactiveFormsModule, Validators } from '@angular/forms';
import { ActivatedRoute, Router, RouterModule } from '@angular/router';
import { PageHeaderComponent } from '@shared/components/page-header/page-header.component';
import { LoadingSkeletonComponent } from '@shared/components/loading-skeleton/loading-skeleton.component';
import {
  StatusBadgeComponent,
  StatusBadgeTone,
} from '@shared/components/status-badge/status-badge.component';
import {
  ConfirmationModalComponent,
  ConfirmationResult,
} from '@shared/components/confirmation-modal/confirmation-modal.component';
import { AuthService } from '@core/services/auth.service';
import { OpsSupportTicketDetail } from '../models/support-ops-ticket.model';
import { SupportOpsTicketService } from '../services/support-ops-ticket.service';

type LifecycleAction = 'resolve' | 'close' | 'reopen';

@Component({
  selector: 'app-support-ops-ticket-detail-page',
  standalone: true,
  imports: [
    CommonModule,
    ReactiveFormsModule,
    RouterModule,
    PageHeaderComponent,
    LoadingSkeletonComponent,
    StatusBadgeComponent,
    ConfirmationModalComponent,
  ],
  templateUrl: './support-ops-ticket-detail.page.html',
  styleUrl: '../../support/pages/support-ticket-detail.page.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class SupportOpsTicketDetailPage implements OnInit {
  private readonly route = inject(ActivatedRoute);
  private readonly router = inject(Router);
  private readonly tickets = inject(SupportOpsTicketService);
  private readonly fb = inject(FormBuilder);
  private readonly auth = inject(AuthService);
  private readonly cdr = inject(ChangeDetectorRef);

  ticket: OpsSupportTicketDetail | null = null;
  loading = true;
  error: string | null = null;
  actionError: string | null = null;
  posting = false;
  postingInternal = false;
  downloadingId: number | null = null;

  commentForm = this.fb.group({ body: ['', Validators.required] });
  internalNoteForm = this.fb.group({ body: ['', Validators.required] });

  acting = false;
  lifecycleAction: LifecycleAction | null = null;
  lifecycleConfirmOpen = false;

  private static readonly RESOLVABLE = ['new', 'in_progress', 'awaiting_you', 'awaiting_ekklesia'];
  private static readonly WORKFLOW_OPEN = ['new', 'in_progress', 'awaiting_you', 'awaiting_ekklesia'];

  ngOnInit(): void {
    const id = this.route.snapshot.paramMap.get('id') || '';
    this.loadTicket(id);
  }

  canAddPublicComment(ticket: OpsSupportTicketDetail): boolean {
    return this.hasOpsPermission('support.ops.tickets.comment') && !['cancelled', 'closed'].includes(ticket.status);
  }

  canInternalNote(): boolean {
    return this.hasOpsPermission('support.ops.tickets.internal_note');
  }

  canAssign(ticket: OpsSupportTicketDetail): boolean {
    return (
      this.hasOpsPermission('support.ops.tickets.assign') &&
      SupportOpsTicketDetailPage.WORKFLOW_OPEN.includes(ticket.status)
    );
  }

  canSetAwaitingYou(ticket: OpsSupportTicketDetail): boolean {
    return (
      this.hasOpsPermission('support.ops.tickets.change_status') &&
      ['in_progress', 'awaiting_ekklesia'].includes(ticket.status)
    );
  }

  canSetAwaitingEkklesia(ticket: OpsSupportTicketDetail): boolean {
    return (
      this.hasOpsPermission('support.ops.tickets.change_status') &&
      ['in_progress', 'awaiting_you'].includes(ticket.status)
    );
  }

  canResolve(ticket: OpsSupportTicketDetail): boolean {
    return (
      this.hasOpsPermission('support.ops.tickets.resolve') &&
      SupportOpsTicketDetailPage.RESOLVABLE.includes(ticket.status)
    );
  }

  canClose(ticket: OpsSupportTicketDetail): boolean {
    return ticket.status === 'resolved' && this.hasOpsPermission('support.ops.tickets.close');
  }

  canReopen(ticket: OpsSupportTicketDetail): boolean {
    return (
      this.hasOpsPermission('support.ops.tickets.reopen') &&
      ['resolved', 'closed'].includes(ticket.status)
    );
  }

  canStartDiagnosis(ticket: OpsSupportTicketDetail): boolean {
    return !!ticket.tenant?.id && this.hasOpsPermission('support.sessions.start');
  }

  startDiagnosisSession(ticket: OpsSupportTicketDetail): void {
    const tenantId = ticket.tenant?.id;
    if (!tenantId) {
      return;
    }

    void this.router.navigate(['/support-center'], {
      queryParams: { tab: 'start', tenant_id: tenantId },
    });
  }

  assignToMe(): void {
    if (!this.ticket || this.acting) {
      return;
    }
    this.acting = true;
    this.actionError = null;
    this.tickets.assignTicket(this.ticket.ticket_number).subscribe({
      next: (ticket) => {
        this.ticket = ticket;
        this.acting = false;
        this.cdr.markForCheck();
      },
      error: (err) => {
        this.actionError = err?.error?.message || 'Could not assign this ticket.';
        this.acting = false;
        this.cdr.markForCheck();
      },
    });
  }

  setAwaitingYou(): void {
    if (!this.ticket || this.acting) {
      return;
    }
    this.runStatusChange(() => this.tickets.setAwaitingYou(this.ticket!.ticket_number));
  }

  setAwaitingEkklesia(): void {
    if (!this.ticket || this.acting) {
      return;
    }
    this.runStatusChange(() => this.tickets.setAwaitingEkklesia(this.ticket!.ticket_number));
  }

  openLifecycle(action: LifecycleAction): void {
    this.actionError = null;
    this.lifecycleAction = action;
    this.lifecycleConfirmOpen = true;
    this.cdr.markForCheck();
  }

  closeLifecycle(): void {
    if (this.acting) {
      return;
    }
    this.lifecycleConfirmOpen = false;
    this.lifecycleAction = null;
    this.cdr.markForCheck();
  }

  onLifecycleConfirmed(result: ConfirmationResult): void {
    if (!this.ticket || !this.lifecycleAction || this.acting) {
      return;
    }

    if (this.lifecycleAction === 'reopen') {
      const reason = result.description?.trim() || '';
      if (!reason) {
        this.actionError = 'Please tell us why you are reopening this ticket.';
        this.cdr.markForCheck();
        return;
      }
      this.runReopen(reason);
      return;
    }

    if (this.lifecycleAction === 'resolve') {
      const summary = result.description?.trim() || '';
      if (!summary) {
        this.actionError = 'Please describe how this ticket was resolved.';
        this.cdr.markForCheck();
        return;
      }
      this.runResolve(summary);
      return;
    }

    if (this.lifecycleAction === 'close') {
      this.runClose(result.description?.trim() || undefined);
    }
  }

  get lifecycleTitle(): string {
    switch (this.lifecycleAction) {
      case 'resolve':
        return 'Mark ticket as resolved?';
      case 'close':
        return 'Close this ticket?';
      case 'reopen':
        return 'Reopen this ticket?';
      default:
        return 'Confirm';
    }
  }

  get lifecycleMessage(): string {
    switch (this.lifecycleAction) {
      case 'resolve':
        return 'The parish will see this ticket as resolved. Add a clear summary of what was fixed.';
      case 'close':
        return 'Close after the parish confirms the fix, or when no further action is needed.';
      case 'reopen':
        return 'The ticket will return to in progress and the parish will be notified.';
      default:
        return '';
    }
  }

  get lifecycleConfirmText(): string {
    switch (this.lifecycleAction) {
      case 'resolve':
        return 'Mark as resolved';
      case 'close':
        return 'Close ticket';
      case 'reopen':
        return 'Reopen ticket';
      default:
        return 'Confirm';
    }
  }

  get lifecycleConfirmClass(): string {
    return this.lifecycleAction === 'close' ? 'btn-danger' : 'btn-primary';
  }

  get lifecycleNeedsReason(): boolean {
    return this.lifecycleAction === 'resolve' || this.lifecycleAction === 'reopen';
  }

  get lifecycleDescriptionLabel(): string {
    if (this.lifecycleAction === 'resolve') {
      return 'Resolution summary';
    }
    if (this.lifecycleAction === 'reopen') {
      return 'Why are you reopening?';
    }
    return 'Note (optional)';
  }

  get lifecycleDescriptionRequired(): boolean {
    return this.lifecycleAction === 'resolve' || this.lifecycleAction === 'reopen';
  }

  resolvedByLabel(ticket: OpsSupportTicketDetail): string {
    if (ticket.resolved_by_actor === 'ekklesia') {
      return ticket.resolved_by?.name
        ? `Resolved by ${ticket.resolved_by.name} (Ekklesia support)`
        : 'Resolved by Ekklesia support';
    }
    if (ticket.resolved_by_actor === 'tenant') {
      return ticket.resolved_by?.name
        ? `Resolved by ${ticket.resolved_by.name} (parish)`
        : 'Resolved by the parish';
    }
    return 'Resolution recorded';
  }

  hasBugDetails(ticket: OpsSupportTicketDetail): boolean {
    return !!(
      ticket.steps_to_reproduce ||
      ticket.expected_result ||
      ticket.actual_result ||
      ticket.error_message ||
      ticket.bug_details
    );
  }

  hasRailContent(ticket: OpsSupportTicketDetail): boolean {
    return !!(
      ticket.description ||
      this.hasBugDetails(ticket) ||
      ticket.affected_module ||
      ticket.business_impact ||
      ticket.internal_comments?.length ||
      ticket.attachments?.length ||
      ticket.status === 'resolved' ||
      ticket.status === 'closed'
    );
  }

  postComment(): void {
    if (!this.ticket || this.commentForm.invalid || this.posting) {
      return;
    }

    this.posting = true;
    this.actionError = null;
    this.tickets.addComment(this.ticket.ticket_number, this.commentForm.value.body!).subscribe({
      next: () => {
        this.commentForm.reset();
        this.reload();
        this.posting = false;
        this.cdr.markForCheck();
      },
      error: (err) => {
        this.actionError = err?.error?.message || 'Could not post your comment.';
        this.posting = false;
        this.cdr.markForCheck();
      },
    });
  }

  postInternalNote(): void {
    if (!this.ticket || this.internalNoteForm.invalid || this.postingInternal || !this.canInternalNote()) {
      return;
    }

    this.postingInternal = true;
    this.actionError = null;
    this.tickets.addInternalNote(this.ticket.ticket_number, this.internalNoteForm.value.body!).subscribe({
      next: () => {
        this.internalNoteForm.reset();
        this.reload();
        this.postingInternal = false;
        this.cdr.markForCheck();
      },
      error: (err) => {
        this.actionError = err?.error?.message || 'Could not save the internal note.';
        this.postingInternal = false;
        this.cdr.markForCheck();
      },
    });
  }

  downloadAttachment(attachmentId: number, filename: string): void {
    if (!this.ticket || this.downloadingId !== null) {
      return;
    }

    this.downloadingId = attachmentId;
    this.tickets.downloadAttachment(this.ticket.ticket_number, attachmentId).subscribe({
      next: (blob) => {
        this.saveBlob(blob, filename);
        this.downloadingId = null;
        this.cdr.markForCheck();
      },
      error: () => {
        this.actionError = 'Could not download the attachment.';
        this.downloadingId = null;
        this.cdr.markForCheck();
      },
    });
  }

  statusLabel(status: string): string {
    const labels: Record<string, string> = {
      draft: 'Draft',
      new: 'New',
      in_progress: 'In Progress',
      awaiting_you: 'Awaiting Parish',
      awaiting_ekklesia: 'Awaiting Ekklesia',
      resolved: 'Resolved',
      closed: 'Closed',
      cancelled: 'Cancelled',
    };
    return labels[status] || status;
  }

  priorityLabel(priority: string): string {
    const labels: Record<string, string> = {
      low: 'Low',
      normal: 'Normal',
      high: 'High',
      urgent: 'Urgent',
      critical: 'Critical',
    };
    return labels[priority] || priority;
  }

  statusTone(status: string): StatusBadgeTone {
    switch (status) {
      case 'resolved':
      case 'closed':
        return 'success';
      case 'cancelled':
        return 'neutral';
      case 'awaiting_you':
        return 'warning';
      case 'awaiting_ekklesia':
      case 'in_progress':
        return 'info';
      default:
        return 'neutral';
    }
  }

  priorityTone(priority: string): StatusBadgeTone {
    switch (priority) {
      case 'critical':
      case 'urgent':
        return 'critical';
      case 'high':
        return 'warning';
      case 'normal':
        return 'info';
      default:
        return 'neutral';
    }
  }

  eventLabel(eventType: string): string {
    const labels: Record<string, string> = {
      ticket_created: 'Created',
      ticket_submitted: 'Submitted',
      status_changed: 'Status changed',
      priority_changed: 'Priority changed',
      queue_changed: 'Queue changed',
      assignment_changed: 'Assignment changed',
      public_comment: 'Comment added',
      participant_added: 'Participant added',
      participant_removed: 'Participant removed',
      attachment_uploaded: 'Attachment uploaded',
      resolution: 'Marked resolved',
      reopened: 'Reopened',
      cancelled: 'Cancelled',
      closed: 'Closed',
    };
    return labels[eventType] || eventType.replace(/_/g, ' ');
  }

  slaCaption(ticket: OpsSupportTicketDetail): string | null {
    const sla = ticket.sla;
    if (!sla || ['resolved', 'closed', 'cancelled'].includes(ticket.status)) {
      return null;
    }
    if (sla.at_risk) {
      return 'SLA at risk — respond or resolve soon.';
    }
    if (sla.resolution_due_at) {
      return `Resolution due ${new Date(sla.resolution_due_at).toLocaleString()}`;
    }
    return null;
  }

  bugDetail(ticket: OpsSupportTicketDetail, key: string): string | null {
    const value = ticket.bug_details?.[key];
    return value ? String(value) : null;
  }

  formatFileSize(bytes: number): string {
    if (bytes < 1024) {
      return `${bytes} B`;
    }
    if (bytes < 1024 * 1024) {
      return `${(bytes / 1024).toFixed(1)} KB`;
    }
    return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
  }

  private runResolve(resolutionSummary: string): void {
    if (!this.ticket) {
      return;
    }
    this.acting = true;
    this.actionError = null;
    this.tickets.resolveTicket(this.ticket.ticket_number, { resolution_summary: resolutionSummary }).subscribe({
      next: (ticket) => {
        this.ticket = ticket;
        this.acting = false;
        this.lifecycleConfirmOpen = false;
        this.lifecycleAction = null;
        this.cdr.markForCheck();
      },
      error: (err) => {
        this.actionError = err?.error?.message || 'Could not mark this ticket as resolved.';
        this.acting = false;
        this.cdr.markForCheck();
      },
    });
  }

  private runClose(note?: string): void {
    if (!this.ticket) {
      return;
    }
    this.acting = true;
    this.actionError = null;
    this.tickets.closeTicket(this.ticket.ticket_number, note).subscribe({
      next: (ticket) => {
        this.ticket = ticket;
        this.acting = false;
        this.lifecycleConfirmOpen = false;
        this.lifecycleAction = null;
        this.cdr.markForCheck();
      },
      error: (err) => {
        this.actionError = err?.error?.message || 'Could not close this ticket.';
        this.acting = false;
        this.cdr.markForCheck();
      },
    });
  }

  private runReopen(reason: string): void {
    if (!this.ticket) {
      return;
    }
    this.acting = true;
    this.actionError = null;
    this.tickets.reopenTicket(this.ticket.ticket_number, reason).subscribe({
      next: (ticket) => {
        this.ticket = ticket;
        this.acting = false;
        this.lifecycleConfirmOpen = false;
        this.lifecycleAction = null;
        this.cdr.markForCheck();
      },
      error: (err) => {
        this.actionError = err?.error?.message || 'Could not reopen this ticket.';
        this.acting = false;
        this.cdr.markForCheck();
      },
    });
  }

  private runStatusChange(request: () => ReturnType<SupportOpsTicketService['setAwaitingYou']>): void {
    this.acting = true;
    this.actionError = null;
    request().subscribe({
      next: (ticket) => {
        this.ticket = ticket;
        this.acting = false;
        this.cdr.markForCheck();
      },
      error: (err) => {
        this.actionError = err?.error?.message || 'Could not update this ticket.';
        this.acting = false;
        this.cdr.markForCheck();
      },
    });
  }

  private loadTicket(id: string): void {
    this.loading = true;
    this.error = null;
    this.tickets.getTicket(id).subscribe({
      next: (ticket) => {
        this.ticket = ticket;
        this.loading = false;
        this.cdr.markForCheck();
      },
      error: () => {
        this.error = 'Ticket not found or you do not have access.';
        this.loading = false;
        this.cdr.markForCheck();
      },
    });
  }

  private reload(): void {
    if (!this.ticket) {
      return;
    }

    this.tickets.getTicket(this.ticket.ticket_number).subscribe({
      next: (ticket) => {
        this.ticket = ticket;
        this.cdr.markForCheck();
      },
    });
  }

  private saveBlob(blob: Blob, filename: string): void {
    const url = URL.createObjectURL(blob);
    const anchor = document.createElement('a');
    anchor.href = url;
    anchor.download = filename;
    anchor.click();
    URL.revokeObjectURL(url);
  }

  private hasOpsPermission(permission: string): boolean {
    if (this.auth.isSuperAdmin()) {
      return true;
    }
    return this.auth.hasPermission(permission);
  }
}
