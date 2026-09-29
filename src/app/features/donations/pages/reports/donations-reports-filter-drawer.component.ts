import { CommonModule } from '@angular/common';
import {
  ChangeDetectorRef,
  Component,
  ElementRef,
  EventEmitter,
  Input,
  OnChanges,
  OnDestroy,
  Output,
  SimpleChanges,
  ViewChild,
  inject,
} from '@angular/core';
import { FormsModule } from '@angular/forms';
import { restoreActiveElement, saveActiveElement, trapFocus } from '@shared/utils/focus-trap.util';

export interface DonationsReportsFilterDraft {
  dateFrom: string;
  dateTo: string;
  asOfDate: string;
  preset: string;
  bccId: string;
  projectId: string;
  planId: string;
  fiscalYear: string;
  method: string;
  status: string;
  participationStatus: string;
  actionType: string;
  entityKind: string;
  outstandingView: string;
  projectFundingView: string;
  search: string;
}

@Component({
  selector: 'app-donations-reports-filter-drawer',
  standalone: true,
  imports: [CommonModule, FormsModule],
  template: `
    <div *ngIf="isOpen" class="drawer-backdrop animate-fade-in" (click)="onClose()" aria-hidden="true"></div>

    <div
      #drawerRef
      class="filter-drawer"
      [class.open]="isOpen"
      role="dialog"
      aria-modal="true"
      aria-labelledby="donations-reports-filter-title"
    >
      <header class="filter-drawer__header">
        <h2 id="donations-reports-filter-title" class="filter-drawer__title">Report filters</h2>
        <button type="button" class="filter-drawer__close" (click)="onClose()" aria-label="Close filters">×</button>
      </header>

      <div class="filter-drawer__body">
        <div class="filter-drawer__group" *ngIf="usesDateRange">
          <p class="filter-drawer__group-caption">Date range</p>
          <label class="filter-drawer__label" for="rep-filter-from">From</label>
          <input id="rep-filter-from" type="date" class="filter-drawer__input" [(ngModel)]="draft.dateFrom" />
          <label class="filter-drawer__label" for="rep-filter-to">To</label>
          <input id="rep-filter-to" type="date" class="filter-drawer__input" [(ngModel)]="draft.dateTo" />
          <label class="filter-drawer__label" for="rep-filter-preset">Period preset</label>
          <select id="rep-filter-preset" class="filter-drawer__input" [(ngModel)]="draft.preset">
            <option value="">Custom dates</option>
            <option value="this_month">This month</option>
            <option value="this_fy">This fiscal year</option>
            <option value="last_90">Last 90 days</option>
            <option value="ytd">Year to date</option>
          </select>
        </div>

        <div class="filter-drawer__group" *ngIf="usesAsOf">
          <label class="filter-drawer__label" for="rep-filter-asof">As of date</label>
          <input id="rep-filter-asof" type="date" class="filter-drawer__input" [(ngModel)]="draft.asOfDate" />
        </div>

        <div class="filter-drawer__group" *ngIf="supports('fiscal_year')">
          <label class="filter-drawer__label" for="rep-filter-fy">Fiscal year</label>
          <input
            id="rep-filter-fy"
            type="text"
            class="filter-drawer__input"
            [(ngModel)]="draft.fiscalYear"
            placeholder="e.g. 2025-26"
          />
        </div>

        <div class="filter-drawer__group" *ngIf="supports('bcc_id')">
          <label class="filter-drawer__label" for="rep-filter-bcc">BCC / community</label>
          <select id="rep-filter-bcc" class="filter-drawer__input" [(ngModel)]="draft.bccId">
            <option value="">All</option>
            <option value="unassigned">Unassigned Area</option>
            <option *ngFor="let bcc of bccOptions" [value]="bcc.id">{{ bcc.name }}</option>
          </select>
        </div>

        <div class="filter-drawer__group" *ngIf="supports('project_id')">
          <label class="filter-drawer__label" for="rep-filter-project">Project / campaign</label>
          <select id="rep-filter-project" class="filter-drawer__input" [(ngModel)]="draft.projectId">
            <option value="">All</option>
            <option *ngFor="let project of projectOptions" [value]="project.id">{{ project.name }}</option>
          </select>
        </div>

        <div class="filter-drawer__group" *ngIf="supports('plan_id')">
          <label class="filter-drawer__label" for="rep-filter-plan">Contribution plan</label>
          <select id="rep-filter-plan" class="filter-drawer__input" [(ngModel)]="draft.planId">
            <option value="">All plans</option>
            <option *ngFor="let plan of planOptions" [value]="plan.id">{{ plan.name }}</option>
          </select>
        </div>

        <div class="filter-drawer__group" *ngIf="supports('method')">
          <label class="filter-drawer__label" for="rep-filter-method">Payment method</label>
          <select id="rep-filter-method" class="filter-drawer__input" [(ngModel)]="draft.method">
            <option value="">Any method</option>
            <option value="cash">Cash</option>
            <option value="cheque">Cheque</option>
            <option value="upi">UPI</option>
            <option value="bank_transfer">Bank transfer</option>
            <option value="card">Card</option>
            <option value="other">Other</option>
          </select>
        </div>

        <div class="filter-drawer__group" *ngIf="supports('status') && reportKey === 'payments'">
          <label class="filter-drawer__label" for="rep-filter-status">Status</label>
          <select id="rep-filter-status" class="filter-drawer__input" [(ngModel)]="draft.status">
            <option value="">Any status</option>
            <option value="succeeded">Succeeded</option>
            <option value="pending">Pending</option>
            <option value="failed">Failed</option>
            <option value="refunded">Refunded</option>
            <option value="reversed">Reversed</option>
          </select>
        </div>

        <div class="filter-drawer__group" *ngIf="supports('status') && reportKey === 'receipts'">
          <label class="filter-drawer__label" for="rep-filter-receipt-status">Status</label>
          <select id="rep-filter-receipt-status" class="filter-drawer__input" [(ngModel)]="draft.status">
            <option value="">Any status</option>
            <option value="active">Active</option>
            <option value="void">Void</option>
          </select>
        </div>

        <div class="filter-drawer__group" *ngIf="supports('participation_status')">
          <label class="filter-drawer__label" for="rep-filter-participation">Participation</label>
          <select id="rep-filter-participation" class="filter-drawer__input" [(ngModel)]="draft.participationStatus">
            <option value="not_participating">Have not given</option>
            <option value="participating">Have given</option>
          </select>
        </div>

        <div class="filter-drawer__group" *ngIf="supports('action_type')">
          <label class="filter-drawer__label" for="rep-filter-action">Adjustment type</label>
          <select id="rep-filter-action" class="filter-drawer__input" [(ngModel)]="draft.actionType">
            <option value="">All adjustments</option>
            <option value="refund">Refunds</option>
            <option value="reversal">Reversals</option>
            <option value="waiver">Waivers</option>
          </select>
        </div>

        <div class="filter-drawer__group" *ngIf="supports('entity_kind')">
          <label class="filter-drawer__label" for="rep-filter-kind">Kind</label>
          <select id="rep-filter-kind" class="filter-drawer__input" [(ngModel)]="draft.entityKind">
            <option value="">Projects and campaigns</option>
            <option value="project">Projects only</option>
            <option value="campaign">Campaigns only</option>
          </select>
        </div>

        <div class="filter-drawer__group" *ngIf="supports('view') && reportKey === 'outstanding'">
          <label class="filter-drawer__label" for="rep-filter-view">View</label>
          <select id="rep-filter-view" class="filter-drawer__input" [(ngModel)]="draft.outstandingView">
            <option value="families">Family lines</option>
            <option value="totals">Summary buckets</option>
          </select>
        </div>

        <div class="filter-drawer__group" *ngIf="supports('view') && reportKey === 'project_funding'">
          <label class="filter-drawer__label" for="rep-filter-project-view">View</label>
          <select id="rep-filter-project-view" class="filter-drawer__input" [(ngModel)]="draft.projectFundingView">
            <option value="projects">By project</option>
            <option value="gaps">Family funding gaps</option>
          </select>
        </div>

        <div class="filter-drawer__group" *ngIf="supports('search')">
          <label class="filter-drawer__label" for="rep-filter-search">Search</label>
          <input
            id="rep-filter-search"
            type="search"
            class="filter-drawer__input"
            [(ngModel)]="draft.search"
            placeholder="Family or payer (min 2 characters)"
          />
        </div>
      </div>

      <footer class="filter-drawer__footer">
        <button type="button" class="cf-btn filter-drawer__reset" (click)="onReset()">Reset</button>
        <button type="button" class="cf-btn cf-btn-primary" (click)="onApply()">Apply filters</button>
      </footer>
    </div>
  `,
  styleUrl: '../../../../shared/components/advanced-search-panel/advanced-search-panel.component.scss',
})
export class DonationsReportsFilterDrawerComponent implements OnChanges, OnDestroy {
  private readonly cdr = inject(ChangeDetectorRef);

