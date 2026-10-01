import { CommonModule } from '@angular/common';
import { Component, inject, signal } from '@angular/core';
import { FormBuilder, ReactiveFormsModule, Validators } from '@angular/forms';
import { Router, RouterModule } from '@angular/router';
import { CfActionIconComponent } from '@shared/components/cf-action-icon/cf-action-icon.component';
import { CfEmptyStateComponent } from '@shared/components/cf-empty-state/cf-empty-state.component';
import { LoadingSkeletonComponent } from '@shared/components/loading-skeleton/loading-skeleton.component';
import { PageHeaderComponent } from '@shared/components/page-header/page-header.component';
import {
  StatusBadgeComponent,
  StatusBadgeTone,
} from '@shared/components/status-badge/status-badge.component';
import { ConfirmationDialogService } from '@core/services/confirmation-dialog.service';
import { ToastService } from '@core/services/toast.service';
import { MassIntentionsApiService } from '../services/mass-intentions-api.service';

type TemporaryScheduleRow = {
  schedule: { id: string; name: string; status?: string };
  published: { effective_from?: string; effective_to?: string } | null;
};

@Component({
  selector: 'app-mass-temporary-schedules-page',
  standalone: true,
  imports: [
    CommonModule,
    RouterModule,
    ReactiveFormsModule,
    PageHeaderComponent,
    CfEmptyStateComponent,
    LoadingSkeletonComponent,
    StatusBadgeComponent,
    CfActionIconComponent,
  ],
  templateUrl: './mass-temporary-schedules.page.html',
  styleUrl: './mass-temporary-schedules.page.scss',
})
export class MassTemporarySchedulesPageComponent {
  private readonly api = inject(MassIntentionsApiService);
  private readonly router = inject(Router);
  private readonly fb = inject(FormBuilder);
  private readonly confirm = inject(ConfirmationDialogService);
  private readonly toast = inject(ToastService);

  readonly loading = signal(true);
  readonly creating = signal(false);
  readonly items = signal<TemporaryScheduleRow[]>([]);
  readonly selectedWeekdays = signal<number[]>([]);
  readonly showInactive = signal(false);

  readonly weekdayOptions = [
    { value: 0, label: 'Sunday' },
    { value: 1, label: 'Monday' },
    { value: 2, label: 'Tuesday' },
    { value: 3, label: 'Wednesday' },
    { value: 4, label: 'Thursday' },
    { value: 5, label: 'Friday' },
    { value: 6, label: 'Saturday' },
  ];

  readonly createForm = this.fb.nonNullable.group({
    name: ['', Validators.required],
    coverage_mode: ['full_week' as 'full_week' | 'selected_weekdays', Validators.required],
  });

  constructor() {
    this.reload();
  }

  toggleShowInactive(event: Event): void {
    this.showInactive.set((event.target as HTMLInputElement).checked);
    this.loading.set(true);
    this.reload();
  }

  toggleWeekday(value: number, event: Event): void {
    const checked = (event.target as HTMLInputElement).checked;
    this.selectedWeekdays.update((list) =>
      checked ? [...list, value].sort() : list.filter((v) => v !== value)
    );
  }

  dateRangeLabel(row: TemporaryScheduleRow): string {
    const from = row.published?.effective_from;
    const to = row.published?.effective_to;
    if (!from || !to) {
      return 'Dates not set yet — open to choose dates and Mass times';
    }
    const fromLabel = this.formatScheduleDate(from);
    const toLabel = this.formatScheduleDate(to);
    if (from === to) {
      return `One day · ${fromLabel}`;
    }
    return `${fromLabel} – ${toLabel}`;
  }

  statusLabel(row: TemporaryScheduleRow): string {
    const status = row.schedule.status ?? 'active';
    if (status === 'active') {
      return row.published?.effective_from ? 'Active' : 'Draft';
    }
    if (status === 'inactive') {
      return 'Ended';
    }
    if (status === 'archived') {
      return 'Archived';
    }
    return status.charAt(0).toUpperCase() + status.slice(1);
  }

  statusTone(row: TemporaryScheduleRow): StatusBadgeTone {
    const status = row.schedule.status ?? 'active';
    if (status === 'active') {
      return row.published?.effective_from ? 'success' : 'warning';
    }
    if (status === 'inactive') {
      return 'neutral';
    }
    if (status === 'archived') {
      return 'neutral';
    }
    return 'neutral';
  }

  create(): void {
    if (this.createForm.invalid || this.creating()) {
      return;
    }
    this.creating.set(true);
    const raw = this.createForm.getRawValue();
    const body: {
      name: string;
      coverage_mode: 'full_week' | 'selected_weekdays';
      selected_weekdays?: number[];
    } = {
      name: raw.name,
      coverage_mode: raw.coverage_mode,
    };
    if (raw.coverage_mode === 'selected_weekdays') {
      body.selected_weekdays = this.selectedWeekdays();
    }
    this.api.createTemporarySchedule(body).subscribe({
      next: (res) => {
        this.creating.set(false);
        void this.router.navigate(['/mass-intentions/masses/temporaries', res.data.schedule.id]);
      },
      error: () => this.creating.set(false),
    });
  }

  inactivate(scheduleId: string): void {
    this.confirm
      .confirm({
        title: 'End this temporary schedule?',
        message: 'Future dates will use the regular weekly schedule again.',
        confirmText: 'End schedule',
        variant: 'danger',
      })
      .subscribe((result) => {
        if (!result.confirmed) {
          return;
        }
        this.api.inactivateSchedule(scheduleId).subscribe({
          next: () => {
            this.toast.success('Temporary schedule ended.');
            this.reload();
          },
          error: () => this.toast.error('Could not end this schedule.'),
        });
      });
  }

  private formatScheduleDate(iso: string): string {
    const parts = iso.split('-').map(Number);
    if (parts.length !== 3 || parts.some((n) => Number.isNaN(n))) {
      return iso;
    }
    const [year, month, day] = parts;
    return new Intl.DateTimeFormat(undefined, { dateStyle: 'medium' }).format(
      new Date(year, month - 1, day)
    );
  }

  private reload(): void {
    this.api.listTemporarySchedules(this.showInactive()).subscribe({
      next: (res) => {
        this.items.set(res.data ?? []);
        this.loading.set(false);
      },
      error: () => this.loading.set(false),
    });
  }
}
