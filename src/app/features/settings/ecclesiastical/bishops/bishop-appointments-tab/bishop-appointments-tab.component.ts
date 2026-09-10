import { CommonModule } from '@angular/common';
import {
  ChangeDetectionStrategy,
  ChangeDetectorRef,
  Component,
  Input,
  OnChanges,
  SimpleChanges,
  inject,
} from '@angular/core';
import { BishopService } from '@core/services/ecclesiastical';
import { BishopAppointment } from '@core/models/ecclesiastical';
import { ToastService } from '@core/services';
import { AuthService } from '@core/services/auth.service';
import {
  formatAppointmentDate,
  resolveAppointmentEffectiveDate,
} from '@core/utils/appointment-date.util';
import { CfEmptyStateComponent } from '@shared/components/cf-empty-state/cf-empty-state.component';
import { LoadingSkeletonComponent } from '@shared/components/loading-skeleton/loading-skeleton.component';

@Component({
  selector: 'app-bishop-appointments-tab',
  standalone: true,
  imports: [CommonModule, CfEmptyStateComponent, LoadingSkeletonComponent],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <section class="bishop-appointments-tab">
      <div class="cf-decision-strip" *ngIf="canManage">
        <p>Appointments are the source of truth for diocesan leadership. End or activate from here.</p>
      </div>

      <app-loading-skeleton *ngIf="loading" type="table" [rows]="4" [columns]="5"></app-loading-skeleton>

      <table *ngIf="!loading && appointments.length" class="table cf-table">
        <thead>
          <tr>
            <th>Diocese</th>
            <th>Role</th>
            <th>Effective</th>
            <th>Ended</th>
            <th>Status</th>
            <th *ngIf="canManage"></th>
          </tr>
        </thead>
        <tbody>
          <tr *ngFor="let row of appointments">
            <td>{{ row.diocese?.name || row.diocese_id }}</td>
            <td>{{ formatRole(row.canonical_role) }}</td>
            <td>{{ formatEffectiveDate(row) }}</td>
            <td>{{ formatEndedDate(row) }}</td>
            <td>
              <span class="status-pill" [class.current]="row.is_current">{{ row.is_current ? 'Current' : (row.appointment_status || 'Past') }}</span>
            </td>
            <td *ngIf="canManage" class="actions">
              <button *ngIf="!row.is_current && !row.ended_date" type="button" class="cf-btn" (click)="activate(row)">Activate</button>
              <button *ngIf="row.is_current" type="button" class="cf-btn" (click)="end(row)">End</button>
            </td>
          </tr>
        </tbody>
      </table>

      <app-cf-empty-state
        *ngIf="!loading && !appointments.length"
        icon="⛪"
        title="No appointments yet"
        description="Episcopal appointments for this bishop will appear here."
      ></app-cf-empty-state>
    </section>
  `,
  styles: [`
    .bishop-appointments-tab { display: flex; flex-direction: column; gap: 1rem; }
    .status-pill { padding: 0.15rem 0.5rem; border-radius: 999px; background: var(--cf-surface-muted, #f3f4f6); font-size: 0.85rem; }
    .status-pill.current { background: #dcfce7; color: #166534; }
    .actions { display: flex; gap: 0.5rem; }
  `],
})
export class BishopAppointmentsTabComponent implements OnChanges {
  @Input({ required: true }) bishopId!: number;

  private readonly bishopService = inject(BishopService);
  private readonly toast = inject(ToastService);
  private readonly auth = inject(AuthService);
  private readonly cdr = inject(ChangeDetectorRef);

  appointments: BishopAppointment[] = [];
  loading = false;
  canManage = false;

  ngOnChanges(changes: SimpleChanges): void {
    if (changes['bishopId'] && this.bishopId) {
      this.canManage = this.auth.hasEcclesiasticalPermission('bishops.manage_appointments');
      this.load();
    }
  }

  load(): void {
    this.loading = true;
    this.bishopService.getAppointments(this.bishopId).subscribe({
      next: (res) => {
        this.appointments = res.data?.data ?? [];
        this.loading = false;
        this.cdr.markForCheck();
      },
      error: () => {
        this.toast.error('Failed to load appointments');
        this.loading = false;
        this.cdr.markForCheck();
      },
    });
  }

  activate(row: BishopAppointment): void {
    this.bishopService.activateAppointment(row.id).subscribe({
      next: () => {
        this.toast.success('Appointment activated');
        this.load();
      },
      error: () => this.toast.error('Failed to activate appointment'),
    });
  }

  end(row: BishopAppointment): void {
    const endedDate = prompt('End date (YYYY-MM-DD):', new Date().toISOString().slice(0, 10));
    if (!endedDate) return;
    this.bishopService.endAppointment(row.id, { ended_date: endedDate, end_reason: 'appointment_ended' }).subscribe({
      next: () => {
        this.toast.success('Appointment ended');
        this.load();
      },
      error: () => this.toast.error('Failed to end appointment'),
    });
  }

  formatRole(role: string): string {
    return role.replace(/_/g, ' ');
  }

  formatEffectiveDate(row: BishopAppointment): string {
    return formatAppointmentDate(resolveAppointmentEffectiveDate(row));
  }

  formatEndedDate(row: BishopAppointment): string {
    return formatAppointmentDate(row.ended_date);
  }
}
