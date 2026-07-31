import { ComponentFixture, TestBed } from '@angular/core/testing';
import { provideRouter } from '@angular/router';
import { FocExpenseModalComponent } from './foc-expense-modal.component';

describe('FocExpenseModalComponent', () => {
  let fixture: ComponentFixture<FocExpenseModalComponent>;
  let component: FocExpenseModalComponent;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [FocExpenseModalComponent],
      providers: [provideRouter([])]
    }).compileComponents();

    fixture = TestBed.createComponent(FocExpenseModalComponent);
    component = fixture.componentInstance;
    component.open = true;
    component.form = {
      category: 'Utilities',
      amount: 15000,
      expense_date: '2026-06-12',
      payee: 'Sacred Supplies',
      method: 'upi',
      notes: '',
      phone: '',
      reference_number: 'UTR123',
      invoice_number: '',
      cheque_number: ''
    };
    component.monthExpenses = 50000;
    component.monthCollected = 150000;
    fixture.detectChanges();
  });

  it('renders the disbursement workspace layout', () => {
    const text = fixture.nativeElement.textContent;
    expect(text).toContain('Record Parish Disbursement');
    expect(text).toContain('Transaction Summary');
    expect(text).toContain('Validation Checklist');
    expect(text).toContain('Budget Impact');
  });

  it('shows dynamic recipient fields for UPI', () => {
    expect(fixture.nativeElement.textContent).toContain('Reference Number');
  });

  it('emits submit payload when form is complete', () => {
    const spy = jest.spyOn(component.submitExpense, 'emit');
    component.recordDisbursement();
    expect(spy).toHaveBeenCalledWith(expect.objectContaining({
      category: 'Utilities',
      amount: 15000,
      status: 'recorded'
    }));
  });

  it('renders success state when submitted record is provided', () => {
    fixture.componentRef.setInput('submittedRecord', {
      id: 'exp-99',
      category: 'Utilities',
      amount: 15000,
      payee: 'Sacred Supplies',
      method: 'upi',
      status: 'recorded'
    });
    fixture.componentRef.setInput('recordedAt', new Date().toISOString());
    fixture.detectChanges();
    expect(fixture.nativeElement.textContent).toContain('Disbursement recorded successfully');
    expect(fixture.nativeElement.textContent).toContain('exp-99');
  });
});
