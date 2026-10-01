import { CommonModule } from '@angular/common';
import { Component, inject, signal } from '@angular/core';
import { FormBuilder, FormsModule, ReactiveFormsModule } from '@angular/forms';
import { ActivatedRoute, Router, RouterModule } from '@angular/router';
import { ConfirmationDialogService } from '@core/services/confirmation-dialog.service';
import { ToastService } from '@core/services/toast.service';
import {
  ActiveFilter,
  AdvancedSearchPanelComponent,
  SearchField,
} from '@shared/components/advanced-search-panel/advanced-search-panel.component';
import { LoadingSkeletonComponent } from '@shared/components/loading-skeleton/loading-skeleton.component';
import { ListToolbarComponent } from '@shared/components/list-toolbar/list-toolbar.component';
import { PageHeaderComponent } from '@shared/components/page-header/page-header.component';
import { Observable, combineLatest, map, of } from 'rxjs';
import {
  MassIntentionsApiService,
  MassScheduleConflict,
  MassScheduleSlotDraft,
} from '../services/mass-intentions-api.service';
import { formatMassDayTime } from '../utils/mass-celebration-display';
import { isoDateLocal, MASS_WEEKDAY_LABELS } from '../utils/mass-week.util';

const MAX_SLOTS_PER_DAY = 8;

type SourceMode = 'inherit' | 'override' | 'unset';

interface EditableSlot extends MassScheduleSlotDraft {
  place: string;
  celebrant_name: string;
}

export type MassScheduleGenerationStatus =
  | { kind: 'hidden' }
  | { kind: 'ok'; generatedThrough: string }
  | { kind: 'attention'; generatedThrough: string; requiredThrough: string }
  | { kind: 'failed'; message: string };

@Component({
  selector: 'app-mass-regular-schedule-page',
  standalone: true,
  imports: [
    CommonModule,
    RouterModule,
    ReactiveFormsModule,
    FormsModule,
    PageHeaderComponent,
    LoadingSkeletonComponent,
    ListToolbarComponent,
    AdvancedSearchPanelComponent,
  ],
  templateUrl: './mass-regular-schedule.page.html',
  styleUrl: './mass-regular-schedule.page.scss',
})
export class MassRegularSchedulePageComponent {
  private readonly api = inject(MassIntentionsApiService);
  private readonly toast = inject(ToastService);
  private readonly confirm = inject(ConfirmationDialogService);
  private readonly fb = inject(FormBuilder);
  private readonly route = inject(ActivatedRoute);

  readonly isTemporary = signal(false);
  readonly weekdays = MASS_WEEKDAY_LABELS.map((label, index) => ({ label, weekday: index }));
  readonly weekOfMonthOptions = [
    { value: '1', label: '1st' },
    { value: '2', label: '2nd' },
    { value: '3', label: '3rd' },
    { value: '4', label: '4th' },
    { value: 'last', label: 'Last' },
  ];

  readonly loading = signal(true);
  readonly loadError = signal<string | null>(null);
  readonly saving = signal(false);
  readonly previewing = signal(false);
  readonly scheduleId = signal<string | null>(null);
  readonly slots = signal<EditableSlot[]>([]);
  readonly dirty = signal(false);
  readonly previewCounts = signal<Record<string, number> | null>(null);
  readonly previewConflicts = signal<MassScheduleConflict[]>([]);
  readonly previewFingerprint = signal<string | null>(null);
  readonly previewError = signal<string | null>(null);
  readonly applyError = signal<string | null>(null);
  readonly generationStatus = signal<MassScheduleGenerationStatus>({ kind: 'hidden' });
  readonly generationRetrying = signal(false);
  readonly showDefaultsPanel = signal(false);
  defaultsSearchFields: SearchField[] = [];
  readonly stalePreview = signal(false);
  readonly keepingConflictId = signal<string | null>(null);
  readonly applyingProposalId = signal<string | null>(null);
  readonly markingScheduleChangedId = signal<string | null>(null);
  readonly scheduleStatus = signal('active');
  readonly revisionHistory = signal<{ revision_number: number; status: string; effective_from?: string | null; effective_to?: string | null }[]>([]);
  readonly lifecycleBusy = signal(false);

