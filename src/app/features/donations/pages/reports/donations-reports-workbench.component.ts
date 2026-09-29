import { CommonModule } from '@angular/common';
import {
  AfterViewInit,
  ChangeDetectorRef,
  Component,
  ElementRef,
  EventEmitter,
  inject,
  Input,
  OnChanges,
  OnDestroy,
  OnInit,
  Output,
  SimpleChanges,
  ViewChild,
} from '@angular/core';
import { debounceTime, distinctUntilChanged, Subject, Subscription } from 'rxjs';
import { ActivatedRoute, Router, RouterLink } from '@angular/router';
import { ChurchCurrencyService } from '@core/services/church-currency.service';
import { PaginationComponent } from '@shared/components/pagination/pagination.component';
import { cfFormatDate } from '@shared/utils/cf-intl.util';
import { FormsModule } from '@angular/forms';
import { CfEmptyStateComponent } from '@shared/components/cf-empty-state/cf-empty-state.component';
import { CfActionIconComponent } from '@shared/components/cf-action-icon/cf-action-icon.component';
import { DataTableComponent } from '@shared/components/data-table/data-table.component';
import { SortableDirective, SortDirection, SortEvent } from '@shared/directives/sortable.directive';
import {
  DonationReportCatalogItem,
  DonationReportExport,
  DonationReportPreview,
} from '../../models/donation.model';
import { donationReportExportFormatShortLabelForRow } from './donation-report-export-format.util';
import { DonationsService } from '../../services/donations.service';
import { ReceiptPrintService } from '../../services/receipt-print.service';
import { BCCService } from '@core/services/bcc.service';
import {
  DonationsReportsFilterDrawerComponent,
  DonationsReportsFilterDraft,
} from './donations-reports-filter-drawer.component';

