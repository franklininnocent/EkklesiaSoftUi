import { CommonModule } from '@angular/common';
import { Component, EventEmitter, Input, OnChanges, Output, SimpleChanges, inject, signal } from '@angular/core';
import { FormBuilder, ReactiveFormsModule, Validators } from '@angular/forms';
import { ModalShellComponent } from '@shared/components/modal-shell/modal-shell.component';
import { MassIntentionsApiService } from '../services/mass-intentions-api.service';

export interface TransferParishTarget {
  tenant_id: number;
  name: string;
}

@Component({
  selector: 'app-transfer-intention-modal',
  standalone: true,
  imports: [CommonModule, ReactiveFormsModule, ModalShellComponent],
  template: `
    <app-modal-shell
      *ngIf="open"
      title="Transfer to another parish"
      size="sm"
      headerVariant="compact"
      bodyPadding="none"
      (closeRequested)="close()"
    >
      <form class="cf-split-form" [formGroup]="form" (ngSubmit)="submit()">
        <div class="cf-split-form__body">
          <p class="transfer-modal__lead">
            The other parish must accept before the intention moves. Only parishes in your diocese are listed.
          </p>
          @if (loadingTargets()) {
            <p>Loading parishes…</p>
          } @else if (targets().length === 0) {
            <p class="transfer-modal__warn">No other parish in your diocese has Mass intentions enabled.</p>
          } @else {
            <label class="cf-split-field">
              <span class="cf-split-field__label">Receiving parish</span>
              <select class="cf-control" formControlName="to_tenant_id">
                <option value="">Choose a parish…</option>
                @for (p of targets(); track p.tenant_id) {
                  <option [value]="p.tenant_id">{{ p.name }}</option>
                }
              </select>
            </label>
            <label class="cf-split-field">
              <span class="cf-split-field__label">Note (optional)</span>
              <textarea class="cf-control" rows="2" formControlName="note"></textarea>
            </label>
          }
        </div>
        <div class="cf-split-form-actions">
          <button type="button" class="cf-btn cf-btn-ghost" (click)="close()">Cancel</button>
          <button
            type="submit"
            class="cf-btn cf-btn-primary"
            [disabled]="form.invalid || saving() || targets().length === 0"
          >
            Send transfer
          </button>
        </div>
      </form>
    </app-modal-shell>
  `,
  styles: [
    `
      .transfer-modal__lead {
        font-size: var(--cf-text-sm);
        color: var(--cf-color-text-muted);
        margin: 0;
      }
      .transfer-modal__warn {
        font-size: var(--cf-text-base);
        color: var(--cf-color-danger);
        margin: 0;
      }
    `,
  ],
})
export class TransferIntentionModalComponent implements OnChanges {
  private readonly fb = inject(FormBuilder);
  private readonly api = inject(MassIntentionsApiService);

  @Input() open = false;
  @Input() requestId = '';
  @Output() closed = new EventEmitter<void>();
  @Output() transferred = new EventEmitter<void>();

  readonly saving = signal(false);
  readonly loadingTargets = signal(false);
  readonly targets = signal<TransferParishTarget[]>([]);

  readonly form = this.fb.nonNullable.group({
    to_tenant_id: ['', Validators.required],
    note: [''],
  });

  ngOnChanges(changes: SimpleChanges): void {
    if (changes['open']?.currentValue) {
      this.form.reset();
      this.loadTargets();
    }
  }

  close(): void {
    this.closed.emit();
  }

  submit(): void {
    if (this.form.invalid || this.saving() || !this.requestId) {
      return;
    }
    const raw = this.form.getRawValue();
    this.saving.set(true);
    this.api
      .initiateTransfer(this.requestId, Number(raw.to_tenant_id), raw.note.trim() || undefined)
      .subscribe({
        next: () => {
          this.saving.set(false);
          this.transferred.emit();
          this.close();
        },
        error: () => this.saving.set(false),
      });
  }

  private loadTargets(): void {
    this.loadingTargets.set(true);
    this.api.listTransferTargets().subscribe({
      next: (res) => {
        this.targets.set(res.data ?? []);
        this.loadingTargets.set(false);
      },
      error: () => this.loadingTargets.set(false),
    });
  }
}
