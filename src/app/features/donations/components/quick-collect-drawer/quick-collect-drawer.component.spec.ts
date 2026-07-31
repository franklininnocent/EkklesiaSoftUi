import { TestBed } from '@angular/core/testing';
import { of, throwError } from 'rxjs';
import { QuickCollectDrawerComponent } from './quick-collect-drawer.component';
import { FamilyService } from '@core/services/family.service';
import { DonationsService } from '../../services/donations.service';
import { QuickCollectService } from '../../services/quick-collect.service';
import { ReceiptPrintService } from '../../services/receipt-print.service';
import { ToastService } from '@core/services/toast.service';

describe('QuickCollectDrawerComponent', () => {
  let component: QuickCollectDrawerComponent;
  let quickCollectService: QuickCollectService;
  let donationsService: jest.Mocked<Pick<DonationsService, 'createPayment' | 'getFunds' | 'getPayments' | 'getFamilyFinancialProfile' | 'getReceiptPreview' | 'getUpiIntent'>>;

  beforeEach(async () => {
    donationsService = {
      createPayment: jest.fn(),
      getFunds: jest.fn().mockReturnValue(of({ success: true, data: [{ id: 'fund-1', name: 'Monthly Dues', code: 'DUES' }] })),
      getPayments: jest.fn().mockReturnValue(of({ success: true, data: { data: [] } })),
      getFamilyFinancialProfile: jest.fn().mockReturnValue(of({ success: true, data: null })),
      getReceiptPreview: jest.fn(),
      getUpiIntent: jest.fn()
    };

    await TestBed.configureTestingModule({
      imports: [QuickCollectDrawerComponent],
      providers: [
        QuickCollectService,
        {
          provide: FamilyService,
          useValue: {
            getFamilies: jest.fn().mockReturnValue(of({ data: [] })),
            getFamily: jest.fn()
          }
        },
        { provide: DonationsService, useValue: donationsService },
        { provide: ReceiptPrintService, useValue: { printPaymentReceipt: jest.fn() } },
        { provide: ToastService, useValue: { success: jest.fn(), error: jest.fn() } }
      ]
    }).compileComponents();

    const fixture = TestBed.createComponent(QuickCollectDrawerComponent);
    component = fixture.componentInstance;
    quickCollectService = TestBed.inject(QuickCollectService);
    fixture.detectChanges();
  });

  it('requires family, payer, amount, and category before submit', () => {
    expect(component.canSubmit).toBe(false);

    component.selectedFamily = { id: 'f1', family_name: 'Smith Family', family_code: 'FAM001' } as any;
    component.payerName = 'John Smith';
    component.amount = 500;
    component.fundId = 'fund-1';

    expect(component.canSubmit).toBe(true);
  });

  it('opens the drawer and loads funds when Quick Collect is triggered', () => {
    quickCollectService.open();
    expect(component.isOpen).toBe(true);
    expect(donationsService.getFunds).toHaveBeenCalled();
    expect(donationsService.getPayments).toHaveBeenCalled();
  });

  it('maps UPI to online_placeholder when recording payment', () => {
    component.selectedFamily = { id: 'f1', family_name: 'Smith Family', family_code: 'FAM001' } as any;
    component.payerName = 'John Smith';
    component.amount = 500;
    component.fundId = 'fund-1';
    component.method = 'upi';

    donationsService.createPayment.mockReturnValue(of({
      success: true,
      message: 'Payment recorded.',
      data: { id: 'pay-1' } as any
    }));
    donationsService.getReceiptPreview.mockReturnValue(of({ success: true, data: {} as any }));

    component.submit();

    expect(donationsService.createPayment).toHaveBeenCalledWith(expect.objectContaining({
      method: 'online_placeholder',
      allocations: [{ allocatable_type: 'fund', allocatable_id: 'fund-1', amount: 500 }]
    }));
    expect(component.phase).toBe('success');
  });

  it('shows a friendly error when payment save fails', () => {
    component.selectedFamily = { id: 'f1', family_name: 'Smith Family', family_code: 'FAM001' } as any;
    component.payerName = 'John Smith';
    component.amount = 500;
    component.fundId = 'fund-1';

    donationsService.createPayment.mockReturnValue(throwError(() => ({
      error: { message: 'Unable to save payment.' }
    })));

    component.submit();

    expect(component.saving).toBe(false);
    expect(component.error).toContain('Unable to save payment');
    expect(component.submitLabel).toBe('Error — try again');
  });
});