@Component({
  selector: 'app-donations-reports-workbench',
  standalone: true,
  imports: [
    CommonModule,
    FormsModule,
    RouterLink,
    CfEmptyStateComponent,
    CfActionIconComponent,
    DataTableComponent,
    SortableDirective,
    PaginationComponent,
    DonationsReportsFilterDrawerComponent,
  ],
  template: `
    <div class="reports-layout">
    <section class="reports-layout__primary reports-workbench cf-panel" aria-labelledby="reports-workbench-heading">
      <header class="reports-workbench__head">
        <div class="reports-workbench__head-copy">
          <h2 id="reports-workbench-heading">Downloadable reports</h2>
          <p class="reports-workbench__lead">Choose a report, set filters, preview the table, then download in CSV, Excel, or PDF.</p>
        </div>
        <div
          class="reports-workbench__actions"
          *ngIf="!catalogLoading && !catalogError && visibleCatalog.length"
          role="toolbar"
          aria-label="Report actions"
        >
          <button type="button" class="cf-btn cf-btn--sm" (click)="loadPreview()" [disabled]="!hasSelectedReport || previewLoading">
            Refresh preview
          </button>
          <label class="reports-workbench__control reports-workbench__control--format" *ngIf="canExport">
            <span class="reports-workbench__control-prefix">Format</span>
            <select [(ngModel)]="selectedExportFormat" aria-label="Download format">
              <option value="csv">CSV</option>
              <option value="xlsx">Excel (.xlsx)</option>
              <option value="pdf">PDF</option>
            </select>
          </label>
          <button
            type="button"
            class="cf-btn cf-btn-primary cf-btn--sm"
            *ngIf="canExport"
            (click)="queueExport()"
            [disabled]="!hasSelectedReport || exportLoading"
          >
            <app-cf-action-icon name="download" />
            Download {{ exportFormatLabel }}
          </button>
          <button
            type="button"
            class="cf-btn cf-btn--sm"
            (click)="printReport()"
            [disabled]="!hasSelectedReport || !canPrint"
          >
            <app-cf-action-icon name="print" />
            Print
          </button>
        </div>
      </header>

      <div *ngIf="catalogLoading" class="cf-loading-block" role="status" aria-busy="true">
        Loading available reports…
      </div>

      <app-cf-empty-state
        *ngIf="!catalogLoading && catalogError"
        title="Reports are not available"
        [description]="catalogError"
      />

      <app-cf-empty-state
        *ngIf="!catalogLoading && !catalogError && visibleCatalog.length === 0"
        title="No reports to show"
        description="Your plan may not include advanced reports, or the report list could not be loaded. Try refreshing the page."
      />

      <div
        class="cf-filters cf-panel reports-workbench__toolbar"
        *ngIf="!catalogLoading && !catalogError && visibleCatalog.length"
        role="region"
        aria-label="Report and filters"
      >
        <label class="reports-workbench__control reports-workbench__control--report">
          <span class="reports-workbench__control-prefix">Report</span>
          <select
            [(ngModel)]="selectedReportKey"
            (ngModelChange)="onReportChange()"
            aria-label="Report type"
          >
            <option value="">Select Report </option>
            <option *ngFor="let item of visibleCatalog" [value]="item.key">{{ item.label }}</option>
          </select>
        </label>

        <div
          class="reports-workbench__date-range"
          *ngIf="showDateRange"
          role="group"
          aria-label="Date range"
        >
          <label class="reports-workbench__control reports-workbench__control--date">
            <span class="reports-workbench__control-prefix">From</span>
            <input type="date" [(ngModel)]="dateFrom" (change)="onToolbarDatesChange()" aria-label="From date" />
          </label>
          <span class="reports-workbench__date-sep" aria-hidden="true">–</span>
          <label class="reports-workbench__control reports-workbench__control--date">
            <span class="reports-workbench__control-prefix">To</span>
            <input type="date" [(ngModel)]="dateTo" (change)="onToolbarDatesChange()" aria-label="To date" />
          </label>
        </div>

        <label class="reports-workbench__control reports-workbench__control--date" *ngIf="showAsOf">
          <span class="reports-workbench__control-prefix">As of</span>
          <input type="date" [(ngModel)]="asOfDate" (change)="onToolbarDatesChange()" aria-label="As of date" />
        </label>

        <input
          *ngIf="showSearch"
          class="reports-workbench__search"
          type="search"
          [(ngModel)]="search"
          (ngModelChange)="onSearchInput($event)"
          placeholder="Family or payer…"
          aria-label="Search family or payer"
        />

        <button
          type="button"
          class="cf-btn reports-workbench__filters-btn"
          (click)="openFiltersDrawer()"
          [attr.aria-expanded]="filtersDrawerOpen"
          aria-label="More filters"
        >
          <app-cf-action-icon name="filter" />
          More filters
          <span *ngIf="activeChips.length" class="cf-badge cf-badge--info">{{ activeChips.length }}</span>
        </button>
      </div>

      <div class="reports-workbench__chips" *ngIf="activeChips.length" role="region" aria-label="Active filters">
        <span class="reports-workbench__chip" *ngFor="let chip of visibleChips">
          <span class="cf-badge cf-badge--info">{{ chip.label }}</span>
          <button type="button" class="reports-workbench__chip-remove" (click)="removeFilterChip(chip.key)" [attr.aria-label]="chip.removeLabel">×</button>
        </span>
        <button
          *ngIf="hiddenChipCount > 0"
          type="button"
          class="cf-btn cf-btn--sm"
          (click)="openFiltersDrawer()"
          [attr.aria-expanded]="filtersDrawerOpen"
        >
          +{{ hiddenChipCount }} filters
        </button>
      </div>

      <app-donations-reports-filter-drawer
        [isOpen]="filtersDrawerOpen"
        [supportedFilters]="selectedSupportedFilters"
        [usesDateRange]="usesDateRange"
        [usesAsOf]="usesAsOf"
        [bccOptions]="bccOptions"
        [projectOptions]="projectOptions"
        [planOptions]="planOptions"
        [reportKey]="selectedReportKey"
        [model]="filterDraftModel"
        (close)="filtersDrawerOpen = false"
        (apply)="onFiltersApplied($event)"
        (reset)="onFiltersReset()"
      />

      <div class="reports-workbench__totals" *ngIf="preview?.totals && totalHints.length" role="status">
        <span *ngFor="let hint of totalHints">{{ hint }}</span>
      </div>

      <div *ngIf="previewLoading" class="cf-loading-block" role="status" aria-busy="true">
        <p class="cf-loading-block__label">Loading report…</p>
      </div>

      <div *ngIf="previewError" class="cf-inline-alert" role="alert">
        {{ previewError }}
        <button type="button" class="cf-btn cf-btn--sm" (click)="loadPreview()">Try again</button>
      </div>

      <app-cf-empty-state
        *ngIf="hasSelectedReport && !previewLoading && !previewError && !preview?.rows?.length"
        icon="📋"
        title="No records match"
        description="Try a different date range or search."
        [hasActions]="false"
      />

      <app-cf-empty-state
        *ngIf="!hasSelectedReport && !catalogLoading && !catalogError && visibleCatalog.length"
        icon="📋"
        title="Select a report"
        description="Choose a report type from the menu above to preview and download."
        [hasActions]="false"
      />

      <div class="reports-workbench__table-scroll" *ngIf="preview?.rows?.length">
      <app-data-table>
        <table class="cf-table">
          <caption class="sr-only">{{ selectedLabel }} preview</caption>
          <thead>
            <tr>
              <th
                scope="col"
                *ngFor="let col of preview?.columns"
                [appSortable]="col.key"
                [direction]="previewSortColumn === col.key ? previewSortDirection : null"
                (sort)="onPreviewSort($event)"
              >
                {{ col.label }}
              </th>
            </tr>
          </thead>
          <tbody>
            <tr *ngFor="let row of preview?.rows">
              <td *ngFor="let col of preview?.columns">
                <a
                  *ngIf="isFamilyCodeColumn(col.key) && hasFamilyId(row); else plainCell"
                  [routerLink]="['/families', asFamilyId(row)]"
                  class="reports-workbench__family-code-link"
                >
                  {{ formatCell(col.key, row[col.key]) }}
                </a>
                <ng-template #plainCell>
                  <span [class.reports-workbench__family-label]="col.key === 'family_name'">
                    {{ formatCell(col.key, row[col.key]) }}
                  </span>
                </ng-template>
              </td>
            </tr>
          </tbody>
          <tfoot *ngIf="hasFooter">
            <tr>
              <th scope="row" *ngFor="let col of preview?.columns; let first = first">
                {{ footerCell(col.key, first) }}
              </th>
            </tr>
          </tfoot>
        </table>
      </app-data-table>
      </div>

      <app-pagination
        *ngIf="previewTotal > perPage"
        [currentPage]="page"
        [pageSize]="perPage"
        [totalItems]="previewTotal"
        [pageSizeOptions]="[25, 50, 100]"
        (pageChange)="goToPage($event)"
        (pageSizeChange)="onPageSizeChange($event)"
      />
    </section>

    <aside class="reports-layout__secondary exports-panel cf-panel" aria-labelledby="workbench-exports-heading">
      <header class="exports-panel__head">
        <div>
          <h2 id="workbench-exports-heading" class="exports-panel__title">Export history</h2>
          <p class="exports-panel__hint">Report files you requested from this parish.</p>
        </div>
        <button
          type="button"
          class="cf-btn cf-btn--sm"
          (click)="refreshExports.emit()"
          [disabled]="exportsLoading"
          aria-label="Refresh export history"
        >
          Refresh
        </button>
      </header>

      <div class="exports-panel__body" #exportsViewport role="region" aria-label="Export history list">
        <div *ngIf="exportsLoading && !exports.length" class="cf-loading-block" role="status" aria-busy="true">
          <p class="cf-loading-block__label">Loading exports…</p>
        </div>

        <app-cf-empty-state
          *ngIf="!exportsLoading && !exports.length"
          icon="↓"
          title="No exports yet"
          description="Download a report from the left panel to see it here."
          [hasActions]="false"
        />

        <ul class="exports-list" *ngIf="visibleExports.length">
          <li class="exports-list__item" *ngFor="let report of visibleExports">
            <p class="exports-list__title">{{ exportHistoryTitle(report) }}</p>
            <p class="exports-list__sub">
              <span *ngIf="report.requested_by_name">{{ report.requested_by_name }}</span>
              <time class="exports-list__time" [dateTime]="report.created_at">
                {{ report.created_at | date: 'medium' }}
              </time>
            </p>
          </li>
        </ul>
      </div>
      <footer class="exports-panel__foot">
        <a routerLink="/donations/download-history" class="cf-link exports-panel__view-all">View all</a>
      </footer>
    </aside>
    </div>
  `,
  styles: [`
    .reports-layout {
      display: grid;
      grid-template-columns: minmax(0, 1fr) minmax(17.5rem, 0.36fr);
      gap: var(--cf-space-3);
      align-items: start;
    }
    .reports-layout__primary {
      min-width: 0;
    }
    .reports-layout__secondary {
      min-width: 0;
      position: sticky;
      top: var(--cf-space-2);
      display: flex;
      flex-direction: column;
      height: calc(100vh - 16rem);
      max-height: calc(100vh - 16rem);
      overflow: hidden;
      background: var(--cf-panel-bg, var(--cf-color-surface));
      border: 1px solid var(--cf-panel-border);
    }
    .exports-panel__title {
      margin: 0;
      font-size: var(--cf-text-md);
      font-weight: 600;
      color: var(--cf-color-text-primary);
    }
    .exports-panel__hint {
      margin: var(--cf-space-1) 0 0;
      font-size: var(--cf-text-meta);
      color: var(--cf-color-text-muted);
      line-height: 1.4;
    }
    .exports-panel__body {
      flex: 1 1 auto;
      min-height: 0;
      overflow: hidden;
      padding-right: 0.15rem;
    }
    .exports-panel__foot {
      flex: 0 0 auto;
      margin-top: var(--cf-space-2);
      padding-top: var(--cf-space-2);
      border-top: 1px solid var(--cf-panel-border);
    }
    .exports-panel__view-all {
      font-size: var(--cf-text-sm, 0.875rem);
      font-weight: 600;
    }
    .exports-list {
      list-style: none;
      margin: 0;
      padding: 0;
      display: grid;
      gap: var(--cf-space-2);
    }
    .exports-list__item {
      padding: var(--cf-space-2);
      border: 1px solid var(--cf-panel-border);
      border-radius: var(--cf-radius-md, 0.5rem);
      background: var(--cf-color-surface, #fff);
      display: grid;
      gap: var(--cf-space-1);
    }
    .exports-list__title,
    .exports-list__sub {
      margin: 0;
      font-size: var(--cf-text-sm, 0.875rem);
      font-weight: 400;
      line-height: 1.4;
      color: var(--cf-color-text-primary);
    }
    .exports-list__sub {
      display: flex;
      flex-wrap: wrap;
      align-items: baseline;
      gap: 0.35rem;
    }
    .exports-list__sub span + .exports-list__time::before {
      content: '·';
      margin-right: 0.35rem;
      color: var(--cf-color-text-muted);
    }
    .exports-list__time {
      font-size: var(--cf-text-meta);
      color: var(--cf-color-text-muted);
    }
    .reports-workbench__table-scroll {
      overflow-x: auto;
      max-width: 100%;
      -webkit-overflow-scrolling: touch;
    }
    .reports-layout__primary .cf-table {
      min-width: 36rem;
    }
    .reports-workbench__family-label {
      font-weight: var(--cf-font-weight-medium, 500);
      color: var(--cf-text, inherit);
    }

    .reports-workbench__family-code-link {
      appearance: none;
      border: none;
      background: none;
      padding: 0;
      margin: 0;
      font: inherit;
      font-weight: var(--cf-font-weight-medium, 500);
      color: var(--cf-text, inherit);
      text-align: inherit;
      cursor: pointer;
      text-decoration: underline;
      text-decoration-color: color-mix(in srgb, var(--cf-primary) 35%, transparent);
      text-underline-offset: 0.12em;
    }

    .reports-workbench__family-code-link:hover {
      color: var(--cf-primary);
      text-decoration-color: var(--cf-primary);
    }

    .reports-workbench__table-scroll tfoot th {
      font-weight: 700;
      border-top: 2px solid var(--cf-panel-border);
      background: var(--cf-slate-50, #f8fafc);
      white-space: nowrap;
    }
    .reports-workbench__head {
      display: flex;
      flex-wrap: wrap;
      align-items: flex-start;
      justify-content: space-between;
      gap: var(--cf-space-2) var(--cf-space-3);
      margin-bottom: var(--cf-space-3);
      min-width: 0;
    }
    .reports-workbench__head-copy {
      flex: 1 1 12rem;
      min-width: 0;
    }
    .reports-workbench__lead { margin: 0; color: var(--cf-muted); font-size: var(--cf-text-meta); }
    .reports-workbench__toolbar {
      flex-wrap: nowrap;
      align-items: center;
      padding: var(--cf-space-2) var(--cf-space-3);
      margin-bottom: var(--cf-space-3);
      overflow-x: auto;
      overflow-y: hidden;
      -webkit-overflow-scrolling: touch;
      scrollbar-width: thin;
    }
    .reports-workbench__control {
      display: inline-flex;
      align-items: center;
      gap: var(--cf-space-1);
      margin: 0;
      flex: 0 0 auto;
      min-width: 0;
    }
    .reports-workbench__control-prefix {
      font-size: var(--cf-text-sm);
      font-weight: 600;
      color: var(--cf-slate-700, var(--cf-color-text-primary));
      white-space: nowrap;
    }
    .reports-workbench__control--report select {
      width: 10.5rem;
      max-width: 10.5rem;
    }
    .reports-workbench__date-range {
      display: inline-flex;
      align-items: center;
      flex-wrap: nowrap;
      gap: var(--cf-space-1);
      flex: 0 0 auto;
      min-width: 0;
    }
    .reports-workbench__date-sep {
      color: var(--cf-muted);
      font-weight: 500;
      line-height: 1;
      user-select: none;
    }
    .reports-workbench__control--date input[type='date'] {
      width: 9.25rem;
      min-width: 9.25rem;
      max-width: 9.25rem;
    }
    .reports-workbench__search {
      box-sizing: border-box;
      flex: 1 1 7rem;
      min-width: 7rem;
      width: auto;
      max-width: none;
      min-height: var(--cf-control-height);
      border: 1px solid var(--cf-panel-border);
      border-radius: var(--cf-radius-sm);
      padding: var(--cf-toolbar-control-pad-y) var(--cf-toolbar-control-pad-x);
      background: var(--cf-panel-bg);
      font-size: var(--cf-text-base);
      line-height: 1.25;
    }
    .reports-workbench__filters-btn {
      margin-left: auto;
      flex-shrink: 0;
      display: inline-flex;
      align-items: center;
      gap: var(--cf-space-1);
    }
    .reports-workbench__totals {
      display: flex;
      flex-wrap: wrap;
      gap: var(--cf-space-2);
      margin-bottom: var(--cf-space-2);
      font-size: var(--cf-text-md);
    }
    .reports-workbench__actions {
      display: flex;
      flex-wrap: wrap;
      justify-content: flex-end;
      align-items: center;
      gap: var(--cf-space-2);
      flex: 0 1 auto;
      max-width: 100%;
      margin-left: auto;
    }
    .reports-workbench__actions .cf-btn {
      display: inline-flex;
      align-items: center;
      gap: var(--cf-space-1);
      white-space: nowrap;
    }
    .reports-workbench__chips {
      display: flex;
      flex-wrap: wrap;
      gap: var(--cf-space-1);
      margin-bottom: var(--cf-space-2);
      align-items: center;
    }
    .reports-workbench__chip {
      display: inline-flex;
      align-items: center;
      gap: 0.15rem;
    }
    .reports-workbench__chip-remove {
      border: none;
      background: transparent;
      cursor: pointer;
      font-size: 1rem;
      line-height: 1;
      padding: 0 0.25rem;
      color: var(--cf-muted);
    }
    .exports-panel__head {
      display: flex;
      justify-content: space-between;
      align-items: flex-start;
      gap: var(--cf-space-2);
      margin-bottom: var(--cf-space-2);
      flex-shrink: 0;
    }
    @media (max-width: 960px) {
      .reports-layout {
        grid-template-columns: 1fr;
      }
      .reports-layout__secondary {
        position: static;
        height: auto;
        max-height: none;
        overflow: visible;
      }
      .exports-panel__body {
        max-height: 16rem;
      }
    }
  `],
})
export class DonationsReportsWorkbenchComponent implements OnInit, OnChanges, AfterViewInit, OnDestroy {
  @Input() canExport = false;
  @Input() advancedReports = true;
  @Input() exports: DonationReportExport[] = [];
  @Input() exportsLoading = false;
  @Output() refreshExports = new EventEmitter<void>();
  @ViewChild('exportsViewport') exportsViewport?: ElementRef<HTMLElement>;

