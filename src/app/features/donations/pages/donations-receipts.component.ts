import { CommonModule } from '@angular/common';
import { ChangeDetectorRef, Component, OnDestroy, OnInit } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { RouterModule } from '@angular/router';
import { debounceTime, distinctUntilChanged, Subject, Subscription } from 'rxjs';
import { CfEmptyStateComponent } from '@shared/components/cf-empty-state/cf-empty-state.component';
import { CfIconActionButtonComponent } from '@shared/components/cf-icon-action-button/cf-icon-action-button.component';
import { LoadingSkeletonComponent } from '@shared/components/loading-skeleton/loading-skeleton.component';
import { DonationsService } from '../services/donations.service';
import { QuickCollectService } from '../services/quick-collect.service';
import { ReceiptPrintService } from '../services/receipt-print.service';
import { DonationReceiptListItem } from '../models/donation.model';

@Component({
  selector: 'app-donations-receipts',
  standalone: true,
  imports: [CommonModule, FormsModule, RouterModule, CfEmptyStateComponent, CfIconActionButtonComponent, LoadingSkeletonComponent],
  template: `
    <section class="receipts-hub cf-page">
      <header class="cf-hero">
        <h1>Receipts</h1>
        <p>Find, verify, and reprint contribution receipts in one click.</p>
      </header>

      <div class="filters cf-filters cf-panel">
        <input type="search" [ngModel]="search" (ngModelChange)="onSearchChange($event)" placeholder="Receipt #, payer, or family…" />
        <input type="date" [(ngModel)]="dateFrom" (ngModelChange)="onDateFilterChange()" />
        <input type="date" [(ngModel)]="dateTo" (ngModelChange)="onDateFilterChange()" />
        <button type="button" class="cf-btn" (click)="clearFilters()">Clear</button>
      </div>

      <div class="cf-decision-strip" role="region" aria-label="Suggested next step" *ngIf="receiptsLoaded && !loadError">
        <div class="cf-decision-strip__copy">
          <strong>{{ receipts.length }} receipt{{ receipts.length === 1 ? '' : 's' }} found</strong>
          <span>{{ decisionHint }}</span>
        </div>
        <div class="cf-decision-strip__actions">
          <button type="button" class="cf-btn cf-btn-primary" (click)="openQuickCollect()">Collect Payment</button>
          <button type="button" class="cf-btn" *ngIf="hasActiveFilters" (click)="clearFilters()">Clear filters</button>
        </div>
      </div>

      <div class="receipts-data cf-panel" [class.receipts-data--refreshing]="refreshing" [attr.aria-busy]="!receiptsLoaded || refreshing">
        <div *ngIf="!receiptsLoaded" class="receipts-loading" role="status" aria-live="polite">
          <p class="receipts-loading__label">Loading receipts…</p>
          <app-loading-skeleton type="table" [rows]="6" [columns]="6"></app-loading-skeleton>
        </div>

        <ng-container *ngIf="receiptsLoaded">
          <p *ngIf="loadError" class="cf-state cf-state--error">{{ loadError }}</p>

          <table class="table cf-table" *ngIf="!loadError && receipts.length">
            <thead>
              <tr>
                <th>Receipt</th>
                <th>Date</th>
                <th>Family</th>
                <th>Payer</th>
                <th>Method</th>
                <th>Amount</th>
                <th class="cf-table__actions-col" aria-label="Actions"></th>
              </tr>
            </thead>
            <tbody>
              <tr *ngFor="let receipt of receipts; trackBy: trackReceipt">
                <td>
                  <strong>{{ receipt.receipt_number }}</strong>
                  <small *ngIf="receipt.is_void">Void</small>
                </td>
                <td>{{ receipt.issued_on | date }}</td>
                <td>
                  <a *ngIf="receipt.family_id" [routerLink]="['/families', receipt.family_id]">
                    {{ receipt.family_name || receipt.family_code }}
                  </a>
                  <span *ngIf="!receipt.family_id">—</span>
                </td>
                <td>{{ receipt.payer_name }}</td>
                <td>{{ receipt.method }}</td>
                <td>{{ receipt.amount | number:'1.2-2' }}</td>
                <td class="cf-table__actions-cell">
                  <div class="cf-row-actions">
                    <app-cf-icon-action-button
                      action="view"
                      size="sm"
                      [ariaLabel]="'View receipt ' + receipt.receipt_number"
                      [title]="'View receipt ' + receipt.receipt_number"
                      [disabled]="!receipt.payment_id"
                      (clicked)="viewReceipt(receipt)"
                    ></app-cf-icon-action-button>
                    <app-cf-icon-action-button
                      action="print"
                      size="sm"
                      [ariaLabel]="'Print receipt ' + receipt.receipt_number"
                      [title]="'Print receipt ' + receipt.receipt_number"
                      [disabled]="!receipt.payment_id"
                      (clicked)="printReceipt(receipt)"
                    ></app-cf-icon-action-button>
                  </div>
                </td>
              </tr>
            </tbody>
          </table>

          <app-cf-empty-state
            *ngIf="!loadError && !receipts.length"
            icon="🧾"
            title="No receipts match"
            description="Try clearing filters or collect a payment — a receipt is generated automatically."
          >
            <button type="button" class="cf-btn cf-btn-primary" (click)="openQuickCollect()">Collect Payment</button>
            <button type="button" class="cf-btn" *ngIf="hasActiveFilters" (click)="clearFilters()">Clear filters</button>
          </app-cf-empty-state>

          <div class="pagination cf-filters" *ngIf="!loadError && lastPage > 1">
            <button type="button" class="cf-btn" [disabled]="page <= 1 || refreshing" (click)="goToPage(page - 1)">Previous</button>
            <span class="cf-state">Page {{ page }} of {{ lastPage }}</span>
            <button type="button" class="cf-btn" [disabled]="page >= lastPage || refreshing" (click)="goToPage(page + 1)">Next</button>
          </div>
        </ng-container>
      </div>

    </section>
  `,
  styles: [`
    .receipts-loading { display: grid; gap: 0.75rem; padding: 0.25rem 0; }
    .receipts-loading__label { margin: 0; font-size: 0.88rem; color: var(--cf-muted); }
    .receipts-data--refreshing { opacity: 0.72; pointer-events: none; }
    .table small { display: block; color: var(--cf-critical); }
  `]
})
export class DonationsReceiptsComponent implements OnInit, OnDestroy {
  receipts: DonationReceiptListItem[] = [];
  search = '';
  dateFrom = '';
  dateTo = '';
  page = 1;
  lastPage = 1;
  receiptsLoaded = false;
  refreshing = false;
  loadError: string | null = null;
  private loadReceiptsSeq = 0;
  private searchChanges$ = new Subject<string>();
  private searchSub?: Subscription;

