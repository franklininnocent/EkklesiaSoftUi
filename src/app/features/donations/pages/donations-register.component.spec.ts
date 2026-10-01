import { ComponentFixture, TestBed } from '@angular/core/testing';
import { provideRouter } from '@angular/router';
import { of } from 'rxjs';
import { AuthService } from '@core/services/auth.service';
import { FamilyService } from '@core/services/family.service';
import { ChurchCurrencyService } from '@core/services/church-currency.service';
import { DonationsRegisterComponent } from './donations-register.component';
import { DonationsService } from '../services/donations.service';
import { QuickCollectService } from '../services/quick-collect.service';
import { ReceiptPrintService } from '../services/receipt-print.service';

describe('DonationsRegisterComponent', () => {
  let fixture: ComponentFixture<DonationsRegisterComponent>;
  let getPayments: jest.Mock;

  beforeEach(async () => {
    getPayments = jest.fn().mockReturnValue(
      of({
        data: {
          data: [
            {
              id: 'pay-1',
              payment_number: 'PAY-1',
              payer_name: 'Test Payer',
              payment_date: '2026-09-30',
              method: 'cash',
              status: 'succeeded',
              amount: 10,
            },
          ],
        },
      })
    );
    await TestBed.configureTestingModule({
      imports: [DonationsRegisterComponent],
      providers: [
        provideRouter([]),
        { provide: AuthService, useValue: { hasPermission: () => true, hasAnyPermission: () => false } },
        { provide: QuickCollectService, useValue: { open: jest.fn() } },
        { provide: ReceiptPrintService, useValue: { viewPaymentReceipt: jest.fn() } },
        { provide: FamilyService, useValue: { getFamilies: jest.fn().mockReturnValue(of({ data: [] })) } },
        {
          provide: DonationsService,
          useValue: {
            getCategories: jest.fn().mockReturnValue(of({ data: [] })),
            getDonors: jest.fn().mockReturnValue(of({ data: { data: [] } })),
            getDonationEntries: jest.fn().mockReturnValue(of({ data: { data: [] } })),
            getPayments,
          },
        },
        { provide: ChurchCurrencyService, useValue: { currencyCode: () => 'USD' } },
      ],
    }).compileComponents();

    fixture = TestBed.createComponent(DonationsRegisterComponent);
    fixture.detectChanges();
  });

  it('uses filter drawer and sortable payment table', () => {
    const el = fixture.nativeElement as HTMLElement;
    expect(el.querySelector('app-advanced-search-panel')).toBeTruthy();
    expect(el.querySelectorAll('th.sortable').length).toBeGreaterThanOrEqual(6);
    expect(getPayments).toHaveBeenCalledWith(
      expect.objectContaining({
        today_only: '1',
        sort: 'payment_date',
        direction: 'desc',
      })
    );
  });

  it('opens voluntary donation modal from toolbar instead of inline disclosure', () => {
    const el = fixture.nativeElement as HTMLElement;
    expect(el.querySelector('details.cf-disclosure')).toBeNull();

    const openBtn = el.querySelector(
      'button[aria-label="Record voluntary donation"]'
    ) as HTMLButtonElement;
    expect(openBtn).toBeTruthy();
    openBtn.click();
    fixture.detectChanges();

    expect(el.querySelector('app-modal-shell')).toBeTruthy();
    expect(el.textContent).toContain('Record voluntary donation');
  });
});
