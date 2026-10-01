import { CommonModule } from '@angular/common';
import { RouterModule } from '@angular/router';
import { Component, EventEmitter, Input, OnChanges, Output, SimpleChanges, inject, signal } from '@angular/core';
import { MassCelebrationSummary } from '../services/mass-intentions-api.service';
import { FormBuilder, ReactiveFormsModule, Validators } from '@angular/forms';
import { ModalShellComponent } from '@shared/components/modal-shell/modal-shell.component';
import { MassIntentionsApiService } from '../services/mass-intentions-api.service';
import { formatMassDayTime } from '../utils/mass-celebration-display';

@Component({
  selector: 'app-add-mass-modal',
  standalone: true,
  imports: [CommonModule, RouterModule, ReactiveFormsModule, ModalShellComponent],
  template: `
    <app-modal-shell
      *ngIf="open"
      [title]="celebration ? 'Edit Mass' : 'Add a one-time Mass'"
      size="sm"
      headerVariant="compact"
      bodyPadding="none"
      closeAriaLabel="Close mass"
      [isSubmitting]="saving()"
      (closeRequested)="close()"
    >
      <form
        class="cf-split-form-body"
        [formGroup]="form"
        (ngSubmit)="submit()"
        novalidate
      >
        @if (!celebration) {
          <p class="cf-inline-hint cf-split-section">
            For repeating Mass times,
            <a routerLink="/mass-intentions/masses/schedule">set the weekly schedule instead</a>.
          </p>
        }

        @if (fromWeeklySchedule()) {
          <p class="cf-inline-hint cf-split-section">
            This Mass comes from the weekly schedule. You can change place and priest here. For a different day or
            time, cancel this Mass and add a one-time Mass, or
            <a routerLink="/mass-intentions/masses/schedule">update the weekly schedule</a>.
          </p>
        }

        <section class="cf-split-section" aria-labelledby="mass-celebration-section-details">
          <h3 id="mass-celebration-section-details" class="cf-split-section__title">Mass details</h3>
          <div class="cf-split-grid">
            <div class="cf-split-field">
              <label for="mass-celebration-day">
                Day <span class="cf-split-req" aria-hidden="true">*</span>
              </label>
              <input
                id="mass-celebration-day"
                type="date"
                formControlName="celebrated_on"
                aria-required="true"
                [readonly]="fromWeeklySchedule()"
                (change)="loadSameDayForField()"
              />
            </div>
            <div class="cf-split-field">
              <label for="mass-celebration-time">
                Time <span class="cf-split-optional">optional</span>
              </label>
              <input
                id="mass-celebration-time"
                type="time"
                formControlName="celebrated_at"
                [readonly]="fromWeeklySchedule()"
              />
            </div>
            <div class="cf-split-field">
              <label for="mass-celebration-place">
                Place <span class="cf-split-optional">optional</span>
              </label>
              <input
                id="mass-celebration-place"
                type="text"
                formControlName="place"
                autocomplete="off"
              />
            </div>
            <div class="cf-split-field">
              <label for="mass-celebration-priest">
                Priest <span class="cf-split-optional">optional</span>
              </label>
              <input
                id="mass-celebration-priest"
                type="text"
                formControlName="celebrant_name"
                autocomplete="off"
              />
            </div>
            @if (!celebration) {
              <div class="cf-split-field">
                <label for="mass-celebration-occasion">
                  Occasion <span class="cf-split-optional">optional</span>
                </label>
                <input id="mass-celebration-occasion" type="text" formControlName="occasion" autocomplete="off" />
              </div>
              <div class="cf-split-field cf-split-field--full">
                <label for="mass-celebration-notes">
                  Notes <span class="cf-split-optional">optional</span>
                </label>
                <textarea id="mass-celebration-notes" rows="2" formControlName="notes"></textarea>
              </div>
            }
          </div>
        </section>

        @if (!celebration && sameDayMasses().length) {
          <section class="cf-split-section" aria-labelledby="mass-same-day-heading">
            <h3 id="mass-same-day-heading" class="cf-split-section__title">Already on this day</h3>
            <ul class="add-mass-modal__same-day">
              @for (m of sameDayMasses(); track m.id) {
                <li>{{ formatRow(m) }}</li>
              }
            </ul>
          </section>
        }

        <div class="cf-split-form-actions">
          <button type="submit" class="cf-btn cf-btn-primary" [disabled]="form.invalid || saving()">
            {{ saving() ? 'Saving…' : celebration ? 'Save changes' : 'Add one-time Mass' }}
          </button>
          <button type="button" class="cf-btn" (click)="close()" [disabled]="saving()">Cancel</button>
        </div>
      </form>
    </app-modal-shell>
  `,
  styleUrl: './add-mass-modal.component.scss',
})
export class AddMassModalComponent implements OnChanges {
  private readonly fb = inject(FormBuilder);
  private readonly api = inject(MassIntentionsApiService);