  private readonly router = inject(Router);

  private baselineSnapshot = '';

  readonly defaultsForm = this.fb.nonNullable.group({
    default_place: [''],
    default_celebrant_name: [''],
    apply_from: [isoDateLocal(new Date()), []],
    effective_to: [isoDateLocal(new Date()), []],
  });

  constructor() {
    this.defaultsForm.valueChanges.subscribe(() => {
      this.markDirty();
      this.clearPreview();
    });
    this.refreshGenerationStatus();
    this.initDefaultsSearchFields();
    combineLatest([this.route.paramMap, this.route.queryParamMap]).subscribe(([params, query]) => {
      const scheduleId = params.get('scheduleId');
      const legacyTempId = query.get('temp');
      if (legacyTempId && !scheduleId) {
        void this.router.navigate(['/mass-intentions/masses/temporaries', legacyTempId], { replaceUrl: true });
        return;
      }
      if (scheduleId) {
        this.isTemporary.set(true);
        this.reloadTemporary(scheduleId);
        return;
      }
      this.isTemporary.set(false);
      this.reloadRegular();
    });
  }

  generationAttention(): Extract<MassScheduleGenerationStatus, { kind: 'attention' }> | null {
    const status = this.generationStatus();
    return status.kind === 'attention' ? status : null;
  }

  generationFailed(): Extract<MassScheduleGenerationStatus, { kind: 'failed' }> | null {
    const status = this.generationStatus();
    return status.kind === 'failed' ? status : null;
  }

  generationOk(): Extract<MassScheduleGenerationStatus, { kind: 'ok' }> | null {
    const status = this.generationStatus();
    return status.kind === 'ok' ? status : null;
  }

  defaultsDrawerFilterCount(): number {
    return this.getActiveDefaultsFilters().length;
  }

  getActiveDefaultsFilters(): ActiveFilter[] {
    const values = this.defaultsForm.getRawValue();
    const filters: ActiveFilter[] = [];
    const place = values.default_place.trim();
    if (place) {
      filters.push({ key: 'default_place', label: 'Default place', value: place, displayValue: place });
    }
    const priest = values.default_celebrant_name.trim();
    if (priest) {
      filters.push({
        key: 'default_celebrant_name',
        label: 'Default priest',
        value: priest,
        displayValue: priest,
      });
    }
    if (values.apply_from) {
      filters.push({
        key: 'apply_from',
        label: this.isTemporary() ? 'Starts on' : 'Changes take effect from',
        value: values.apply_from,
        displayValue: values.apply_from,
      });
    }
    if (this.isTemporary() && values.effective_to) {
      filters.push({
        key: 'effective_to',
        label: 'Ends on',
        value: values.effective_to,
        displayValue: values.effective_to,
      });
    }
    return filters;
  }

  openDefaultsPanel(): void {
    this.initDefaultsSearchFields();
    this.syncDefaultsSearchFields();
    this.showDefaultsPanel.set(true);
  }

  onDefaultsPanelApply(values: Record<string, unknown>): void {
    const current = this.defaultsForm.getRawValue();
    this.defaultsForm.patchValue({
      default_place:
        values['default_place'] !== undefined ? String(values['default_place']) : current.default_place,
      default_celebrant_name:
        values['default_celebrant_name'] !== undefined
          ? String(values['default_celebrant_name'])
          : current.default_celebrant_name,
      apply_from:
        values['apply_from'] !== undefined
          ? String(values['apply_from'])
          : current.apply_from || isoDateLocal(new Date()),
      ...(this.isTemporary()
        ? {
            effective_to:
              values['effective_to'] !== undefined
                ? String(values['effective_to'])
                : current.effective_to || isoDateLocal(new Date()),
          }
        : {}),
    });
    this.showDefaultsPanel.set(false);
  }

