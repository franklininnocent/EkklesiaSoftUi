import { CommonModule } from '@angular/common';
import { Component, OnInit, inject } from '@angular/core';
import { FormBuilder, ReactiveFormsModule, Validators } from '@angular/forms';
import { ActivatedRoute, RouterModule } from '@angular/router';
import { PageHeaderComponent } from '@shared/components/page-header/page-header.component';
import { LoadingSkeletonComponent } from '@shared/components/loading-skeleton/loading-skeleton.component';
import {
  ConfirmationModalComponent,
  ConfirmationResult,
} from '@shared/components/confirmation-modal/confirmation-modal.component';
import {
  StatusBadgeComponent,
  StatusBadgeTone,
} from '@shared/components/status-badge/status-badge.component';
import { AuthService } from '@core/services/auth.service';
import { SupportTicketService } from '../services/support-ticket.service';
import { SupportTicketDetail } from '../models/support-ticket.model';

type LifecycleAction = 'cancel' | 'resolve' | 'reopen' | 'confirm';

@Component({
  selector: 'app-support-ticket-detail-page',
  standalone: true,
  imports: [
    CommonModule,
    ReactiveFormsModule,
    RouterModule,
    PageHeaderComponent,
    LoadingSkeletonComponent,
    ConfirmationModalComponent,
    StatusBadgeComponent,
  ],
  templateUrl: './support-ticket-detail.page.html',
  styleUrl: './support-ticket-detail.page.scss',
})
export class SupportTicketDetailPage implements OnInit {
  private readonly route = inject(ActivatedRoute);
  private readonly tickets = inject(SupportTicketService);
  private readonly fb = inject(FormBuilder);
  private readonly auth = inject(AuthService);

  private static readonly CANCELLABLE = [
    'draft',
    'new',
    'in_progress',
    'awaiting_you',
    'awaiting_ekklesia',
  ];

  private static readonly RESOLVABLE = [
    'new',
    'in_progress',
    'awaiting_you',
    'awaiting_ekklesia',
  ];

  ticket: SupportTicketDetail | null = null;
  loading = true;
  error: string | null = null;
  actionError: string | null = null;
  acting = false;
  posting = false;
  downloadingId: number | null = null;

  lifecycleAction: LifecycleAction | null = null;
  lifecycleConfirmOpen = false;

  commentForm = this.fb.group({ body: ['', Validators.required] });

  ngOnInit(): void {
    const id = this.route.snapshot.paramMap.get('id') || '';
    this.loadTicket(id);
  }

  canCancel(ticket: SupportTicketDetail): boolean {
    return (
      this.auth.hasTenantPermission('support.tickets.cancel') &&
      SupportTicketDetailPage.CANCELLABLE.includes(ticket.status)
    );
  }

  canReopen(ticket: SupportTicketDetail): boolean {
    if (!this.auth.hasTenantPermission('support.tickets.reopen')) {
      return false;
    }
    if (!['resolved', 'closed'].includes(ticket.status)) {
      return false;
    }
    if (ticket.reopen_allowed_until) {
      return new Date(ticket.reopen_allowed_until) > new Date();
    }
    return true;
  }

  canResolve(ticket: SupportTicketDetail): boolean {
    return (
      this.auth.hasTenantPermission('support.tickets.resolve') &&
      SupportTicketDetailPage.RESOLVABLE.includes(ticket.status)
    );
  }

  canConfirm(ticket: SupportTicketDetail): boolean {
    return ticket.status === 'resolved' && ticket.resolved_by_actor === 'ekklesia';
  }

  resolveRequiresReason(ticket: SupportTicketDetail): boolean {
    return ticket.status === 'in_progress';
  }

  canComment(ticket: SupportTicketDetail): boolean {
    return (
      this.auth.hasTenantPermission('support.tickets.comment') &&
      !['cancelled', 'closed'].includes(ticket.status)
    );
  }

  hasBugDetails(ticket: SupportTicketDetail): boolean {
    return !!(
      ticket.steps_to_reproduce ||
      ticket.expected_result ||
      ticket.actual_result ||
      ticket.error_message ||
      ticket.bug_details
    );
  }