  visibleExportLimit = 4;

  catalog: DonationReportCatalogItem[] = [];
  catalogLoading = true;
  catalogError: string | null = null;
  selectedReportKey = '';
  preview: DonationReportPreview | null = null;
  previewLoading = false;
  previewError: string | null = null;
  exportLoading = false;

  selectedExportFormat: 'csv' | 'xlsx' | 'pdf' = 'csv';

  dateFrom = '';
  dateTo = '';
  asOfDate = '';
  search = '';
  preset = '';
  bccId = '';
  bccOptions: { id: string; name: string }[] = [];
  projectId = '';
  projectOptions: { id: string; name: string }[] = [];
  planOptions: { id: string; name: string }[] = [];
  filtersDrawerOpen = false;
  fiscalYear = '';
  planId = '';
  method = '';
  status = '';
  participationStatus = 'not_participating';
  actionType = '';
  entityKind = '';
  outstandingView = 'families';
  projectFundingView = 'projects';
  page = 1;
  perPage = 25;
  previewSortColumn: string | null = null;
  previewSortDirection: SortDirection = null;

  private readonly churchCurrency = inject(ChurchCurrencyService);
  private readonly searchChanges$ = new Subject<string>();
  private searchSubscription?: Subscription;
  private exportResizeObserver?: ResizeObserver;
  private readonly onExportPanelResize = (): void => this.measureVisibleExports();

