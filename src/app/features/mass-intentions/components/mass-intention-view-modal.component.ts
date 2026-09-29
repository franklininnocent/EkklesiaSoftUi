import { CommonModule } from '@angular/common';
import { Component, EventEmitter, Input, OnChanges, Output, SimpleChanges, inject, signal } from '@angular/core';
import { ModalShellComponent } from '@shared/components/modal-shell/modal-shell.component';
import { StatusBadgeComponent } from '@shared/components/status-badge/status-badge.component';
import { CfActionIconComponent } from '@shared/components/cf-action-icon/cf-action-icon.component';
import { AuthService } from '@core/services/auth.service';
import { ToastService } from '@core/services/toast.service';
import { MassIntentionRecord, MassIntentionsApiService } from '../services/mass-intentions-api.service';
import { canCloseMassIntention, canCreateMassIntention } from '../utils/mass-intentions-auth.util';
import {
  formatMassIntentionScheduledDay,
  massIntentionBeneficiaryIdentification,
  massIntentionListDescription,
  massIntentionListType,
} from '../utils/mass-intention-list-display';
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
  @Output() recordClosed = new EventEmitter<void>();

  readonly loading = signal(false);
  readonly closing = signal(false);
  readonly record = signal<MassIntentionRecord | null>(null);

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
        this.loading.set(false);
      },
      error: () => {
        this.record.set(null);
        this.loading.set(false);
      },
    });
  }
}
