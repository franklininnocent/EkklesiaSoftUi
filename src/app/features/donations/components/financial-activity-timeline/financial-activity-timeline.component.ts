import { CommonModule } from '@angular/common';
import { ChangeDetectorRef, Component, DestroyRef, Input, OnChanges, SimpleChanges, inject } from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { CfBrandLoaderComponent } from '@shared/components/cf-brand-loader/cf-brand-loader.component';
import { CfCurrencyPipe } from '@shared/pipes/cf-currency.pipe';
import { CfDatePipe } from '@shared/pipes/cf-date.pipe';
import { FinancialTimelineEvent } from '../../models/donation.model';
import { DonationsService } from '../../services/donations.service';

type ActivityFilterKey = 'all' | 'overdue' | 'received' | 'receipts' | 'other';

interface ActivityFilter {
  key: ActivityFilterKey;
  label: string;
  count: number;
}

const GENERIC_TITLES = new Set([
  'overdue contribution',
  'payment received',
  'payment recorded',
  'receipt issued',
  'contribution received',
  'campaign started',
  'project started',
]);

@Component({
  selector: 'app-financial-activity-timeline',
  standalone: true,
  imports: [CfDatePipe, CommonModule, CfCurrencyPipe, CfBrandLoaderComponent],
  template: `
    <section class="fat" [class.cf-panel]="!embedded" *ngIf="subjectId" [attr.aria-labelledby]="title && !embedded ? headingId : null">
      <header class="fat__header" *ngIf="title && !embedded">
        <h4 [id]="headingId" class="cf-subsection-title">{{ title }}</h4>
        <div class="fat__filters" *ngIf="filters.length" role="group" [attr.aria-label]="'Filter ' + title">
          <button
            type="button"
            *ngFor="let filter of filters"
            class="fat__filter"
            [class.is-active]="activeFilter === filter.key"
            [attr.aria-pressed]="activeFilter === filter.key"
            (click)="setFilter(filter.key)"
          >
            {{ filter.label }}
            <span>{{ filter.count }}</span>
          </button>
        </div>
        <span class="fat__count" *ngIf="!filters.length && !loading && events.length">{{ eventCountLabel }}</span>
      </header>
      <p class="sr-only" *ngIf="description">{{ description }}</p>

      <app-cf-brand-loader *ngIf="loading" size="inline" label="Loading activity…" />
      <p *ngIf="!loading && error" class="fat__state cf-state cf-state--error" role="alert">{{ error }}</p>

      <div class="cf-table-responsive" *ngIf="!loading && visibleEvents.length">
        <table class="cf-table fat__table">
          <thead>
            <tr>
              <th scope="col">Item</th>
              <th scope="col">Date</th>
              <th scope="col" class="fat__num">Amount</th>
              <th scope="col">Status</th>
            </tr>
          </thead>
          <tbody>
            <tr *ngFor="let event of visibleEvents; trackBy: trackEvent">
              <td>
                <span class="fat__name">{{ primaryLabel(event) }}</span>
                <span class="fat__note cf-caption" *ngIf="supportingLabel(event)">{{ supportingLabel(event) }}</span>
              </td>
              <td class="fat__date">
                <time *ngIf="event.date; else noDate" [attr.datetime]="event.date">{{ event.date | cfDate }}</time>
                <ng-template #noDate>—</ng-template>
              </td>
              <td class="fat__num">{{ event.amount != null ? (event.amount | cfCurrency) : '—' }}</td>
              <td><span class="cf-badge" [ngClass]="badgeClass(event)">{{ kindLabel(event) }}</span></td>
            </tr>
          </tbody>
        </table>
      </div>

      <p *ngIf="!loading && !error && !events.length" class="fat__state cf-state">No activity recorded yet.</p>
    </section>
  `,
  styles: [`
    .fat { display: grid; gap: 0.55rem; }
    .fat__header {
      display: flex;
      align-items: center;
      justify-content: space-between;
      gap: 0.45rem 0.75rem;
      flex-wrap: wrap;
    }
    .fat__header .cf-subsection-title { margin: 0; color: var(--cf-slate-900); }
    .fat__filters { display: flex; flex-wrap: wrap; gap: 0.3rem; }
    .fat__filter {
      display: inline-flex;
      align-items: center;
      gap: 0.3rem;
      min-height: 1.65rem;
      padding: 0.05rem 0.5rem;
      border: 1px solid var(--cf-panel-border);
      border-radius: var(--cf-radius-pill);
      background: var(--cf-panel-bg);
      color: var(--cf-slate-700);
      font: inherit;
      font-size: 0.75rem;
      font-weight: 600;
      line-height: 1.2;
      cursor: pointer;
    }
    .fat__filter span {
      color: var(--cf-muted);
      font-variant-numeric: tabular-nums;
    }
    .fat__filter:hover { background: var(--cf-slate-50); }
    .fat__filter.is-active {
      background: var(--cf-slate-900);
      border-color: var(--cf-slate-900);
      color: var(--cf-color-text-on-dark, #fff);
    }
    .fat__filter.is-active span { color: inherit; }
    .fat__filter:focus-visible {
      outline: 2px solid var(--cf-primary);
      outline-offset: 2px;
    }
    .fat__count {
      color: var(--cf-muted);
      font-size: var(--cf-text-sm, 0.8rem);
      font-weight: 600;
    }
    .fat__table { margin: 0; }
    .fat__name {
      display: block;
      font-weight: 600;
      color: var(--cf-slate-900);
    }
    .fat__note { display: block; margin-top: 0.05rem; }
    .fat__date { white-space: nowrap; color: var(--cf-slate-700); }
    .fat__num {
      text-align: right;
      font-variant-numeric: tabular-nums;
      white-space: nowrap;
      font-weight: 600;
    }
    .fat__table th.fat__num { text-align: right; }
    .fat__state { margin: 0; }
  `]
})
export class FinancialActivityTimelineComponent implements OnChanges {
  private readonly donationsService = inject(DonationsService);
  private readonly cdr = inject(ChangeDetectorRef);
  private readonly destroyRef = inject(DestroyRef);

