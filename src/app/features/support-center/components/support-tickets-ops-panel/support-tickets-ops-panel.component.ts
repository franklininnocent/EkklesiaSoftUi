import { CommonModule } from '@angular/common';
import { ChangeDetectionStrategy, ChangeDetectorRef, Component, OnInit, inject } from '@angular/core';
import { RouterModule } from '@angular/router';
import { DataTableComponent } from '@shared/components/data-table/data-table.component';
import { CfEmptyStateComponent } from '@shared/components/cf-empty-state/cf-empty-state.component';
import { LoadingSkeletonComponent } from '@shared/components/loading-skeleton/loading-skeleton.component';
import {
  OpsSupportTicketMetrics,
  OpsSupportTicketRow,
} from '../../models/support-ops-ticket.model';
import { SupportOpsTicketService } from '../../services/support-ops-ticket.service';

@Component({
  selector: 'app-support-tickets-ops-panel',
  standalone: true,
  imports: [CommonModule, RouterModule, DataTableComponent, CfEmptyStateComponent, LoadingSkeletonComponent],
  template: `
    <section class="cf-panel" *ngIf="!loading && !error">
      <div class="support-tickets-ops__metrics" *ngIf="metrics">
        <span>Open: {{ metrics.open }}</span>
        <span>Unassigned: {{ metrics.unassigned }}</span>
        <span>SLA at risk: {{ metrics.sla_at_risk }}</span>
      </div>
      <app-data-table *ngIf="rows.length" [clickableRows]="true">
        <thead>
          <tr>
            <th>Ticket</th>
            <th>Parish</th>
            <th>Subject</th>
            <th>Priority</th>
            <th>Status</th>
          </tr>
        </thead>
        <tbody>
          <tr
            *ngFor="let row of rows"
            [routerLink]="ticketRoute(row)"
            tabindex="0"
            (keydown)="onRowKeydown($event)"
          >
            <td><strong>{{ row.ticket_number }}</strong></td>
            <td>{{ row.tenant?.name }}</td>
            <td>{{ row.subject }}</td>
            <td>{{ row.priority }}</td>
            <td>{{ row.status }}</td>
          </tr>
        </tbody>
      </app-data-table>
      <app-cf-empty-state
        *ngIf="!rows.length"
        title="No tickets"
        description="Tenant support tickets will appear here."
      ></app-cf-empty-state>
    </section>
    <div class="cf-loading-block cf-panel" *ngIf="loading">
      <app-loading-skeleton type="table" [rows]="4" [columns]="5"></app-loading-skeleton>
    </div>
    <div class="cf-inline-alert cf-panel" *ngIf="error" role="alert">{{ error }}</div>
  `,
  styles: [
    `
      .support-tickets-ops__metrics {
        display: flex;
        flex-wrap: wrap;
        gap: 1rem;
        margin-bottom: 1rem;
        font-size: 0.875rem;
      }
    `,
  ],
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class SupportTicketsOpsPanelComponent implements OnInit {
  private readonly tickets = inject(SupportOpsTicketService);
  private readonly cdr = inject(ChangeDetectorRef);

  loading = true;
  error: string | null = null;
  rows: OpsSupportTicketRow[] = [];
  metrics: OpsSupportTicketMetrics | null = null;

  ngOnInit(): void {
    this.tickets.list(50).subscribe({
      next: (rows) => {
        this.rows = rows;
        this.loading = false;
        this.cdr.markForCheck();
      },
      error: () => {
        this.error = 'Could not load support tickets.';
        this.loading = false;
        this.cdr.markForCheck();
      },
    });

    this.tickets.getDashboard().subscribe({
      next: (metrics) => {
        this.metrics = metrics;
        this.cdr.markForCheck();
      },
    });
  }

  ticketRoute(row: OpsSupportTicketRow): string[] {
    return ['/support-center/tickets', row.ticket_number];
  }

  onRowKeydown(event: KeyboardEvent): void {
    if (event.key === 'Enter' || event.key === ' ') {
      event.preventDefault();
      (event.currentTarget as HTMLElement)?.click();
    }
  }
}