  hasRailContent(ticket: SupportTicketDetail): boolean {
    return !!(
      ticket.description ||
      this.hasBugDetails(ticket) ||
      ticket.affected_module ||
      ticket.business_impact ||
      (ticket.status === 'resolved' || ticket.status === 'closed') ||
      ticket.attachments?.length ||
      ticket.participants?.length
    );
  }

  openLifecycle(action: LifecycleAction): void {
    this.actionError = null;
    this.lifecycleAction = action;
    this.lifecycleConfirmOpen = true;
  }

  closeLifecycle(): void {
    if (this.acting) {
      return;
    }
    this.lifecycleConfirmOpen = false;
    this.lifecycleAction = null;
  }

  onLifecycleConfirmed(result: ConfirmationResult): void {
    if (!this.ticket || !this.lifecycleAction || this.acting) {
      return;
    }

    if (this.lifecycleAction === 'cancel' || this.lifecycleAction === 'reopen') {
      const reason = result.description?.trim() || '';
      if (!reason) {
        this.actionError =
          this.lifecycleAction === 'cancel'
            ? 'Please tell us why you are cancelling this ticket.'
            : 'Please tell us why you are reopening this ticket.';
        return;
      }
      this.runLifecycleWithReason(reason);
      return;
    }

    if (this.lifecycleAction === 'resolve') {
      const summary = result.description?.trim() || '';
      if (this.ticket && this.resolveRequiresReason(this.ticket) && !summary) {
        this.actionError =
          'Please explain how this was resolved while support is actively working on it.';
        return;
      }
      this.runResolve(summary || undefined);
      return;
    }

    this.runConfirmResolution();
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
      },
      error: (err) => {
        this.actionError = err?.error?.message || 'Could not post your comment.';
        this.posting = false;
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
      },
      error: () => {
        this.actionError = 'Could not download the attachment.';
        this.downloadingId = null;
      },
    });
  }

  statusLabel(status: string): string {
    const labels: Record<string, string> = {
      draft: 'Draft',
      new: 'New',
      in_progress: 'In Progress',
      awaiting_you: 'Awaiting You',
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

  slaCaption(ticket: SupportTicketDetail): string | null {
    const sla = ticket.sla;
    if (!sla || ['resolved', 'closed', 'cancelled'].includes(ticket.status)) {
      return null;
    }
    if (sla.at_risk) {
      return 'SLA at risk — the support team is working to respond soon.';
    }
    if (sla.resolution_due_at) {
      return `Resolution due ${new Date(sla.resolution_due_at).toLocaleString()}`;
    }
    return null;
  }

  bugDetail(ticket: SupportTicketDetail, key: string): string | null {
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

  get lifecycleTitle(): string {
    switch (this.lifecycleAction) {
      case 'cancel':
        return 'Cancel this ticket?';
      case 'resolve':
        return 'Mark as resolved?';
      case 'reopen':
        return 'Reopen this ticket?';
      case 'confirm':
        return 'Confirm resolution?';
      default:
        return 'Confirm';
    }
  }

  get lifecycleMessage(): string {
    if (this.lifecycleAction === 'resolve' && this.ticket) {
      switch (this.ticket.status) {
        case 'new':
          return 'You solved this on your own without waiting for support.';
        case 'awaiting_ekklesia':
          return 'The issue is no longer needed or is already solved.';
        case 'awaiting_you':
          return 'You completed the action support requested.';
        case 'in_progress':
          return 'Support is actively working on this. Explain how it was resolved before closing.';
        default:
          return 'Use this when the issue is fixed and you no longer need help from the support team.';
      }
    }

    switch (this.lifecycleAction) {
      case 'cancel':
        return 'This ticket will be marked cancelled. You can open a new ticket later if you still need help.';
      case 'resolve':
        return 'Use this when the issue is fixed and you no longer need help from the support team.';
      case 'reopen':
        return 'The support team will be notified that this issue is not fully resolved.';
      case 'confirm':
        return 'This will close the ticket. Choose Confirm only if the issue is fixed.';
      default:
        return '';
    }
  }

  get lifecycleConfirmText(): string {
    switch (this.lifecycleAction) {
      case 'cancel':
        return 'Cancel ticket';
      case 'resolve':
        return 'Mark as resolved';
      case 'reopen':
        return 'Reopen ticket';
      case 'confirm':
        return 'Confirm & close';
      default:
        return 'Confirm';
    }
  }

  get lifecycleConfirmClass(): string {
    return this.lifecycleAction === 'cancel' ? 'btn-danger' : 'btn-primary';
  }

  get lifecycleNeedsReason(): boolean {
    return (
      this.lifecycleAction === 'cancel' ||
      this.lifecycleAction === 'reopen' ||
      this.lifecycleAction === 'resolve'
    );
  }

  get lifecycleDescriptionLabel(): string {
    if (this.lifecycleAction === 'resolve' && this.ticket) {
      return this.resolveRequiresReason(this.ticket)
        ? 'How was this resolved?'
        : 'Add a note (optional)';
    }

    switch (this.lifecycleAction) {
      case 'cancel':
        return 'Why are you cancelling?';
      case 'reopen':
        return 'Why are you reopening?';
      default:
        return 'Notes';
    }
  }

  get lifecycleDescriptionRequired(): boolean {
    if (this.lifecycleAction === 'resolve' && this.ticket) {
      return this.resolveRequiresReason(this.ticket);
    }
    return this.lifecycleAction === 'cancel' || this.lifecycleAction === 'reopen';
  }

  resolvedByLabel(ticket: SupportTicketDetail): string {
    if (ticket.resolved_by_actor === 'ekklesia') {
      return ticket.resolved_by?.name
        ? `Resolved by ${ticket.resolved_by.name} (Ekklesia support)`
        : 'Resolved by Ekklesia support';
    }
    if (ticket.resolved_by_actor === 'tenant') {
      return ticket.resolved_by?.name
        ? `Resolved by ${ticket.resolved_by.name} (your parish)`
        : 'Resolved by your parish';
    }
    return 'Resolution recorded';
  }

  private runLifecycleWithReason(reason: string): void {
    if (!this.ticket || !this.lifecycleAction) {
      return;
    }
    this.acting = true;
    this.actionError = null;

    const request$ =
      this.lifecycleAction === 'cancel'
        ? this.tickets.cancelTicket(this.ticket.ticket_number, reason)
        : this.tickets.reopenTicket(this.ticket.ticket_number, reason);

    request$.subscribe({
      next: (ticket) => {
        this.ticket = ticket;
        this.acting = false;
        this.lifecycleConfirmOpen = false;
        this.lifecycleAction = null;
      },
      error: (err) => {
        this.actionError = err?.error?.message || 'Could not update this ticket.';
        this.acting = false;
      },
    });
  }

  private runResolve(resolutionSummary?: string): void {
    if (!this.ticket) {
      return;
    }
    this.acting = true;
    this.actionError = null;

    this.tickets.resolveTicket(this.ticket.ticket_number, resolutionSummary).subscribe({
      next: (ticket) => {
        this.ticket = ticket;
        this.acting = false;
        this.lifecycleConfirmOpen = false;
        this.lifecycleAction = null;
      },
      error: (err) => {
        this.actionError = err?.error?.message || 'Could not mark this ticket as resolved.';
        this.acting = false;
      },
    });
  }

  private runConfirmResolution(): void {
    if (!this.ticket) {
      return;
    }
    this.acting = true;
    this.actionError = null;

    this.tickets.confirmResolution(this.ticket.ticket_number).subscribe({
      next: (ticket) => {
        this.ticket = ticket;
        this.acting = false;
        this.lifecycleConfirmOpen = false;
        this.lifecycleAction = null;
      },
      error: (err) => {
        this.actionError = err?.error?.message || 'Could not confirm resolution.';
        this.acting = false;
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
      },
      error: () => {
        this.error = 'Ticket not found or you do not have access.';
        this.loading = false;
      },
    });
  }

  private reload(): void {
    if (!this.ticket) {
      return;
    }
    this.tickets.getTicket(this.ticket.ticket_number).subscribe({
      next: (t) => (this.ticket = t),
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
}
