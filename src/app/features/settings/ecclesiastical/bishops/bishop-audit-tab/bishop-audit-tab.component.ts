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
import { ToastService } from '@core/services';
import { AuthService } from '@core/services/auth.service';
import { CfEmptyStateComponent } from '@shared/components/cf-empty-state/cf-empty-state.component';
import { LoadingSkeletonComponent } from '@shared/components/loading-skeleton/loading-skeleton.component';
import {
  EcclesiasticalAuditChangeLine,
  formatEcclesiasticalAuditChanges,
} from '@core/utils/ecclesiastical-audit.util';

@Component({
  selector: 'app-bishop-audit-tab',
  standalone: true,
  imports: [CommonModule, CfEmptyStateComponent, LoadingSkeletonComponent],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <section class="bishop-audit-tab">
      <app-loading-skeleton *ngIf="loading" type="table" [rows]="5" [columns]="4"></app-loading-skeleton>

      <table *ngIf="!loading && entries.length" class="table cf-table">
        <thead>
          <tr>
            <th>When</th>
            <th>Action</th>
            <th>User</th>
            <th>Changes</th>
          </tr>
        </thead>
        <tbody>
          <tr *ngFor="let entry of entries">
            <td>{{ entry.created_at | date:'medium' }}</td>
            <td>{{ entry.action || entry.event || '—' }}</td>
            <td>{{ entry.user_name || entry.performed_by || '—' }}</td>
            <td>
              <ul class="audit-changes" *ngIf="getChangeLines(entry).length; else noChanges">
                <li *ngFor="let line of getChangeLines(entry)">
                  <span class="audit-field">{{ line.label }}</span>
                  <span class="audit-value">{{ line.text }}</span>
                </li>
              </ul>
              <ng-template #noChanges>—</ng-template>
            </td>
          </tr>
        </tbody>
      </table>

      <app-cf-empty-state
        *ngIf="!loading && !entries.length"
        icon="📋"
        title="No audit history"
        description="Changes to this bishop record will appear here."
      ></app-cf-empty-state>

      <p *ngIf="!canView" class="cf-state cf-state--error">You do not have permission to view audit history.</p>
    </section>
  `,
  styles: [`
    .bishop-audit-tab { display: flex; flex-direction: column; gap: 1rem; }
    .audit-changes {
      margin: 0;
      padding: 0;
      list-style: none;
      display: flex;
      flex-direction: column;
      gap: 0.35rem;
      max-width: 28rem;
    }
    .audit-field {
      font-weight: 600;
      margin-right: 0.35rem;
    }
    .audit-value { color: var(--cf-text-secondary, #4b5563); }
  `],
})
export class BishopAuditTabComponent implements OnChanges {
  @Input({ required: true }) bishopId!: number;

  private readonly bishopService = inject(BishopService);
  private readonly toast = inject(ToastService);
  private readonly auth = inject(AuthService);
  private readonly cdr = inject(ChangeDetectorRef);

  entries: any[] = [];
  loading = false;
  canView = false;

  ngOnChanges(changes: SimpleChanges): void {
    if (changes['bishopId'] && this.bishopId) {
      this.canView = this.auth.hasEcclesiasticalPermission('bishops.view_audit');
      if (this.canView) {
        this.load();
      }
    }
  }

  load(): void {
    this.loading = true;
    this.bishopService.getAuditHistory(this.bishopId).subscribe({
      next: (res) => {
        this.entries = (res.data as any[]) ?? [];
        this.loading = false;
        this.cdr.markForCheck();
      },
      error: () => {
        this.toast.error('Failed to load audit history');
        this.loading = false;
        this.cdr.markForCheck();
      },
    });
  }

  getChangeLines(entry: Record<string, unknown>): EcclesiasticalAuditChangeLine[] {
    return formatEcclesiasticalAuditChanges(entry);
  }
}
