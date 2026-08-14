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

/** Minimal sacrament fields needed to start a historical correction. */
export interface CorrectSacramentTarget {
  id: number;
  lock_version?: number;
  recipient_name?: string;
}

@Component({
  selector: 'app-correct-sacrament-dialog',
  standalone: true,
  imports: [CommonModule, FormsModule, ModalShellComponent],
  templateUrl: './correct-sacrament-dialog.component.html',
  styleUrl: './correct-sacrament-dialog.component.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class CorrectSacramentDialogComponent implements OnChanges {
  @Input() show = false;
  @Input() sacrament: CorrectSacramentTarget | null = null;

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
    return this.reasonTrimmed.length >= this.minReasonLength;
  }

  onConfirm(): void {
    if (!this.canConfirm) {
      return;
    }
    this.confirmed.emit({ reason: this.reasonTrimmed });
    this.reason = '';
  }

  onCancel(): void {
    this.cancelled.emit();
    this.reason = '';
  }
}