  @Input({ required: true }) subjectType!: 'family' | 'payment' | 'project' | 'campaign' | string;
  @Input({ required: true }) subjectId = '';
  @Input() title = 'Activity Timeline';
  @Input() description = '';
  /** Inside a detail modal the parent section already supplies the heading and panel. */
  @Input() embedded = false;
  @Input() limit = 20;

  loading = false;
  error = '';
  events: FinancialTimelineEvent[] = [];
  activeFilter: ActivityFilterKey = 'all';
  readonly headingId = `fat-${Math.random().toString(36).slice(2, 9)}`;

  constructor() {
    this.donationsService.ledgerMutated$
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe(() => this.load(false));
  }

  ngOnChanges(changes: SimpleChanges): void {
    if (changes['subjectId'] || changes['subjectType']) {
      this.load(true);
    }
  }

  get eventCountLabel(): string {
    return this.events.length === 1 ? '1 event' : `${this.events.length} events`;
  }

  get filters(): ActivityFilter[] {
    const counts = new Map<ActivityFilterKey, number>();
    for (const event of this.events) {
      const key = filterKey(event);
      counts.set(key, (counts.get(key) ?? 0) + 1);
    }
    if (counts.size < 2) {
      return [];
    }

    const filters: ActivityFilter[] = [{ key: 'all', label: 'All', count: this.events.length }];
    const order: Array<{ key: ActivityFilterKey; label: string }> = [
      { key: 'overdue', label: 'Overdue' },
      { key: 'received', label: 'Received' },
      { key: 'receipts', label: 'Receipts' },
      { key: 'other', label: 'Updates' },
    ];
    for (const item of order) {
      const count = counts.get(item.key) ?? 0;
      if (count) {
        filters.push({ key: item.key, label: item.label, count });
      }
    }
    return filters;
  }

  get visibleEvents(): FinancialTimelineEvent[] {
    if (this.activeFilter === 'all') {
      return this.events;
    }
    return this.events.filter((event) => filterKey(event) === this.activeFilter);
  }

  setFilter(key: ActivityFilterKey): void {
    this.activeFilter = key;
  }

  trackEvent(_index: number, event: FinancialTimelineEvent): string {
    return `${event.type}:${event.id}`;
  }

  badgeClass(event: FinancialTimelineEvent): string {
    switch (event.type) {
      case 'overdue':
        return 'cf-badge--critical';
      case 'payment':
      case 'donation':
        return 'cf-badge--success';
      case 'receipt':
        return 'cf-badge--info';
      case 'project':
        return 'cf-badge--warning';
      default:
        return 'cf-badge--neutral';
    }
  }

  kindLabel(event: FinancialTimelineEvent): string {
    switch (event.type) {
      case 'overdue':
        return 'Overdue';
      case 'payment':
        return 'Received';
      case 'donation':
        return 'Offering';
      case 'receipt':
        return 'Receipt';
      case 'project':
        return 'Project';
      default:
        return 'Update';
    }
  }

  primaryLabel(event: FinancialTimelineEvent): string {
    const title = (event.title || '').trim();
    const subtitle = (event.subtitle || '').trim();
    if (isGenericTitle(title) && subtitle) {
      return subtitle;
    }
    return title || subtitle || 'Activity';
  }

  supportingLabel(event: FinancialTimelineEvent): string {
    const title = (event.title || '').trim();
    const subtitle = (event.subtitle || '').trim();
    const parts: string[] = [];
    if (subtitle && !isGenericTitle(title) && subtitle !== title && !looksLikeEventCode(subtitle)) {
      parts.push(subtitle);
    }
    if (event.reference) {
      parts.push(`Ref: ${event.reference}`);
    }
    return parts.join(' · ');
  }

  private load(showLoader = true): void {
    if (!this.subjectId) {
      this.events = [];
      this.activeFilter = 'all';
      return;
    }

    this.loading = showLoader && this.events.length === 0;
    this.error = '';
    this.donationsService.getActivityTimeline(this.subjectType, this.subjectId).subscribe({
      next: (res) => {
        this.events = (res.data?.events ?? []).slice(0, this.limit);
        if (!this.filters.some((filter) => filter.key === this.activeFilter)) {
          this.activeFilter = 'all';
        }
        this.loading = false;
        this.cdr.detectChanges();
      },
      error: () => {
        this.loading = false;
        this.error = 'Unable to load activity timeline.';
        this.events = [];
        this.activeFilter = 'all';
        this.cdr.detectChanges();
      }
    });
  }
}

function filterKey(event: FinancialTimelineEvent): ActivityFilterKey {
  switch (event.type) {
    case 'overdue':
      return 'overdue';
    case 'payment':
    case 'donation':
      return 'received';
    case 'receipt':
      return 'receipts';
    default:
      return 'other';
  }
}

function isGenericTitle(title: string): boolean {
  return GENERIC_TITLES.has(title.trim().toLowerCase());
}

function looksLikeEventCode(value: string): boolean {
  return value.includes('.') && /^[a-z0-9_.-]+$/i.test(value);
}
