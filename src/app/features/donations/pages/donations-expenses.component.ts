import { CommonModule } from '@angular/common';
import { ChangeDetectionStrategy, ChangeDetectorRef, Component, OnInit, inject } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { RouterModule } from '@angular/router';
import { PageHeaderComponent } from '@shared/components/page-header/page-header.component';
import { ModalShellComponent } from '@shared/components/modal-shell/modal-shell.component';
import { CommandCenterDataService } from '../dashboard/services/command-center-data.service';
import { ParishExpenseRecord } from '../models/donation.model';
import { refreshStewardshipView } from '../utils/stewardship-view.util';

@Component({
  selector: 'app-donations-expenses',
  standalone: true,
  imports: [CommonModule, FormsModule, RouterModule, PageHeaderComponent, ModalShellComponent],
  templateUrl: './donations-expenses.component.html',
  styleUrl: './donations-expenses.component.scss',
  changeDetection: ChangeDetectionStrategy.OnPush
})
export class DonationsExpensesComponent implements OnInit {
  private readonly dataService = inject(CommandCenterDataService);
  private readonly cdr = inject(ChangeDetectorRef);

  expenses: ParishExpenseRecord[] = [];
  loading = true;
  error: string | null = null;
  showForm = false;
  saving = false;
  form = {
    category: '',
    amount: null as number | null,
    expense_date: new Date().toISOString().slice(0, 10),
    payee: '',
    method: 'cash',
    notes: ''
  };

  ngOnInit(): void {
    this.reload();
  }

  reload(): void {
    this.loading = true;
    this.error = null;
    refreshStewardshipView(this.cdr);
    this.dataService.loadExpenses().subscribe({
      next: (rows) => {
        this.expenses = rows;
        this.loading = false;
        refreshStewardshipView(this.cdr);
      },
      error: () => {
        this.error = 'Unable to load parish disbursements.';
        this.loading = false;
        refreshStewardshipView(this.cdr);
      }
    });
  }

  submit(): void {
    if (!this.form.category || !this.form.amount) {
      return;
    }
    this.saving = true;
    refreshStewardshipView(this.cdr);
    this.dataService.createExpense({
      category: this.form.category,
      amount: this.form.amount,
      expense_date: this.form.expense_date,
      payee: this.form.payee || undefined,
      method: this.form.method,
      notes: this.form.notes || undefined
    }).subscribe({
      next: () => {
        this.saving = false;
        this.showForm = false;
        this.form = {
          category: '',
          amount: null,
          expense_date: new Date().toISOString().slice(0, 10),
          payee: '',
          method: 'cash',
          notes: ''
        };
        this.reload();
      },
      error: () => {
        this.saving = false;
        refreshStewardshipView(this.cdr);
      }
    });
  }
}
