import { ComponentFixture, TestBed } from '@angular/core/testing';
import { Subject, of, throwError } from 'rxjs';
import { ChurchCurrencyService } from '@core/services/church-currency.service';
import { FinancialTimelineEvent } from '../../models/donation.model';
import { DonationsService } from '../../services/donations.service';
import { FinancialActivityTimelineComponent } from './financial-activity-timeline.component';

const familyEvents: FinancialTimelineEvent[] = [
  {
    type: 'overdue',
    id: 'due-1',
    date: '2026-09-30',
    title: 'Overdue contribution',
    subtitle: 'Parish Feast Offering 2026',
    amount: 1000,
    status: 'overdue',
  },
  {
    type: 'overdue',
    id: 'due-2',
    date: '2026-07-10',
    title: 'Overdue contribution',
    subtitle: 'Family Support Pledge',
    amount: 1392,
    status: 'overdue',
  },
  {
    type: 'overdue',
    id: 'due-3',
    date: '2026-04-10',
    title: 'Overdue contribution',
    subtitle: 'Family Support Pledge',
    amount: 1392,
    status: 'overdue',
  },
  {
    type: 'payment',
    id: 'pay-1',
    date: '2025-04-01',
    title: 'Payment received',
    subtitle: 'Stephen Varghese',
    amount: 3125,
    reference: 'RCPT-15-2026-000001',
    status: 'succeeded',
  },
];

describe('FinancialActivityTimelineComponent', () => {
  let fixture: ComponentFixture<FinancialActivityTimelineComponent>;
  let ledgerMutated$: Subject<void>;

  function setup(events: FinancialTimelineEvent[] | 'error' = familyEvents): void {
    ledgerMutated$ = new Subject<void>();
    TestBed.configureTestingModule({
      imports: [FinancialActivityTimelineComponent],
      providers: [
        {
          provide: DonationsService,
          useValue: {
            ledgerMutated$,
            getActivityTimeline: jest.fn(() =>
              events === 'error'
                ? throwError(() => new Error('failed'))
                : of({ success: true, data: { subject_type: 'family', subject_id: 'fam-1', count: events.length, events } })
            ),
          },
        },
        { provide: ChurchCurrencyService, useValue: { currencyCode: () => 'USD' } },
      ],
    });
    fixture = TestBed.createComponent(FinancialActivityTimelineComponent);
    fixture.componentRef.setInput('subjectType', 'family');
    fixture.componentRef.setInput('subjectId', 'fam-1');
    fixture.componentRef.setInput('title', 'Activity Feed');
    fixture.detectChanges();
  }

  afterEach(() => {
    TestBed.resetTestingModule();
  });

  it('shows a compact ledger and filters to overdue items', () => {
    setup();
    const el = fixture.nativeElement as HTMLElement;
    const text = el.textContent ?? '';

    expect(text).toContain('Activity Feed');
    expect(text).toContain('Parish Feast Offering 2026');
    expect(text).toContain('Stephen Varghese');
    expect(text).toContain('Ref: RCPT-15-2026-000001');
    expect(text).toContain('30 Sep 2026');
    expect(text).toContain('1 Apr 2025');
    expect(text).not.toContain('Overdue contribution');
    expect(text).not.toContain('Payment received');
    expect(el.querySelectorAll('tbody tr').length).toBe(4);

    const overdue = Array.from(el.querySelectorAll('button')).find((button) => button.textContent?.includes('Overdue'));
    overdue?.click();
    fixture.detectChanges();

    expect(el.querySelectorAll('tbody tr').length).toBe(3);
    expect(el.textContent).not.toContain('Stephen Varghese');
    expect(el.textContent).toContain('Family Support Pledge');
  });

  it('keeps a specific offering title and shows its category', () => {
    setup([
      {
        type: 'donation',
        id: 'gift-1',
        date: '2026-09-30',
        title: 'Sunday Offering',
        subtitle: 'Voluntary gift',
        amount: 250,
        status: 'recorded',
      },
    ]);
    const text = (fixture.nativeElement as HTMLElement).textContent ?? '';
    expect(text).toContain('Sunday Offering');
    expect(text).toContain('Voluntary gift');
    expect(text).toContain('Offering');
  });

  it('shows an empty state when nothing is recorded', () => {
    setup([]);
    expect((fixture.nativeElement as HTMLElement).textContent).toContain('No activity recorded yet.');
  });

  it('shows an error when the timeline cannot be loaded', () => {
    setup('error');
    expect((fixture.nativeElement as HTMLElement).textContent).toContain('Unable to load activity timeline.');
  });
});
