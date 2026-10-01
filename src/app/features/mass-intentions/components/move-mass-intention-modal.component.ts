import { CommonModule } from '@angular/common';
import { Component, EventEmitter, Input, OnChanges, Output, SimpleChanges, computed, inject, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { NgSelectModule } from '@ng-select/ng-select';
import { ModalShellComponent } from '@shared/components/modal-shell/modal-shell.component';
import { MassIntentionsApiService } from '../services/mass-intentions-api.service';
import {
  MassDestinationSelectOption,
  toMassDestinationSelectOptions,
} from '../utils/mass-destination-select.util';
import { addDaysIso, isoDateLocal } from '../utils/mass-week.util';

@Component({
  selector: 'app-move-mass-intention-modal',
  standalone: true,
  imports: [CommonModule, FormsModule, ModalShellComponent, NgSelectModule],
  templateUrl: './move-mass-intention-modal.component.html',
  styleUrl: './move-mass-intention-modal.component.scss',
})
export class MoveMassIntentionModalComponent implements OnChanges {
  private readonly api = inject(MassIntentionsApiService);

  @Input() open = false;
  @Input() intentionIds: string[] = [];
  @Input() fromMassLabel = '';
  @Input() excludeCelebrationId: string | null = null;
  @Output() closed = new EventEmitter<void>();
  @Output() moved = new EventEmitter<void>();

  readonly saving = signal(false);
  readonly loadingMasses = signal(false);
  readonly errorMessage = signal('');
  readonly massOptions = signal<MassDestinationSelectOption[]>([]);
  readonly targetId = signal('');
  readonly rangeDays = signal(14);

  readonly modalTitle = computed(() =>
    this.intentionIds.length === 1 ? 'Move Intention to Another Mass' : 'Move Intentions to Another Mass'
  );

  intentionsSummary(): string {
    const n = this.intentionIds.length;
    return n === 1 ? '1 intention' : `${n} intentions`;
  }

  readonly compareDestinationId = (a: string | null | undefined, b: string | null | undefined): boolean =>
    String(a ?? '') === String(b ?? '');

  onDestinationChange(value: string | MassDestinationSelectOption | null | undefined): void {
    if (value === null || value === undefined || value === '') {
      this.targetId.set('');
      return;
    }
    if (typeof value === 'string') {
      this.targetId.set(value);
      return;
    }
    this.targetId.set(String(value.id));
  }

  ngOnChanges(changes: SimpleChanges): void {
    if (changes['open']?.currentValue) {
      this.targetId.set('');
      this.errorMessage.set('');
      this.rangeDays.set(14);
      this.loadMasses();
    }
  }

  setRange(days: number): void {
    if (this.rangeDays() === days) {
      return;
    }
    this.rangeDays.set(days);
    this.targetId.set('');
    this.loadMasses();
  }

  close(): void {
    if (!this.saving()) {
      this.closed.emit();
    }
  }

  submit(): void {
    const target = this.targetId();
    if (!target || this.intentionIds.length === 0 || this.saving()) {
      return;
    }
    this.saving.set(true);
    this.errorMessage.set('');
    const onSuccess = (): void => {
      this.saving.set(false);
      this.moved.emit();
      this.closed.emit();
    };
    const onError = (err: unknown): void => {
      this.saving.set(false);
      this.errorMessage.set(this.readError(err));
    };
    if (this.intentionIds.length === 1) {
      this.api.moveRequest(this.intentionIds[0], target).subscribe({ next: onSuccess, error: onError });
    } else {
      this.api.bulkMoveRequests(this.intentionIds, target).subscribe({ next: onSuccess, error: onError });
    }
  }

  private loadMasses(): void {
    this.loadingMasses.set(true);
    const from = isoDateLocal(new Date());
    const to = addDaysIso(from, this.rangeDays());
    const params: Record<string, string | number> = {
      from,
      to,
      assignable_only: 1,
      per_page: 100,
    };
    this.api.listCelebrations(params).subscribe({
      next: (res) => {
        const exclude = this.excludeCelebrationId;
        const eligible = (res.data ?? []).filter((m) => m.id !== exclude);
        this.massOptions.set(toMassDestinationSelectOptions(eligible));
        if (this.targetId() && !eligible.some((m) => m.id === this.targetId())) {
          this.targetId.set('');
        }
        this.loadingMasses.set(false);
      },
      error: () => {
        this.massOptions.set([]);
        this.loadingMasses.set(false);
      },
    });
  }

  private readError(err: unknown): string {
    if (err && typeof err === 'object' && 'error' in err) {
      const body = (err as { error?: { message?: string; errors?: Record<string, string[]> } }).error;
      if (body?.message) {
        return body.message;
      }
      if (body?.errors) {
        return Object.values(body.errors).flat().join(' ');
      }
    }
    return 'Could not move. Check the selected Mass and try again.';
  }
}
