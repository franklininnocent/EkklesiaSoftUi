/**
 * Confirmation Modal — wraps app-modal-shell with CF confirm/cancel actions.
 * Public API preserved for existing call sites.
 */

import {
  Component,
  EventEmitter,
  Input,
  Output,
  OnChanges,
  SimpleChanges,
  ChangeDetectionStrategy,
} from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { ModalShellComponent } from '../modal-shell/modal-shell.component';

export interface ConfirmationResult {
  confirmed: boolean;
  description?: string;
}

@Component({
  selector: 'app-confirmation-modal',
  standalone: true,
  imports: [CommonModule, FormsModule, ModalShellComponent],
  templateUrl: './confirmation-modal.component.html',
  styleUrls: ['./confirmation-modal.component.scss'],
  changeDetection: ChangeDetectionStrategy.Eager,
})
export class ConfirmationModalComponent implements OnChanges {
  @Input() show = false;
  @Input() title = 'Confirm Action';
  @Input() message = 'Are you sure you want to proceed?';
  @Input() confirmText = 'Confirm';
  @Input() cancelText = 'Cancel';
  /** Legacy: 'btn-primary' | 'btn-danger' | 'btn-warning' — mapped to CF button classes. */
  @Input() confirmButtonClass = 'btn-primary';
  @Input() showDescriptionInput = false;
  @Input() descriptionLabel = 'Description (Optional)';
  @Input() descriptionPlaceholder = 'Enter a reason or note...';
  @Input() descriptionMaxLength = 500;
  /** When true, the description field must be non-empty before confirm is enabled. */
  @Input() descriptionRequired = false;
  /** Parent-controlled busy state for async confirm handlers (keeps modal open). */
  @Input() externalSubmitting = false;
  /** When true, stacks above an already-open modal. */
  @Input() nested = true;

  @Output() confirmed = new EventEmitter<ConfirmationResult>();
  @Output() cancelled = new EventEmitter<void>();
  @Output() closed = new EventEmitter<void>();

  description = '';
  isSubmitting = false;

  ngOnChanges(changes: SimpleChanges): void {
    if (changes['show'] && this.show) {
      this.description = '';
      this.isSubmitting = false;
    }
  }

  get confirmBtnClass(): string {
    if (this.confirmButtonClass === 'btn-danger') {
      return 'cf-btn cf-btn-danger';
    }
    if (this.confirmButtonClass === 'btn-warning') {
      return 'cf-btn cf-btn-primary';
    }
    return 'cf-btn cf-btn-primary';
  }

  get remainingCharacters(): number {
    return this.descriptionMaxLength - this.description.length;
  }

  get isDescriptionTooLong(): boolean {
    return this.description.length > this.descriptionMaxLength;
  }

  get isDescriptionMissing(): boolean {
    return this.descriptionRequired && this.showDescriptionInput && !this.description.trim();
  }

  get isBusy(): boolean {
    return this.isSubmitting || this.externalSubmitting;
  }

  onCloseRequested(): void {
    this.onCancel();
  }

  onConfirm(): void {
    if (this.isBusy || this.isDescriptionTooLong || this.isDescriptionMissing) {
      return;
    }

    const result: ConfirmationResult = {
      confirmed: true,
      description: this.description.trim() || undefined,
    };

    if (this.externalSubmitting) {
      this.confirmed.emit(result);
      return;
    }

    this.isSubmitting = true;
    this.confirmed.emit(result);
    this.reset();
  }

  onCancel(): void {
    if (this.isBusy) {
      return;
    }

    this.cancelled.emit();
    this.closed.emit();
    this.reset();
  }

  private reset(): void {
    this.description = '';
    this.isSubmitting = false;
  }
}
