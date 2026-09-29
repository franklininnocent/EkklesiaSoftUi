import { CommonModule } from '@angular/common';
import { Component, inject, signal } from '@angular/core';
import { FormBuilder, ReactiveFormsModule, Validators } from '@angular/forms';
import { RouterModule } from '@angular/router';
import { ToastService } from '@core/services/toast.service';
import { PageHeaderComponent } from '@shared/components/page-header/page-header.component';
import { MassIntentionsApiService } from '../services/mass-intentions-api.service';

@Component({
  selector: 'app-mass-intentions-settings-page',
  standalone: true,
  imports: [CommonModule, ReactiveFormsModule, RouterModule, PageHeaderComponent],
  template: `
    <div class="cf-page">
      <app-page-header
        title="Settings"
        subtitle="Parish Mass intention settings"
        [backLink]="['/mass-intentions/intentions']"
        backLabel="Dashboard"
      />

      <form class="cf-panel mass-settings" [formGroup]="form" (ngSubmit)="save()">
        <label class="mass-settings__field">
          <span>Suggested offering amount</span>
          <input class="cf-control" type="text" formControlName="suggested_offering_amount" />
          <span class="mass-settings__hint">Parish guide only — does not set Mass count.</span>
        </label>
        <label class="mass-settings__field mass-settings__checkbox">
          <input type="checkbox" formControlName="provincial_collective_authorized" />
          <span>Provincial authorization for collective intentions</span>
        </label>
        <p class="mass-settings__hint">
          Intention types are managed from the parish master list. Add recommended types under
          <a routerLink="/settings/default-seeds">Settings → Default seeds</a>
          (Mass intention types), or add new types while recording an intention.
        </p>
        <div class="mass-settings__actions">
          <button type="submit" class="cf-btn cf-btn-primary" [disabled]="form.invalid || saving()">Save</button>
        </div>
      </form>
    </div>
  `,
  styles: [
    `
      .mass-settings {
        padding: var(--cf-space-3);
        display: grid;
        gap: var(--cf-space-3);
        max-width: 28rem;
      }
      .mass-settings__field {
        display: grid;
        gap: var(--cf-space-2);
        font-size: var(--cf-text-base);
      }
      .mass-settings__hint {
        font-size: var(--cf-text-xs);
        color: var(--cf-color-text-muted);
      }
      .mass-settings__checkbox {
        display: flex;
        align-items: flex-start;
        gap: var(--cf-space-2);
      }
      .mass-settings__actions {
        display: flex;
        justify-content: flex-end;
      }
    `,
  ],
})
export class MassIntentionsSettingsPageComponent {
  private readonly api = inject(MassIntentionsApiService);
  private readonly fb = inject(FormBuilder);
  private readonly toast = inject(ToastService);

  readonly saving = signal(false);

  readonly form = this.fb.nonNullable.group({
    suggested_offering_amount: [''],
    provincial_collective_authorized: [false],
  });

  constructor() {
    this.api.getSettings().subscribe({
      next: (res) => {
        this.form.patchValue({
          suggested_offering_amount: res.data.suggested_offering_amount ?? '',
          provincial_collective_authorized: res.data.provincial_collective_authorized ?? false,
        });
      },
    });
  }

  save(): void {
    if (this.form.invalid) {
      return;
    }
    this.saving.set(true);
    const raw = this.form.getRawValue();
    this.api
      .updateSettings({
        suggested_offering_amount: raw.suggested_offering_amount || null,
        provincial_collective_authorized: raw.provincial_collective_authorized,
      })
      .subscribe({
        next: () => {
          this.saving.set(false);
          this.toast.success('Settings saved.');
        },
        error: () => this.saving.set(false),
      });
  }
}