  constructor(
    private donationsService: DonationsService,
    private receiptPrintService: ReceiptPrintService,
    private bccService: BCCService,
    private router: Router,
    private route: ActivatedRoute,
    private cdr: ChangeDetectorRef,
  ) {}

  ngOnInit(): void {
    this.applyFiltersFromQuery(this.route.snapshot.queryParamMap);

    this.searchSubscription = this.searchChanges$
      .pipe(debounceTime(350), distinctUntilChanged())
      .subscribe(() => {
        this.page = 1;
        this.loadPreview();
      });

    this.donationsService.getPlans().subscribe({
      next: (res) => {
        this.planOptions = (res?.data ?? []).map((plan) => ({
          id: String(plan.id),
          name: plan.name ?? plan.code,
        }));
        this.cdr.detectChanges();
      },
    });

    this.donationsService.getProjects().subscribe({
      next: (res) => {
        const rows = res?.data ?? [];
        this.projectOptions = rows
          .filter((p) => p.status === 'active' || p.status === 'completed')
          .map((p) => ({ id: String(p.id), name: p.name ?? p.code }));
        this.cdr.detectChanges();
      },
    });

    this.bccService
      .getBCCs({ status: 'active', per_page: 500, sort_by: 'name', sort_order: 'asc' })
      .subscribe({
        next: (response) => {
          const rows = response?.data ?? [];
          this.bccOptions = rows.map((row) => ({ id: String(row.id), name: row.name ?? 'BCC' }));
          this.cdr.detectChanges();
        },
      });

    this.donationsService.getReportCatalog().subscribe({
      next: (res) => {
        this.catalogLoading = false;
        this.catalogError = null;
        this.catalog = Array.isArray(res.data) ? res.data : [];
        if (!this.catalog.length) {
          this.catalogError =
            'The server returned an empty report list. Check that the API is running and your parish has Donations enabled.';
          this.cdr.detectChanges();
          return;
        }
        const queryReport = this.route.snapshot.queryParamMap.get('report');
        if (queryReport && this.catalog.find((c) => c.key === queryReport)) {
          this.selectedReportKey = queryReport;
        } else if (
          this.selectedReportKey &&
          !this.catalog.find((c) => c.key === this.selectedReportKey)
        ) {
          this.selectedReportKey = '';
        }
        if (this.hasSelectedReport) {
          this.applyCatalogDefaultPreset();
          this.loadPreview();
        }
        this.cdr.detectChanges();
      },
      error: (err: { status?: number; message?: string; error?: unknown }) => {
        this.catalogLoading = false;
        this.catalog = [];
        if (err?.status === 403) {
          this.catalogError =
            "You don't have permission to view downloadable reports. Ask your parish administrator to grant Access Donation Reports (donations.reports) on your role.";
        } else if (err?.status === 401) {
          this.catalogError = 'Your session has expired. Sign in again, then return to this page.';
        } else {
          this.catalogError =
            'Could not load the report list. Confirm the API is reachable and you are signed in to the correct parish.';
        }
        this.cdr.detectChanges();
      },
    });
  }

  ngOnChanges(changes: SimpleChanges): void {
    if (changes['exports'] || changes['exportsLoading']) {
      this.scheduleExportMeasure();
    }
  }

