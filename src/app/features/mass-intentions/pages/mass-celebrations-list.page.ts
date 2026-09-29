import { CommonModule } from '@angular/common';
import { Component, inject, signal } from '@angular/core';
import { ActivatedRoute, RouterModule } from '@angular/router';
import { StatusBadgeComponent, StatusBadgeTone } from '@shared/components/status-badge/status-badge.component';
import { CfEmptyStateComponent } from '@shared/components/cf-empty-state/cf-empty-state.component';
import { LoadingSkeletonComponent } from '@shared/components/loading-skeleton/loading-skeleton.component';
import { PageHeaderComponent } from '@shared/components/page-header/page-header.component';
import { PaginationComponent } from '@shared/components/pagination/pagination.component';
import { DataTableComponent } from '@shared/components/data-table/data-table.component';
import { ListToolbarComponent } from '@shared/components/list-toolbar/list-toolbar.component';
import { AddMassModalComponent } from '../components/add-mass-modal.component';
import { MassCelebrationSummary, MassIntentionsApiService } from '../services/mass-intentions-api.service';
import { formatMassDayTime } from '../utils/mass-celebration-display';

@Component({
  selector: 'app-mass-celebrations-list-page',
  standalone: true,
  imports: [
    CommonModule,
    RouterModule,
    PageHeaderComponent,
    CfEmptyStateComponent,
    AddMassModalComponent,
    StatusBadgeComponent,
    LoadingSkeletonComponent,
    PaginationComponent,
    DataTableComponent,
    ListToolbarComponent,
  ],
  template: `
    <div class="cf-page mass-celebrations-page">
      <app-page-header
        [title]="needsTickFilter() ? 'Masses that need a tick' : 'Masses'"
        subtitle="Upcoming and recent celebrations"
      >
        <button type="button" class="cf-btn cf-btn-primary" (click)="showAddMass.set(true)">Add Mass</button>
      </app-page-header>

      <app-list-toolbar
        searchPlaceholder="Place, priest, or day…"
        [searchValue]="search()"
        [filterCount]="statusFilter() ? 1 : 0"
        (searchChange)="onSearch($event)"
        (filtersOpened)="showFilters.set(!showFilters())"
      />

      @if (showFilters()) {
        <div class="cf-panel mass-celebrations-page__filters">
          <label class="mass-celebrations-page__filter">
            <span>Status</span>
            <select class="cf-control" [value]="statusFilter()" (change)="onStatusFilter($any($event.target).value)">
              <option value="">All</option>
              <option value="scheduled">Scheduled</option>
              <option value="cancelled">Cancelled</option>
            </select>
          </label>
        </div>
      }

      @if (loading()) {
        <app-loading-skeleton type="table" [rows]="5" [columns]="5" />
      } @else if (items().length === 0) {
        <app-cf-empty-state title="No Masses yet." description="Add the next Sunday or weekday Mass.">
          <button type="button" class="cf-btn cf-btn-primary" (click)="showAddMass.set(true)">Add Mass</button>
        </app-cf-empty-state>
      } @else if (filteredItems().length === 0) {
        <app-cf-empty-state title="No matches." description="Try a different search or filter." />
      } @else {
        <app-data-table [clickableRows]="true" [ariaBusy]="loading()">
          <table class="cf-data-table">
            <thead>
              <tr>
                <th>Day and time</th>
                <th>Place</th>
                <th>Priest</th>
                <th>Intentions</th>
                <th>Status</th>
              </tr>
            </thead>
            <tbody>
              @for (row of filteredItems(); track row.id) {
                <tr [routerLink]="['/mass-intentions/masses', row.id]">
                  <td>{{ dayTime(row) }}</td>
                  <td>{{ row.place || '—' }}</td>
                  <td>{{ row.celebrant_name || '—' }}</td>
                  <td>{{ row.intention_count ?? 0 }}</td>
                  <td>
                    <app-status-badge [label]="massStatusLabel(row.status)" [tone]="massStatusTone(row.status)" />
                  </td>
                </tr>
              }
            </tbody>
          </table>
        </app-data-table>

        @if (totalItems() > 20) {
          <app-pagination
            [currentPage]="currentPage()"
            [pageSize]="20"
            [totalItems]="totalItems()"
            [showPageSizeSelector]="false"
            (pageChange)="goToPage($event)"
          />
        }
      }

      <app-add-mass-modal
        [open]="showAddMass()"
        (closed)="showAddMass.set(false)"
        (created)="reload()"
      />
    </div>
  `,
  styles: [
    `
      .mass-celebrations-page__filters {
        padding: var(--cf-space-3);
        margin-bottom: var(--cf-space-3);
      }
      .mass-celebrations-page__filter {
        display: grid;
        gap: var(--cf-space-2);
        font-size: var(--cf-text-base);
        max-width: 16rem;
      }
      @media (max-width: 768px) {
        .mass-celebrations-page app-page-header .cf-btn-primary {
          width: 100%;
          min-height: 44px;
        }
      }
    `,
  ],
})
export class MassCelebrationsListPageComponent {
  private readonly api = inject(MassIntentionsApiService);
  private readonly route = inject(ActivatedRoute);

  readonly loading = signal(true);
  readonly showAddMass = signal(false);
  readonly items = signal<MassCelebrationSummary[]>([]);
  readonly needsTickFilter = signal(false);
  readonly currentPage = signal(1);
  readonly totalItems = signal(0);
  readonly search = signal('');
  readonly statusFilter = signal('');
  readonly showFilters = signal(false);

  constructor() {
    this.route.queryParamMap.subscribe((params) => {
      this.needsTickFilter.set(params.get('needs_tick') === '1');
      this.currentPage.set(1);
      this.reload();
    });
  }

  onSearch(term: string): void {
    this.search.set(term);
  }

  onStatusFilter(status: string): void {
    this.statusFilter.set(status);
  }

  filteredItems(): MassCelebrationSummary[] {
    const q = this.search().trim().toLowerCase();
    const status = this.statusFilter();
    return this.items().filter((row) => {
      if (status && row.status !== status) {
        return false;
      }
      if (!q) {
        return true;
      }
      const haystack = [row.celebrated_on, row.celebrated_at, row.place, row.celebrant_name]
        .filter(Boolean)
        .join(' ')
        .toLowerCase();
      return haystack.includes(q);
    });
  }

  dayTime(row: MassCelebrationSummary): string {
    return formatMassDayTime(row.celebrated_on, row.celebrated_at);
  }

  massStatusLabel(status?: string): string {
    if (status === 'cancelled') {
      return 'Cancelled';
    }
    if (status === 'scheduled') {
      return 'Scheduled';
    }
    return status ?? '—';
  }

  massStatusTone(status?: string): StatusBadgeTone {
    if (status === 'cancelled') {
      return 'neutral';
    }
    return 'info';
  }

  goToPage(page: number): void {
    this.currentPage.set(page);
    this.reload();
  }

  reload(): void {
    this.loading.set(true);
    const params: Record<string, string | number> = {
      per_page: 20,
      page: this.currentPage(),
    };
    if (this.needsTickFilter()) {
      params['needs_tick'] = 1;
    }
    this.api.listCelebrations(params).subscribe({
      next: (res) => {
        this.items.set(res.data ?? []);
        this.totalItems.set(res.total ?? this.items().length);
        this.loading.set(false);
      },
      error: () => this.loading.set(false),
    });
  }
}
