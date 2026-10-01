import { CommonModule } from '@angular/common';
import {
  ChangeDetectionStrategy,
  ChangeDetectorRef,
  Component,
  DestroyRef,
  OnInit,
  inject
} from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { ActivatedRoute, ParamMap, Router, RouterModule } from '@angular/router';
import { Subject, of } from 'rxjs';
import { catchError, switchMap } from 'rxjs/operators';
import { CfEmptyStateComponent } from '@shared/components/cf-empty-state/cf-empty-state.component';
import { LoadingSkeletonComponent } from '@shared/components/loading-skeleton/loading-skeleton.component';
import { CfBrandLoaderComponent } from '@shared/components/cf-brand-loader/cf-brand-loader.component';
import { PageHeaderComponent } from '@shared/components/page-header/page-header.component';
import { CfCurrencyPipe } from '@shared/pipes/cf-currency.pipe';
import { CfActionIconComponent } from '@shared/components/cf-action-icon/cf-action-icon.component';
import { EntitlementService } from '@core/services/entitlement.service';
import { DashboardCollectedTrendComponent } from '../dashboard/dashboard-collected-trend.component';
import {
  DashboardDateRangeComponent,
  DashboardDateRangeValue,
  DashboardPeriodPreset
} from '../dashboard/dashboard-date-range.component';
import { DonationsDashboardFilterDrawerComponent } from '../dashboard/donations-dashboard-filter-drawer.component';
import {
  CollectionTrendPoint,
  DonationDashboardDateQuery,
  DonationDashboardSnapshot,
  DonationDashboardSummary,
  ExecutiveReportSummary,
  ReportDrillDownRequestPayload
} from '../models/donation.model';
import { DonationsService } from '../services/donations.service';
import { QuickCollectService } from '../services/quick-collect.service';
import { ExecutiveSummaryVisualsComponent } from './reports/executive-summary-visuals.component';
import { ReportDrillDownModalComponent } from './reports/report-drill-down-modal.component';

interface MixRow {
  key: string;
  label: string;
  amount: number;
}

interface DashboardActiveFilterChip {
  key: 'ytd' | 'custom' | 'bcc' | 'project';
  label: string;
  removeAriaLabel: string;
}

