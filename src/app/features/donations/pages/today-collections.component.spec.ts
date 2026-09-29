import { ComponentFixture, TestBed, fakeAsync, tick } from '@angular/core/testing';
import { provideRouter } from '@angular/router';
import { HttpErrorResponse } from '@angular/common/http';
import { of, Subject, throwError } from 'rxjs';
import { TodaysCollectionsComponent } from './today-collections.component';
import { DonationsService } from '../services/donations.service';
import { ReceiptPrintService } from '../services/receipt-print.service';
import { QuickCollectService } from '../services/quick-collect.service';
import { AuthService } from '@core/services/auth.service';
import { BCCService } from '@core/services/bcc.service';
import { ChurchCurrencyService } from '@core/services/church-currency.service';

describe('TodaysCollectionsComponent', () => {
  let fixture: ComponentFixture<TodaysCollectionsComponent>;
  let component: TodaysCollectionsComponent;
  let getPayments: jest.Mock;
  const ledgerMutated$ = new Subject<void>();

  const listResponse = {
    success: true,
    data: {
      data: [
        {
          id: 'pay-1',
          payment_number: 'PAY-1',
          payer_name: 'Jane Ward',
          payment_date: '2026-09-28',
          amount: 40,
          method: 'cash',
          status: 'succeeded',
          family_id: 'fam-1',
          family: { id: 'fam-1', family_name: 'Ward Family', family_code: 'FAM1' },
          receipt: { receipt_number: 'RCT-1' }
        }
      ],
      current_page: 1,
      last_page: 1,
      total: 1,
      per_page: 20
    },
    meta: {
      totals: {
        payment_count: 1,
        collected_gross: 40,
        refunded_total: 0,
        net_collected: 40,
        families_count: 1,
        currency_code: 'INR'
      },
      business_date: '2026-09-28',
      timezone: 'Asia/Kolkata',
      date_basis: 'payment_date',
      date_mode: 'today'
    }
  };

  beforeEach(async () => {
    getPayments = jest.fn().mockReturnValue(of(listResponse));
    await TestBed.configureTestingModule({
      imports: [TodaysCollectionsComponent],
      providers: [
        provideRouter([]),
        {
          provide: DonationsService,
          useValue: {
            getPayments,
            getProjects: jest.fn().mockReturnValue(of({ success: true, data: [] })),
            ledgerMutated$,
            reversePayment: jest.fn(),
            requestRefund: jest.fn()
          }
        },
        { provide: ReceiptPrintService, useValue: { viewPaymentReceipt: jest.fn(), printPaymentReceipt: jest.fn() } },
        { provide: QuickCollectService, useValue: { open: jest.fn() } },
        {
          provide: AuthService,
          useValue: {
            hasPermission: jest.fn((permission: string) => permission === 'donations.view' || permission === 'donations.collect')
          }
        },
        { provide: BCCService, useValue: { getBCCs: jest.fn().mockReturnValue(of({ data: [] })) } },
        { provide: ChurchCurrencyService, useValue: { currencyCode: () => 'INR' } }
      ]
    }).compileComponents();

    fixture = TestBed.createComponent(TodaysCollectionsComponent);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  it('loads today_only payments and displays server totals without summing rows', () => {
    expect(getPayments).toHaveBeenCalledWith(expect.objectContaining({
      today_only: '1',
      page: '1',
      per_page: '20'
    }));
    expect(fixture.nativeElement.textContent).toContain("Today's Collections");
    expect(fixture.nativeElement.textContent).toContain('1 payment');
    expect(component.totals.collected_gross).toBe(40);
    expect(component.payments.length).toBe(1);
  });

  it('debounces search and resets to page 1', fakeAsync(() => {
    getPayments.mockClear();
    component.onSearchChange('Jane');
    tick(299);
    expect(getPayments).not.toHaveBeenCalled();
    tick(1);
    expect(getPayments).toHaveBeenCalledWith(expect.objectContaining({
      search: 'Jane',
      page: '1',
      today_only: '1'
    }));
  }));

  it('shows a permission empty state when donations.view is missing', () => {
    (TestBed.inject(AuthService).hasPermission as jest.Mock).mockReturnValue(false);
    const denied = TestBed.createComponent(TodaysCollectionsComponent);
    denied.detectChanges();
    expect(denied.componentInstance.canView).toBe(false);
    expect(denied.nativeElement.textContent).toContain("You don't have permission to view today's collections");
  });

  it('shows a retryable error when the list fails', () => {
    getPayments.mockReturnValue(throwError(() => new HttpErrorResponse({ status: 500, error: { message: 'Server down' } })));
    component.load();
    fixture.detectChanges();
    expect(fixture.nativeElement.textContent).toContain('Server down');
  });

  it('uses an empty parish-day state versus a no-results filtered state', () => {
    getPayments.mockReturnValue(of({
      ...listResponse,
      data: { ...listResponse.data, data: [], total: 0 },
      meta: {
        ...listResponse.meta,
        totals: { ...listResponse.meta.totals, payment_count: 0, collected_gross: 0, families_count: 0 }
      }
    }));
    component.search = '';
    component.load();
    fixture.detectChanges();
    expect(fixture.nativeElement.textContent).toContain('No payments recorded today');

    component.search = 'zzz';
    component.load();
    fixture.detectChanges();
    expect(fixture.nativeElement.textContent).toContain('No payments match');
  });

  it('hides reverse and refund without permission and ignores stale responses', () => {
    expect(fixture.nativeElement.querySelector('[aria-label="Reverse"]')).toBeFalsy();
    expect(fixture.nativeElement.querySelector('[aria-label="Refund"]')).toBeFalsy();

    const slow = new Subject<typeof listResponse>();
    getPayments.mockReturnValueOnce(slow.asObservable());
    component.load();
    getPayments.mockReturnValue(of({
      ...listResponse,
      data: { ...listResponse.data, data: [], total: 0 }
    }));
    component.load();
    slow.next(listResponse);
    expect(component.payments.length).toBe(0);
  });

  it('sends collection_date instead of today_only when a date override is active', () => {
    getPayments.mockClear();
    component.onAdvancedSearch({ collection_date: '2026-09-20' });
    expect(getPayments).toHaveBeenCalledWith(expect.objectContaining({
      collection_date: '2026-09-20'
    }));
    expect(getPayments.mock.calls[0][0].today_only).toBeUndefined();
  });
});
