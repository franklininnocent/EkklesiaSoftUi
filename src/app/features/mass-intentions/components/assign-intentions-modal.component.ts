import { CommonModule } from '@angular/common';
import { Component, EventEmitter, Input, OnChanges, Output, inject, signal } from '@angular/core';
import { ModalShellComponent } from '@shared/components/modal-shell/modal-shell.component';
import {
  MassIntentionsApiService,
  PendingScheduleObligation,
} from '../services/mass-intentions-api.service';

@Component({
  selector: 'app-assign-intentions-modal',
  standalone: true,
  imports: [CommonModule, ModalShellComponent],
  template: `
    <app-modal-shell
      *ngIf="open"
      title="Put on this Mass"
      size="sm"
      headerVariant="compact"
      bodyPadding="none"
      (closeRequested)="close()"
    >
      <form class="cf-split-form" (ngSubmit)="submit()">
        <div class="cf-split-form__body assign-intentions__body">
          @if (loading()) {
            <p>Loading…</p>
          } @else if (options().length === 0) {
            <p class="assign-intentions__muted">No intentions are waiting to be scheduled.</p>
          } @else {
            @for (row of options(); track row.obligation_id) {
              <label class="assign-intentions__row">
                <input
                  type="checkbox"
                  [checked]="selected().has(row.obligation_id)"
                  (change)="toggle(row.obligation_id)"
                />
                <span>
                  <strong>{{ row.beneficiary_name }}</strong>
                  <span class="assign-intentions__text">{{ row.intention_text }}</span>
                </span>
              </label>
            }
          }
          @if (needsDateVarianceReason()) {
            <label class="assign-intentions__reason">
              <span>Why is this Mass on a different day?</span>
              <textarea
                class="cf-control"
                rows="2"
                [value]="dateVarianceReason()"
                (input)="dateVarianceReason.set($any($event.target).value)"
              ></textarea>
            </label>
          }
        </div>
        <div class="cf-split-form-actions">
          <button type="button" class="cf-btn cf-btn-ghost" (click)="close()">Cancel</button>
          <button
            type="submit"
            class="cf-btn cf-btn-primary"
            [disabled]="selected().size === 0 || saving() || (needsDateVarianceReason() && !dateVarianceReason().trim())"
          >
            Add to Mass
          </button>
        </div>
      </form>
    </app-modal-shell>
  `,
  styles: [
    `
      .assign-intentions__body {
        display: grid;
        gap: var(--cf-space-2);
        max-height: 20rem;
        overflow: auto;
      }
      .assign-intentions__row {
        display: flex;
        gap: var(--cf-space-2);
        align-items: flex-start;
        min-height: var(--cf-touch-target);
        font-size: var(--cf-text-base);
      }
      .assign-intentions__text {
        display: block;
        font-size: var(--cf-text-sm);
        color: var(--cf-color-text-muted);
      }
      .assign-intentions__muted {
        font-size: var(--cf-text-sm);
        color: var(--cf-color-text-muted);
      }
      .assign-intentions__reason {
        display: grid;
        gap: var(--cf-space-2);
        font-size: var(--cf-text-base);
      }
    `,
  ],
})
export class AssignIntentionsModalComponent implements OnChanges {
  private readonly api = inject(MassIntentionsApiService);

  @Input() open = false;
  @Input() celebrationId = '';
  @Input() massCelebratedOn = '';
  @Output() closed = new EventEmitter<void>();
  @Output() assigned = new EventEmitter<void>();

  readonly loading = signal(false);
  readonly saving = signal(false);
  readonly options = signal<PendingScheduleObligation[]>([]);
  readonly selected = signal(new Set<string>());
  readonly dateVarianceReason = signal('');

  ngOnChanges(): void {
    if (this.open) {
      this.load();
    }
  }

  toggle(id: string): void {
    const next = new Set(this.selected());
    if (next.has(id)) {
      next.delete(id);
    } else {
      next.add(id);
    }
    this.selected.set(next);
  }

  close(): void {
    this.selected.set(new Set());
    this.dateVarianceReason.set('');
    this.closed.emit();
  }

  needsDateVarianceReason(): boolean {
    if (!this.massCelebratedOn) {
      return false;
    }
    const selectedIds = this.selected();
    return this.options().some(
      (row) =>
        selectedIds.has(row.obligation_id) &&
        row.date_must_be_kept &&
        row.requested_date &&
        row.requested_date !== this.massCelebratedOn
    );
  }

  submit(): void {
    const ids = [...this.selected()];
    if (!ids.length || !this.celebrationId) {
      return;
    }
    this.saving.set(true);
    const reason = this.needsDateVarianceReason() ? this.dateVarianceReason().trim() : undefined;
    this.api.assignObligationsToCelebration(this.celebrationId, ids, reason).subscribe({
      next: () => {
        this.saving.set(false);
        this.selected.set(new Set());
        this.dateVarianceReason.set('');
        this.assigned.emit();
      },
      error: () => this.saving.set(false),
    });
  }

  private load(): void {
    this.loading.set(true);
    this.api.listPendingScheduleObligations().subscribe({
      next: (res) => {
        this.options.set(res.data ?? []);
        this.loading.set(false);
      },
      error: () => this.loading.set(false),
    });
  }
}
