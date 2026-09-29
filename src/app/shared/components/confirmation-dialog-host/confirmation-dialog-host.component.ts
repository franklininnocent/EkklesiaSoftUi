/**
 * App-root host for imperative confirmation dialogs.
 */

import { Component, ChangeDetectionStrategy, inject } from '@angular/core';
import { AsyncPipe } from '@angular/common';
import {
  ConfirmationDialogService,
  ConfirmationDialogVariant,
} from '@core/services/confirmation-dialog.service';
import { ConfirmationModalComponent, ConfirmationResult } from '../confirmation-modal/confirmation-modal.component';

@Component({
  selector: 'app-confirmation-dialog-host',
  standalone: true,
  imports: [AsyncPipe, ConfirmationModalComponent],
  template: `
    @if (state$ | async; as state) {
      <app-confirmation-modal
        [show]="state.show"
        [title]="state.options?.title ?? 'Confirm Action'"
        [message]="state.options?.message ?? ''"
        [confirmText]="state.options?.confirmText ?? 'Confirm'"
        [cancelText]="state.options?.cancelText ?? 'Cancel'"
        [confirmButtonClass]="confirmButtonClass(state.options?.variant)"
        [showDescriptionInput]="state.options?.showDescriptionInput ?? false"
        [descriptionLabel]="state.options?.descriptionLabel ?? 'Description (Optional)'"
        [descriptionPlaceholder]="state.options?.descriptionPlaceholder ?? 'Enter a reason or note...'"
        [descriptionRequired]="state.options?.descriptionRequired ?? false"
        [externalSubmitting]="state.submitting"
        [nested]="state.options?.nested ?? true"
        (confirmed)="onConfirmed($event)"
        (cancelled)="onCancelled()"
        (closed)="onCancelled()"
      />
    }
  `,
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class ConfirmationDialogHostComponent {
  private readonly confirmationDialog = inject(ConfirmationDialogService);
  readonly state$ = this.confirmationDialog.state$;

  confirmButtonClass(variant?: ConfirmationDialogVariant): string {
    return variant === 'danger' ? 'btn-danger' : 'btn-primary';
  }

  onConfirmed(result: ConfirmationResult): void {
    this.confirmationDialog.resolve({
      confirmed: true,
      description: result.description,
    });
  }

  onCancelled(): void {
    this.confirmationDialog.resolve({ confirmed: false });
  }
}
