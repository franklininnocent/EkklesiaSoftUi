import { ComponentFixture, TestBed } from '@angular/core/testing';
import { ActivatedRoute, convertToParamMap, provideRouter } from '@angular/router';
import { of, EMPTY } from 'rxjs';
import { AuthService } from '@core/services/auth.service';
import { ChurchCurrencyService } from '@core/services/church-currency.service';
import { DonationsPaymentsComponent } from './donations-payments.component';
import { DonationsService } from '../services/donations.service';
import { QuickCollectService } from '../services/quick-collect.service';
import { ReceiptPrintService } from '../services/receipt-print.service';

describe('DonationsPaymentsComponent', () => {
  let fixture: ComponentFixture<DonationsPaymentsComponent>;
  let getPayments: jest.Mock;

  const paymentsResponse = {
    data: {
      data: [
        {
          id: 'pay-1',
          payment_number: 'PAY-1',
          payer_name: 'Jane Ward',
          payment_date: '2026-09-30',
          method: 'cash',
          status: 'succeeded',
          amount: 25,
        },
      ],
    },
  };

  beforeEach(async () => {
    getPayments = jest.fn().mockReturnValue(of(paymentsResponse));
    await TestBed.configureTestingModule({
      imports: [DonationsPaymentsComponent],
      providers: [
        provideRouter([]),
        {
          provide: ActivatedRoute,
          useValue: {
            snapshot: { queryParamMap: convertToParamMap({}) },
          },
        },
        {
          provide: DonationsService,
          useValue: {
            getPayments,
            reversePayment: jest.fn(),
            requestRefund: jest.fn(),
            ledgerMutated$: EMPTY,
          },
        },
        { provide: QuickCollectService, useValue: { open: jest.fn() } },
        { provide: ReceiptPrintService, useValue: { viewPaymentReceipt: jest.fn() } },
        {
          provide: AuthService,
          useValue: {
            hasPermission: jest.fn(() => true),
          },
        },
        { provide: ChurchCurrencyService, useValue: { currencyCode: () => 'USD' } },
      ],
    }).compileComponents();

    fixture = TestBed.createComponent(DonationsPaymentsComponent);
    fixture.detectChanges();
  });

  it('loads payments without a decision strip summary', () => {
    expect(getPayments).toHaveBeenCalledWith(
      expect.objectContaining({
        sort: 'payment_date',
        direction: 'desc',
      })
    );
    const el = fixture.nativeElement as HTMLElement;
    expect(el.querySelector('.cf-decision-strip')).toBeFalsy();
    expect(el.textContent).not.toContain('payments today');
    expect(el.textContent).not.toContain('Collection Day mode for fast keyboard entry');
    expect(el.textContent).toContain('PAY-1');
  });

  it('passes paid_from and paid_to query params to the API', async () => {
    getPayments.mockClear();
    await TestBed.resetTestingModule();
    getPayments = jest.fn().mockReturnValue(of({ data: { data: [] } }));
    await TestBed.configureTestingModule({
      imports: [DonationsPaymentsComponent],
      providers: [
        provideRouter([]),
        {
          provide: ActivatedRoute,
          useValue: {
            snapshot: {
              queryParamMap: convertToParamMap({
                paid_from: '2026-09-01',
                paid_to: '2026-09-30',
              }),
            },
          },
        },
        {
          provide: DonationsService,
          useValue: {
            getPayments,
            reversePayment: jest.fn(),
            requestRefund: jest.fn(),
            ledgerMutated$: EMPTY,
          },
        },
        { provide: QuickCollectService, useValue: { open: jest.fn() } },
        { provide: ReceiptPrintService, useValue: { viewPaymentReceipt: jest.fn() } },
        {
          provide: AuthService,
          useValue: { hasPermission: jest.fn(() => true) },
        },
        { provide: ChurchCurrencyService, useValue: { currencyCode: () => 'USD' } },
      ],
    }).compileComponents();

    const ranged = TestBed.createComponent(DonationsPaymentsComponent);
    ranged.detectChanges();

    expect(getPayments).toHaveBeenCalledWith(
      expect.objectContaining({
        paid_from: '2026-09-01',
        paid_to: '2026-09-30',
        per_page: '100',
      })
    );
    expect(ranged.nativeElement.querySelector('.cf-decision-strip')).toBeFalsy();
  });
});