  onDefaultsPanelClear(): void {
    this.defaultsForm.patchValue({
      default_place: '',
      default_celebrant_name: '',
      apply_from: isoDateLocal(new Date()),
      effective_to: isoDateLocal(new Date()),
    });
    this.syncDefaultsSearchFields();
    this.showDefaultsPanel.set(false);
  }

  removeDefaultsFilter(filter: ActiveFilter): void {
    if (filter.key === 'default_place') {
      this.defaultsForm.patchValue({ default_place: '' });
      return;
    }
    if (filter.key === 'default_celebrant_name') {
      this.defaultsForm.patchValue({ default_celebrant_name: '' });
      return;
    }
    if (filter.key === 'apply_from') {
      this.defaultsForm.patchValue({ apply_from: isoDateLocal(new Date()) });
      return;
    }
    if (filter.key === 'effective_to') {
      this.defaultsForm.patchValue({ effective_to: isoDateLocal(new Date()) });
    }
  }

  clearAllDefaultsFilters(): void {
    this.onDefaultsPanelClear();
  }

  refreshGenerationStatus(): void {
    this.api.getGenerationStatus().subscribe({
      next: (res) => {
        const row = res.data;
        if (row.last_error) {
          this.generationStatus.set({ kind: 'failed', message: row.last_error });
        } else if (row.attention_required) {
          this.generationStatus.set({
            kind: 'attention',
            generatedThrough: row.last_generated_through ?? 'not yet',
            requiredThrough: row.minimum_through_date ?? '',
          });
        } else if (row.last_generated_through) {
          this.generationStatus.set({ kind: 'ok', generatedThrough: row.last_generated_through });
        } else {
          this.generationStatus.set({ kind: 'hidden' });
        }
      },
    });
  }

  retryGeneration(): void {
    const from = isoDateLocal(new Date());
    const end = new Date();
    end.setDate(end.getDate() + 14);
    const to = isoDateLocal(end);
    this.generationRetrying.set(true);
    this.api
      .listCelebrations({ from, to, per_page: 1, page: 1 })
      .subscribe({
        next: () => {
          this.generationRetrying.set(false);
          this.refreshGenerationStatus();
          this.toast.success('Checked for missing Masses in the next two weeks.');
        },
        error: () => {
          this.generationRetrying.set(false);
          this.toast.error('Could not refresh Mass generation. Try again later.');
        },
      });
  }

  confirmLeaveIfDirty(): Observable<boolean> {
    if (!this.dirty()) {
      return of(true);
    }
    return this.confirm
      .confirmDiscardChanges('You have unsaved schedule changes. Leave without saving?')
      .pipe(map((r) => r.confirmed));
  }

  reloadRegular(): void {
    this.loading.set(true);
    this.loadError.set(null);
    this.api.getRegularSchedule().subscribe({
      next: (res) => {
        const bundle = res.data;
        this.scheduleId.set(bundle.schedule.id);
        this.scheduleStatus.set(bundle.schedule.status ?? 'active');
        this.loadRevisionHistory(bundle.schedule.id);
        this.defaultsForm.patchValue(
          {
            default_place: bundle.schedule.default_place ?? '',
            default_celebrant_name: bundle.schedule.default_celebrant_name ?? '',
            apply_from: isoDateLocal(new Date()),
          },
          { emitEvent: false }
        );
        const source = bundle.draft?.slots?.length ? bundle.draft.slots : bundle.published?.slots ?? [];
        this.slots.set(this.mapSlots(source));
        this.captureBaseline();
        this.initDefaultsSearchFields();
        this.syncDefaultsSearchFields();
        this.loading.set(false);
      },
      error: () => {
        this.loading.set(false);
        this.loadError.set('Could not load the weekly schedule. Try again.');
      },
    });
  }