  ngAfterViewInit(): void {
    const host = this.exportsViewport?.nativeElement;
    if (host && typeof ResizeObserver !== 'undefined') {
      this.exportResizeObserver = new ResizeObserver(() => this.measureVisibleExports());
      this.exportResizeObserver.observe(host);
    }
    window.addEventListener('resize', this.onExportPanelResize);
    this.scheduleExportMeasure();
  }

  ngOnDestroy(): void {
    this.searchSubscription?.unsubscribe();
    this.exportResizeObserver?.disconnect();
    window.removeEventListener('resize', this.onExportPanelResize);
  }

  get visibleExports(): DonationReportExport[] {
    return this.exports.slice(0, this.visibleExportLimit);
  }

  private fitExportPanel(host?: HTMLElement): void {
    const panel = host?.closest('.exports-panel') as HTMLElement | null;
    if (!panel) {
      return;
    }
    if (window.matchMedia('(max-width: 960px)').matches) {
      panel.style.height = '';
      panel.style.maxHeight = '';
      return;
    }
    const footer = document.querySelector('footer.footer');
    const footerHeight = footer?.getBoundingClientRect().height ?? 0;
    const top = Math.max(0, panel.getBoundingClientRect().top);
    const available = Math.floor(window.innerHeight - top - footerHeight - 12);
    if (available < 220) {
      return;
    }
    if (Math.abs(panel.clientHeight - available) > 2) {
      panel.style.height = `${available}px`;
      panel.style.maxHeight = `${available}px`;
    }
  }

  private scheduleExportMeasure(): void {
    setTimeout(() => this.measureVisibleExports(), 0);
  }

  private measureVisibleExports(): void {
    const host = this.exportsViewport?.nativeElement;
    this.fitExportPanel(host);
    if (!host || !this.exports.length) {
      return;
    }
    const available = host.clientHeight;
    if (available < 48) {
      return;
    }
    const item = host.querySelector('.exports-list__item') as HTMLElement | null;
    const itemHeight = item?.offsetHeight ?? 0;
    if (itemHeight < 24) {
      return;
    }
    const list = host.querySelector('.exports-list') as HTMLElement | null;
    const styles = list ? getComputedStyle(list) : null;
    const gap = styles ? Number.parseFloat(styles.rowGap || styles.gap || '0') || 0 : 0;
    const count = Math.max(1, Math.floor((available + gap) / (itemHeight + gap)));
    const next = Math.min(this.exports.length, count);
    if (next !== this.visibleExportLimit) {
      this.visibleExportLimit = next;
      this.cdr.detectChanges();
    }
  }

  get selectedSupportedFilters(): string[] {
    return this.catalog.find((c) => c.key === this.selectedReportKey)?.supported_filters ?? [];
  }

  get filterDraftModel(): DonationsReportsFilterDraft {
    return {
      dateFrom: this.dateFrom,
      dateTo: this.dateTo,
      asOfDate: this.asOfDate,
      preset: this.preset,
      bccId: this.bccId,
      projectId: this.projectId,
      planId: this.planId,
      fiscalYear: this.fiscalYear,
      method: this.method,
      status: this.status,
      participationStatus: this.participationStatus,
      actionType: this.actionType,
      entityKind: this.entityKind,
      outstandingView: this.outstandingView,
      projectFundingView: this.projectFundingView,
      search: this.search,
    };
  }

  get visibleCatalog(): DonationReportCatalogItem[] {
    return this.catalog.filter((item) => !item.requires_advanced || this.advancedReports);
  }

  get hasSelectedReport(): boolean {
    return this.visibleCatalog.some((item) => item.key === this.selectedReportKey);
  }

  get selectedLabel(): string {
    return this.catalog.find((c) => c.key === this.selectedReportKey)?.label ?? 'Report';
  }

  get selectedSemantic(): string {
    return this.catalog.find((c) => c.key === this.selectedReportKey)?.date_semantic ?? 'payment_period';
  }

  get usesDateRange(): boolean {
    if (!this.hasSelectedReport) {
      return false;
    }
    return ['payment_period', 'receipt_issued', 'expense_date', 'participation_window', 'adjustment_date', 'received_at'].includes(this.selectedSemantic);
  }

  get usesAsOf(): boolean {
    if (!this.hasSelectedReport) {
      return false;
    }
    return this.selectedSemantic === 'as_of';
  }

  get supportsSearch(): boolean {
    if (!this.hasSelectedReport) {
      return false;
    }
    const item = this.catalog.find((c) => c.key === this.selectedReportKey);
    return item?.supported_filters?.includes('search') ?? false;
  }

  /** Toolbar shows date range and search before a report is chosen; after that, follow the catalog. */
  get showDateRange(): boolean {
    return this.hasSelectedReport ? this.usesDateRange : !this.showAsOf;
  }

  get showAsOf(): boolean {
    return this.hasSelectedReport && this.usesAsOf;
  }

  get showSearch(): boolean {
    return this.hasSelectedReport ? this.supportsSearch : true;
  }

  get supportsBcc(): boolean {
    const item = this.catalog.find((c) => c.key === this.selectedReportKey);
    return item?.supported_filters?.includes('bcc_id') ?? false;
  }

  get supportsProject(): boolean {
    const item = this.catalog.find((c) => c.key === this.selectedReportKey);
    return item?.supported_filters?.includes('project_id') ?? false;
  }

  get previewTotal(): number {
    return this.preview?.pagination?.total ?? 0;
  }

  get canPrint(): boolean {
    if (!this.hasSelectedReport) {
      return false;
    }
    const item = this.catalog.find((c) => c.key === this.selectedReportKey);
    return item?.print !== false;
  }

