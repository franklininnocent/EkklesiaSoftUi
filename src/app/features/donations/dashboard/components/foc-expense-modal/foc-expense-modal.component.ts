import { CommonModule } from '@angular/common';
import {
  ChangeDetectionStrategy,
  ChangeDetectorRef,
  Component,
  EventEmitter,
  Input,
  Output,
  inject
} from '@angular/core';
import { FormsModule } from '@angular/forms';
import { RouterModule } from '@angular/router';
import { ModalShellComponent } from '@shared/components/modal-shell/modal-shell.component';
import { ParishExpenseRecord } from '../../../models/donation.model';
import { formatFocCurrency } from '../../utils/foc-format.util';
import { localDateOnly } from '../../../utils/local-date-only';

export interface FocExpenseFormValue {
  category: string;
  amount: number | null;
  expense_date: string;
  payee: string;
  method: string;
  notes: string;
  phone: string;
  reference_number: string;
  invoice_number: string;
  cheque_number: string;
}

export interface FocExpenseSubmitPayload extends FocExpenseFormValue {
  status: 'draft' | 'recorded';
}

export interface FocExpenseCategoryOption {
  value: string;
  label: string;
  icon: 'utilities' | 'maintenance' | 'charity' | 'office' | 'liturgical' | 'events' | 'salary' | 'projects' | 'vendor';
}

export interface FocExpenseMethodOption {
  value: string;
  label: string;
  icon: 'cash' | 'bank' | 'cheque' | 'upi' | 'online';
}

@Component({
  selector: 'app-foc-expense-modal',
  standalone: true,
  imports: [CommonModule, FormsModule, RouterModule, ModalShellComponent],
  changeDetection: ChangeDetectionStrategy.OnPush,
  templateUrl: './foc-expense-modal.component.html',
  styleUrl: './foc-expense-modal.component.scss'
})
export class FocExpenseModalComponent {
  private readonly cdr = inject(ChangeDetectorRef);

  @Input() open = false;
  @Input() saving = false;
  @Input({ required: true }) form!: FocExpenseFormValue;
  @Input() currencyCode = 'INR';
  @Input() operatorName = 'Administrator';
  @Input() operatorRole = 'Administrator';
  @Input() financialYear: string | null = null;
  @Input() monthExpenses = 0;
  @Input() monthCollected = 0;
  @Input() expenseRatioPct = 0;
  @Input() submittedRecord: ParishExpenseRecord | null = null;
  @Input() recordedAt: string | null = null;

  @Output() close = new EventEmitter<void>();
  @Output() submitExpense = new EventEmitter<FocExpenseSubmitPayload>();
  @Output() recordAnother = new EventEmitter<void>();

  readonly categories: FocExpenseCategoryOption[] = [
    { value: 'Utilities', label: 'Utilities', icon: 'utilities' },
    { value: 'Maintenance', label: 'Maintenance', icon: 'maintenance' },
    { value: 'Charity', label: 'Charity', icon: 'charity' },
    { value: 'Office Expenses', label: 'Office Expenses', icon: 'office' },
    { value: 'Liturgical Expenses', label: 'Liturgical Expenses', icon: 'liturgical' },
    { value: 'Events', label: 'Events', icon: 'events' },
    { value: 'Salary', label: 'Salary', icon: 'salary' },
    { value: 'Projects', label: 'Projects', icon: 'projects' },
    { value: 'Vendor Payments', label: 'Vendor Payments', icon: 'vendor' }
  ];

  readonly paymentMethods: FocExpenseMethodOption[] = [
    { value: 'cash', label: 'Cash', icon: 'cash' },
    { value: 'bank_transfer', label: 'Bank Transfer', icon: 'bank' },
    { value: 'cheque', label: 'Cheque', icon: 'cheque' },
    { value: 'upi', label: 'UPI', icon: 'upi' },
    { value: 'online_transfer', label: 'Online Transfer', icon: 'online' }
  ];

  get showSuccess(): boolean {
    return !!this.submittedRecord;
  }

  get financialYearLabel(): string {
    if (!this.financialYear) {
      return 'Current FY';
    }
    return `FY ${this.financialYear.replace('-', '–')}`;
  }

  get formattedAmount(): string {
    return formatFocCurrency(this.form.amount, this.currencyCode);
  }

  get previewAmount(): number {
    return Number(this.form.amount ?? 0);
  }

  get todayExpenses(): number {
    const today = localDateOnly();
    if (this.form.expense_date === today) {
      return this.previewAmount;
    }
    return 0;
  }

  get projectedMonthExpenses(): number {
    return this.monthExpenses + this.previewAmount;
  }

  get budgetUtilizationPct(): number {
    if (this.monthCollected <= 0) {
      return Math.min(100, this.expenseRatioPct);
    }
    return Math.min(100, Math.round((this.projectedMonthExpenses / this.monthCollected) * 100));
  }

  get remainingBudget(): number {
    return Math.max(0, this.monthCollected - this.projectedMonthExpenses);
  }

  get methodLabel(): string {
    return this.paymentMethods.find((method) => method.value === this.form.method)?.label ?? '—';
  }

  get categorySelected(): boolean {
    return !!this.form.category?.trim();
  }

  get amountEntered(): boolean {
    return (this.form.amount ?? 0) > 0;
  }

  get payeeEntered(): boolean {
    return !!this.form.payee?.trim();
  }

  get methodSelected(): boolean {
    return !!this.form.method;
  }

  get dateSelected(): boolean {
    return !!this.form.expense_date;
  }

  get formComplete(): boolean {
    return this.categorySelected && this.amountEntered && this.payeeEntered && this.methodSelected && this.dateSelected;
  }

  get showReferenceField(): boolean {
    return ['bank_transfer', 'upi', 'online_transfer'].includes(this.form.method);
  }

  get showInvoiceField(): boolean {
    return ['online_transfer', 'bank_transfer'].includes(this.form.method);
  }

  get showChequeField(): boolean {
    return this.form.method === 'cheque';
  }

  get showPhoneField(): boolean {
    return this.form.method !== 'cash';
  }

  formatCurrency(value: number): string {
    return formatFocCurrency(value, this.currencyCode);
  }

  selectCategory(value: string): void {
    this.form.category = value;
    this.touch();
  }

  selectMethod(value: string): void {
    this.form.method = value;
    this.touch();
  }

  onFieldChange(): void {
    this.touch();
  }

  saveDraft(): void {
    if (!this.categorySelected) {
      return;
    }
    this.submitExpense.emit({ ...this.form, status: 'draft' });
  }

  recordDisbursement(): void {
    if (!this.formComplete) {
      return;
    }
    this.submitExpense.emit({ ...this.form, status: 'recorded' });
  }

  printVoucher(): void {
    window.print();
  }

  private touch(): void {
    this.cdr.markForCheck();
  }
}