  reloadTemporary(scheduleId: string): void {
    this.loading.set(true);
    this.loadError.set(null);
    this.api.getSchedule(scheduleId).subscribe({
      next: (res) => {
        const bundle = res.data;
        this.scheduleId.set(bundle.schedule.id);
        this.scheduleStatus.set(bundle.schedule.status ?? 'active');
        this.loadRevisionHistory(bundle.schedule.id);
        const publishedTo = bundle.published?.effective_to;
        const publishedFrom = bundle.published?.effective_from;
        this.defaultsForm.patchValue(
          {
            default_place: bundle.schedule.default_place ?? '',
            default_celebrant_name: bundle.schedule.default_celebrant_name ?? '',
            apply_from: publishedFrom ?? isoDateLocal(new Date()),
            effective_to: publishedTo ?? isoDateLocal(new Date()),
          },
          { emitEvent: false }
        );
        const source = bundle.draft?.slots?.length ? bundle.draft.slots : bundle.published?.slots ?? [];
        this.slots.set(this.mapSlots(source));
        this.captureBaseline();
        this.initDefaultsSearchFields();
        this.syncDefaultsSearchFields();
        this.loading.set(false);
      },
      error: () => {
        this.loading.set(false);
        this.loadError.set('Could not load this temporary schedule.');
      },
    });
  }

  slotsForDay(weekday: number): EditableSlot[] {
    return this.slots().filter((s) => s.weekday === weekday);
  }

  addSlot(weekday: number): void {
    const count = this.slotsForDay(weekday).length;
    if (count >= MAX_SLOTS_PER_DAY) {
      this.toast.error(`At most ${MAX_SLOTS_PER_DAY} Mass times per day.`);
      return;
    }
    this.slots.update((list) => [
      ...list,
      {
        weekday,
        celebrated_at: '09:00',
        place_source: 'inherit',
        celebrant_source: 'inherit',
        place: '',
        celebrant_name: '',
        weeks_of_month: [],
      },
    ]);
    this.markDirty();
    this.clearPreview();
  }

  toggleWeekOfMonth(weekday: number, indexInDay: number, value: string, checked: boolean): void {
    const daySlots = this.slotsForDay(weekday);
    const target = daySlots[indexInDay];
    if (!target) {
      return;
    }
    this.slots.update((list) =>
      list.map((s) => {
        if (s !== target) {
          return s;
        }
        const current = s.weeks_of_month ?? [];
        const next = checked ? [...current, value] : current.filter((v) => v !== value);
        const unique = [...new Set(next)].sort((a, b) => {
          const order = ['1', '2', '3', '4', 'last'];
          return order.indexOf(a) - order.indexOf(b);
        });
        return { ...s, weeks_of_month: unique };
      })
    );
    this.markDirty();
    this.clearPreview();
  }

  weekOfMonthSelected(slot: EditableSlot, value: string): boolean {
    return (slot.weeks_of_month ?? []).includes(value);
  }

  removeSlot(weekday: number, indexInDay: number): void {
    const daySlots = this.slotsForDay(weekday);
    const target = daySlots[indexInDay];
    if (!target) {
      return;
    }
    const dayLabel = this.weekdays.find((d) => d.weekday === weekday)?.label ?? 'this day';
    this.confirm
      .confirm({
        title: 'Remove this Mass time?',
        message:
          'Future Masses at this time will be taken off the schedule (not marked cancelled). Masses with intentions stay until you handle them.',
        confirmText: 'Remove time',
        variant: 'danger',
      })
      .subscribe((result) => {
        if (!result.confirmed) {
          return;
        }
        this.applyRemoveSlot(weekday, indexInDay);
      });
  }

  private applyRemoveSlot(weekday: number, indexInDay: number): void {
    this.slots.update((list) => {
      let seen = 0;
      return list.filter((s) => {
        if (s.weekday !== weekday) {
          return true;
        }
        if (seen === indexInDay) {
          seen++;
          return false;
        }
        seen++;
        return true;
      });
    });
    this.markDirty();
    this.clearPreview();
  }

  onSlotChange(): void {
    this.markDirty();
    this.clearPreview();
  }

  runPreview(): void {
    const scheduleId = this.scheduleId();
    if (!scheduleId) {
      return;
    }
    this.previewing.set(true);
    this.previewError.set(null);
    this.requestPreview(scheduleId).subscribe({
      next: (res) => {
        this.stalePreview.set(false);
        this.applyError.set(null);
        this.previewCounts.set(res.counts);
        this.previewConflicts.set(res.conflicts ?? []);
        this.previewFingerprint.set(res.fingerprint);
        this.previewing.set(false);
      },
      error: (message) => {
        this.previewing.set(false);
        this.previewError.set(message);
      },
    });
  }

