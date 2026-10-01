import { CommonModule } from '@angular/common';
import { Component, EventEmitter, Input, OnChanges, Output, SimpleChanges, inject, signal } from '@angular/core';
import { FormBuilder, ReactiveFormsModule, Validators } from '@angular/forms';
import { RouterModule } from '@angular/router';
import { ToastService } from '@core/services/toast.service';
import { ModalShellComponent } from '@shared/components/modal-shell/modal-shell.component';
import {
  MassDayOverrideSlotDraft,
  MassIntentionsApiService,
  MassScheduleConflict,
} from '../services/mass-intentions-api.service';
import { formatMassDayTime } from '../utils/mass-celebration-display';
import { map, Observable } from 'rxjs';

const MAX_SLOTS = 8;

@Component({
  selector: 'app-special-day-schedule-modal',
  standalone: true,
  imports: [CommonModule, ReactiveFormsModule, RouterModule, ModalShellComponent],
  templateUrl: './special-day-schedule-modal.component.html',
  styleUrl: './special-day-schedule-modal.component.scss',
})
export class SpecialDayScheduleModalComponent implements OnChanges {
  private readonly api = inject(MassIntentionsApiService);
  private readonly toast = inject(ToastService);
  private readonly fb = inject(FormBuilder);

  @Input({ required: true }) open = false;
  @Input({ required: true }) overrideOn = '';
  @Output() closed = new EventEmitter<void>();
  @Output() saved = new EventEmitter<void>();

  readonly loading = signal(false);
  readonly saving = signal(false);
  readonly previewing = signal(false);
  readonly overrideId = signal<string | null>(null);
  readonly slots = signal<MassDayOverrideSlotDraft[]>([]);
  readonly previewCounts = signal<Record<string, number> | null>(null);
  readonly previewConflicts = signal<MassScheduleConflict[]>([]);
  readonly previewFingerprint = signal<string | null>(null);
  readonly previewError = signal<string | null>(null);
  readonly applyError = signal<string | null>(null);
  readonly keepingConflictId = signal<string | null>(null);

  readonly metaForm = this.fb.nonNullable.group({
    label: [''],
    closes_regular_masses: [false],
  });

  /** No default — user must choose replace or supplement (P15). */
  readonly modeForm = this.fb.group({
    mode: this.fb.control<'replace' | 'supplement' | null>(null, Validators.required),
  });

  ngOnChanges(changes: SimpleChanges): void {
    if (changes['open']?.currentValue && this.overrideOn) {
      this.resetState();
      this.loadExisting();
    }
  }

  close(): void {
    this.closed.emit();
  }

  mode(): 'replace' | 'supplement' | null {
    return this.modeForm.controls.mode.value;
  }

  addSlot(): void {
    if (this.slots().length >= MAX_SLOTS) {
      this.toast.error(`At most ${MAX_SLOTS} Mass times on one day.`);
      return;
    }
    this.slots.update((list) => [...list, { celebrated_at: '09:00', place: '', celebrant_name: '' }]);
    this.clearPreview();
  }

  removeSlot(index: number): void {
    this.slots.update((list) => list.filter((_, i) => i !== index));
    this.clearPreview();
  }

  updateSlotField(index: number, field: 'celebrated_at' | 'place' | 'celebrant_name', value: string): void {
    this.slots.update((list) => {
      const next = [...list];
      next[index] = { ...next[index], [field]: value };
      return next;
    });
    this.onFieldChange();
  }

  onFieldChange(): void {
    this.clearPreview();
  }

  runPreview(): void {
    if (this.modeForm.invalid) {
      this.toast.error('Choose whether to replace the regular schedule or add extra Masses.');
      return;
    }
    if (!this.validateSlots()) {
      return;
    }
    this.previewing.set(true);
    this.previewError.set(null);
    this.persistOverride()
      .subscribe({
        next: (id) => {
          this.api.previewDayOverride(id).subscribe({
            next: (res) => {
              this.previewCounts.set(res.data.counts);
              this.previewConflicts.set(res.data.conflicts ?? []);
              this.previewFingerprint.set(res.data.fingerprint);
              this.previewing.set(false);
            },
            error: (err) => {
              this.previewing.set(false);
              this.previewError.set(err?.error?.message ?? 'Could not preview this special day.');
            },
          });
        },
        error: (err) => {
          this.previewing.set(false);
          this.previewError.set(err?.error?.message ?? 'Could not save before preview.');
        },
      });
  }

