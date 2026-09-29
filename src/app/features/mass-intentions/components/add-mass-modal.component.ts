import { CommonModule } from '@angular/common';
import { Component, EventEmitter, Input, OnChanges, Output, SimpleChanges, inject, signal } from '@angular/core';
import { MassCelebrationSummary } from '../services/mass-intentions-api.service';
import { FormBuilder, ReactiveFormsModule, Validators } from '@angular/forms';
import { ModalShellComponent } from '@shared/components/modal-shell/modal-shell.component';
import { MassIntentionsApiService } from '../services/mass-intentions-api.service';

@Component({
  selector: 'app-add-mass-modal',
  standalone: true,
  imports: [CommonModule, ReactiveFormsModule, ModalShellComponent],
  template: `
    <app-modal-shell
      *ngIf="open"
      [title]="celebration ? 'Edit Mass' : 'Add Mass'"
      size="sm"
      headerVariant="compact"
      bodyPadding="none"
      (closeRequested)="close()"
    >
      <form class="cf-split-form" [formGroup]="form" (ngSubmit)="submit()">
        <div class="cf-split-form__body">
          <label class="cf-split-field">
            <span class="cf-split-field__label">Day</span>
            <input class="cf-control" type="date" formControlName="celebrated_on" />
          </label>
          <label class="cf-split-field">
            <span class="cf-split-field__label">Time</span>
            <input class="cf-control" type="time" formControlName="celebrated_at" />
          </label>
          <label class="cf-split-field">
            <span class="cf-split-field__label">Place</span>
            <input class="cf-control" type="text" formControlName="place" autocomplete="off" />
          </label>
          <label class="cf-split-field">
            <span class="cf-split-field__label">Priest</span>
            <input class="cf-control" type="text" formControlName="celebrant_name" autocomplete="off" />
          </label>
        </div>
        <div class="cf-split-form-actions">
          <button type="button" class="cf-btn cf-btn-ghost" (click)="close()">Cancel</button>
          <button type="submit" class="cf-btn cf-btn-primary" [disabled]="form.invalid || saving()">
            {{ celebration ? 'Save changes' : 'Save Mass' }}
          </button>
        </div>
      </form>
    </app-modal-shell>
  `,
})
export class AddMassModalComponent implements OnChanges {
  private readonly fb = inject(FormBuilder);
  private readonly api = inject(MassIntentionsApiService);

  @Input() open = false;
  @Input() celebration: MassCelebrationSummary | null = null;
  @Output() closed = new EventEmitter<void>();
  @Output() created = new EventEmitter<void>();
  @Output() updated = new EventEmitter<void>();

  readonly saving = signal(false);

  readonly form = this.fb.nonNullable.group({
    celebrated_on: ['', Validators.required],
    celebrated_at: [''],
    place: [''],
    celebrant_name: [''],
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
    }
    if (changes['open']?.currentValue && !this.celebration) {
      this.form.reset();
    }
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
      celebrated_on: value.celebrated_on,
      place: value.place,
      celebrant_name: value.celebrant_name,
    };
    if (value.celebrated_at) {
      payload['celebrated_at'] = value.celebrated_at;
    }
    const save$ = this.celebration
      ? this.api.updateCelebration(this.celebration.id, payload)
      : this.api.createCelebration(payload);

    save$.subscribe({
      next: () => {
        this.saving.set(false);
        this.form.reset();
        if (this.celebration) {
          this.updated.emit();
        } else {
          this.created.emit();
        }
        this.close();
      },
      error: () => this.saving.set(false),
    });
  }
}