  private previewThenApply(scheduleId: string): void {
    this.saving.set(true);
    this.previewError.set(null);
    this.applyError.set(null);
    this.requestPreview(scheduleId).subscribe({
      next: (preview) => {
        this.previewCounts.set(preview.counts);
        this.previewConflicts.set(preview.conflicts ?? []);
        this.previewFingerprint.set(preview.fingerprint);
        this.applyWithFingerprint(scheduleId, preview.fingerprint);
      },
      error: (message) => {
        this.saving.set(false);
        this.previewError.set(message);
      },
    });
  }

  private requestPreview(scheduleId: string): Observable<{
    fingerprint: string;
    counts: Record<string, number>;
    conflicts: MassScheduleConflict[];
  }> {
    return new Observable((subscriber) => {
      this.saveDraft(scheduleId).subscribe({
        next: () => {
          const applyFrom = this.defaultsForm.controls.apply_from.value;
          const previewBody: { apply_from: string; until?: string; effective_to?: string } = {
            apply_from: applyFrom,
            until: this.previewUntil(applyFrom),
          };
          if (this.isTemporary()) {
            previewBody.effective_to = this.defaultsForm.controls.effective_to.value;
            previewBody.until = previewBody.effective_to;
          }
          this.api.previewScheduleApply(scheduleId, previewBody).subscribe({
            next: (res) => subscriber.next(res.data),
            error: (err) => subscriber.error(this.formatScheduleApiError(err, 'Preview failed. Check the schedule and try again.')),
            complete: () => subscriber.complete(),
          });
        },
        error: (err) =>
          subscriber.error(this.formatScheduleApiError(err, 'Could not save draft before preview.')),
      });
    });
  }

  private applyWithFingerprint(scheduleId: string, fingerprint: string): void {
    const applyFrom = this.defaultsForm.controls.apply_from.value;
    const applyBody: {
      fingerprint: string;
      apply_from: string;
      until?: string;
      effective_to?: string;
    } = {
      fingerprint,
      apply_from: applyFrom,
      until: this.previewUntil(applyFrom),
    };
    if (this.isTemporary()) {
      applyBody.effective_to = this.defaultsForm.controls.effective_to.value;
      applyBody.until = applyBody.effective_to;
    }
    this.api.applySchedule(scheduleId, applyBody).subscribe({
      next: (res) => this.onApplySuccess(res),
      error: (err) => this.onApplyError(err),
    });
  }

  private onApplySuccess(res: { data?: { counts?: Record<string, number>; conflicts?: MassScheduleConflict[] } }): void {
    this.saving.set(false);
    const created = res.data?.counts?.['create'] ?? 0;
    const updated = res.data?.counts?.['update'] ?? 0;
    const conflicts = res.data?.conflicts ?? [];
    this.previewConflicts.set(conflicts);
    this.toast.success(
      created || updated ? `Schedule saved. ${created} new, ${updated} updated.` : 'Schedule saved.'
    );
    if (conflicts.length > 0) {
      this.toast.error(
        `${conflicts.length} Mass${conflicts.length === 1 ? '' : 'es'} could not be changed because intentions are scheduled on them.`
      );
    }
    this.captureBaseline();
    this.clearPreview();
    if (this.isTemporary() && this.scheduleId()) {
      this.reloadTemporary(this.scheduleId()!);
    } else {
      this.reloadRegular();
    }
  }

  private onApplyError(err: { status?: number; error?: { message?: string } }): void {
    this.saving.set(false);
    const msg = err?.error?.message ?? 'Could not apply schedule.';
    this.applyError.set(msg);
    if (err?.status === 409) {
      this.stalePreview.set(true);
      this.applyError.set('The schedule changed. Preview your changes again before saving.');
      this.clearPreview();
    }
  }