  get activeChips(): { key: string; label: string; removeLabel: string }[] {
    const chips: { key: string; label: string; removeLabel: string }[] = [];
    if (this.preset) {
      chips.push({
        key: 'preset',
        label: `Period: ${this.preset.replace(/_/g, ' ')}`,
        removeLabel: 'Remove period preset',
      });
    }
    if (this.dateFrom && this.dateTo) {
      chips.push({
        key: 'dates',
        label: `${this.dateFrom} – ${this.dateTo}`,
        removeLabel: 'Remove date range',
      });
    }
    if (this.asOfDate) {
      chips.push({ key: 'as_of', label: `As of ${this.asOfDate}`, removeLabel: 'Remove as-of date' });
    }
    if (this.fiscalYear) {
      chips.push({ key: 'fiscal_year', label: `FY ${this.fiscalYear}`, removeLabel: 'Remove fiscal year' });
    }
    if (this.bccId) {
      const name = this.bccId === 'unassigned'
        ? 'Unassigned Area'
        : (this.bccOptions.find((b) => b.id === this.bccId)?.name ?? 'BCC');
      chips.push({ key: 'bcc_id', label: `BCC: ${name}`, removeLabel: 'Remove BCC filter' });
    }
    if (this.projectId) {
      const name = this.projectOptions.find((p) => p.id === this.projectId)?.name ?? 'Project';
      chips.push({ key: 'project_id', label: `Project: ${name}`, removeLabel: 'Remove project filter' });
    }
    if (this.planId) {
      const name = this.planOptions.find((p) => p.id === this.planId)?.name ?? 'Plan';
      chips.push({ key: 'plan_id', label: `Plan: ${name}`, removeLabel: 'Remove plan filter' });
    }
    if (this.method) {
      chips.push({ key: 'method', label: `Method: ${this.method}`, removeLabel: 'Remove method filter' });
    }
    if (this.status) {
      chips.push({ key: 'status', label: `Status: ${this.status}`, removeLabel: 'Remove status filter' });
    }
    if (this.participationStatus && this.selectedReportKey === 'participation') {
      chips.push({
        key: 'participation_status',
        label: this.participationStatus === 'participating' ? 'Participating families' : 'Not participating',
        removeLabel: 'Remove participation filter',
      });
    }
    if (this.actionType) {
      chips.push({ key: 'action_type', label: `Type: ${this.actionType}`, removeLabel: 'Remove adjustment type' });
    }
    if (this.entityKind) {
      chips.push({ key: 'entity_kind', label: `Kind: ${this.entityKind}`, removeLabel: 'Remove entity kind' });
    }
    if (this.outstandingView === 'totals' && this.selectedReportKey === 'outstanding') {
      chips.push({ key: 'view', label: 'Summary view', removeLabel: 'Switch to family lines view' });
    }
    if (this.projectFundingView === 'gaps' && this.selectedReportKey === 'project_funding') {
      chips.push({
        key: 'project_view',
        label: 'Family funding gaps',
        removeLabel: 'Switch to project summary view',
      });
    }
    if (this.search.trim().length >= 2) {
      chips.push({
        key: 'search',
        label: `Search: ${this.search.trim()}`,
        removeLabel: 'Clear search',
      });
    }
    return chips;
  }

  get visibleChips(): { key: string; label: string; removeLabel: string }[] {
    return this.activeChips.slice(0, 2);
  }

  get hiddenChips(): { key: string; label: string; removeLabel: string }[] {
    return this.activeChips.slice(2);
  }

  get hiddenChipCount(): number {
    return this.hiddenChips.length;
  }

  get totalHints(): string[] {
    const totals = this.preview?.totals ?? {};
    const hints: string[] = [];
    if (totals['payment_count'] != null) {
      hints.push(`${totals['payment_count']} payments`);
    }
    if (totals['collected_gross'] != null) {
      const gross = totals['collected_gross'] as string | number;
      const formatted = this.churchCurrency.formatAmount(gross);
      hints.push(formatted ? `Collected ${formatted}` : `Collected ${gross}`);
    }
    if (totals['outstanding_collectable'] != null) {
      const outstanding = totals['outstanding_collectable'] as string | number;
      const formatted = this.churchCurrency.formatAmount(outstanding);
      hints.push(
        formatted ? `Outstanding ${formatted}` : `Outstanding ${outstanding}`,
      );
    }
    if (totals['active_families'] != null) {
      hints.push(`${totals['active_families']} active families`);
    }
    const gaps = totals['reconstruction_gaps'];
    if (typeof gaps === 'number' && gaps > 0) {
      hints.push(`${gaps} rows excluded from as-of (missing waiver date)`);
    }
    return hints;
  }

  onSearchInput(value: string): void {
    this.search = value;
    if (value.trim().length === 0 || value.trim().length >= 2) {
      this.searchChanges$.next(value.trim());
    }
  }

  openFiltersDrawer(): void {
    this.filtersDrawerOpen = true;
    this.cdr.detectChanges();
  }

  onFiltersApplied(draft: DonationsReportsFilterDraft): void {
    this.dateFrom = draft.dateFrom;
    this.dateTo = draft.dateTo;
    this.asOfDate = draft.asOfDate;
    this.preset = draft.preset;
    this.bccId = draft.bccId;
    this.projectId = draft.projectId;
    this.planId = draft.planId;
    this.fiscalYear = draft.fiscalYear;
    this.method = draft.method;
    this.status = draft.status;
    this.participationStatus = draft.participationStatus;
    this.actionType = draft.actionType;
    this.entityKind = draft.entityKind;
    this.outstandingView = draft.outstandingView;
    this.projectFundingView = draft.projectFundingView ?? 'projects';
    this.search = draft.search;
    this.page = 1;
    this.filtersDrawerOpen = false;
    this.loadPreview();
  }

  onFiltersReset(): void {
    this.dateFrom = '';
    this.dateTo = '';
    this.asOfDate = '';
    this.preset = '';
    this.bccId = '';
    this.projectId = '';
    this.planId = '';
    this.fiscalYear = '';
    this.method = '';
    this.status = '';
    this.participationStatus = 'not_participating';
    this.actionType = '';
    this.entityKind = '';
    this.outstandingView = 'families';
    this.projectFundingView = 'projects';
    this.search = '';
    this.page = 1;
    this.filtersDrawerOpen = false;
    this.loadPreview();
  }

  removeFilterChip(key: string): void {
    switch (key) {
      case 'preset':
        this.preset = '';
        break;
      case 'dates':
        this.dateFrom = '';
        this.dateTo = '';
        break;
      case 'as_of':
        this.asOfDate = '';
        break;
      case 'fiscal_year':
        this.fiscalYear = '';
        break;
      case 'bcc_id':
        this.bccId = '';
        break;
      case 'project_id':
        this.projectId = '';
        break;
      case 'plan_id':
        this.planId = '';
        break;
      case 'method':
        this.method = '';
        break;
      case 'status':
        this.status = '';
        break;
      case 'participation_status':
        this.participationStatus = 'not_participating';
        break;
      case 'action_type':
        this.actionType = '';
        break;
      case 'entity_kind':
        this.entityKind = '';
        break;
      case 'view':
        this.outstandingView = 'families';
        break;
      case 'project_view':
        this.projectFundingView = 'projects';
        break;
      case 'search':
        this.search = '';
        break;
      default:
        break;
    }
    this.page = 1;
    this.loadPreview();
  }

