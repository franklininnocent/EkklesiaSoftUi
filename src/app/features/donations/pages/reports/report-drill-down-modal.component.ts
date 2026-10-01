import { CommonModule } from '@angular/common';
import { HttpErrorResponse } from '@angular/common/http';
import {
  ChangeDetectionStrategy,
  ChangeDetectorRef,
  Component,
  EventEmitter,
  Input,
  OnChanges,
  OnDestroy,
  OnInit,
  Output,
  SimpleChanges,
  inject
} from '@angular/core';
import { FormsModule } from '@angular/forms';
import { RouterModule } from '@angular/router';
import { Subject, Subscription, debounceTime, distinctUntilChanged, finalize, switchMap, merge, map } from 'rxjs';
import { formatReportDrillDownMethodology } from './report-drill-down-methodology.util';
import { DonationsService } from '../../services/donations.service';
import {
  ContributionDue,
  ReportDrillDownFamilyRow,
  ReportDrillDownPaymentRow,
  ReportDrillDownProjectRow,
  ReportDrillDownRequestPayload,
  ReportDrillDownResponse
} from '../../models/donation.model';
import { ModalShellComponent } from '@shared/components/modal-shell/modal-shell.component';
import { DataTableComponent } from '@shared/components/data-table/data-table.component';
import { PaginationComponent } from '@shared/components/pagination/pagination.component';
import { CfEmptyStateComponent } from '@shared/components/cf-empty-state/cf-empty-state.component';
import { LoadingSkeletonComponent } from '@shared/components/loading-skeleton/loading-skeleton.component';
import { CfBrandLoaderComponent } from '@shared/components/cf-brand-loader/cf-brand-loader.component';
import { CfCurrencyPipe } from '@shared/pipes/cf-currency.pipe';
import { CfDatePipe } from '@shared/pipes/cf-date.pipe';