  @Input() isOpen = false;
  @Input() supportedFilters: string[] = [];
  @Input() usesDateRange = false;
  @Input() usesAsOf = false;
  @Input() bccOptions: { id: string; name: string }[] = [];
  @Input() projectOptions: { id: string; name: string }[] = [];
  @Input() planOptions: { id: string; name: string }[] = [];
  @Input() model!: DonationsReportsFilterDraft;
  @Input() reportKey = '';

  @Output() readonly close = new EventEmitter<void>();
  @Output() readonly apply = new EventEmitter<DonationsReportsFilterDraft>();
  @Output() readonly reset = new EventEmitter<void>();

  @ViewChild('drawerRef') drawerRef?: ElementRef<HTMLElement>;

  draft: DonationsReportsFilterDraft = this.emptyDraft();

  private previousActiveElement: HTMLElement | null = null;
  private focusTrapCleanup: (() => void) | null = null;

  ngOnChanges(changes: SimpleChanges): void {
    if (changes['isOpen']) {
      if (this.isOpen) {
        this.syncDraftFromModel();
        this.onDrawerOpened();
      } else {
        this.onDrawerClosed();
      }
    }
    if (changes['model'] && this.isOpen) {
      this.syncDraftFromModel();
    }
  }

  ngOnDestroy(): void {
    this.releaseFocusTrap();
  }