  @Input() open = false;
  @Input() celebration: MassCelebrationSummary | null = null;
  @Input() initialCelebratedOn = '';
  @Output() closed = new EventEmitter<void>();
  @Output() created = new EventEmitter<MassCelebrationSummary>();
  @Output() updated = new EventEmitter<void>();

  readonly saving = signal(false);
  readonly sameDayMasses = signal<MassCelebrationSummary[]>([]);

  readonly form = this.fb.nonNullable.group({
    celebrated_on: ['', Validators.required],
    celebrated_at: [''],
    place: [''],
    celebrant_name: [''],
    occasion: [''],
    notes: ['', Validators.maxLength(1000)],
  });

  ngOnChanges(changes: SimpleChanges): void {
    if (changes['open']?.currentValue && this.celebration) {
      const at = this.celebration.celebrated_at;
      const time = at && at.length > 5 ? at.slice(0, 5) : at ?? '';
      this.form.patchValue({
        celebrated_on: this.celebration.celebrated_on,
        celebrated_at: time,
        place: this.celebration.place ?? '',
        celebrant_name: this.celebration.celebrant_name ?? '',
      });
      this.sameDayMasses.set([]);
    }
    if (changes['open']?.currentValue && !this.celebration) {
      this.form.reset({
        celebrated_on: this.initialCelebratedOn || '',
      });
      this.sameDayMasses.set([]);
    }
    if (changes['open']?.currentValue && !this.celebration) {
      this.loadSameDayForField();
    }
  }

  loadSameDayForField(): void {
    this.loadSameDay(this.form.controls.celebrated_on.value);
  }

  fromWeeklySchedule(): boolean {
    return Boolean(this.celebration?.slot_id);
  }

  formatRow(row: MassCelebrationSummary): string {
    return formatMassDayTime(row.celebrated_on, row.celebrated_at) + (row.place ? ` · ${row.place}` : '');
  }

  close(): void {
    this.closed.emit();
  }

  submit(): void {
    if (this.form.invalid || this.saving()) {
      return;
    }
    this.saving.set(true);
    const value = this.form.getRawValue();
    const payload: Record<string, string> = {
      place: value.place,
      celebrant_name: value.celebrant_name,
    };
    if (!this.fromWeeklySchedule()) {
      payload['celebrated_on'] = value.celebrated_on;
      if (value.celebrated_at) {
        payload['celebrated_at'] = value.celebrated_at;
      }
    }
    if (!this.celebration) {
      if (value.occasion) {
        payload['occasion'] = value.occasion;
      }
      if (value.notes) {
        payload['notes'] = value.notes;
      }
    }
    const save$ = this.celebration
      ? this.api.updateCelebration(this.celebration.id, payload)
      : this.api.createCelebration({
          ...payload,
          celebrated_on: value.celebrated_on,
          ...(value.celebrated_at ? { celebrated_at: value.celebrated_at } : {}),
        });

    save$.subscribe({
      next: (res) => {
        this.saving.set(false);
        this.form.reset();
        if (this.celebration) {
          this.updated.emit();
        } else {
          this.created.emit(res.data);
        }
        this.close();
      },
      error: () => this.saving.set(false),
    });
  }

  private loadSameDay(day: string): void {
    if (this.celebration || !day || !/^\d{4}-\d{2}-\d{2}$/.test(day)) {
      this.sameDayMasses.set([]);
      return;
    }
    this.api.listCelebrations({ celebrated_on: day, per_page: 20, page: 1 }).subscribe({
      next: (res) => this.sameDayMasses.set(res.data ?? []),
      error: () => this.sameDayMasses.set([]),
    });
  }
}