  private formatScheduleApiError(err: unknown, fallback: string): string {
    if (err && typeof err === 'object' && 'error' in err) {
      const body = (err as { error?: { message?: string; errors?: Record<string, string[]> } }).error;
      if (body?.message) {
        return body.message;
      }
      if (body?.errors) {
        return Object.values(body.errors).flat().join(' ');
      }
    }
    return fallback;
  }

  saveWeeklySchedule(): void {
    const scheduleId = this.scheduleId();
    const fingerprint = this.previewFingerprint();
    if (!scheduleId) {
      return;
    }
    if (!fingerprint) {
      this.previewThenApply(scheduleId);
      return;
    }
    this.saving.set(true);
    this.applyError.set(null);
    this.saveDraft(scheduleId).subscribe({
      next: () => this.applyWithFingerprint(scheduleId, fingerprint),
      error: () => {
        this.saving.set(false);
        this.applyError.set('Could not save draft.');
      },
    });
  }

  private saveDraft(scheduleId: string): Observable<unknown> {
    const defaults = this.defaultsForm.getRawValue();
    const payload = {
      default_place: defaults.default_place || null,
      default_celebrant_name: defaults.default_celebrant_name || null,
      slots: this.slots().map((s) => ({
        slot_id: s.slot_id,
        weekday: s.weekday,
        celebrated_at: this.normalizeSlotTime(s.celebrated_at),
        place_source: s.place_source ?? 'inherit',
        celebrant_source: s.celebrant_source ?? 'inherit',
        place: s.place_source === 'override' ? s.place || null : null,
        celebrant_name: s.celebrant_source === 'override' ? s.celebrant_name || null : null,
        weeks_of_month: s.weeks_of_month?.length ? s.weeks_of_month : null,
      })),
    };
    return this.api.saveScheduleDraft(scheduleId, payload);
  }

  private normalizeSlotTime(value: string | undefined): string {
    if (!value) {
      return '';
    }
    return value.length > 5 ? value.slice(0, 5) : value;
  }

  private previewUntil(applyFrom: string): string {
    const parts = applyFrom.split('-').map(Number);
    const d = new Date(parts[0], parts[1] - 1, parts[2]);
    d.setDate(d.getDate() + 14);
    return isoDateLocal(d);
  }

  private mapSlots(slots: MassScheduleSlotDraft[]): EditableSlot[] {
    return slots.map((s) => ({
      ...s,
      celebrated_at: s.celebrated_at?.length > 5 ? s.celebrated_at.slice(0, 5) : s.celebrated_at,
      place_source: (s.place_source ?? 'inherit') as SourceMode,
      celebrant_source: (s.celebrant_source ?? 'inherit') as SourceMode,
      place: s.place ?? '',
      celebrant_name: s.celebrant_name ?? '',
      weeks_of_month: s.weeks_of_month ?? [],
    }));
  }

  private captureBaseline(): void {
    this.baselineSnapshot = this.snapshot();
    this.dirty.set(false);
  }

  private markDirty(): void {
    this.dirty.set(this.snapshot() !== this.baselineSnapshot);
  }

  private snapshot(): string {
    return JSON.stringify({
      defaults: this.defaultsForm.getRawValue(),
      slots: this.slots(),
    });
  }

  applyConflictProposal(row: MassScheduleConflict): void {
    const proposal = row.proposed;
    if (!proposal?.celebrated_at) {
      this.toast.error('No proposed schedule was found for this Mass.');
      return;
    }
    this.applyingProposalId.set(row.celebration_id);
    this.api.applyCelebrationScheduleProposal(row.celebration_id, {
      celebrated_at: proposal.celebrated_at,
      place: proposal.place ?? null,
      celebrant_name: proposal.celebrant_name ?? null,
      revision_id: proposal.revision_id,
      schedule_id: proposal.schedule_id,
      source_label: proposal.source_label ?? null,
    }).subscribe({
      next: () => {
        this.previewConflicts.update((list) => list.filter((r) => r.celebration_id !== row.celebration_id));
        this.applyingProposalId.set(null);
        this.toast.success('New schedule time applied. Intentions stay on this Mass.');
      },
      error: () => {
        this.applyingProposalId.set(null);
        this.toast.error('Could not apply the new schedule to this Mass.');
      },
    });
  }

