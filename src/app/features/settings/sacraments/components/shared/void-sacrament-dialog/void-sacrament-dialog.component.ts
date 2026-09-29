import {
  ChangeDetectionStrategy,
  Component,
  EventEmitter,
  Input,
  OnChanges,
  Output,
  SimpleChanges,
} from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { ModalShellComponent } from '@shared/components/modal-shell/modal-shell.component';

/** Minimal sacrament fields needed to void a register record. */
export interface VoidSacramentTarget {
  id: number;
  lock_version?: number;
  recipient_name?: string;
}

@Component({
  selector: 'app-void-sacrament-dialog',
  standalone: true,
  imports: [CommonModule, FormsModule, ModalShellComponent],
  templateUrl: './void-sacrament-dialog.component.html',
  styleUrl: './void-sacrament-dialog.component.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class VoidSacramentDialogComponent implements OnChanges {
  @Input() show = false;
  @Input() sacrament: VoidSacramentTarget | null = null;
  /** Parent sets true while void API is in flight. */
  @Input() submitting = false;

  @Output() confirmed = new EventEmitter<{ reason: string }>();
  @Output() cancelled = new EventEmitter<void>();

  reason = '';

  readonly minReasonLength = 3;

  ngOnChanges(changes: SimpleChanges): void {
    if (changes['show'] && this.show) {
      this.reason = '';
    }
  }

  get recipientLabel(): string {
    return this.sacrament?.recipient_name?.trim() || 'this recipient';
  }

  get reasonTrimmed(): string {
    return this.reason.trim();
  }

  get canConfirm(): boolean {
    return this.reasonTrimmed.length >= this.minReasonLength && !this.submitting;
  }

  onConfirm(): void {
    if (!this.canConfirm) {
      return;
    }
    this.confirmed.emit({ reason: this.reasonTrimmed });
  }

  onCancel(): void {
    if (this.submitting) {
      return;
    }
    this.cancelled.emit();
    this.reason = '';
  }
}
