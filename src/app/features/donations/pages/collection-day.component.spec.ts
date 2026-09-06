import { TestBed } from '@angular/core/testing';
import { provideRouter } from '@angular/router';
import { of } from 'rxjs';
import { CollectionDayComponent } from './collection-day.component';
import { FamilyService } from '@core/services/family.service';
import { DonationsService } from '../services/donations.service';
import { ReceiptPrintService } from '../services/receipt-print.service';
import { AuthService } from '@core/services/auth.service';

describe('CollectionDayComponent', () => {
  let component: CollectionDayComponent;

  beforeEach(async () => {
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
            getPayments: jest.fn().mockReturnValue(of({ success: true, data: { data: [] } })),
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

    const fixture = TestBed.createComponent(CollectionDayComponent);
    component = fixture.componentInstance;
    fixture.detectChanges();
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

  it('opens shortcuts with question mark outside editable fields', () => {
    component.onKeydown({
      key: '?',
      target: document.createElement('div'),
      preventDefault: jest.fn()
    } as unknown as KeyboardEvent);

    expect(component.shortcutsOpen).toBe(true);
  });
});