@Component({
  selector: 'app-donations-dashboard',
  standalone: true,
  imports: [
    CommonModule,
    RouterModule,
    PageHeaderComponent,
    CfCurrencyPipe,
    CfActionIconComponent,
    CfEmptyStateComponent,
    LoadingSkeletonComponent,
    CfBrandLoaderComponent,
    DashboardCollectedTrendComponent,
    DashboardDateRangeComponent,
    DonationsDashboardFilterDrawerComponent,
    ExecutiveSummaryVisualsComponent,
    ReportDrillDownModalComponent
  ],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <section class="donations-dashboard cf-page cf-financial-dashboard" [attr.aria-busy]="loading">
      <app-page-header
        title="Financial Dashboard"
        [subtitle]="pageSubtitle"
      >
        <app-dashboard-date-range
          [preset]="activePreset"
          (rangeChange)="onRangeChange($event)"
        />
        <button
          type="button"
          class="cf-btn cf-btn-icon dashboard-header__filters"
          (click)="openFilters()"
          aria-label="Filters"
          title="Filters"
        >
          <app-cf-action-icon name="filter" />
          <span *ngIf="dashboardFilterCount > 0" class="dashboard-header__filter-badge">{{ dashboardFilterCount }}</span>
        </button>
        <button
          type="button"
          class="cf-btn cf-btn-icon cf-btn-primary"
          (click)="openQuickCollect()"
          aria-label="Quick Collect"
          title="Quick Collect"
        >
          <app-cf-action-icon name="collect-payment" />
        </button>
        <button
          type="button"
          class="cf-btn cf-btn-icon"
          (click)="reload()"
          aria-label="Refresh"
          title="Refresh"
        >
          <app-cf-action-icon name="refresh" />
        </button>
      </app-page-header>

      <div
        class="dashboard-active-filters"
        *ngIf="activeFilterChips.length"
        role="region"
        aria-label="Active filters"
      >
        <span class="cf-meta">Active filters</span>
        <div class="dashboard-active-filters__list">
          <span class="cf-badge cf-badge--info" *ngFor="let chip of activeFilterChips">
            {{ chip.label }}
            <button
              type="button"
              class="dashboard-active-filters__remove"
              (click)="removeActiveFilter(chip)"
              [attr.aria-label]="chip.removeAriaLabel"
            >
              ×
            </button>
          </span>
        </div>
      </div>

      <app-donations-dashboard-filter-drawer
        [isOpen]="filtersOpen"
        [appliedPreset]="activePreset"
        [appliedCustomFrom]="customFrom"
        [appliedCustomTo]="customTo"
        [appliedBccId]="activeBccId"
        [appliedBccName]="activeBccName"
        [appliedProjectId]="activeProjectId"
        [appliedProjectName]="activeProjectName"
        (close)="closeFilters()"
        (apply)="onRangeChange($event)"
        (reset)="onFilterReset()"
      />

      <div *ngIf="loading && !summary" class="cf-loading-block cf-panel" role="status" aria-live="polite">
        <app-loading-skeleton label="Loading financial dashboard…" type="card" [rows]="1"></app-loading-skeleton>
        <app-loading-skeleton [showBrandHeader]="false" type="rectangle" [rows]="3"></app-loading-skeleton>
      </div>

      <div *ngIf="error" class="cf-inline-alert cf-panel" role="alert">
        {{ error }}
      </div>

      <ng-container *ngIf="snapshot as snap">
        <div class="cf-kpi-strip" aria-label="Financial snapshot">
          <a
            class="cf-kpi-card--executive dashboard-kpi dashboard-kpi--collected-month"
            routerLink="payments"
            [queryParams]="monthPaymentQuery"
            title="Succeeded payments in the selected date range."
            [attr.aria-label]="collectedPeriodAriaLabel"
          >
            <span class="dashboard-kpi-collected__head">
              <span class="dashboard-kpi-collected__icon" aria-hidden="true">
                <app-cf-action-icon name="wallet" />
              </span>
              <span class="cf-kpi-card__label dashboard-kpi-collected__label">{{ collectedPeriodLabel }}</span>
            </span>
            <strong class="cf-kpi-card__value dashboard-kpi-collected__value">{{ snap.month.collected | cfCurrency }}</strong>
            <span class="dashboard-kpi-collected__hint">{{ collectedPeriodHint }}</span>
            <span
              class="dashboard-kpi__compare dashboard-kpi-collected__compare"
              [class.cf-kpi-card__trend--up]="growthDirection === 'up'"
              [class.cf-kpi-card__trend--down]="growthDirection === 'down'"
              [class.dashboard-kpi-collected__compare--neutral]="growthDirection === 'flat' || growthDirection === 'none'"
            >
              {{ monthComparison }}
            </span>
          </a>

          <a
            class="cf-kpi-card--executive dashboard-kpi dashboard-kpi--collected-fy"
            routerLink="payments"
            [queryParams]="comparisonPaymentQuery"
            [title]="comparisonCardTitle"
            [attr.aria-label]="comparisonCardAriaLabel"
          >
            <span class="dashboard-kpi-collected__head">
              <span class="dashboard-kpi-collected__icon" aria-hidden="true">
                <app-cf-action-icon name="collect-payment" />
              </span>
              <span class="cf-kpi-card__label dashboard-kpi-collected__label">{{ comparisonPeriodLabel }}</span>
            </span>
            <strong class="cf-kpi-card__value dashboard-kpi-collected__value">{{ snap.month.comparison_collected | cfCurrency }}</strong>
            <span class="dashboard-kpi-collected__hint">{{ comparisonPeriodHint }}</span>
          </a>

          <a
            class="cf-kpi-card--executive dashboard-kpi dashboard-kpi--outstanding"
            routerLink="dues"
            [title]="outstandingKpiTitle"
          >
            <span class="dashboard-kpi-outstanding__head">
              <span class="dashboard-kpi-outstanding__icon" aria-hidden="true">
                <app-cf-action-icon name="clipboard-list" />
              </span>
              <span class="cf-kpi-card__label dashboard-kpi-outstanding__label">Outstanding contributions</span>
            </span>
            <strong class="cf-kpi-card__value dashboard-kpi-outstanding__value">{{ snap.outstanding_contributions | cfCurrency }}</strong>
            <span class="dashboard-kpi-outstanding__hint">Collectable open balances</span>
            <span class="dashboard-badge cf-health--attention">Collectable</span>
          </a>

          <a
            class="cf-kpi-card--executive dashboard-kpi dashboard-kpi--overdue"
            routerLink="dues"
            [queryParams]="duesOverdueQuery"
            title="Open contribution dues with a due date before the range end date."
          >
            <span class="dashboard-kpi-overdue__head">
              <span class="dashboard-kpi-overdue__icon" aria-hidden="true">
                <app-cf-action-icon name="calendar-clock" />
              </span>
              <span class="cf-kpi-card__label dashboard-kpi-overdue__label">Overdue</span>
            </span>
            <strong class="cf-kpi-card__value dashboard-kpi-overdue__value">{{ snap.overdue_amount | cfCurrency }}</strong>
            <span class="dashboard-kpi-overdue__hint">Past due date</span>
            <span class="dashboard-badge cf-health--risk">Overdue</span>
            <span class="dashboard-kpi-overdue__meta cf-meta">{{ familyCountLabel(snap.overdue_families) }}</span>
          </a>

          <a
            class="cf-kpi-card--executive dashboard-kpi dashboard-kpi--participation"
            routerLink="reports"
            [queryParams]="{ report: 'participation' }"
            [title]="participationTitle"
          >
            <span class="dashboard-kpi-participation__head">
              <span class="dashboard-kpi-participation__icon" aria-hidden="true">
                <app-cf-action-icon name="users" />
              </span>
              <span class="cf-kpi-card__label dashboard-kpi-participation__label">Family participation</span>
            </span>
            <strong class="cf-kpi-card__value dashboard-kpi-participation__value">{{ snap.participation.rate | number:'1.1-1' }}%</strong>
            <span class="dashboard-kpi-participation__hint">
              {{ snap.participation.participating | number }} of {{ snap.participation.active | number }} active families
            </span>
            <span
              class="dashboard-kpi-participation__compare"
              [class.dashboard-kpi-participation__compare--up]="participationDelta > 0"
              [class.dashboard-kpi-participation__compare--down]="participationDelta < 0"
              [class.dashboard-kpi-participation__compare--neutral]="participationDelta === 0"
            >{{ participationChange }}</span>
          </a>
        </div>

        <div
          *ngIf="advancedReports && executiveLoading && !executiveSummary"
          class="cf-loading-block cf-panel"
          role="status"
          aria-live="polite"
        >
          <app-cf-brand-loader size="section" label="Loading stewardship overview…" />
        </div>

        <div *ngIf="advancedReports && executiveError" class="cf-inline-alert cf-panel" role="alert">
          {{ executiveError }}
          <button type="button" class="cf-btn cf-btn--sm" (click)="loadExecutiveSummary()">Try again</button>
        </div>

        <app-executive-summary-visuals
          *ngIf="advancedReports && executiveSummary?.visuals && !executiveLoading"
          [summary]="executiveSummary!"
          visualScope="dashboard"
          (drillDownRequested)="openDrillDown($event)"
        />

        <app-report-drill-down-modal
          *ngIf="drillDownRequest"
          [request]="drillDownRequest"
          (closeRequested)="closeDrillDown()"
        />

        <div class="dashboard-split dashboard-split--trend">
          <section class="cf-panel" aria-labelledby="collection-trend-heading">
            <h2 id="collection-trend-heading" class="cf-section-title">Collection</h2>
            <p class="cf-meta">Succeeded payments in the selected range, grouped by month.</p>
            <ul class="sr-only" *ngIf="hasCollections">
              <li *ngFor="let row of collectionTrend">{{ row.is_current ? row.label + ' month to date' : row.label }} {{ row.collected | cfCurrency }}</li>
            </ul>
            <app-dashboard-collected-trend
              *ngIf="hasCollections"
              [points]="collectionTrend"
              [chartAriaLabel]="collectionTrendAriaLabel"
              (monthSelected)="openTrendMonth($event)"
            ></app-dashboard-collected-trend>
            <app-cf-empty-state
              *ngIf="!hasCollections"
              title="No collections yet"
              description="Succeeded payments will appear here by month."
              [hasActions]="false"
            ></app-cf-empty-state>
          </section>

          <section class="cf-panel" aria-labelledby="giving-mix-heading">
            <h2 id="giving-mix-heading" class="cf-section-title">Giving mix</h2>
            <p class="cf-meta">Where succeeded payments in this period were allocated. Unallocated payments are shown separately.</p>
            <ng-container *ngIf="showMix; else mixHidden">
              <p class="dashboard-mix__single" *ngIf="mixRows.length === 1">
                <span>{{ mixRows[0].label }}</span>
                <strong>{{ mixRows[0].amount | cfCurrency }}</strong>
              </p>
              <ul class="dashboard-mix" *ngIf="mixRows.length > 1">
                <li *ngFor="let row of mixRows">
                  <span class="dashboard-mix__label">{{ row.label }}</span>
                  <span class="dashboard-mix__track" aria-hidden="true">
                    <span class="dashboard-mix__bar" [style.width.%]="mixWidth(row.amount)"></span>
                  </span>
                  <strong>{{ row.amount | cfCurrency }}</strong>
                </li>
              </ul>
              <a class="dashboard-link" routerLink="payments" [queryParams]="monthPaymentQuery">View payments in this period</a>
            </ng-container>
            <ng-template #mixHidden>
              <p class="cf-meta" *ngIf="snap.month.collected > 0 && !snap.giving_mix.reconciled">Giving mix is hidden because the allocation totals do not match collections in this period.</p>
              <p class="cf-meta" *ngIf="snap.month.collected === 0">No succeeded payments in this period yet.</p>
            </ng-template>
          </section>
        </div>

        <nav class="dashboard-footer" aria-label="Financial shortcuts">
          <a routerLink="plans">Contribution Plans</a>
          <a routerLink="dues">Outstanding Dues</a>
          <a routerLink="projects">Projects</a>
          <a routerLink="register">Offerings</a>
          <a routerLink="payments">Payments</a>
          <a routerLink="reports">Reports</a>
          <a routerLink="settings">Settings</a>
        </nav>
      </ng-container>
    </section>
  `,
  styles: [`
    .donations-dashboard { display: grid; gap: 0.65rem; }
    .dashboard-header__filters {
      position: relative;
      display: inline-flex;
      align-items: center;
    }
    .dashboard-header__filter-badge {
      position: absolute;
      top: -0.2rem;
      right: -0.2rem;
      display: inline-flex;
      align-items: center;
      justify-content: center;
      min-width: 1.15rem;
      height: 1.15rem;
      padding: 0 0.25rem;
      border-radius: var(--cf-radius-pill);
      background: var(--cf-primary);
      color: #fff;
      font-size: var(--cf-text-xs, 0.68rem);
      font-weight: 600;
      line-height: 1;
    }
    .dashboard-active-filters {
      display: flex;
      flex-wrap: wrap;
      align-items: center;
      gap: var(--cf-space-2);
    }
    .dashboard-active-filters__list {
      display: flex;
      flex-wrap: wrap;
      gap: var(--cf-space-1);
      align-items: center;
      flex: 1;
      min-width: 0;
    }
    .dashboard-active-filters__remove {
      margin-left: 0.25rem;
      border: 0;
      background: transparent;
      color: inherit;
      cursor: pointer;
      font-size: 1rem;
      line-height: 1;
      padding: 0 0.1rem;
    }
    .dashboard-kpi {
      color: inherit;
      text-decoration: none;
      min-height: 44px;
    }
    .dashboard-kpi:focus-visible {
      outline: var(--cf-focus-ring-width) solid var(--cf-focus-ring);
      outline-offset: var(--cf-focus-ring-offset);
    }
    .dashboard-kpi--collected-month,
    .dashboard-kpi--collected-fy {
      position: relative;
      border-color: color-mix(in srgb, var(--cf-forest) 28%, var(--cf-panel-border));
      background: linear-gradient(
        145deg,
        color-mix(in srgb, var(--cf-forest-soft) 92%, var(--cf-panel-bg)) 0%,
        var(--cf-panel-bg) 72%
      );
      box-shadow: var(--cf-shadow-xs);
      min-width: 10.5rem;
      padding: 0.75rem 0.85rem;
    }
    .dashboard-kpi-collected__head {
      display: flex;
      align-items: center;
      gap: 0.45rem;
      min-width: 0;
    }
    .dashboard-kpi-collected__icon {
      display: inline-flex;
      align-items: center;
      justify-content: center;
      flex-shrink: 0;
      width: 1.75rem;
      height: 1.75rem;
      border-radius: var(--cf-radius-pill);
      background: color-mix(in srgb, var(--cf-forest) 14%, var(--cf-forest-soft));
      color: var(--cf-forest);
    }
    .dashboard-kpi-collected__icon .cf-action-icon {
      width: 1rem;
      height: 1rem;
    }
    .dashboard-kpi-collected__label {
      color: var(--cf-forest);
      font-weight: 600;
      letter-spacing: 0.01em;
    }
    .dashboard-kpi-collected__value {
      margin-top: 0.35rem;
      font-size: clamp(1.45rem, 2.8vw, 1.65rem);
      font-weight: 700;
      line-height: 1.05;
      color: var(--cf-color-success);
    }
    .dashboard-kpi-collected__hint {
      display: block;
      margin-top: 0.2rem;
      font-size: 0.72rem;
      line-height: 1.35;
      color: color-mix(in srgb, var(--cf-forest) 55%, var(--cf-muted));
    }
    .dashboard-kpi__compare { display: block; margin-top: 0.35rem; }
    .dashboard-kpi-collected__compare {
      font-size: 0.72rem;
      line-height: 1.35;
      color: color-mix(in srgb, var(--cf-forest) 40%, var(--cf-muted));
    }
      .dashboard-kpi-collected__compare--neutral {
        display: inline-block;
        margin-top: 0.35rem;
        padding: 0.1rem 0.4rem;
        border-radius: 999px;
        background: color-mix(in srgb, var(--cf-forest-soft) 65%, var(--cf-panel-bg));
        color: color-mix(in srgb, var(--cf-forest) 70%, var(--cf-slate-700));
      }
    .dashboard-kpi--outstanding,
    .dashboard-kpi--overdue {
      position: relative;
      box-shadow: var(--cf-shadow-xs);
      min-width: 10.5rem;
      padding: 0.75rem 0.85rem;
    }
    .dashboard-kpi--outstanding {
      border-color: color-mix(in srgb, var(--cf-amber) 32%, var(--cf-panel-border));
      background: linear-gradient(
        145deg,
        color-mix(in srgb, var(--cf-amber-soft) 92%, var(--cf-panel-bg)) 0%,
        var(--cf-panel-bg) 72%
      );
    }
    .dashboard-kpi--overdue {
      border-color: color-mix(in srgb, var(--cf-critical) 32%, var(--cf-panel-border));
      background: linear-gradient(
        145deg,
        color-mix(in srgb, var(--cf-critical-soft) 92%, var(--cf-panel-bg)) 0%,
        var(--cf-panel-bg) 72%
      );
    }
    .dashboard-kpi-outstanding__head,
    .dashboard-kpi-overdue__head {
      display: flex;
      align-items: center;
      gap: 0.45rem;
      min-width: 0;
    }
    .dashboard-kpi-outstanding__icon,
    .dashboard-kpi-overdue__icon {
      display: inline-flex;
      align-items: center;
      justify-content: center;
      flex-shrink: 0;
      width: 1.75rem;
      height: 1.75rem;
      border-radius: var(--cf-radius-pill);
    }
    .dashboard-kpi-outstanding__icon {
      background: color-mix(in srgb, var(--cf-amber) 16%, var(--cf-amber-soft));
      color: var(--cf-amber);
    }
    .dashboard-kpi-overdue__icon {
      background: color-mix(in srgb, var(--cf-critical) 14%, var(--cf-critical-soft));
      color: var(--cf-critical);
    }
    .dashboard-kpi-outstanding__icon .cf-action-icon,
    .dashboard-kpi-overdue__icon .cf-action-icon {
      width: 1rem;
      height: 1rem;
    }
    .dashboard-kpi-outstanding__label {
      color: var(--cf-amber);
      font-weight: 600;
      letter-spacing: 0.01em;
    }
    .dashboard-kpi-overdue__label {
      color: var(--cf-critical);
      font-weight: 600;
      letter-spacing: 0.01em;
    }
    .dashboard-kpi-outstanding__value {
      margin-top: 0.35rem;
      font-size: clamp(1.45rem, 2.8vw, 1.65rem);
      font-weight: 700;
      line-height: 1.05;
      color: var(--cf-color-warning);
    }
    .dashboard-kpi-overdue__value {
      margin-top: 0.35rem;
      font-size: clamp(1.45rem, 2.8vw, 1.65rem);
      font-weight: 700;
      line-height: 1.05;
      color: var(--cf-color-danger);
    }
    .dashboard-kpi-outstanding__hint,
    .dashboard-kpi-overdue__hint {
      display: block;
      margin-top: 0.2rem;
      font-size: 0.72rem;
      line-height: 1.35;
    }
    .dashboard-kpi-outstanding__hint {
      color: color-mix(in srgb, var(--cf-amber) 55%, var(--cf-muted));
    }
    .dashboard-kpi-overdue__hint {
      color: color-mix(in srgb, var(--cf-critical) 50%, var(--cf-muted));
    }
    .dashboard-kpi-overdue__meta {
      display: block;
      margin-top: 0.15rem;
      color: color-mix(in srgb, var(--cf-critical) 45%, var(--cf-muted));
    }
    .dashboard-kpi--participation {
      position: relative;
      border-color: color-mix(in srgb, var(--cf-indigo) 32%, var(--cf-panel-border));
      background: linear-gradient(
        145deg,
        color-mix(in srgb, var(--cf-indigo-soft) 92%, var(--cf-panel-bg)) 0%,
        var(--cf-panel-bg) 72%
      );
      box-shadow: var(--cf-shadow-xs);
      min-width: 10.5rem;
      padding: 0.75rem 0.85rem;
    }
    .dashboard-kpi-participation__head {
      display: flex;
      align-items: center;
      gap: 0.45rem;
      min-width: 0;
    }
    .dashboard-kpi-participation__icon {
      display: inline-flex;
      align-items: center;
      justify-content: center;
      flex-shrink: 0;
      width: 1.75rem;
      height: 1.75rem;
      border-radius: var(--cf-radius-pill);
      background: color-mix(in srgb, var(--cf-indigo) 14%, var(--cf-indigo-soft));
      color: var(--cf-indigo);
    }
    .dashboard-kpi-participation__icon .cf-action-icon {
      width: 1rem;
      height: 1rem;
    }
    .dashboard-kpi-participation__label {
      color: var(--cf-indigo);
      font-weight: 600;
      letter-spacing: 0.01em;
    }
    .dashboard-kpi-participation__value {
      margin-top: 0.35rem;
      font-size: clamp(1.45rem, 2.8vw, 1.65rem);
      font-weight: 700;
      line-height: 1.05;
      color: var(--cf-indigo);
    }
    .dashboard-kpi-participation__hint {
      display: block;
      margin-top: 0.2rem;
      font-size: 0.72rem;
      line-height: 1.35;
      color: color-mix(in srgb, var(--cf-indigo) 50%, var(--cf-muted));
    }
    .dashboard-kpi-participation__compare {
      display: inline-block;
      margin-top: 0.35rem;
      padding: 0.1rem 0.4rem;
      border-radius: 999px;
      font-size: 0.72rem;
      line-height: 1.35;
      font-weight: 600;
    }
    .dashboard-kpi-participation__compare--up {
      background: color-mix(in srgb, var(--cf-forest-soft) 75%, var(--cf-panel-bg));
      color: var(--cf-forest);
    }
    .dashboard-kpi-participation__compare--down {
      background: color-mix(in srgb, var(--cf-critical-soft) 75%, var(--cf-panel-bg));
      color: var(--cf-critical);
    }
    .dashboard-kpi-participation__compare--neutral {
      background: color-mix(in srgb, var(--cf-indigo-soft) 65%, var(--cf-panel-bg));
      color: color-mix(in srgb, var(--cf-indigo) 70%, var(--cf-slate-700));
    }
    @media (prefers-color-scheme: dark) {
      .dashboard-kpi--collected-month,
      .dashboard-kpi--collected-fy {
        border-color: color-mix(in srgb, var(--cf-forest) 42%, var(--cf-panel-border));
        background: linear-gradient(
          145deg,
          color-mix(in srgb, var(--cf-forest) 22%, var(--cf-panel-bg)) 0%,
          var(--cf-panel-bg) 78%
        );
        box-shadow: none;
      }
      .dashboard-kpi-collected__icon {
        background: color-mix(in srgb, var(--cf-forest) 35%, var(--cf-slate-800));
        color: color-mix(in srgb, var(--cf-forest-soft) 88%, #fff);
      }
      .dashboard-kpi-collected__label {
        color: color-mix(in srgb, var(--cf-forest-soft) 75%, #fff);
      }
      .dashboard-kpi-collected__value {
        color: color-mix(in srgb, var(--cf-forest-soft) 92%, #fff);
      }
      .dashboard-kpi-collected__hint,
      .dashboard-kpi-collected__compare {
        color: var(--cf-slate-300);
      }
      .dashboard-kpi-collected__compare--neutral {
        background: color-mix(in srgb, var(--cf-forest) 28%, var(--cf-slate-800));
        color: var(--cf-slate-200);
      }
      .dashboard-kpi--outstanding {
        border-color: color-mix(in srgb, var(--cf-amber) 45%, var(--cf-panel-border));
        background: linear-gradient(
          145deg,
          color-mix(in srgb, var(--cf-amber) 22%, var(--cf-panel-bg)) 0%,
          var(--cf-panel-bg) 78%
        );
        box-shadow: none;
      }
      .dashboard-kpi--overdue {
        border-color: color-mix(in srgb, var(--cf-critical) 45%, var(--cf-panel-border));
        background: linear-gradient(
          145deg,
          color-mix(in srgb, var(--cf-critical) 20%, var(--cf-panel-bg)) 0%,
          var(--cf-panel-bg) 78%
        );
        box-shadow: none;
      }
      .dashboard-kpi-outstanding__icon {
        background: color-mix(in srgb, var(--cf-amber) 35%, var(--cf-slate-800));
        color: color-mix(in srgb, var(--cf-amber-soft) 88%, #fff);
      }
      .dashboard-kpi-overdue__icon {
        background: color-mix(in srgb, var(--cf-critical) 32%, var(--cf-slate-800));
        color: color-mix(in srgb, var(--cf-critical-soft) 90%, #fff);
      }
      .dashboard-kpi-outstanding__label {
        color: color-mix(in srgb, var(--cf-amber-soft) 35%, #fff);
      }
      .dashboard-kpi-overdue__label {
        color: color-mix(in srgb, var(--cf-critical-soft) 35%, #fff);
      }
      .dashboard-kpi-outstanding__value {
        color: color-mix(in srgb, var(--cf-amber-soft) 88%, #fff);
      }
      .dashboard-kpi-overdue__value {
        color: color-mix(in srgb, var(--cf-critical-soft) 90%, #fff);
      }
      .dashboard-kpi-outstanding__hint {
        color: var(--cf-slate-300);
      }
      .dashboard-kpi-overdue__hint,
      .dashboard-kpi-overdue__meta {
        color: var(--cf-slate-300);
      }
      .dashboard-kpi--participation {
        border-color: color-mix(in srgb, var(--cf-indigo) 45%, var(--cf-panel-border));
        background: linear-gradient(
          145deg,
          color-mix(in srgb, var(--cf-indigo) 22%, var(--cf-panel-bg)) 0%,
          var(--cf-panel-bg) 78%
        );
        box-shadow: none;
      }
      .dashboard-kpi-participation__icon {
        background: color-mix(in srgb, var(--cf-indigo) 35%, var(--cf-slate-800));
        color: color-mix(in srgb, var(--cf-indigo-soft) 88%, #fff);
      }
      .dashboard-kpi-participation__label,
      .dashboard-kpi-participation__value {
        color: color-mix(in srgb, var(--cf-indigo-soft) 75%, #fff);
      }
      .dashboard-kpi-participation__hint {
        color: var(--cf-slate-300);
      }
      .dashboard-kpi-participation__compare--neutral {
        background: color-mix(in srgb, var(--cf-indigo) 28%, var(--cf-slate-800));
        color: var(--cf-slate-200);
      }
    }
    .dashboard-badge {
      display: inline-flex;
      width: fit-content;
      margin-top: 0.35rem;
      padding: 0.1rem 0.4rem;
      border-radius: 999px;
      font-size: 0.72rem;
      font-weight: 600;
    }
    .dashboard-split { display: grid; gap: 0.65rem; }
    .dashboard-link {
      display: inline-flex;
      align-items: center;
      min-height: 44px;
      color: var(--cf-forest);
    }
    .dashboard-mix {
      list-style: none;
      margin: 0.5rem 0 0;
      padding: 0;
      display: grid;
      gap: 0.55rem;
    }
    .dashboard-mix li {
      display: grid;
      grid-template-columns: minmax(7rem, 1.2fr) minmax(4rem, 1fr) auto;
      gap: 0.45rem;
      align-items: center;
    }
    .dashboard-mix__track {
      display: block;
      height: 0.45rem;
      background: var(--cf-slate-100);
      border-radius: 999px;
      overflow: hidden;
    }
    .dashboard-mix__bar {
      display: block;
      height: 100%;
      background: var(--cf-forest);
      min-width: 2px;
    }
    .dashboard-mix__single {
      display: flex;
      justify-content: space-between;
      gap: 0.75rem;
      margin: 0.5rem 0;
    }
    .dashboard-footer {
      display: flex;
      flex-wrap: wrap;
      gap: 0.35rem 1rem;
    }
    .dashboard-footer a {
      display: inline-flex;
      align-items: center;
      min-height: 44px;
      color: var(--cf-forest);
    }
    @media (min-width: 1024px) {
      .dashboard-split--trend { grid-template-columns: minmax(0, 8fr) minmax(0, 4fr); }
    }
  `]
})
export class DonationsDashboardComponent implements OnInit {
  private readonly donationsService = inject(DonationsService);
  private readonly quickCollectService = inject(QuickCollectService);
  private readonly entitlements = inject(EntitlementService);
  private readonly cdr = inject(ChangeDetectorRef);
  private readonly router = inject(Router);
  private readonly route = inject(ActivatedRoute);
  private readonly destroyRef = inject(DestroyRef);
  private readonly reload$ = new Subject<void>();

  summary: DonationDashboardSummary | null = null;
  executiveSummary: ExecutiveReportSummary | null = null;
  loading = true;
  executiveLoading = false;
  error: string | null = null;
  executiveError: string | null = null;
  advancedReports = false;
  drillDownRequest: ReportDrillDownRequestPayload | null = null;
  activePreset: DashboardPeriodPreset = 'this_month';
  customFrom = '';
  customTo = '';
  activeBccId = '';
  activeBccName = '';
  activeProjectId = '';
  activeProjectName = '';
  filtersOpen = false;

  private readonly projectLabelCache = new Map<string, string>();
  private projectLabelCacheLoaded = false;

  get dashboardFilterCount(): number {
    return this.activeFilterChips.length;
  }

  get activeFilterChips(): DashboardActiveFilterChip[] {
    const chips: DashboardActiveFilterChip[] = [];
    if (this.activePreset === 'ytd') {
      const applied = this.summary?.applied_range;
      const rangeLabel =
        applied?.date_from && applied?.collection_end
          ? `${this.formatDay(applied.date_from, false)} – ${this.formatDay(applied.collection_end, false)}`
          : null;
      chips.push({
        key: 'ytd',
        label: rangeLabel ? `Year to date · ${rangeLabel}` : 'Year to date',
        removeAriaLabel: 'Remove filter: Year to date'
      });
    }
    if (this.activePreset === 'custom') {
      const rangeLabel =
        this.customFrom && this.customTo
          ? `${this.formatDay(this.customFrom, false)} – ${this.formatDay(this.customTo, false)}`
          : 'Custom range';
      chips.push({
        key: 'custom',
        label: rangeLabel,
        removeAriaLabel: 'Remove filter: Custom date range'
      });
    }
    if (this.activeBccId) {
      chips.push({
        key: 'bcc',
        label: `BCC: ${this.activeBccName || this.summary?.applied_bcc?.name || 'Selected community'}`,
        removeAriaLabel: 'Remove filter: BCC'
      });
    }
    if (this.activeProjectId) {
      const projectName = this.resolvedProjectFilterName() || 'Selected project';
      chips.push({
        key: 'project',
        label: `Project: ${projectName}`,
        removeAriaLabel: `Remove filter: ${projectName}`
      });
    }
    return chips;
  }

  private resolvedProjectFilterName(): string {
    if (!this.activeProjectId) {
      return '';
    }
    return (
      this.activeProjectName ||
      this.summary?.applied_project?.name ||
      this.projectLabelCache.get(this.activeProjectId) ||
      ''
    );
  }

  private hydrateProjectLabelCache(): void {
    if (this.projectLabelCacheLoaded) {
      this.syncProjectNameFromCache();
      return;
    }
    this.projectLabelCacheLoaded = true;
    this.donationsService
      .getProjects()
      .pipe(catchError(() => of({ data: [] })))
      .subscribe((res) => {
        for (const project of res.data ?? []) {
          this.projectLabelCache.set(String(project.id), project.name);
        }
        this.syncProjectNameFromCache();
        this.cdr.markForCheck();
      });
  }

  private syncProjectNameFromCache(): void {
    if (!this.activeProjectId || this.activeProjectName) {
      return;
    }
    const cached = this.projectLabelCache.get(this.activeProjectId);
    if (cached) {
      this.activeProjectName = cached;
    }
  }

  removeActiveFilter(chip: DashboardActiveFilterChip): void {
    if (chip.key === 'bcc') {
      this.onRangeChange(this.rangePayload({ bcc_id: null }));
      return;
    }
    if (chip.key === 'project') {
      this.onRangeChange(this.rangePayload({ project_id: null }));
      return;
    }
    if (chip.key === 'ytd' && this.activePreset === 'ytd') {
      this.onRangeChange(this.rangePayload({ preset: 'this_month' }));
      return;
    }
    if (chip.key === 'custom' && this.activePreset === 'custom') {
      this.onRangeChange(this.rangePayload({ preset: 'this_month' }));
    }
  }

  private rangePayload(overrides: Partial<DashboardDateRangeValue>): DashboardDateRangeValue {
    const preset = overrides.preset ?? this.activePreset;
    const payload: DashboardDateRangeValue = {
      preset,
      bcc_id: overrides.bcc_id !== undefined ? overrides.bcc_id : (this.activeBccId || null),
      project_id: overrides.project_id !== undefined ? overrides.project_id : (this.activeProjectId || null)
    };
    if (preset === 'custom') {
      payload.date_from = overrides.date_from ?? this.customFrom;
      payload.date_to = overrides.date_to ?? this.customTo;
    }
    return payload;
  }

  private currentRangeQuery(): DonationDashboardDateQuery {
    const query: DonationDashboardDateQuery =
      this.activePreset === 'custom'
        ? {
            preset: 'custom',
            date_from: this.customFrom,
            date_to: this.customTo
          }
        : { preset: this.activePreset };
    if (this.activeBccId) {
      query.bcc_id = this.activeBccId;
    }
    if (this.activeProjectId) {
      query.project_id = this.activeProjectId;
    }
    return query;
  }

  get snapshot(): DonationDashboardSnapshot | null {
    return this.summary?.snapshot ?? null;
  }

  get pageSubtitle(): string {
    const snap = this.snapshot;
    if (!snap) {
      return 'Collections, dues, and families for this parish.';
    }
    const applied = this.summary?.applied_range ?? snap.applied_range;
    if (applied) {
      return `${this.formatDay(applied.date_from, true)} – ${this.formatDay(applied.collection_end, true)} · ${applied.timezone} · Fiscal year ${snap.financial_year}`;
    }
    return `As of ${this.formatDay(snap.as_of, true)} · Fiscal year ${snap.financial_year}`;
  }

  get collectionTrend(): CollectionTrendPoint[] {
    return this.summary?.collection_trend ?? [];
  }

  get hasCollections(): boolean {
    return this.collectionTrend.some((row) => row.collected > 0);
  }

  get collectedPeriodLabel(): string {
    return this.activePreset === 'this_month' ? 'Collected this month' : 'Collected';
  }

  get collectedPeriodHint(): string {
    const applied = this.summary?.applied_range;
    if (this.activePreset === 'this_month') {
      return 'Succeeded payments · month to date';
    }
    if (applied) {
      return `Succeeded payments · ${this.formatDay(applied.date_from, false)}–${this.formatDay(applied.collection_end, false)}`;
    }
    return 'Succeeded payments in the selected period';
  }

  get collectedPeriodAriaLabel(): string {
    const snap = this.snapshot;
    if (!snap) {
      return this.collectedPeriodLabel;
    }
    return `${this.collectedPeriodLabel}, ${snap.month.collected}. ${this.collectedPeriodHint}. ${this.monthComparison}`;
  }

  get comparisonPeriodLabel(): string {
    return this.activePreset === 'this_month' ? 'Same days last month' : 'Previous period';
  }

  get comparisonPeriodHint(): string {
    const month = this.snapshot?.month;
    if (!month) {
      return '';
    }
    return this.formatRange(month.comparison_start, month.comparison_end);
  }

  get comparisonCardTitle(): string {
    const month = this.snapshot?.month;
    if (!month) {
      return '';
    }
    return `Succeeded payments from ${month.comparison_start} through ${month.comparison_end}.`;
  }

  get comparisonCardAriaLabel(): string {
    const snap = this.snapshot;
    if (!snap) {
      return this.comparisonPeriodLabel;
    }
    return `${this.comparisonPeriodLabel}, ${snap.month.comparison_collected}.`;
  }

  get growthDirection(): 'up' | 'down' | 'flat' | 'none' {
    const growth = this.snapshot?.month.growth_pct;
    if (growth === null || growth === undefined) {
      return 'none';
    }
    if (growth > 0) {
      return 'up';
    }
    if (growth < 0) {
      return 'down';
    }
    return 'flat';
  }

  get monthComparison(): string {
    const month = this.snapshot?.month;
    if (!month) {
      return '';
    }
    const range = this.formatRange(month.comparison_start, month.comparison_end);
    if (month.growth_pct === null) {
      return `No comparable period last month (${range})`;
    }
    const word = month.growth_pct > 0 ? 'Up' : month.growth_pct < 0 ? 'Down' : 'Flat';
    return `${word} ${Math.abs(month.growth_pct)}% versus ${range}`;
  }

  get participationDelta(): number {
    return this.snapshot?.participation.net_change_vs_prior_window ?? 0;
  }

  get participationChange(): string {
    const delta = this.participationDelta;
    if (delta > 0) {
      return `${delta} more than the previous period`;
    }
    if (delta < 0) {
      return `${Math.abs(delta)} fewer than the previous period`;
    }
    return 'Same number as the previous period';
  }

  get participationTitle(): string {
    const snap = this.snapshot;
    if (!snap) {
      return '';
    }
    return `Active families with a succeeded payment from ${snap.participation.window_start} through ${snap.participation.window_end}.`;
  }

  get outstandingKpiTitle(): string {
    if (this.activeProjectId) {
      return 'Open project installment balances collectable as of the range end.';
    }
    return 'Contribution dues whose period has started and are not paid, waived, or cancelled, as of the range end. Does not include project installments.';
  }

  get duesOverdueQuery(): Record<string, string> {
    const query: Record<string, string> = { overdue_only: '1' };
    if (this.activeBccId) {
      query['bcc_id'] = this.activeBccId;
    }
    if (this.activeProjectId) {
      query['project_id'] = this.activeProjectId;
    }
    return query;
  }

  get collectionTrendAriaLabel(): string {
    const applied = this.summary?.applied_range;
    if (applied) {
      return `Collected payments from ${applied.date_from} through ${applied.collection_end}, grouped by month.`;
    }
    return 'Collected payments in the selected range, grouped by month.';
  }

  private scopeQueryParams(): Record<string, string> {
    const params: Record<string, string> = {};
    if (this.activeBccId) {
      params['bcc_id'] = this.activeBccId;
    }
    if (this.activeProjectId) {
      params['project_id'] = this.activeProjectId;
    }
    return params;
  }

  get monthPaymentQuery(): Record<string, string> | null {
    const applied = this.summary?.applied_range;
    const snap = this.snapshot;
    if (applied) {
      return { paid_from: applied.date_from, paid_to: applied.collection_end, ...this.scopeQueryParams() };
    }
    if (!snap) {
      return null;
    }
    return { paid_from: `${snap.as_of.slice(0, 8)}01`, paid_to: snap.as_of, ...this.scopeQueryParams() };
  }

  get comparisonPaymentQuery(): Record<string, string> | null {
    const snap = this.snapshot;
    if (!snap) {
      return null;
    }
    return {
      paid_from: snap.month.comparison_start,
      paid_to: snap.month.comparison_end,
      ...this.scopeQueryParams()
    };
  }

  get mixRows(): MixRow[] {
    const mix = this.snapshot?.giving_mix;
    if (!mix?.reconciled) {
      return [];
    }
    const rows = mix.buckets.filter((bucket: { amount: number }) => bucket.amount > 0);
    if (mix.unallocated !== 0) {
      rows.push({ key: 'unallocated', label: 'Unallocated', amount: mix.unallocated });
    }
    return rows;
  }

  get showMix(): boolean {
    return this.mixRows.length > 0;
  }

  ngOnInit(): void {
    this.entitlements.load().pipe(takeUntilDestroyed(this.destroyRef)).subscribe(() => {
      this.advancedReports = this.entitlements.hasFeature('ADVANCED_FINANCIAL_REPORTING');
      if (this.advancedReports) {
        this.loadExecutiveSummary();
      }
      this.cdr.markForCheck();
    });

    this.reload$.pipe(
      switchMap(() => {
        this.loading = true;
        this.error = null;
        this.cdr.markForCheck();
        return this.donationsService.getDashboardSummary(this.currentRangeQuery()).pipe(catchError(() => of(null)));
      }),
      takeUntilDestroyed(this.destroyRef)
    ).subscribe((res) => {
      if (res?.data?.snapshot) {
        this.summary = res.data;
        if (res.data.applied_bcc?.name) {
          this.activeBccName = res.data.applied_bcc.name;
        }
        if (
          this.activeProjectId &&
          res.data.applied_project?.id === this.activeProjectId &&
          res.data.applied_project.name
        ) {
          this.activeProjectName = res.data.applied_project.name;
        }
        this.error = null;
        const windows = res.data.preset_windows?.['this_month'];
        if (this.activePreset === 'custom' && windows && !this.customFrom) {
          this.customFrom = windows.date_from;
          this.customTo = windows.date_to;
        }
      } else if (!this.summary) {
        this.error = 'Failed to load financial dashboard.';
      } else {
        this.error = 'Failed to refresh financial dashboard.';
      }
      this.loading = false;
      this.cdr.markForCheck();
    });

    this.route.queryParamMap.pipe(takeUntilDestroyed(this.destroyRef)).subscribe((params) => {
      this.applyQueryParams(params);
      this.reload$.next();
      if (this.advancedReports) {
        this.loadExecutiveSummary();
      }
    });
    this.donationsService.ledgerMutated$
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe(() => this.reload$.next());
  }

  reload(): void {
    this.reload$.next();
    if (this.advancedReports) {
      this.loadExecutiveSummary();
    }
  }

  loadExecutiveSummary(): void {
    this.executiveLoading = true;
    this.executiveError = null;
    this.cdr.markForCheck();
    this.donationsService.getExecutiveReportSummary(this.currentRangeQuery()).pipe(catchError(() => of(null))).subscribe((res) => {
      if (res?.data?.visuals) {
        this.executiveSummary = res.data;
        this.executiveError = null;
      } else if (!this.executiveSummary) {
        this.executiveError = 'Could not load stewardship health. Check your connection and try again.';
      } else {
        this.executiveError = 'Could not refresh stewardship health.';
      }
      this.executiveLoading = false;
      this.cdr.markForCheck();
    });
  }

  openFilters(): void {
    this.filtersOpen = true;
    this.cdr.markForCheck();
  }

  closeFilters(): void {
    this.filtersOpen = false;
    this.cdr.markForCheck();
  }

  onFilterReset(): void {
    this.onRangeChange({ preset: 'this_month', bcc_id: null, project_id: null });
  }

  onRangeChange(value: DashboardDateRangeValue): void {
    if (value.preset === 'custom') {
      this.activePreset = 'custom';
      this.customFrom = value.date_from ?? '';
      this.customTo = value.date_to ?? '';
    } else if (value.preset) {
      this.activePreset = value.preset;
      this.customFrom = '';
      this.customTo = '';
    }
    if (value.bcc_id !== undefined) {
      this.activeBccId = value.bcc_id ?? '';
      if (!this.activeBccId) {
        this.activeBccName = '';
      }
    }
    if (value.project_id !== undefined) {
      this.activeProjectId = value.project_id ?? '';
      if (!this.activeProjectId) {
        this.activeProjectName = '';
      } else if (value.project_name) {
        this.activeProjectName = value.project_name;
      } else {
        this.syncProjectNameFromCache();
        if (!this.activeProjectName) {
          this.hydrateProjectLabelCache();
        }
      }
    }

    void this.router.navigate([], {
      relativeTo: this.route,
      queryParams: {
        preset: value.preset ?? this.activePreset,
        date_from: (value.preset ?? this.activePreset) === 'custom' ? (value.date_from ?? null) : null,
        date_to: (value.preset ?? this.activePreset) === 'custom' ? (value.date_to ?? null) : null,
        bcc_id: value.bcc_id !== undefined ? (value.bcc_id || null) : (this.activeBccId || null),
        project_id: value.project_id !== undefined ? (value.project_id || null) : (this.activeProjectId || null)
      },
      queryParamsHandling: 'merge'
    });
  }

  private applyQueryParams(params: ParamMap): void {
    const preset = params.get('preset');
    const allowed: DashboardPeriodPreset[] = ['this_month', 'this_fy', 'last_90', 'ytd', 'custom'];
    this.activePreset = allowed.includes(preset as DashboardPeriodPreset)
      ? (preset as DashboardPeriodPreset)
      : 'this_month';
    if (this.activePreset === 'custom') {
      this.customFrom = params.get('date_from') ?? '';
      this.customTo = params.get('date_to') ?? '';
    } else {
      this.customFrom = '';
      this.customTo = '';
    }
    this.activeBccId = params.get('bcc_id') ?? '';
    if (!this.activeBccId) {
      this.activeBccName = '';
    }
    this.activeProjectId = params.get('project_id') ?? '';
    if (!this.activeProjectId) {
      this.activeProjectName = '';
    } else {
      this.syncProjectNameFromCache();
      if (!this.activeProjectName) {
        this.hydrateProjectLabelCache();
      }
    }
  }

  openDrillDown(payload: ReportDrillDownRequestPayload): void {
    this.drillDownRequest = { ...payload, ...this.currentRangeQuery() };
    this.cdr.markForCheck();
  }

  closeDrillDown(): void {
    this.drillDownRequest = null;
    this.cdr.markForCheck();
  }

  openQuickCollect(): void {
    this.quickCollectService.open();
  }

  openTrendMonth(point: CollectionTrendPoint): void {
    if (!point.start || !point.end) {
      return;
    }
    this.router.navigate(['payments'], {
      relativeTo: this.route.parent ?? this.route,
      queryParams: { paid_from: point.start, paid_to: point.end, ...this.scopeQueryParams() }
    });
  }

  familyCountLabel(count: number): string {
    return count === 1 ? '1 family' : `${count} families`;
  }

  mixWidth(amount: number): number {
    const max = Math.max(...this.mixRows.map((row) => Math.abs(row.amount)), 1);
    return Math.max(2, Math.round((Math.abs(amount) / max) * 100));
  }

  private formatRange(start: string, end: string): string {
    const startLabel = this.formatDay(start, false);
    const endLabel = this.formatDay(end, false);
    if (start.slice(0, 7) === end.slice(0, 7)) {
      return `${start.slice(8).replace(/^0/, '')}–${endLabel}`;
    }
    return `${startLabel}–${endLabel}`;
  }

  private formatDay(iso: string, withYear: boolean): string {
    const [year, month, day] = iso.split('-').map((part) => Number(part));
    if (!year || !month || !day) {
      return iso;
    }
    const date = new Date(Date.UTC(year, month - 1, day));
    return new Intl.DateTimeFormat('en-GB', {
      day: 'numeric',
      month: 'short',
      year: withYear ? 'numeric' : undefined,
      timeZone: 'UTC'
    }).format(date);
  }
}