  confirmApply(): void {
    const id = this.overrideId();
    const fingerprint = this.previewFingerprint();
    if (!id || !fingerprint) {
      this.toast.error('Preview the impact before confirming.');
      return;
    }
    this.saving.set(true);
    this.applyError.set(null);
    this.api.applyDayOverride(id, fingerprint).subscribe({
      next: (res) => {
        this.saving.set(false);
        const conflicts = res.data?.conflicts ?? [];
        this.toast.success('Special day schedule saved.');
        if (conflicts.length > 0) {
          this.toast.error(
            `${conflicts.length} Mass${conflicts.length === 1 ? '' : 'es'} could not be changed because intentions are scheduled on them.`
          );
        }
        this.saved.emit();
        this.close();
      },
      error: (err) => {
        this.saving.set(false);
        this.applyError.set(err?.error?.message ?? 'Could not apply this special day.');
        if (err?.status === 409) {
          this.clearPreview();
        }
      },
    });
  }

  removeSpecialDay(): void {
    const id = this.overrideId();
    if (!id) {
      return;
    }
    this.saving.set(true);
    this.api.inactivateDayOverride(id).subscribe({
      next: () => {
        this.saving.set(false);
        this.toast.success('Special day schedule removed.');
        this.saved.emit();
        this.close();
      },
      error: () => {
        this.saving.set(false);
        this.toast.error('Could not remove the special day schedule.');
      },
    });
  }

  keepConflictMass(celebrationId: string): void {
    this.keepingConflictId.set(celebrationId);
    this.api.keepCelebrationOnSchedule(celebrationId).subscribe({
      next: () => {
        this.previewConflicts.update((list) => list.filter((r) => r.celebration_id !== celebrationId));
        this.keepingConflictId.set(null);
        this.toast.success('This Mass will stay as-is.');
      },
      error: () => {
        this.keepingConflictId.set(null);
        this.toast.error('Could not keep this Mass.');
      },
    });
  }

  conflictLabel(row: MassScheduleConflict): string {
    const when = formatMassDayTime(row.celebrated_on ?? '', row.celebrated_at ?? null);
    const reason =
      row.reason_code === 'suppress_blocked'
        ? 'Cannot remove from schedule'
        : row.reason_code === 'update_blocked'
          ? 'Cannot change time or place'
          : 'Needs attention';
    return `${when} — ${reason} (${row.intention_count} intention${row.intention_count === 1 ? '' : 's'})`;
  }

  private loadExisting(): void {
    this.loading.set(true);
    this.api.listDayOverrides(this.overrideOn, this.overrideOn).subscribe({
      next: (res) => {
        const active = (res.data ?? []).find((row) => row.status === 'active');
        if (active) {
          this.overrideId.set(active.id);
          this.modeForm.patchValue({ mode: active.mode });
          this.metaForm.patchValue({
            label: active.label ?? '',
            closes_regular_masses: active.closes_regular_masses,
          });
          this.slots.set(
            active.slots.map((s) => ({
              slot_id: s.slot_id,
              celebrated_at: s.celebrated_at?.length > 5 ? s.celebrated_at.slice(0, 5) : s.celebrated_at,
              place: s.place ?? '',
              celebrant_name: s.celebrant_name ?? '',
            }))
          );
        }
        this.loading.set(false);
      },
      error: () => this.loading.set(false),
    });
  }

  private persistOverride(): Observable<string> {
    const mode = this.mode();
    if (!mode) {
      throw new Error('mode required');
    }
    const meta = this.metaForm.getRawValue();
    const body = {
      override_on: this.overrideOn,
      mode,
      closes_regular_masses: meta.closes_regular_masses,
      label: meta.label || null,
      slots: this.slots().map((s) => ({
        slot_id: s.slot_id,
        celebrated_at: s.celebrated_at,
        place: s.place || null,
        celebrant_name: s.celebrant_name || null,
      })),
    };
    return this.api.saveDayOverride(body).pipe(
      map((res) => {
        this.overrideId.set(res.data.id);
        return res.data.id;
      })
    );
  }

  private validateSlots(): boolean {
    const mode = this.mode();
    const closes = this.metaForm.controls.closes_regular_masses.value;
    if (this.slots().length === 0 && !(mode === 'replace' && closes)) {
      this.toast.error('Add at least one Mass time, or mark that regular Masses are closed on this date.');
      return false;
    }
    return true;
  }

  private resetState(): void {
    this.overrideId.set(null);
    this.slots.set([]);
    this.modeForm.reset({ mode: null });
    this.metaForm.reset({ label: '', closes_regular_masses: false });
    this.clearPreview();
    this.previewError.set(null);
    this.applyError.set(null);
  }

  private clearPreview(): void {
    this.previewCounts.set(null);
    this.previewConflicts.set([]);
    this.previewFingerprint.set(null);
  }
}