  keepConflictMass(celebrationId: string): void {
    this.keepingConflictId.set(celebrationId);
    this.api.keepCelebrationOnSchedule(celebrationId).subscribe({
      next: () => {
        this.previewConflicts.update((list) => list.filter((r) => r.celebration_id !== celebrationId));
        this.keepingConflictId.set(null);
        this.toast.success('This Mass will stay as-is when you save.');
      },
      error: () => {
        this.keepingConflictId.set(null);
        this.toast.error('Could not keep this Mass.');
      },
    });
  }

  markScheduleChangedFromConflict(row: MassScheduleConflict): void {
    this.markingScheduleChangedId.set(row.celebration_id);
    this.api.markCelebrationScheduleChanged(row.celebration_id).subscribe({
      next: () => {
        this.previewConflicts.update((list) => list.filter((r) => r.celebration_id !== row.celebration_id));
        this.markingScheduleChangedId.set(null);
        this.toast.success('This Mass was marked schedule changed.');
      },
      error: () => {
        this.markingScheduleChangedId.set(null);
        this.toast.error('Could not mark this Mass schedule changed. Move every intention off it first.');
      },
    });
  }

  conflictLabel(row: MassScheduleConflict): string {
    const when = formatMassDayTime(row.celebrated_on ?? '', row.celebrated_at ?? null);
    if (row.reason_code === 'move_then_remove' && row.replacement) {
      const newWhen = formatMassDayTime(
        row.replacement.celebrated_on ?? '',
        row.replacement.celebrated_at ?? null
      );
      return `${when} → ${newWhen} — move intentions, then remove this Mass (${row.intention_count} intention${row.intention_count === 1 ? '' : 's'})`;
    }
    const reason =
      row.reason_code === 'suppress_blocked' || row.reason_code === 'move_then_remove'
        ? 'Move intentions, then remove from schedule'
        : row.reason_code === 'move_unsaid_only'
          ? 'Move unsaid intentions — said stay on this Mass'
          : row.reason_code === 'apply_or_move'
            ? 'New time — apply or move intentions'
            : row.reason_code === 'update_blocked'
              ? 'Cannot change time or place'
              : 'Needs attention';
    return `${when} — ${reason} (${row.intention_count} intention${row.intention_count === 1 ? '' : 's'})`;
  }

  previousDayLabel(weekday: number): string {
    const source = weekday === 0 ? 6 : weekday - 1;
    return this.weekdays.find((d) => d.weekday === source)?.label ?? 'previous day';
  }

  copyFromPreviousDay(weekday: number): void {
    const sourceWeekday = weekday === 0 ? 6 : weekday - 1;
    const sourceSlots = this.slotsForDay(sourceWeekday);
    if (sourceSlots.length === 0) {
      this.toast.error(`No times on ${this.previousDayLabel(weekday)} to copy.`);
      return;
    }
    if (sourceSlots.length > MAX_SLOTS_PER_DAY) {
      this.toast.error(`At most ${MAX_SLOTS_PER_DAY} Mass times per day.`);
      return;
    }
    const withoutTarget = this.slots().filter((s) => s.weekday !== weekday);
    const copied = sourceSlots.map((s) => ({
      weekday,
      celebrated_at: s.celebrated_at,
      place_source: s.place_source,
      celebrant_source: s.celebrant_source,
      place: s.place,
      celebrant_name: s.celebrant_name,
      weeks_of_month: s.weeks_of_month ? [...s.weeks_of_month] : [],
    }));
    this.slots.set([...withoutTarget, ...copied]);
    this.markDirty();
    this.clearPreview();
    this.toast.success(`Copied ${this.previousDayLabel(weekday)} times.`);
  }

