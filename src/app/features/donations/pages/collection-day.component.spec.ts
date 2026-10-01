import { ComponentFixture, TestBed } from '@angular/core/testing';
import { provideRouter, Router } from '@angular/router';
import { of, Subject } from 'rxjs';
import { CollectionDayComponent } from './collection-day.component';
import { FamilyService } from '@core/services/family.service';
import { DonationsService } from '../services/donations.service';
import { ReceiptPrintService } from '../services/receipt-print.service';
import { AuthService } from '@core/services/auth.service';

describe('CollectionDayComponent', () => {
  let component: CollectionDayComponent;
  let fixture: ComponentFixture<CollectionDayComponent>;
  let ledgerMutated$: Subject<void>;
  let getPayments: jest.Mock;

  beforeEach(async () => {
    ledgerMutated$ = new Subject<void>();
    getPayments = jest.fn().mockReturnValue(of({
      success: true,
      data: { data: [] },
      meta: {
        totals: {
          payment_count: 0,
          collected_gross: 0,
          refunded_total: 0,
          net_collected: 0,
          families_count: 0,
          currency_code: 'INR'
        },
        business_date: '2026-09-28',
        timezone: 'Asia/Kolkata',
        date_basis: 'payment_date',
        date_mode: 'today'
      }
    }));

    await TestBed.configureTestingModule({
      imports: [CollectionDayComponent],
      providers: [
        provideRouter([]),
        {
          provide: FamilyService,
          useValue: {
            getFamilies: jest.fn().mockReturnValue(of({ data: [] }))
          }
        },
        {
          provide: DonationsService,
          useValue: {
            getPayments,
            ledgerMutated$,
            getDashboardSummary: jest.fn().mockReturnValue(of({ success: true, data: {} })),
            getSettings: jest.fn().mockReturnValue(of({ success: true, data: { default_currency: 'INR' } })),
            getFamilyFinancialProfile: jest.fn().mockReturnValue(of({ success: true, data: null })),
            createPayment: jest.fn(),
            getReceiptPreview: jest.fn()
          }
        },
        {
          provide: ReceiptPrintService,
          useValue: { printPaymentReceipt: jest.fn() }
        },
        {
          provide: AuthService,
          useValue: { currentUserValue: { name: 'Test Operator' } }
        }
      ]
    }).compileComponents();

    fixture = TestBed.createComponent(CollectionDayComponent);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  it('renders the command header hierarchy', () => {
    const text = fixture.nativeElement.textContent;
    expect(text).not.toContain('Collection Operations Center');
    expect(text).not.toContain('Real-time contribution collection and payment processing workspace');
    expect(text).toContain('Session Active');
    expect(text).toContain('Operator');
    expect(text).toContain('Test Operator');
    expect(text).toContain('Collection Date');
    expect(fixture.nativeElement.querySelector('[aria-label="Quick Actions"]')).toBeTruthy();
    expect(fixture.nativeElement.querySelector('[aria-label="Export"]')).toBeTruthy();
    expect(fixture.nativeElement.querySelector('[aria-label="Exit Workspace"]')).toBeTruthy();
    expect(fixture.nativeElement.querySelector('[aria-label="Refresh session"]')).toBeTruthy();
  });

  it('requires family, payer, and amount before submit', () => {
    expect(component.canSubmit).toBe(false);

    component.selectedFamily = { id: 'f1', family_name: 'Ward Family', family_code: 'FAM001' } as any;
    component.payerName = 'Jane Ward';
    component.amount = 100;

    expect(component.canSubmit).toBe(true);
  });

  it('ignores number shortcuts while typing in form fields', () => {
    component.selectedFamily = { id: 'f1', family_name: 'Ward Family', family_code: 'FAM001' } as any;
    component.collectType = 'general';

    const input = document.createElement('input');
    component.onKeydown({
      key: '2',
      target: input,
      preventDefault: jest.fn()
    } as unknown as KeyboardEvent);

    expect(component.collectType).toBe('general');
  });

  it('labels unallocated collection-day amounts as family credit', () => {
    component.amount = 250;
    component.collectType = 'general';
    expect(component.allocationPreview[0].label).toContain('Family credit');
  });

  it('makes Today\'s Collections a navigable KPI and loads parish-today payments', () => {
    const donations = TestBed.inject(DonationsService) as unknown as {
      getPayments: jest.Mock;
      getDashboardSummary: jest.Mock;
    };
    expect(donations.getPayments).toHaveBeenCalledWith({ today_only: '1', per_page: '12' });

    donations.getPayments.mockReturnValue(of({
      success: true,
      data: { data: [{ id: 'pay-1', amount: 10, method: 'cash', payment_number: 'PAY-1' }] },
      meta: {
        totals: {
          payment_count: 7,
          collected_gross: 125,
          refunded_total: 0,
          net_collected: 125,
          families_count: 4,
          currency_code: 'INR'
        },
        business_date: '2026-09-28',
        timezone: 'Asia/Kolkata',
        date_basis: 'payment_date',
        date_mode: 'today'
      }
    }));
    donations.getDashboardSummary.mockReturnValue(of({ success: true, data: {} }));
    component.refreshSession();
    fixture.detectChanges();

    expect(component.sessionCount).toBe(7);
    expect(component.sessionTotal).toBe(125);
    expect(component.familiesProcessedToday).toBe(4);
    expect(component.todayPayments.length).toBe(1);

    const buttons = fixture.nativeElement.querySelectorAll('button.coc-kpi--link');
    expect(buttons.length).toBe(6);
    const hrefs = component.kpiCards.map((card) => component.kpiHref(card));
    expect(hrefs.some((href) => href === '/donations/today-collections')).toBe(true);
    expect(hrefs.some((href) => href.includes('focus=amount'))).toBe(true);
    expect(hrefs.some((href) => href.includes('/donations/dues') && href.includes('overdue_only=1'))).toBe(true);
    expect(hrefs.some((href) => href.includes('focus=families'))).toBe(true);
    expect(hrefs.some((href) => href.includes('focus=average'))).toBe(true);
    expect(hrefs.some((href) => href.includes('focus=completion'))).toBe(true);
    expect(buttons[0].getAttribute('aria-label')).toBe("View Today's Collections");

    const router = TestBed.inject(Router);
    const navigateByUrlSpy = jest.spyOn(router, 'navigateByUrl').mockResolvedValue(true);
    const totalCollected = component.kpiCards.find((card) => card.label === 'Total Collected');
    expect(totalCollected?.href).toBe('/donations/today-collections');
    component.navigateKpi(totalCollected!);
    expect(navigateByUrlSpy).toHaveBeenCalledWith('/donations/today-collections?focus=amount');
  });

  it('refreshes session when the donations ledger mutates (e.g. Quick Collect)', () => {
    getPayments.mockClear();
    ledgerMutated$.next();
    expect(getPayments).toHaveBeenCalledWith({ today_only: '1', per_page: '12' });
  });

  it('opens shortcuts with question mark outside editable fields', () => {
    component.onKeydown({
      key: '?',
      target: document.createElement('div'),
      preventDefault: jest.fn()
    } as unknown as KeyboardEvent);

    expect(component.shortcutsOpen).toBe(true);
  });
});
