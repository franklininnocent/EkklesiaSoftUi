import { CommonModule } from '@angular/common';
import { Component, EventEmitter, Input, Output, inject, signal } from '@angular/core';
import { FormBuilder, ReactiveFormsModule, Validators } from '@angular/forms';
import { ModalShellComponent } from '@shared/components/modal-shell/modal-shell.component';
import { MassIntentionsApiService } from '../services/mass-intentions-api.service';

@Component({
  selector: 'app-add-mass-payment-modal',
  standalone: true,
  imports: [CommonModule, ReactiveFormsModule, ModalShellComponent],
  template: `
    <app-modal-shell
      *ngIf="open && requestId"
      title="Add payment"
      size="sm"
      headerVariant="compact"
      bodyPadding="none"
      (closeRequested)="close()"
    >
      <form class="cf-split-form" [formGroup]="form" (ngSubmit)="submit()">
        <div class="cf-split-form__body">
          <label class="cf-split-field">
            <span class="cf-split-field__label">Amount</span>
            <input class="cf-control" type="number" step="0.01" min="0" formControlName="amount" />
          </label>
          <label class="cf-split-field">
            <span class="cf-split-field__label">Method</span>
            <select class="cf-control" formControlName="payment_method">
              <option value="cash">Cash</option>
              <option value="cheque">Cheque</option>
              <option value="transfer">Transfer</option>
              <option value="other">Other</option>
            </select>
          </label>
          <label class="cf-split-field">
            <span class="cf-split-field__label">Date</span>
            <input class="cf-control" type="date" formControlName="received_on" />
          </label>
        </div>
        <div class="cf-split-form-actions">
          <button type="button" class="cf-btn cf-btn-ghost" (click)="close()">Cancel</button>
          <button type="submit" class="cf-btn cf-btn-primary" [disabled]="form.invalid || saving()">Save</button>
        </div>
      </form>
    </app-modal-shell>
  `,
})
export class AddMassPaymentModalComponent {
  private readonly fb = inject(FormBuilder);
  private readonly api = inject(MassIntentionsApiService);

  @Input() open = false;
  @Input() requestId: string | null = null;
  @Output() closed = new EventEmitter<void>();
  @Output() saved = new EventEmitter<void>();

  readonly saving = signal(false);

  readonly form = this.fb.nonNullable.group({
    amount: ['', [Validators.required, Validators.min(0.01)]],
    payment_method: ['cash'],
    received_on: [new Date().toISOString().slice(0, 10)],
  });

  close(): void {
    this.closed.emit();
  }

  submit(): void {
    if (!this.requestId || this.form.invalid || this.saving()) {
      return;
    }
    this.saving.set(true);
    this.api.recordReceipt(this.requestId, this.form.getRawValue()).subscribe({
      next: () => {
        this.saving.set(false);
        this.saved.emit();
        this.close();
      },
      error: () => this.saving.set(false),
    });
  }
}