  supports(key: string): boolean {
    return this.supportedFilters.includes(key);
  }

  onClose(): void {
    this.close.emit();
  }

  onApply(): void {
    this.apply.emit({ ...this.draft });
    this.close.emit();
  }

  onReset(): void {
    this.reset.emit();
    this.close.emit();
  }

  private syncDraftFromModel(): void {
    if (!this.model) {
      return;
    }
    this.draft = { ...this.model };
    this.cdr.markForCheck();
  }

  private emptyDraft(): DonationsReportsFilterDraft {
    return {
      dateFrom: '',
      dateTo: '',
      asOfDate: '',
      preset: '',
      bccId: '',
      projectId: '',
      planId: '',
      fiscalYear: '',
      method: '',
      status: '',
      participationStatus: 'not_participating',
      actionType: '',
      entityKind: '',
      outstandingView: 'families',
      projectFundingView: 'projects',
      search: '',
    };
  }

  private onDrawerOpened(): void {
    this.previousActiveElement = saveActiveElement();
    setTimeout(() => {
      if (this.isOpen && this.drawerRef?.nativeElement) {
        this.releaseFocusTrap(false);
        this.focusTrapCleanup = trapFocus(this.drawerRef.nativeElement);
      }
    }, 0);
  }

  private onDrawerClosed(): void {
    this.releaseFocusTrap();
  }

  private releaseFocusTrap(restore = true): void {
    this.focusTrapCleanup?.();
    this.focusTrapCleanup = null;
    if (restore) {
      restoreActiveElement(this.previousActiveElement);
      this.previousActiveElement = null;
    }
  }
}
