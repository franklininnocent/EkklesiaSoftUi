import { CommonModule } from '@angular/common';
import { Component, EventEmitter, Input, OnChanges, Output, SimpleChanges, inject, signal } from '@angular/core';
import { ModalShellComponent } from '@shared/components/modal-shell/modal-shell.component';
import { StatusBadgeComponent } from '@shared/components/status-badge/status-badge.component';
import { CfActionIconComponent } from '@shared/components/cf-action-icon/cf-action-icon.component';
import { AuthService } from '@core/services/auth.service';
import { ToastService } from '@core/services/toast.service';
import { MassIntentionRecord, MassIntentionsApiService } from '../services/mass-intentions-api.service';
import { canCloseMassIntention, canCreateMassIntention, canScheduleMasses } from '../utils/mass-intentions-auth.util';
import {
  formatMassIntentionScheduledDay,
  massIntentionBeneficiaryIdentification,
  massIntentionListDescription,
  massIntentionListMass,
  massIntentionListType,
} from '../utils/mass-intention-list-display';
import { formatMassDayTime } from '../utils/mass-celebration-display';
import {
  MassIntentionAssignmentHistoryRow,
  MassIntentionAuditRow,
} from '../services/mass-intentions-api.service';
import { massIntentionStageLabel, massIntentionStageTone } from '../utils/mass-intention-status-display';

@Component({
  selector: 'app-mass-intention-view-modal',
  standalone: true,
  imports: [CommonModule, ModalShellComponent, StatusBadgeComponent, CfActionIconComponent],
  templateUrl: './mass-intention-view-modal.component.html',
  styleUrl: './mass-intention-view-modal.component.scss',
})
export class MassIntentionViewModalComponent implements OnChanges {
  private readonly api = inject(MassIntentionsApiService);
  private readonly auth = inject(AuthService);
  private readonly toast = inject(ToastService);

  @Input() open = false;
  @Input() requestId: string | null = null;
  @Output() closed = new EventEmitter<void>();
  @Output() editRequested = new EventEmitter<string>();
  @Output() moveRequested = new EventEmitter<MassIntentionRecord>();
  @Output() recordClosed = new EventEmitter<void>();

  readonly loading = signal(false);
  readonly closing = signal(false);
  readonly record = signal<MassIntentionRecord | null>(null);
  readonly assignmentHistory = signal<MassIntentionAssignmentHistoryRow[]>([]);
  readonly auditHistory = signal<MassIntentionAuditRow[]>([]);

  ngOnChanges(changes: SimpleChanges): void {
    if (changes['open']?.currentValue && this.requestId) {
      this.load(this.requestId);
    }
  }

  modalTitle(): string {
    return this.record()?.beneficiary_name?.trim() || 'Mass intention';
  }

  modalSubtitle(): string {
    const r = this.record();
    if (!r) {
      return 'Parish office register';
    }
    const type = this.intentionTypeLabel(r);
    return type !== '—' ? type : 'Parish office register';
  }

  statusLabel(r: MassIntentionRecord): string {
    return massIntentionStageLabel(r.status, r.said_progress);
  }

  statusTone(r: MassIntentionRecord) {
    return massIntentionStageTone(r.status, r.said_progress);
  }

  intentionTypeLabel(r: MassIntentionRecord): string {
    return massIntentionListType(r);
  }

  intentionDescriptionText(r: MassIntentionRecord): string | null {
    return massIntentionListDescription(r);
  }

  scheduledDay(r: MassIntentionRecord): string {
    return formatMassIntentionScheduledDay(r.requested_date);
  }

  beneficiaryIdentification(r: MassIntentionRecord): string | null {
    return massIntentionBeneficiaryIdentification(r);
  }

  canClose(): boolean {
    return canCloseMassIntention(this.auth);
  }

  canEdit(): boolean {
    return canCreateMassIntention(this.auth);
  }

  canMove(r: MassIntentionRecord): boolean {
    return (
      canScheduleMasses(this.auth) &&
      r.status === 'open' &&
      !r.needs_a_mass &&
      !!r.mass_celebration?.id
    );
  }

  massLabel(r: MassIntentionRecord): string {
    return massIntentionListMass(r);
  }

  assignmentLabel(row: MassIntentionAssignmentHistoryRow): string {
    const when = formatMassDayTime(row.mass.celebrated_on ?? '', row.mass.celebrated_at ?? null);
    const place = row.mass.place ? ` · ${row.mass.place}` : '';
    const state = row.is_active ? 'Current' : row.is_said ? 'Said on this Mass' : 'Previous Mass';
    return `${when}${place} — ${state}`;
  }

  auditLabel(row: MassIntentionAuditRow): string {
    const map: Record<string, string> = {
      'request.created': 'Recorded',
      'request.updated': 'Updated',
      'intention.moved': 'Moved to another Mass',
    };
    return map[row.event_type] ?? row.event_type;
  }

  closeIntention(): void {
    const id = this.requestId;
    if (!id || this.closing()) {
      return;
    }
    this.closing.set(true);
    this.api.closeRequest(id).subscribe({
      next: () => {
        this.closing.set(false);
        this.toast.success('Intention closed.');
        this.recordClosed.emit();
        this.close();
      },
      error: () => {
        this.closing.set(false);
        this.toast.error('Could not close this intention.');
      },
    });
  }

  close(): void {
    if (!this.closing()) {
      this.closed.emit();
    }
  }

  private load(id: string): void {
    this.loading.set(true);
    this.api.getRequest(id).subscribe({
      next: (res) => {
        this.record.set(res.data);
        this.assignmentHistory.set(res.meta?.history?.assignments ?? []);
        this.auditHistory.set(res.meta?.history?.audits ?? []);
        this.loading.set(false);
      },
      error: () => {
        this.record.set(null);
        this.loading.set(false);
      },
    });
  }
}