  onToolbarDatesChange(): void {
    this.page = 1;
    this.loadPreview();
  }

  onReportChange(): void {
    this.page = 1;
    this.previewSortColumn = null;
    this.previewSortDirection = null;
    if (!this.hasSelectedReport) {
      this.preview = null;
      this.previewError = null;
      this.previewLoading = false;
      void this.router.navigate([], {
        relativeTo: this.route,
        queryParams: {},
        replaceUrl: true,
      });
      this.cdr.detectChanges();
      return;
    }
    this.applyCatalogDefaultPreset();
    this.loadPreview();
  }

  private applyCatalogDefaultPreset(): void {
    const item = this.catalog.find((c) => c.key === this.selectedReportKey);
    if (!item?.default_preset) {
      return;
    }
    const hasDates = !!(this.dateFrom && this.dateTo);
    const hasQueryDates =
      this.route.snapshot.queryParamMap.has('date_from') ||
      this.route.snapshot.queryParamMap.has('preset');
    if (!this.preset && !hasDates && !hasQueryDates) {
      this.preset = item.default_preset;
    }
    if (item.key === 'participation' && !this.route.snapshot.queryParamMap.has('participation_status')) {
      this.participationStatus = 'not_participating';
    }
  }

  goToPage(nextPage: number): void {
    this.page = nextPage;
    this.loadPreview();
  }

  onPageSizeChange(size: number): void {
    this.perPage = size;
    this.page = 1;
    this.loadPreview();
  }

  onPreviewSort(event: SortEvent): void {
    this.previewSortColumn = event.column;
    this.previewSortDirection = event.direction;
    this.page = 1;
    this.loadPreview();
  }

  loadPreview(): void {
    if (!this.hasSelectedReport) {
      return;
    }
    this.previewLoading = true;
    this.previewError = null;
    this.donationsService.getReportPreview(this.buildFilterPayload()).subscribe({
      next: (res) => {
        this.preview = res.data;
        this.previewLoading = false;
        this.syncFiltersToQuery();
        this.cdr.detectChanges();
      },
      error: (err: { status?: number }) => {
        this.preview = null;
        this.previewLoading = false;
        this.previewError =
          err?.status === 403
            ? "You don't have access to this report."
            : 'Could not load this report. Check filters and try again.';
        this.cdr.detectChanges();
      },
    });
  }

  queueExport(): void {
    if (!this.canExport) {
      return;
    }
    this.exportLoading = true;
    this.donationsService.exportReport(this.buildExportPayload()).subscribe({
      next: (res) => {
        this.exportLoading = false;
        this.refreshExports.emit();
        if (res.data?.status === 'completed' && res.data.id) {
          this.downloadExport(res.data.id, res.data.export_format ?? this.selectedExportFormat);
        }
        this.cdr.detectChanges();
      },
      error: () => {
        this.exportLoading = false;
        this.cdr.detectChanges();
      },
    });
  }

  printReport(): void {
    if (!this.hasSelectedReport || !this.canPrint) {
      return;
    }
    this.receiptPrintService.printOperationalReport(this.buildFilterPayload());
  }

  asFamilyId(row: Record<string, unknown>): string {
    return String(row['family_id'] ?? '');
  }

  isFamilyCodeColumn(columnKey: string): boolean {
    return columnKey === 'family_code';
  }

  hasFamilyId(row: Record<string, unknown>): boolean {
    const familyId = row['family_id'];
    return familyId !== null && familyId !== undefined && String(familyId).length > 0;
  }

  downloadExport(exportId: string, format: 'csv' | 'xlsx' | 'pdf' = 'csv'): void {
    const extension = format === 'xlsx' ? 'xlsx' : format === 'pdf' ? 'pdf' : 'csv';
    this.donationsService.downloadReportExport(exportId).subscribe({
      next: (blob) => {
        const url = URL.createObjectURL(blob);
        const anchor = document.createElement('a');
        anchor.href = url;
        anchor.download = `donation-report-${exportId}.${extension}`;
        anchor.click();
        URL.revokeObjectURL(url);
      },
    });
  }

  get exportFormatLabel(): string {
    if (this.selectedExportFormat === 'xlsx') {
      return 'Excel';
    }
    if (this.selectedExportFormat === 'pdf') {
      return 'PDF';
    }
    return 'CSV';
  }

  get isLastPreviewPage(): boolean {
    const total = this.previewTotal;
    if (total <= 0) {
      return false;
    }
    const lastPage = Math.max(1, Math.ceil(total / this.perPage));
    return this.page >= lastPage;
  }

  get hasFooter(): boolean {
    const footer = this.preview?.footer;
    return (
      !!footer &&
      Object.keys(footer).length > 0 &&
      !!this.preview?.rows?.length &&
      this.isLastPreviewPage
    );
  }

  footerCell(columnKey: string, first: boolean): string {
    const footer = this.preview?.footer ?? {};
    if (Object.prototype.hasOwnProperty.call(footer, columnKey)) {
      return this.formatCell(columnKey, footer[columnKey]);
    }
    return first ? 'Total' : '';
  }

  formatCell(columnKey: string, value: unknown): string {
    if (value === null || value === undefined) {
      return '—';
    }
    if (this.isDateColumn(columnKey) && (typeof value === 'string' || value instanceof Date)) {
      const formatted = cfFormatDate(value);
      return formatted || String(value);
    }
    if (this.isMoneyColumn(columnKey) && (typeof value === 'number' || typeof value === 'string')) {
      const formatted = this.churchCurrency.formatAmount(value);
      if (formatted) {
        return formatted;
      }
    }
    return String(value);
  }

  private isDateColumn(key: string): boolean {
    return /date|_on$|issued/i.test(key);
  }

  private isMoneyColumn(key: string): boolean {
    return /amount|outstanding|collected|paid|gross|total|due/i.test(key) && !this.isDateColumn(key);
  }

  exportTypeLabel(reportType: string): string {
    const fromCatalog = this.catalog.find((c) => c.key === reportType)?.label;
    if (fromCatalog) {
      return fromCatalog;
    }
    const labels: Record<string, string> = { payments: 'Payments', donation_entries: 'Offerings' };
    return labels[reportType] ?? reportType.replace(/_/g, ' ');
  }