  inactivateTemporary(): void {
    const id = this.scheduleId();
    if (!id || !this.isTemporary()) {
      return;
    }
    this.confirm
      .confirm({
        title: 'Inactivate temporary schedule?',
        message: 'Future Masses will use the regular weekly schedule again. Existing Mass rows are kept.',
        confirmText: 'Inactivate',
        variant: 'danger',
      })
      .subscribe((result) => {
        if (!result.confirmed) {
          return;
        }
        this.lifecycleBusy.set(true);
        this.api.inactivateSchedule(id).subscribe({
          next: () => {
            this.lifecycleBusy.set(false);
            this.scheduleStatus.set('inactive');
            this.toast.success('Temporary schedule inactivated.');
          },
          error: () => {
            this.lifecycleBusy.set(false);
            this.toast.error('Could not inactivate this schedule.');
          },
        });
      });
  }

  archiveTemporary(): void {
    const id = this.scheduleId();
    if (!id || !this.isTemporary() || this.scheduleStatus() !== 'inactive') {
      return;
    }
    this.confirm
      .confirm({
        title: 'Archive temporary schedule?',
        message: 'Archived schedules stay in history but cannot be edited or reactivated.',
        confirmText: 'Archive',
        variant: 'danger',
      })
      .subscribe((result) => {
        if (!result.confirmed) {
          return;
        }
        this.lifecycleBusy.set(true);
        this.api.archiveSchedule(id).subscribe({
          next: () => {
            this.lifecycleBusy.set(false);
            this.toast.success('Temporary schedule archived.');
            void this.router.navigate(['/mass-intentions/masses/temporaries']);
          },
          error: () => {
            this.lifecycleBusy.set(false);
            this.toast.error('Could not archive this schedule.');
          },
        });
      });
  }

  private loadRevisionHistory(scheduleId: string): void {
    this.api.listScheduleRevisions(scheduleId).subscribe({
      next: (res) => {
        this.revisionHistory.set(
          (res.data ?? []).map((r) => ({
            revision_number: r?.revision_number ?? 0,
            status: r?.status ?? '',
            effective_from: r?.effective_from,
            effective_to: r?.effective_to,
          }))
        );
      },
      error: () => this.revisionHistory.set([]),
    });
  }

  private clearPreview(): void {
    this.previewCounts.set(null);
    this.previewConflicts.set([]);
    this.previewFingerprint.set(null);
    this.previewError.set(null);
  }

  private initDefaultsSearchFields(): void {
    const values = this.defaultsForm.getRawValue();
    const fields: SearchField[] = [
      {
        key: 'default_place',
        label: 'Default place',
        type: 'text',
        group: 'Parish defaults',
        placeholder: 'e.g. Main church',
        value: values.default_place.trim() || undefined,
      },
      {
        key: 'default_celebrant_name',
        label: 'Default priest',
        type: 'text',
        group: 'Parish defaults',
        placeholder: 'Name when slots inherit priest',
        value: values.default_celebrant_name.trim() || undefined,
      },
      {
        key: 'apply_from',
        label: this.isTemporary() ? 'Starts on' : 'Changes take effect from',
        type: 'date',
        group: 'Parish defaults',
        value: values.apply_from || undefined,
      },
    ];
    if (this.isTemporary()) {
      fields.push({
        key: 'effective_to',
        label: 'Ends on',
        type: 'date',
        group: 'Parish defaults',
        value: values.effective_to || undefined,
      });
    }
    this.defaultsSearchFields = fields;
  }

  private syncDefaultsSearchFields(): void {
    const values = this.defaultsForm.getRawValue();
    this.defaultsSearchFields = this.defaultsSearchFields.map((field) => {
      if (field.key === 'default_place') {
        return { ...field, value: values.default_place.trim() || undefined };
      }
      if (field.key === 'default_celebrant_name') {
        return { ...field, value: values.default_celebrant_name.trim() || undefined };
      }
      if (field.key === 'apply_from') {
        return {
          ...field,
          label: this.isTemporary() ? 'Starts on' : 'Changes take effect from',
          value: values.apply_from || undefined,
        };
      }
      if (field.key === 'effective_to') {
        return { ...field, value: values.effective_to || undefined };
      }
      return field;
    });
  }
}