@Component({
  selector: 'app-report-drill-down-modal',
  standalone: true,
  imports: [
    CfDatePipe,
    CommonModule,
    FormsModule,
    RouterModule,
    ModalShellComponent,
    DataTableComponent,
    PaginationComponent,
    CfEmptyStateComponent,
    LoadingSkeletonComponent,
    CfBrandLoaderComponent,
    CfCurrencyPipe
  ],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <app-modal-shell
      *ngIf="request"
      [title]="modalTitle"
      [description]="modalDescription"
      size="xl"
      (closeRequested)="close()"
    >
      <div class="cf-inline-alert cf-panel" *ngIf="listError" role="alert">
        <p>{{ listError }}</p>
        <button type="button" class="cf-btn cf-btn--sm" (click)="reloadList()">Try again</button>
      </div>

      <div *ngIf="listLoading && !response">
        <app-loading-skeleton type="card" [rows]="4"></app-loading-skeleton>
      </div>

      <ng-container *ngIf="response?.context as ctx">
        <div class="drill-down">
          <div class="drill-down__metrics" role="region" aria-label="Chart totals">
            <div
              class="drill-down__metric cf-panel"
              [class.drill-down__metric--overdue]="ctx.slice_id === 'overdue'"
              [class.drill-down__metric--remaining]="ctx.slice_id === 'remaining_collectable'"
            >
              <span class="drill-down__metric-label">Matches chart</span>
              <span class="drill-down__metric-value" *ngIf="ctx.value_kind === 'money'">{{ ctx.expected_amount | cfCurrency }}</span>
              <span class="drill-down__metric-value" *ngIf="ctx.value_kind === 'score'">{{ ctx.expected_amount | number:'1.0-1' }}/100</span>
              <span class="drill-down__metric-value" *ngIf="ctx.value_kind === 'count'">{{ ctx.expected_count | number }}</span>
              <span class="drill-down__metric-value" *ngIf="!ctx.value_kind">{{ ctx.expected_amount | cfCurrency }}</span>
              <span class="drill-down__metric-hint" *ngIf="ctx.value_kind !== 'count'">
                {{ ctx.expected_count | number }} {{ recordKind === 'payment' ? 'payments' : 'families' }} in this slice
              </span>
              <span class="drill-down__metric-hint" *ngIf="ctx.value_kind === 'count'">
                Active families in this slice
              </span>
            </div>
            <div class="drill-down__metric cf-panel" *ngIf="response?.summary as sum">
              <span class="drill-down__metric-label">In this list</span>
              <span class="drill-down__metric-value">{{ listRecordCount(sum) | number }}</span>
              <span class="drill-down__metric-hint">
                <ng-container *ngIf="hasActiveFilters && showFamilyFilters">
                  Filtered from {{ ctx.expected_count | number }} families
                </ng-container>
                <ng-container *ngIf="hasActiveFilters && recordKind === 'payment'">
                  Filtered payments in this slice
                </ng-container>
                <ng-container *ngIf="!hasActiveFilters && !isEmptyKpiOrForecast">
                  Paginated below
                </ng-container>
                <ng-container *ngIf="isEmptyKpiOrForecast">
                  No row list for this KPI or forecast
                </ng-container>
              </span>
            </div>
            <div class="drill-down__metric cf-panel drill-down__metric--date">
              <span class="drill-down__metric-label">As of</span>
              <time
                class="drill-down__metric-value drill-down__metric-value--text"
                [attr.datetime]="ctx.business_date"
              >{{ ctx.business_date | cfDate }}</time>
              <span class="drill-down__metric-hint">{{ ctx.timezone }} · parish business date</span>
            </div>
          </div>

          <div class="cf-inline-alert cf-panel" *ngIf="ctx.diagnostics" role="status">
            <p *ngIf="ctx.diagnostics['record_scope_amount'] != null">
              Record scope remaining: {{ ctx.diagnostics['record_scope_amount'] | cfCurrency }}
            </p>
            <p *ngIf="ctx.diagnostics['residual_formula_amount'] != null">
              Summary formula (pending − overdue): {{ ctx.diagnostics['residual_formula_amount'] | cfCurrency }}
            </p>
          </div>

          <div class="cf-panel drill-down__methodology" *ngIf="ctx.methodology || ctx.point_kind === 'forecast'" role="region" aria-label="Calculation details">
            <p class="drill-down__methodology-banner" *ngIf="ctx.point_kind === 'forecast'">
              Forecast — not collected yet. This projection is not a list of payments.
            </p>
            <ul *ngIf="methodologyLines.length" class="drill-down__methodology-list">
              <li *ngFor="let line of methodologyLines">{{ line }}</li>
            </ul>
          </div>

          <div
            class="cf-filters cf-panel drill-down__toolbar"
            role="region"
            aria-label="Sort records"
            *ngIf="showSortControls && !showPaymentFilters && !showFamilyFilters"
          >
            <div class="drill-down__toolbar-sort" role="group" aria-label="Sort">
              <label class="drill-down__toolbar-control">
                <span class="sr-only">Sort by</span>
                <select
                  [(ngModel)]="sortField"
                  (ngModelChange)="onSortChange()"
                  aria-label="Sort by"
                >
                  <option *ngFor="let s of response?.context?.supported_sorts || []" [value]="s">
                    {{ sortLabel(s) }}
                  </option>
                </select>
              </label>
              <label class="drill-down__toolbar-control">
                <span class="sr-only">Sort direction</span>
                <select
                  [(ngModel)]="sortDirection"
                  (ngModelChange)="onSortChange()"
                  aria-label="Sort direction"
                >
                  <option value="desc">Descending</option>
                  <option value="asc">Ascending</option>
                </select>
              </label>
            </div>
          </div>

          <div
            class="cf-filters cf-panel drill-down__toolbar"
            role="region"
            aria-label="Search, filter, and sort families"
            *ngIf="showFamilyFilters"
          >
            <input
              type="search"
              class="drill-down__toolbar-search"
              [(ngModel)]="search"
              (ngModelChange)="onSearchChange()"
              placeholder="Family name, head, or code…"
              aria-label="Search families"
            />
            <label class="drill-down__toolbar-control">
              <span class="sr-only">Community</span>
              <select
                [(ngModel)]="bccFilter"
                (ngModelChange)="reloadList()"
                aria-label="BCC or community"
              >
                <option value="">All BCC / communities</option>
                <option *ngFor="let bcc of response?.filter_options?.bccs || []" [value]="bcc.id ?? ''">
                  {{ bcc.name }}
                </option>
              </select>
            </label>
            <div
              *ngIf="showSortControls"
              class="drill-down__toolbar-sort"
              role="group"
              aria-label="Sort"
            >
              <label class="drill-down__toolbar-control">
                <span class="sr-only">Sort by</span>
                <select
                  [(ngModel)]="sortField"
                  (ngModelChange)="onSortChange()"
                  aria-label="Sort by"
                >
                  <option *ngFor="let s of response?.context?.supported_sorts || []" [value]="s">
                    {{ sortLabel(s) }}
                  </option>
                </select>
              </label>
              <label class="drill-down__toolbar-control">
                <span class="sr-only">Sort direction</span>
                <select
                  [(ngModel)]="sortDirection"
                  (ngModelChange)="onSortChange()"
                  aria-label="Sort direction"
                >
                  <option value="desc">Descending</option>
                  <option value="asc">Ascending</option>
                </select>
              </label>
            </div>
            <button
              *ngIf="hasActiveFilters"
              type="button"
              class="cf-btn cf-btn--sm drill-down__toolbar-clear"
              (click)="clearFilters()"
            >
              Clear filters
            </button>
          </div>

          <div
            class="cf-filters cf-panel drill-down__toolbar"
            role="region"
            aria-label="Search, filter, and sort payments"
            *ngIf="showPaymentFilters"
          >
            <input
              type="search"
              class="drill-down__toolbar-search"
              [(ngModel)]="search"
              (ngModelChange)="onSearchChange()"
              placeholder="Payer, family, receipt…"
              aria-label="Search payments"
            />
            <label class="drill-down__toolbar-control">
              <span class="sr-only">Method</span>
              <select
                [(ngModel)]="methodFilter"
                (ngModelChange)="reloadList()"
                aria-label="Payment method"
              >
                <option value="">All methods</option>
                <option *ngFor="let m of response?.filter_options?.methods || []" [value]="m.value">
                  {{ m.label }}
                </option>
              </select>
            </label>
            <div
              *ngIf="showSortControls"
              class="drill-down__toolbar-sort"
              role="group"
              aria-label="Sort"
            >
              <label class="drill-down__toolbar-control">
                <span class="sr-only">Sort by</span>
                <select
                  [(ngModel)]="sortField"
                  (ngModelChange)="onSortChange()"
                  aria-label="Sort by"
                >
                  <option *ngFor="let s of response?.context?.supported_sorts || []" [value]="s">
                    {{ sortLabel(s) }}
                  </option>
                </select>
              </label>
              <label class="drill-down__toolbar-control">
                <span class="sr-only">Sort direction</span>
                <select
                  [(ngModel)]="sortDirection"
                  (ngModelChange)="onSortChange()"
                  aria-label="Sort direction"
                >
                  <option value="desc">Descending</option>
                  <option value="asc">Ascending</option>
                </select>
              </label>
            </div>
            <button
              *ngIf="hasActiveFilters"
              type="button"
              class="cf-btn cf-btn--sm drill-down__toolbar-clear"
              (click)="clearFilters()"
            >
              Clear filters
            </button>
          </div>

          <div *ngIf="listLoading" class="cf-loading-block cf-panel" role="status" aria-busy="true">
            <app-cf-brand-loader size="section" label="Refreshing records…" />
          </div>

          <app-data-table *ngIf="!listLoading && paymentRows.length" [ariaBusy]="listLoading">
            <table class="cf-table">
              <thead>
                <tr>
                  <th scope="col">Date</th>
                  <th scope="col">Family</th>
                  <th scope="col">Payer</th>
                  <th scope="col">Method</th>
                  <th scope="col" class="drill-down__money">Amount</th>
                </tr>
              </thead>
              <tbody>
                <tr *ngFor="let row of paymentRows">
                  <td>{{ row.payment_date | cfDate }}</td>
                  <td>
                    <a *ngIf="row.family_id && row.family_name !== 'Anonymous'" [routerLink]="['/families', row.family_id]" class="cf-link">{{ row.family_name }}</a>
                    <span *ngIf="!row.family_id || row.family_name === 'Anonymous'">Anonymous</span>
                  </td>
                  <td>{{ row.payer_name || '—' }}</td>
                  <td>{{ row.method || '—' }}</td>
                  <td class="drill-down__money">{{ row.amount | cfCurrency }}</td>
                </tr>
              </tbody>
            </table>
          </app-data-table>

          <app-data-table *ngIf="!listLoading && projectRows.length" [ariaBusy]="listLoading">
            <table class="cf-table">
              <thead>
                <tr>
                  <th scope="col">Project</th>
                  <th scope="col" class="drill-down__money">Collected</th>
                  <th scope="col" class="drill-down__money">Target</th>
                  <th scope="col">Funded</th>
                </tr>
              </thead>
              <tbody>
                <tr *ngFor="let row of projectRows">
                  <td>
                    <a [routerLink]="['/donations/projects', row.project_id]" class="cf-link">{{ row.name }}</a>
                    <span class="drill-down__code" *ngIf="row.code">{{ row.code }}</span>
                  </td>
                  <td class="drill-down__money">{{ row.collected | cfCurrency }}</td>
                  <td class="drill-down__money">{{ row.target_amount | cfCurrency }}</td>
                  <td>{{ row.funding_percentage | number:'1.0-1' }}%</td>
                </tr>
              </tbody>
            </table>
          </app-data-table>

          <app-data-table *ngIf="!listLoading && rows.length && !paymentRows.length && !projectRows.length" [ariaBusy]="listLoading">
            <table class="cf-table">
              <thead>
                <tr>
                  <th scope="col"></th>
                  <th scope="col">Family</th>
                  <th scope="col">Head</th>
                  <th scope="col">BCC</th>
                  <th scope="col" class="drill-down__money">Outstanding</th>
                  <th scope="col">Oldest due</th>
                  <th scope="col" *ngIf="ctx.slice_id === 'overdue'">Days overdue</th>
                </tr>
              </thead>
              <tbody>
                <ng-container *ngFor="let row of rows">
                  <tr>
                    <td>
                      <button
                        type="button"
                        class="cf-btn cf-btn--sm"
                        (click)="toggleExpand(row)"
                        [attr.aria-expanded]="expandedFamilyId === row.family_id"
                        [attr.aria-label]="expandedFamilyId === row.family_id ? 'Collapse dues' : 'Expand dues'"
                      >
                        {{ expandedFamilyId === row.family_id ? '−' : '+' }}
                      </button>
                    </td>
                    <td>
                      <a [routerLink]="['/families', row.family_id]" class="cf-link">{{ row.family_name }}</a>
                      <span class="drill-down__code" *ngIf="row.family_code">{{ row.family_code }}</span>
                    </td>
                    <td>{{ row.head_of_family || '—' }}</td>
                    <td>{{ row.bcc_name || 'Unassigned Area' }}</td>
                    <td class="drill-down__money">{{ row.outstanding_amount | cfCurrency }}</td>
                    <td>
                    <ng-container *ngIf="row.oldest_due_date; else noOldestDue">{{ row.oldest_due_date | cfDate }}</ng-container>
                    <ng-template #noOldestDue>—</ng-template>
                  </td>
                    <td *ngIf="ctx.slice_id === 'overdue'">{{ row.days_overdue ?? '—' }}</td>
                  </tr>
                  <tr *ngIf="expandedFamilyId === row.family_id">
                    <td [attr.colspan]="ctx.slice_id === 'overdue' ? 7 : 6">
                      <div class="drill-down__expand" *ngIf="expandLoading[row.family_id]">Loading dues…</div>
                      <div class="drill-down__expand" *ngIf="expandError[row.family_id]">{{ expandError[row.family_id] }}</div>
                      <table
                        *ngIf="!expandLoading[row.family_id] && expandedDues[row.family_id]?.length"
                        class="cf-table cf-table--nested"
                      >
                        <thead>
                          <tr>
                            <th>Plan</th>
                            <th>Period</th>
                            <th>Due date</th>
                            <th class="drill-down__money">Outstanding</th>
                            <th>Status</th>
                          </tr>
                        </thead>
                        <tbody>
                          <tr *ngFor="let due of expandedDues[row.family_id]">
                            <td>{{ due.plan?.name || due.plan_id }}</td>
                            <td>{{ due.period_label }}</td>
                            <td>{{ due.due_date | cfDate }}</td>
                            <td class="drill-down__money">
                              {{ (due.outstanding_amount ?? (due.amount_due - due.amount_paid)) | cfCurrency }}
                            </td>
                            <td>
                              <span
                                class="drill-down__pill"
                                [class.drill-down__pill--overdue]="isGraphOverdue(due, ctx.business_date)"
                              >
                                {{ isGraphOverdue(due, ctx.business_date) ? 'Overdue' : due.status }}
                              </span>
                            </td>
                          </tr>
                        </tbody>
                      </table>
                      <p
                        *ngIf="!expandLoading[row.family_id] && expandedDues[row.family_id] && !expandedDues[row.family_id].length"
                        class="cf-state"
                      >
                        No dues in this slice for this family.
                      </p>
                    </td>
                  </tr>
                </ng-container>
              </tbody>
            </table>
          </app-data-table>

          <app-cf-empty-state
            *ngIf="!listLoading && !listError && response && !rows.length && !paymentRows.length && !projectRows.length && !isEmptyKpiOrForecast"
            title="No records match"
            description="Try clearing filters. The chart total above is unchanged."
          />

          <app-pagination
            *ngIf="totalItems > 0 && !isEmptyKpiOrForecast"
            [currentPage]="page"
            [pageSize]="perPage"
            [totalItems]="totalItems"
            [pageSizeOptions]="[10, 20, 50]"
            (pageChange)="onPageChange($event)"
            (pageSizeChange)="onPageSizeChange($event)"
          />
        </div>
      </ng-container>

      <div modalFooter class="drill-down__footer">
        <a
          *ngIf="workspaceLink as link"
          [routerLink]="link.path"
          [queryParams]="link.query"
          class="cf-btn cf-btn--sm"
          (click)="close()"
        >
          Open workspace
        </a>
        <button type="button" class="cf-btn cf-btn--sm" (click)="close()">Close</button>
      </div>
    </app-modal-shell>
  `,
  styles: [`
    .drill-down { display: grid; gap: var(--cf-space-3); }
    .drill-down__metrics {
      display: grid;
      grid-template-columns: repeat(3, minmax(0, 1fr));
      gap: var(--cf-space-2);
    }
    .drill-down__metric {
      display: grid;
      gap: 0.2rem;
      padding: 0.75rem 1rem;
      min-width: 0;
    }
    .drill-down__metric-label {
      font-size: 0.72rem;
      font-weight: 600;
      letter-spacing: 0.04em;
      text-transform: uppercase;
      color: var(--cf-muted);
    }
    .drill-down__metric-value {
      font-size: 1.25rem;
      font-weight: 700;
      line-height: 1.2;
      color: var(--cf-slate-900);
      font-variant-numeric: tabular-nums;
    }
    .drill-down__metric-value--text {
      font-size: 1.05rem;
      font-weight: 600;
    }
    .drill-down__metric-hint {
      font-size: 0.8rem;
      line-height: 1.35;
      color: var(--cf-muted);
    }
    .drill-down__metric--overdue {
      border-color: color-mix(in srgb, var(--cf-critical) 28%, var(--cf-panel-border));
      background: color-mix(in srgb, var(--cf-critical-soft) 55%, var(--cf-panel-bg));
    }
    .drill-down__metric--remaining {
      border-color: color-mix(in srgb, var(--cf-warning, #f59e0b) 35%, var(--cf-panel-border));
      background: color-mix(in srgb, var(--cf-slate-50) 80%, var(--cf-panel-bg));
    }
    .drill-down__toolbar {
      align-items: center;
      padding: var(--cf-space-2) var(--cf-space-3);
    }
    .drill-down__toolbar-search {
      box-sizing: border-box;
      flex: 1 1 var(--cf-toolbar-search-min-width);
      min-width: min(100%, 10rem);
      max-width: 100%;
      min-height: var(--cf-control-height);
      border: 1px solid var(--cf-panel-border);
      border-radius: var(--cf-radius-sm);
      padding: var(--cf-toolbar-control-pad-y) var(--cf-toolbar-control-pad-x);
      background: var(--cf-panel-bg);
      font-size: var(--cf-text-base);
      line-height: 1.25;
    }
    .drill-down__toolbar-control {
      display: inline-flex;
      align-items: center;
      margin: 0;
      flex: 0 1 auto;
      min-width: 0;
    }
    .drill-down__toolbar-control select {
      max-width: 100%;
    }
    .drill-down__toolbar-sort {
      display: inline-flex;
      flex-wrap: wrap;
      align-items: center;
      gap: var(--cf-toolbar-gap);
      flex: 0 1 auto;
      min-width: 0;
    }
    .drill-down__toolbar-clear {
      margin-left: auto;
      flex-shrink: 0;
    }
    @media (max-width: 768px) {
      .drill-down__metrics { grid-template-columns: 1fr; }
      .drill-down__toolbar-search {
        flex: 1 1 100%;
      }
      .drill-down__toolbar-sort {
        flex: 1 1 100%;
      }
      .drill-down__toolbar-clear {
        margin-left: 0;
        width: 100%;
      }
    }
    .drill-down__money { text-align: right; }
    .drill-down__code { display: block; font-size: 0.78rem; color: var(--cf-muted); }
    .drill-down__expand { padding: 0.5rem 0 0.75rem 1.5rem; }
    .drill-down__pill { display: inline-block; padding: 0.1rem 0.45rem; border-radius: 999px; background: var(--cf-slate-100); font-size: 0.78rem; }
    .drill-down__pill--overdue { background: var(--cf-critical-soft); color: var(--cf-critical); }
    .drill-down__footer { display: flex; flex-wrap: wrap; gap: 0.5rem; justify-content: flex-end; width: 100%; }
    .drill-down__methodology { padding: 0.75rem 1rem; }
    .drill-down__methodology-banner {
      margin: 0 0 0.5rem;
      font-weight: 600;
      color: var(--cf-amber-700, #b45309);
    }
    .drill-down__methodology-list {
      margin: 0;
      padding-left: 1.1rem;
      font-size: 0.85rem;
      line-height: 1.45;
      color: var(--cf-slate-700);
    }
    .drill-down__methodology-list li { margin-bottom: 0.25rem; }
  `]
})
export class ReportDrillDownModalComponent implements OnInit, OnChanges, OnDestroy {
  private readonly donationsService = inject(DonationsService);
  private readonly cdr = inject(ChangeDetectorRef);

  @Input({ required: true }) request!: ReportDrillDownRequestPayload;
  @Output() closeRequested = new EventEmitter<void>();

  response: ReportDrillDownResponse | null = null;
  rows: ReportDrillDownFamilyRow[] = [];
  paymentRows: ReportDrillDownPaymentRow[] = [];
  projectRows: ReportDrillDownProjectRow[] = [];
  listLoading = false;
  listError: string | null = null;
  search = '';
  bccFilter = '';
  methodFilter = '';
  sortField = '';
  sortDirection: 'asc' | 'desc' = 'desc';
  page = 1;
  perPage = 20;
  totalItems = 0;

  expandedFamilyId: string | null = null;
  expandedDues: Record<string, ContributionDue[]> = {};
  expandLoading: Record<string, boolean> = {};
  expandError: Record<string, string> = {};
  private expandSubs: Record<string, Subscription> = {};

  private readonly search$ = new Subject<string>();
  private readonly reloadTrigger$ = new Subject<{ resetPage?: boolean }>();
  private listSub?: Subscription;

  get modalTitle(): string {
    return this.response?.context?.title ?? 'Report details';
  }

  get modalDescription(): string {
    const why = this.response?.context?.why_this_number;
    return why ?? 'Loading details from parish records…';
  }

  get recordKind(): string {
    return this.response?.context?.record_kind ?? 'family';
  }

  get showFamilyFilters(): boolean {
    return this.recordKind === 'family';
  }

  get showPaymentFilters(): boolean {
    return this.recordKind === 'payment';
  }

  get isEmptyKpiOrForecast(): boolean {
    const ctx = this.response?.context;
    return ctx?.point_kind === 'forecast' || (ctx?.point_kind === 'kpi' && ctx?.record_kind === 'none');
  }

  get hasActiveFilters(): boolean {
    return Boolean(this.search.trim() || this.bccFilter || this.methodFilter);
  }

  get showSortControls(): boolean {
    const sorts = this.response?.context?.supported_sorts ?? [];
    return sorts.length > 0 && !this.isEmptyKpiOrForecast && this.recordKind !== 'none';
  }

  get methodologyLines(): string[] {
    return formatReportDrillDownMethodology(
      this.response?.context?.methodology ?? null,
      this.response?.context?.point_kind
    );
  }

  sortLabel(field: string): string {
    return field.replace(/_/g, ' ').replace(/\b\w/g, (c) => c.toUpperCase());
  }

  onSortChange(): void {
    this.page = 1;
    this.reloadList();
  }

  listRecordCount(sum: ReportDrillDownResponse['summary']): number {
    return sum.record_count ?? sum.family_count ?? 0;
  }

  ngOnInit(): void {
    const { sort, direction } = this.defaultListSort();
    this.sortField = sort;
    this.sortDirection = direction as 'asc' | 'desc';

    this.listSub = merge(
      this.reloadTrigger$.pipe(map((opts) => ({ resetPage: opts.resetPage ?? false }))),
      this.search$.pipe(
        debounceTime(300),
        distinctUntilChanged(),
        map(() => ({ resetPage: true }))
      )
    )
      .pipe(
        switchMap(({ resetPage }) => {
          if (resetPage) {
            this.page = 1;
          }
          this.listLoading = true;
          this.listError = null;
          this.cdr.markForCheck();
          return this.fetchList().pipe(
            finalize(() => {
              this.listLoading = false;
              this.cdr.markForCheck();
            })
          );
        })
      )
      .subscribe({
        next: (res) => this.applyListResponse(res),
        error: (err) => this.handleListError(err)
      });

    this.reloadTrigger$.next({});
  }

  ngOnChanges(changes: SimpleChanges): void {
    if (changes['request'] && !changes['request'].firstChange) {
      this.rows = [];
      this.paymentRows = [];
      this.projectRows = [];
      this.resetState();
      const { sort, direction } = this.defaultListSort();
      this.sortField = sort;
      this.sortDirection = direction as 'asc' | 'desc';
      this.reloadTrigger$.next({ resetPage: true });
    }
  }

  ngOnDestroy(): void {
    this.listSub?.unsubscribe();
    Object.values(this.expandSubs).forEach((s) => s.unsubscribe());
  }

  onSearchChange(): void {
    this.search$.next(this.search.trim());
  }

  clearFilters(): void {
    this.search = '';
    this.bccFilter = '';
    this.methodFilter = '';
    this.page = 1;
    this.reloadList();
  }

  private sliceLabel(sliceId: string | undefined): string {
    switch (sliceId) {
      case 'overdue':
        return 'Overdue';
      case 'remaining_collectable':
        return 'Remaining collectable';
      case 'total_outstanding':
        return 'Total outstanding';
      default:
        return 'Report details';
    }
  }

  reloadList(): void {
    this.expandedFamilyId = null;
    this.reloadTrigger$.next({});
  }

  onPageChange(page: number): void {
    this.page = page;
    this.reloadList();
  }

  onPageSizeChange(size: number): void {
    this.perPage = size;
    this.page = 1;
    this.reloadList();
  }

  toggleExpand(row: ReportDrillDownFamilyRow): void {
    if (this.expandedFamilyId === row.family_id) {
      this.expandedFamilyId = null;
      this.cdr.markForCheck();
      return;
    }
    this.expandedFamilyId = row.family_id;
    this.loadDuesForFamily(row.family_id);
    this.cdr.markForCheck();
  }

  close(): void {
    this.closeRequested.emit();
  }

  isGraphOverdue(due: ContributionDue, businessDate: string): boolean {
    if (!due.due_date) {
      return false;
    }
    const dueDay = String(due.due_date).slice(0, 10);
    return dueDay < businessDate;
  }

  get workspaceLink(): { path: string; query: Record<string, string> } | null {
    const ctx = this.response?.context;
    if (!ctx) {
      return null;
    }
    return {
      path: ctx.workspace_path || '/donations/dues',
      query: ctx.workspace_query || {}
    };
  }

  private resetState(): void {
    this.response = null;
    this.rows = [];
    this.paymentRows = [];
    this.projectRows = [];
    this.search = '';
    this.bccFilter = '';
    this.methodFilter = '';
    this.page = 1;
    this.listError = null;
    this.expandedFamilyId = null;
    this.expandedDues = {};
  }

  private defaultListSort(): { sort: string; direction: string } {
    switch (this.request.graph_id) {
      case 'collections':
      case 'collection_trend':
      case 'month_end_forecast':
        return { sort: 'payment_date', direction: 'desc' };
      case 'collection_snapshot':
        return { sort: 'expected', direction: 'desc' };
      case 'family_participation':
        return { sort: 'family_name', direction: 'asc' };
      case 'financial_health':
        return this.defaultFinancialHealthListSort();
      default:
        return { sort: 'outstanding_amount', direction: 'desc' };
    }
  }

  private defaultFinancialHealthListSort(): { sort: string; direction: string } {
    const slice = this.request.slice_id;
    const element = this.request.data_element_id;
    if (slice === 'family_engagement' || element === 'family_engagement') {
      return { sort: 'family_name', direction: 'asc' };
    }
    if (slice === 'project_funding' || element === 'project_funding') {
      return { sort: 'funding_percentage', direction: 'desc' };
    }
    if (slice === 'overdue_health' || element === 'overdue_health') {
      return { sort: 'outstanding_amount', direction: 'desc' };
    }
    return { sort: 'family_name', direction: 'asc' };
  }

  private fetchList() {
    const sort = this.sortField || this.defaultListSort().sort;
    const direction = this.sortDirection || this.defaultListSort().direction;
    return this.donationsService.getReportDrillDown({
      graph_id: this.request.graph_id,
      data_element_id: this.request.data_element_id,
      slice_id: this.request.slice_id,
      search: this.search.trim() || undefined,
      page: this.page,
      per_page: this.perPage,
      bcc_id: this.bccFilter || this.request.bcc_id || undefined,
      project_id: this.request.project_id || undefined,
      method: this.methodFilter || undefined,
      sort,
      direction,
      preset: this.request.preset,
      date_from: this.request.date_from,
      date_to: this.request.date_to
    });
  }

  private applyListResponse(res: { success: boolean; data: ReportDrillDownResponse }): void {
    const payload = res?.data;
    if (!payload?.context || !payload?.data) {
      this.listError = 'Unexpected response from the server. Try again.';
      this.cdr.markForCheck();
      return;
    }

    this.response = payload;
    const recordKind = payload.context.record_kind ?? 'family';
    const rawRows = payload.data.data ?? [];
    if (recordKind === 'payment') {
      this.paymentRows = rawRows as ReportDrillDownPaymentRow[];
      this.rows = [];
      this.projectRows = [];
    } else if (recordKind === 'project') {
      this.projectRows = rawRows as ReportDrillDownProjectRow[];
      this.rows = [];
      this.paymentRows = [];
    } else {
      this.rows = rawRows as ReportDrillDownFamilyRow[];
      this.paymentRows = [];
      this.projectRows = [];
    }
    this.totalItems = payload.data.total ?? 0;
    this.page = payload.data.current_page ?? this.page;
    this.perPage = payload.data.per_page ?? this.perPage;
    this.listError = null;
    this.cdr.markForCheck();
  }

  private handleListError(err: unknown): void {
    this.listError = this.formatHttpError(err);
    this.cdr.markForCheck();
  }

  private formatHttpError(err: unknown): string {
    const http = err as HttpErrorResponse;
    const body = http?.error;
    if (body && typeof body === 'object' && body.errors) {
      const firstKey = Object.keys(body.errors)[0];
      const messages = body.errors[firstKey];
      if (Array.isArray(messages) && messages[0]) {
        return String(messages[0]);
      }
    }
    if (body?.message && typeof body.message === 'string') {
      return body.message;
    }
    return 'Could not load drill-down records.';
  }

  private loadDuesForFamily(familyId: string): void {
    const sliceId = this.request.slice_id;
    const filters: Record<string, string | boolean> = {
      family_id: familyId,
      per_page: '50'
    };
    if (sliceId === 'overdue') {
      filters['overdue_only'] = true;
    } else if (sliceId === 'remaining_collectable') {
      filters['remaining_only'] = true;
    } else {
      filters['actionable'] = true;
    }

    this.expandSubs[familyId]?.unsubscribe();
    this.expandLoading[familyId] = true;
    this.expandError[familyId] = '';
    this.cdr.markForCheck();

    this.expandSubs[familyId] = this.donationsService.getDues(filters).subscribe({
      next: (res) => {
        this.expandedDues[familyId] = res.data?.data || [];
        this.expandLoading[familyId] = false;
        this.cdr.markForCheck();
      },
      error: () => {
        this.expandError[familyId] = 'Could not load dues for this family.';
        this.expandLoading[familyId] = false;
        this.cdr.markForCheck();
      }
    });
  }
}
