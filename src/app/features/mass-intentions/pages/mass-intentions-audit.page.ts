import { CommonModule } from '@angular/common';
import { Component, inject, signal } from '@angular/core';
import { RouterModule } from '@angular/router';
import { DataTableComponent } from '@shared/components/data-table/data-table.component';
import { ListToolbarComponent } from '@shared/components/list-toolbar/list-toolbar.component';
import { PageHeaderComponent } from '@shared/components/page-header/page-header.component';
import { PaginationComponent } from '@shared/components/pagination/pagination.component';
import { MassIntentionsApiService, MassIntentionAuditRow } from '../services/mass-intentions-api.service';

@Component({
  selector: 'app-mass-intentions-audit-page',
  standalone: true,
  imports: [
    CommonModule,
    RouterModule,
    PageHeaderComponent,
    ListToolbarComponent,
    DataTableComponent,
    PaginationComponent,
  ],
  template: `
    <div class="cf-page">
      <app-page-header
        title="Audit log"
        subtitle="Who changed mass intentions"
        [backLink]="['/mass-intentions/intentions']"
        backLabel="Dashboard"
      />

      <app-list-toolbar
        searchPlaceholder="Event type…"
        [searchValue]="eventFilter()"
        [filterCount]="0"
        (searchChange)="eventFilter.set($event); reload()"
      />

      @if (loading()) {
        <p>Loading…</p>
      } @else {
        <app-data-table [ariaBusy]="loading()">
          <table class="cf-data-table">
            <thead>
              <tr>
                <th>When</th>
                <th>Event</th>
                <th>Intention</th>
              </tr>
            </thead>
            <tbody>
              @for (row of rows(); track row.id) {
                <tr>
                  <td>{{ row.created_at || '—' }}</td>
                  <td>{{ eventLabel(row.event_type) }}</td>
                  <td>
                    @if (row.request_id) {
                      <a [routerLink]="['/mass-intentions/intentions', row.request_id]">Open</a>
                    } @else {
                      —
                    }
                  </td>
                </tr>
              }
            </tbody>
          </table>
        </app-data-table>

        @if (totalItems() > 30) {
          <app-pagination
            [currentPage]="currentPage()"
            [pageSize]="30"
            [totalItems]="totalItems()"
            [showPageSizeSelector]="false"
            (pageChange)="goToPage($event)"
          />
        }
      }
    </div>
  `,
})
export class MassIntentionsAuditPageComponent {
  private readonly api = inject(MassIntentionsApiService);

  readonly loading = signal(true);
  readonly rows = signal<MassIntentionAuditRow[]>([]);
  readonly eventFilter = signal('');
  readonly currentPage = signal(1);
  readonly totalItems = signal(0);

  constructor() {
    this.reload();
  }

  goToPage(page: number): void {
    this.currentPage.set(page);
    this.reload();
  }

  eventLabel(type: string): string {
    const map: Record<string, string> = {
      'request.accepted': 'Intention accepted',
      'request.withdrawn': 'Intention withdrawn',
      'receipt.voided': 'Receipt voided',
      'celebration.cancelled': 'Mass cancelled',
      'transfer.initiated': 'Transfer sent',
      'transfer.accepted': 'Transfer accepted',
      'transfer.rejected': 'Transfer declined',
      'transfer.received': 'Transfer received',
      'transfer.declined': 'Transfer declined (sending parish)',
    };
    return map[type] ?? type;
  }

  reload(): void {
    this.loading.set(true);
    const params: Record<string, string | number> = {
      per_page: 30,
      page: this.currentPage(),
    };
    const filter = this.eventFilter().trim();
    if (filter) {
      params['event_type'] = filter;
    }
    this.api.listAudits(params).subscribe({
      next: (res) => {
        this.rows.set(res.data ?? []);
        this.totalItems.set(res.total ?? this.rows().length);
        this.loading.set(false);
      },
      error: () => this.loading.set(false),
    });
  }
}
