import { CommonModule } from '@angular/common';
import { Component, EventEmitter, Input, Output, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { ModalShellComponent } from '@shared/components/modal-shell/modal-shell.component';
import {
  MassCelebrationSummary,
  MassCelebrationWorkspaceIntention,
} from '../services/mass-intentions-api.service';
import { formatMassDayTime } from '../utils/mass-celebration-display';

export interface CancelMassPayload {
  reason: string;
  reassignments: { obligation_id: string; celebration_id?: string | null }[];
}

@Component({
  selector: 'app-cancel-mass-modal',
  standalone: true,
  imports: [CommonModule, FormsModule, ModalShellComponent],
  template: `
    <app-modal-shell
      *ngIf="open"
      title="Cancel this Mass"
      size="sm"
      headerVariant="compact"
      bodyPadding="none"
      (closeRequested)="close()"
    >
      <form class="cf-split-form" (ngSubmit)="submit()">
        <div class="cf-split-form__body cancel-mass__body">
          <p class="cancel-mass__lead">
            Every unsaid intention must be moved to another Mass before this Mass can be cancelled.
          </p>
          @for (row of intentions; track row.obligation_id) {
            @if (!row.is_said) {
              <div class="cancel-mass__row">
                <span class="cancel-mass__name">{{ row.beneficiary_name }}</span>
                <select
                  class="cf-control"
                  [ngModel]="targetFor(row.obligation_id)"
                  (ngModelChange)="setTarget(row.obligation_id, $event)"
                  [ngModelOptions]="{ standalone: true }"
                >
                  <option value="" disabled>Select a Mass</option>
                  @for (mass of otherCelebrations; track mass.id) {
                    <option [value]="mass.id">{{ massLabel(mass) }}</option>
                  }
                </select>
              </div>
            }
          }
          @if (needsAddMass()) {
            <p class="cf-meta">No other Mass is in range. Add a one-time Mass, then choose it above.</p>
            <button type="button" class="cf-btn cf-btn-primary" (click)="addMassRequested.emit()">Add a Mass</button>
          }
          @if (!fixedReason) {
            <label class="cf-split-field">
              <span class="cf-split-field__label">Reason</span>
              <textarea
                class="cf-control"
                rows="3"
                [ngModel]="reason()"
                (ngModelChange)="reason.set($event)"
                [ngModelOptions]="{ standalone: true }"
                required
              ></textarea>
            </label>
          }
        </div>
        <div class="cf-split-form-actions">
          <button type="button" class="cf-btn cf-btn-ghost" (click)="close()">Back</button>
          <button
            type="submit"
            class="cf-btn cf-btn-primary cancel-mass__danger"
            [disabled]="!canSubmit()"
          >
            Cancel this Mass
          </button>
        </div>
      </form>
    </app-modal-shell>
  `,
  styles: [
    `
      .cancel-mass__body {
        display: grid;
        gap: var(--cf-space-3);
      }
      .cancel-mass__lead {
        margin: 0;
        font-size: var(--cf-text-sm);
        color: var(--cf-color-text-muted);
      }
      .cancel-mass__row {
        display: grid;
        gap: var(--cf-space-2);
      }
      .cancel-mass__name {
        font-size: var(--cf-text-base);
        font-weight: 600;
      }
      .cancel-mass__danger {
        background: var(--cf-color-danger, #b42318);
        border-color: var(--cf-color-danger, #b42318);
      }
    `,
  ],
})
export class CancelMassModalComponent {
  @Input() open = false;
  @Input() intentions: MassCelebrationWorkspaceIntention[] = [];
  @Input() otherCelebrations: MassCelebrationSummary[] = [];
  /** When set, reason was collected in app-confirmation-modal (xs). */
  @Input() fixedReason: string | null = null;
  @Output() closed = new EventEmitter<void>();
  @Output() confirmed = new EventEmitter<CancelMassPayload>();
  @Output() addMassRequested = new EventEmitter<void>();

  readonly reason = signal('');
  private readonly targets = signal<Record<string, string>>({});

  targetFor(obligationId: string): string {
    return this.targets()[obligationId] ?? '';
  }

  setTarget(obligationId: string, celebrationId: string): void {
    this.targets.update((map) => ({ ...map, [obligationId]: celebrationId }));
  }

  massLabel(mass: MassCelebrationSummary): string {
    const day = formatMassDayTime(mass.celebrated_on, mass.celebrated_at);
    const parts = [day, mass.place, mass.celebrant_name].filter(Boolean);
    return parts.join(' · ');
  }

  effectiveReason(): string {
    return (this.fixedReason ?? this.reason()).trim();
  }

  needsAddMass(): boolean {
    const unsaid = this.intentions.some((row) => !row.is_said);
    return unsaid && this.otherCelebrations.length === 0;
  }

  canSubmit(): boolean {
    if (!this.effectiveReason()) {
      return false;
    }
    const map = this.targets();
    return this.intentions
      .filter((row) => !row.is_said)
      .every((row) => {
        const target = map[row.obligation_id];
        return typeof target === 'string' && target.length > 0;
      });
  }

  close(): void {
    this.reason.set('');
    this.targets.set({});
    this.closed.emit();
  }

  submit(): void {
    const reason = this.effectiveReason();
    if (!reason) {
      return;
    }
    const map = this.targets();
    const reassignments = this.intentions
      .filter((row) => !row.is_said)
      .map((row) => ({
        obligation_id: row.obligation_id,
        celebration_id: map[row.obligation_id],
      }));

    this.confirmed.emit({ reason, reassignments });
  }
}