  exportHistoryTitle(report: DonationReportExport): string {
    const format = donationReportExportFormatShortLabelForRow(report).toLowerCase();
    return `${this.exportTypeLabel(report.report_type)} - ${format}`;
  }

  private buildExportPayload(): Record<string, unknown> {
    return {
      ...this.buildFilterPayload(),
      export_format: this.selectedExportFormat,
    };
  }

  private buildFilterPayload(): Record<string, unknown> {
    const payload: Record<string, unknown> = {
      report_type: this.selectedReportKey,
      page: this.page,
      per_page: this.perPage,
    };
    if (this.usesDateRange && this.dateFrom && this.dateTo) {
      payload['date_from'] = this.dateFrom;
      payload['date_to'] = this.dateTo;
    }
    if (this.usesAsOf && this.asOfDate) {
      payload['as_of_date'] = this.asOfDate;
    }
    if (this.search.trim().length >= 2) {
      payload['search'] = this.search.trim();
    }
    if (this.preset) {
      payload['preset'] = this.preset;
    } else if (this.selectedReportKey === 'payments' && !this.dateFrom && !this.dateTo) {
      payload['preset'] = 'this_month';
    }
    if (this.bccId) {
      payload['bcc_id'] = this.bccId;
    }
    if (this.projectId) {
      payload['project_id'] = this.projectId;
    }
    if (this.planId) {
      payload['plan_id'] = this.planId;
    }
    if (this.fiscalYear) {
      payload['fiscal_year'] = this.fiscalYear;
    }
    if (this.method) {
      payload['method'] = this.method;
    }
    if (this.status) {
      payload['status'] = this.status;
    }
    if (this.actionType) {
      payload['action_type'] = this.actionType;
    }
    if (this.entityKind) {
      payload['entity_kind'] = this.entityKind;
    }
    if (this.selectedReportKey === 'outstanding') {
      if (!this.asOfDate) {
        payload['as_of_date'] = new Date().toISOString().slice(0, 10);
      }
      payload['view'] = this.outstandingView;
    }
    if (this.selectedReportKey === 'project_funding') {
      if (!this.asOfDate) {
        payload['as_of_date'] = new Date().toISOString().slice(0, 10);
      }
      if (this.projectFundingView === 'gaps') {
        payload['view'] = 'gaps';
      }
    }
    if (this.selectedReportKey === 'participation') {
      if (!this.preset && !this.dateFrom) {
        payload['preset'] = 'last_90';
      }
      payload['participation_status'] = this.participationStatus || 'not_participating';
    }
    if (this.previewSortColumn && this.previewSortDirection) {
      payload['sort'] = this.previewSortColumn;
      payload['direction'] = this.previewSortDirection;
    }
    return payload;
  }

  private applyFiltersFromQuery(params: { get: (key: string) => string | null }): void {
    const report = params.get('report');
    if (report) {
      this.selectedReportKey = report;
    }
    this.dateFrom = params.get('date_from') ?? '';
    this.dateTo = params.get('date_to') ?? '';
    this.asOfDate = params.get('as_of_date') ?? '';
    this.preset = params.get('preset') ?? '';
    this.bccId = params.get('bcc_id') ?? '';
    this.projectId = params.get('project_id') ?? '';
    this.planId = params.get('plan_id') ?? '';
    this.fiscalYear = params.get('fiscal_year') ?? '';
    this.method = params.get('method') ?? '';
    this.status = params.get('status') ?? '';
    this.participationStatus = params.get('participation_status') ?? 'not_participating';
    this.actionType = params.get('action_type') ?? '';
    this.entityKind = params.get('entity_kind') ?? '';
    const viewParam = params.get('view');
    if (viewParam === 'gaps') {
      this.projectFundingView = 'gaps';
      this.outstandingView = 'families';
    } else {
      this.outstandingView = viewParam ?? 'families';
      this.projectFundingView = 'projects';
    }
    this.search = params.get('search') ?? '';
    const page = Number(params.get('page'));
    if (page > 0) {
      this.page = page;
    }
    const perPage = Number(params.get('per_page'));
    if (perPage > 0) {
      this.perPage = perPage;
    }
    const sort = params.get('sort');
    const direction = params.get('direction');
    if (sort) {
      this.previewSortColumn = sort;
      this.previewSortDirection = direction === 'desc' ? 'desc' : direction === 'asc' ? 'asc' : null;
    } else {
      this.previewSortColumn = null;
      this.previewSortDirection = null;
    }
  }

  private syncFiltersToQuery(): void {
    const query: Record<string, string | number> = {};
    if (this.selectedReportKey) {
      query['report'] = this.selectedReportKey;
    }
    if (this.page > 1) {
      query['page'] = this.page;
    }
    if (this.perPage !== 25) {
      query['per_page'] = this.perPage;
    }
    if (this.dateFrom) {
      query['date_from'] = this.dateFrom;
    }
    if (this.dateTo) {
      query['date_to'] = this.dateTo;
    }
    if (this.asOfDate) {
      query['as_of_date'] = this.asOfDate;
    }
    if (this.preset) {
      query['preset'] = this.preset;
    }
    if (this.bccId) {
      query['bcc_id'] = this.bccId;
    }
    if (this.projectId) {
      query['project_id'] = this.projectId;
    }
    if (this.planId) {
      query['plan_id'] = this.planId;
    }
    if (this.fiscalYear) {
      query['fiscal_year'] = this.fiscalYear;
    }
    if (this.method) {
      query['method'] = this.method;
    }
    if (this.status) {
      query['status'] = this.status;
    }
    if (this.participationStatus && this.selectedReportKey === 'participation') {
      query['participation_status'] = this.participationStatus;
    }
    if (this.actionType) {
      query['action_type'] = this.actionType;
    }
    if (this.entityKind) {
      query['entity_kind'] = this.entityKind;
    }
    if (this.outstandingView && this.outstandingView !== 'families' && this.selectedReportKey === 'outstanding') {
      query['view'] = this.outstandingView;
    }
    if (this.projectFundingView === 'gaps' && this.selectedReportKey === 'project_funding') {
      query['view'] = 'gaps';
    }
    if (this.search.trim().length >= 2) {
      query['search'] = this.search.trim();
    }
    if (this.previewSortColumn && this.previewSortDirection) {
      query['sort'] = this.previewSortColumn;
      query['direction'] = this.previewSortDirection;
    }

    void this.router.navigate([], {
      relativeTo: this.route,
      queryParams: query,
      replaceUrl: true,
    });
  }
}
