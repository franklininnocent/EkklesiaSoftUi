import { CommonModule } from '@angular/common';
import { ChangeDetectorRef, Component, Input, OnChanges, SimpleChanges, inject } from '@angular/core';
import { DonationsService } from '../../services/donations.service';
import { FinancialTimelineEvent } from '../../models/donation.model';

@Component({
  selector: 'app-financial-activity-timeline',
  standalone: true,
  imports: [CommonModule],
  template: `
    <section class="fat-timeline cf-panel" *ngIf="subjectId">
      <header *ngIf="title">
        <h4>{{ title }}</h4>
        <span *ngIf="!loading && events.length">{{ events.length }} events</span>
      </header>

      <p *ngIf="loading" class="fat-timeline__state cf-state">Loading activity…</p>
      <p *ngIf="!loading && error" class="fat-timeline__state cf-state cf-state--error">{{ error }}</p>

      <ul class="fat-timeline__list" *ngIf="!loading && events.length">
        <li *ngFor="let event of events" class="fat-timeline__item">
          <div class="fat-timeline__dot" [class]="eventTypeClass(event)"></div>
          <div class="fat-timeline__content">
            <strong>{{ event.title }}</strong>
            <span *ngIf="event.subtitle || event.date">
              {{ event.subtitle }}<ng-container *ngIf="event.subtitle && event.date"> · </ng-container>{{ event.date | date }}
            </span>
            <small *ngIf="event.reference">Ref: {{ event.reference }}</small>
          </div>
          <strong class="fat-timeline__amount" *ngIf="event.amount != null">
            {{ event.amount | number:'1.2-2' }}
          </strong>
        </li>
      </ul>

      <p *ngIf="!loading && !error && !events.length" class="fat-timeline__state cf-state">No activity recorded yet.</p>
    </section>
  `,
  styles: [`
    .fat-timeline { display: grid; gap: 0.65rem; }
    .fat-timeline header { display: flex; justify-content: space-between; align-items: baseline; gap: 0.5rem; }
    .fat-timeline h4 { margin: 0; font-size: 0.95rem; color: var(--cf-slate-900); }
    .fat-timeline header span { color: var(--cf-muted); font-size: 0.78rem; }
    .fat-timeline__list { list-style: none; margin: 0; padding: 0; display: grid; gap: 0.55rem; }
    .fat-timeline__item { display: grid; grid-template-columns: 12px minmax(0, 1fr) auto; gap: 0.65rem; align-items: start; }
    .fat-timeline__dot { width: 10px; height: 10px; border-radius: 999px; margin-top: 0.35rem; background: var(--cf-slate-500); }
    .fat-timeline__dot.payment { background: var(--cf-forest); }
    .fat-timeline__dot.receipt { background: var(--cf-primary); }
    .fat-timeline__dot.donation { background: var(--cf-indigo); }
    .fat-timeline__dot.overdue { background: var(--cf-critical); }
    .fat-timeline__dot.project, .fat-timeline__dot.audit { background: var(--cf-amber); }
    .fat-timeline__content { display: grid; gap: 0.1rem; min-width: 0; }
    .fat-timeline__content span, .fat-timeline__content small { color: var(--cf-muted); font-size: 0.82rem; }
    .fat-timeline__amount { font-size: 0.9rem; white-space: nowrap; color: var(--cf-slate-900); }
  `]
})
export class FinancialActivityTimelineComponent implements OnChanges {
  private readonly donationsService = inject(DonationsService);
  private readonly cdr = inject(ChangeDetectorRef);

  @Input({ required: true }) subjectType!: 'family' | 'payment' | 'project' | 'campaign' | string;
  @Input({ required: true }) subjectId = '';
  @Input() title = 'Activity Timeline';
  @Input() limit = 20;

  loading = false;
  error = '';
  events: FinancialTimelineEvent[] = [];

  ngOnChanges(changes: SimpleChanges): void {
    if (changes['subjectId'] || changes['subjectType']) {
      this.load();
    }
  }

  eventTypeClass(event: FinancialTimelineEvent): string {
    return event.type || 'audit';
  }

  private load(): void {
    if (!this.subjectId) {
      this.events = [];
      return;
    }

    this.loading = true;
    this.error = '';
    this.donationsService.getActivityTimeline(this.subjectType, this.subjectId).subscribe({
      next: (res) => {
        this.events = (res.data?.events ?? []).slice(0, this.limit);
        this.loading = false;
        this.cdr.detectChanges();
      },
      error: () => {
        this.loading = false;
        this.error = 'Unable to load activity timeline.';
        this.events = [];
        this.cdr.detectChanges();
      }
    });
  }
}
