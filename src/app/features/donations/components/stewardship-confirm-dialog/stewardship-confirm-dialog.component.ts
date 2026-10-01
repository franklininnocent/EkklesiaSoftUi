import { CommonModule } from '@angular/common';
import { Component, EventEmitter, Input, Output } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { CfBrandLoaderComponent } from '@shared/components/cf-brand-loader/cf-brand-loader.component';

export interface StewardshipConfirmResult {
  reason: string;
  amount: number | null;
}

@Component({
  selector: 'app-stewardship-confirm-dialog',
  standalone: true,
  imports: [CommonModule, FormsModule, CfBrandLoaderComponent],
  template: `
    <div class="cf-dialog-backdrop" (click)="onCancel()">
      <div
        class="cf-dialog"
        role="dialog"
        aria-modal="true"
        [attr.aria-labelledby]="titleId"
        [attr.aria-describedby]="messageId"
        (click)="$event.stopPropagation()"
      >
        <h2 [id]="titleId" class="cf-section-title">{{ title }}</h2>
        <p [id]="messageId" class="cf-meta">{{ message }}</p>

        <label class="cf-field" *ngIf="showAmount">
          <span>Amount</span>
          <input
            type="number"
            min="0.01"
            step="0.01"
            [(ngModel)]="amount"
            name="confirmAmount"
            [attr.aria-label]="'Amount to ' + confirmLabel"
          />
        </label>

        <label class="cf-field">
          <span>Reason <span class="req" aria-hidden="true">*</span></span>
          <textarea
            [(ngModel)]="reason"
            name="confirmReason"
            rows="3"
            required
            [attr.aria-required]="true"
            [attr.aria-label]="'Reason for ' + confirmLabel"
          ></textarea>
        </label>

        <p class="cf-state cf-state--error" *ngIf="error" role="alert">{{ error }}</p>

        <div class="cf-dialog__actions">
          <button
            type="button"
            class="cf-btn cf-dialog__btn"
            (click)="onCancel()"
            [disabled]="saving"
          >
            Cancel
          </button>
          <button
            type="button"
            class="cf-btn cf-btn-primary cf-dialog__btn cf-dialog__btn--confirm"
            [disabled]="!canConfirm"
            (click)="onConfirm()"
          >
            <app-cf-brand-loader *ngIf="saving" size="button" label="Working" [showLabel]="false" />
            {{ saving ? 'Working…' : confirmLabel }}
          </button>
        </div>
      </div>
    </div>
  `,
  styles: [`
    .cf-dialog-backdrop {
      position: fixed; inset: 0; z-index: 80;
      background: rgba(15, 23, 42, 0.45);
      display: grid; place-items: center; padding: 1rem;
    }
    .cf-dialog {
      width: min(480px, 100%);
      background: var(--cf-surface, #fff);
      border: 1px solid var(--cf-border, #e2e8f0);
      border-radius: 12px;
      padding: 1.25rem;
      display: grid;
      gap: 0.75rem;
      box-shadow: 0 16px 40px rgba(15, 23, 42, 0.18);
    }
    .cf-field { display: grid; gap: 0.35rem; font-size: 0.9rem; }
    .cf-field textarea, .cf-field input {
      width: 100%; border: 1px solid var(--cf-border, #cbd5e1); border-radius: 8px; padding: 0.5rem 0.65rem;
    }
    .cf-dialog__actions {
      display: flex;
      justify-content: flex-end;
      flex-wrap: wrap;
      gap: 0.5rem;
    }
    .cf-dialog__btn {
      width: auto;
      min-width: 5.5rem;
      min-height: var(--cf-control-height, 2.5rem);
      height: auto;
      padding: 0.45rem 1rem;
    }
    .cf-dialog__btn--confirm {
      display: inline-flex;
      align-items: center;
      justify-content: center;
      gap: 0.5rem;
    }
    .req { color: var(--cf-critical, #b91c1c); }
  `]
})
export class StewardshipConfirmDialogComponent {
  @Input({ required: true }) title = '';
  @Input({ required: true }) message = '';
  @Input() confirmLabel = 'Confirm';
  @Input() showAmount = false;
  @Input() amount: number | null = null;
  @Input() saving = false;
  @Input() error: string | null = null;

  @Output() cancelled = new EventEmitter<void>();
  @Output() confirmed = new EventEmitter<StewardshipConfirmResult>();

  reason = '';
  readonly titleId = `stewardship-confirm-title-${Math.random().toString(16).slice(2)}`;
  readonly messageId = `stewardship-confirm-message-${Math.random().toString(16).slice(2)}`;

  get canConfirm(): boolean {
    if (this.saving || !this.reason.trim()) {
      return false;
    }
    if (this.showAmount && (!this.amount || this.amount <= 0)) {
      return false;
    }
    return true;
  }

  onCancel(): void {
    if (!this.saving) {
      this.cancelled.emit();
    }
  }

  onConfirm(): void {
    if (!this.canConfirm) {
      return;
    }
    this.confirmed.emit({
      reason: this.reason.trim(),
      amount: this.showAmount ? this.amount : null
    });
  }
}