  constructor(
    private donationsService: DonationsService,
    private receiptPrintService: ReceiptPrintService,
    private quickCollectService: QuickCollectService,
    private cdr: ChangeDetectorRef
  ) {}

  ngOnInit(): void {
    this.searchSub = this.searchChanges$.pipe(
      debounceTime(300),
      distinctUntilChanged()
    ).subscribe(() => {
      this.page = 1;
      this.loadReceipts();
    });
    this.loadReceipts();
  }

  ngOnDestroy(): void {
    this.searchSub?.unsubscribe();
  }

  openQuickCollect(): void {
    this.quickCollectService.open();
  }

  get hasActiveFilters(): boolean {
    return !!(this.search.trim() || this.dateFrom || this.dateTo);
  }

  get decisionHint(): string {
    if (this.hasActiveFilters && !this.receipts.length) {
      return 'No matches for your search — try broader dates or clear filters.';
    }
    if (this.receipts.length) {
      return 'Use the view or print icons on any row — receipts open in a preview window.';
    }
    return 'Receipts appear automatically after every collection.';
  }

  trackReceipt(_index: number, receipt: DonationReceiptListItem): string {
    return receipt.id;
  }

  onSearchChange(value: string): void {
    this.search = value;
    this.searchChanges$.next(value);
  }

  onDateFilterChange(): void {
    this.page = 1;
    this.loadReceipts();
  }

  loadReceipts(): void {
    const seq = ++this.loadReceiptsSeq;
    const isInitial = !this.receiptsLoaded;
    if (isInitial) {
      this.loadError = null;
    } else {
      this.refreshing = true;
    }

    const filters: Record<string, string> = {
      page: String(this.page),
      per_page: '20'
    };
    if (this.search.trim()) {
      filters['search'] = this.search.trim();
    }
    if (this.dateFrom) {
      filters['date_from'] = this.dateFrom;
    }
    if (this.dateTo) {
      filters['date_to'] = this.dateTo;
    }

    this.donationsService.getReceipts(filters).subscribe({
      next: (res) => {
        if (seq !== this.loadReceiptsSeq) {
          return;
        }
        this.receipts = res.data?.data ?? [];
        this.page = res.data?.current_page ?? 1;
        this.lastPage = res.data?.last_page ?? 1;
        this.receiptsLoaded = true;
        this.refreshing = false;
        this.loadError = null;
        this.cdr.detectChanges();
      },
      error: () => {
        if (seq !== this.loadReceiptsSeq) {
          return;
        }
        this.receiptsLoaded = true;
        this.refreshing = false;
        this.loadError = 'Failed to load receipts.';
        this.cdr.detectChanges();
      }
    });
  }

  goToPage(page: number): void {
    this.page = page;
    this.loadReceipts();
  }

  clearFilters(): void {
    this.search = '';
    this.dateFrom = '';
    this.dateTo = '';
    this.page = 1;
    this.loadReceipts();
  }

  viewReceipt(receipt: DonationReceiptListItem): void {
    if (!receipt.payment_id) {
      return;
    }
    this.receiptPrintService.viewPaymentReceipt(receipt.payment_id);
  }

  printReceipt(receipt: DonationReceiptListItem): void {
    if (!receipt.payment_id) {
      return;
    }
    this.receiptPrintService.printPaymentReceipt(receipt.payment_id);
  }
}
