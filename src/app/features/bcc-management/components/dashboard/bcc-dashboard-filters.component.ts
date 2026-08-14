import { CommonModule } from '@angular/common';
import {
  ChangeDetectionStrategy,
  Component,
  EventEmitter,
  Input,
  Output,
} from '@angular/core';
import { FormsModule } from '@angular/forms';
import {
  BccAttentionType,
  BccDashboardFilters,
  BccDashboardPeriod,
  BccStatus,
  BccTrendFilter,
} from '../../models/bcc.model';

export interface BccFilterChip {
  key: string;
  label: string;
}

@Component({
  selector: 'app-bcc-dashboard-filters',
  standalone: true,
  imports: [CommonModule, FormsModule],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <div class="bcc-filters cf-panel">
      <div class="bcc-filters__row">
        <label class="bcc-filters__search">
          <span class="visually-hidden">Search BCCs</span>
          <input
            type="search"
            [ngModel]="search"
            (ngModelChange)="onSearch($event)"
            placeholder="Search BCCs…"
            autocomplete="off"
          />
        </label>

        <label>
          <span>Status</span>
          <select [ngModel]="status" (ngModelChange)="emitChange({ status: $event })">
            <option value="all">All</option>
            <option value="active">Active</option>
            <option value="inactive">Inactive</option>
            <option value="suspended">Suspended</option>
          </select>
        </label>

        <label>
          <span>Period</span>
          <select [ngModel]="period" (ngModelChange)="emitChange({ period: $event })">
            <option value="3m">Last 3 months</option>
            <option value="6m">Last 6 months</option>
            <option value="1y">Last 12 months</option>
            <option value="3y">Last 3 years</option>
          </select>
        </label>

        <label *ngIf="coordinators.length">
          <span>Coordinator</span>
          <select [ngModel]="coordinator" (ngModelChange)="emitChange({ coordinator: $event || null })">
            <option value="">All</option>
            <option *ngFor="let c of coordinators" [value]="c.id">{{ c.name }}</option>
          </select>
        </label>

        <button type="button" class="cf-btn" (click)="reset.emit()" [disabled]="!chips.length">
          Reset filters
        </button>
      </div>

      <div class="bcc-filters__chips" *ngIf="chips.length" aria-label="Active filters">
        <span class="bcc-filters__showing cf-meta" *ngIf="hasCrossFilter">Showing:</span>
        <button
          type="button"
          class="bcc-filters__chip"
          *ngFor="let chip of chips"
          (click)="clearChip.emit(chip.key)"
        >
          {{ chip.label }} <span aria-hidden="true">×</span>
        </button>
      </div>
    </div>
  `,
  styles: [
    `
      .bcc-filters {
        margin-top: 0.75rem;
        padding: 0.85rem 1rem;
      }
      .bcc-filters__row {
        display: flex;
        flex-wrap: wrap;
        gap: 0.75rem;
        align-items: end;
      }
      .bcc-filters label {
        display: grid;
        gap: 0.25rem;
        font-size: 0.78rem;
        color: var(--cf-muted);
      }
      .bcc-filters select,
      .bcc-filters input[type='search'] {
        min-width: 9rem;
        border: 1px solid var(--cf-slate-200);
        border-radius: var(--cf-radius-sm);
        padding: 0.45rem 0.6rem;
        background: #fff;
        color: var(--cf-slate-900);
        font: inherit;
      }
      .bcc-filters__search {
        flex: 1 1 14rem;
      }
      .bcc-filters__search input {
        width: 100%;
        min-width: 12rem;
      }
      .bcc-filters__chips {
        display: flex;
        flex-wrap: wrap;
        gap: 0.4rem;
        margin-top: 0.65rem;
      }
      .bcc-filters__chip {
        border: 1px solid var(--cf-slate-200);
        background: var(--cf-slate-50);
        border-radius: 999px;
        padding: 0.2rem 0.65rem;
        font-size: 0.78rem;
        cursor: pointer;
      }
      .visually-hidden {
        position: absolute;
        width: 1px;
        height: 1px;
        padding: 0;
        margin: -1px;
        overflow: hidden;
        clip: rect(0, 0, 0, 0);
        border: 0;
      }
    `,
  ],
})
export class BccDashboardFiltersComponent {
  @Input() search = '';
  @Input() status: BccStatus | 'all' = 'all';
  @Input() period: BccDashboardPeriod = '1y';
  @Input() coordinator: string | null = null;
  @Input() coordinators: Array<{ id: string; name: string }> = [];
  @Input() chips: BccFilterChip[] = [];

  @Output() filtersChange = new EventEmitter<Partial<BccDashboardFilters>>();
  @Output() searchChange = new EventEmitter<string>();
  @Output() reset = new EventEmitter<void>();
  @Output() clearChip = new EventEmitter<string>();

  get hasCrossFilter(): boolean {
    return this.chips.some((c) => c.key === 'attention' || c.key === 'trend');
  }

  onSearch(value: string): void {
    this.searchChange.emit(value);
  }

  emitChange(partial: Partial<BccDashboardFilters>): void {
    this.filtersChange.emit(partial);
  }
}

export function periodLabel(period: BccDashboardPeriod): string {
  switch (period) {
    case '3m':
      return 'Last 3 months';
    case '6m':
      return 'Last 6 months';
    case '3y':
      return 'Last 3 years';
    default:
      return 'Last 12 months';
  }
}

export function attentionLabel(type: BccAttentionType): string {
  switch (type) {
    case 'no_primary':
      return 'Needs primary leader';
    case 'unlinked_families':
      return 'Families without BCC';
    case 'empty':
      return 'Empty BCCs';
    case 'data_review':
      return 'Data review';
  }
}

export function trendLabel(trend: BccTrendFilter): string {
  return trend === 'growing' ? 'Growing BCCs' : 'Declining BCCs';
}
