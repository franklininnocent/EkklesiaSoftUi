import { CommonModule } from '@angular/common';
import {
  AfterViewInit,
  ChangeDetectionStrategy,
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
  inject
} from '@angular/core';
import { ReportDrillDownRequestPayload, ReportDrillDownGraphId } from '../../models/donation.model';
import { REPORT_DRILL_DOWN_GRAPH_IDS } from './report-drill-down.constants';
import { Chart } from 'chart.js/auto';
import { ChurchCurrencyService } from '@core/services/church-currency.service';
import {
  ExecutiveReportCollectionSnapshot,
  ExecutiveReportHealthFactor,
  ExecutiveReportHealthStoryItem,
  ExecutiveReportSummary,
  ExecutiveReportVisuals
} from '../../models/donation.model';
import { formatFocCurrency } from '../../dashboard/utils/foc-format.util';
import { CfActionIconComponent, CfActionIconName } from '@shared/components/cf-action-icon/cf-action-icon.component';
import { StatusBadgeComponent, StatusBadgeTone } from '@shared/components/status-badge/status-badge.component';

type HealthStateId = 'performing' | 'attention' | 'pending' | 'opportunity';

interface HealthStateColumn {
  id: HealthStateId;
  index: string;
  title: string;
  eyebrow: string;
  icon: CfActionIconName;
  empty: string;
  items: ExecutiveReportHealthStoryItem[];
}

const CHART_COLORS = {
  primary: '#4f46e5',
  forest: '#0d9488',
  amber: '#f59e0b',
  slate: '#94a3b8',
  risk: '#dc2626',
  muted: '#e2e8f0'
};

@Component({
  selector: 'app-executive-summary-visuals',
  standalone: true,
  imports: [CommonModule, StatusBadgeComponent, CfActionIconComponent],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <div
      class="exec-visuals"
      [class.exec-visuals--cols-2]="usesChartGrid"
      [class.exec-visuals--health-only]="visualScope === 'health'"
      *ngIf="summary?.visuals as v"
    >
      <section
        *ngIf="showHealthBlock"
        class="cf-chart-panel cf-panel exec-visuals__cell exec-visuals__health"
        role="region"
        aria-label="Stewardship health"
        aria-labelledby="exec-health-heading"
      >
        <div class="exec-visuals__health-hero">
          <div class="exec-visuals__health-hero-title">
            <h3 id="exec-health-heading">Stewardship health</h3>
            <button
              type="button"
              class="exec-visuals__health-help"
              (click)="toggleHealthMethod()"
              [attr.aria-expanded]="healthMethodOpen"
              [attr.aria-controls]="healthMethodOpen ? 'exec-health-method' : null"
            >
              <app-cf-action-icon name="book-open" />
              <span class="exec-visuals__sr-only">About this operations index</span>
            </button>
          </div>
          <div class="exec-visuals__health-hero-index">
            <button
              type="button"
              class="exec-visuals__health-score"
              (click)="openDrill('financial_health', 'overall_score', 'overall_score')"
              [attr.aria-label]="healthGaugeActionAriaLabel"
            >
              <strong>{{ v.health.score | number:'1.0-0' }}</strong>
              <span>/ 100</span>
            </button>
            <app-status-badge
              [label]="statusLabel(v.health.status)"
              [tone]="statusTone(v.health.status)"
            ></app-status-badge>
          </div>
          <button
            type="button"
            class="exec-visuals__chip-link exec-visuals__health-method"
            (click)="openDrill('financial_health', 'overall_score', 'overall_score')"
          >
            How this score is calculated
          </button>
        </div>
        <p
          id="exec-health-method"
          class="cf-helper exec-visuals__health-method-copy"
          *ngIf="healthMethodOpen"
        >
          Operations index (collections, dues, participation) — not full parish financial position.
        </p>
        <p
          class="exec-visuals__narrative exec-visuals__narrative--compact"
          *ngIf="!hasHealthStory(v.health.story)"
        >{{ summary.narrative }}</p>
        <ul class="exec-visuals__states" aria-label="Stewardship summary">
          <li
            *ngFor="let col of healthStateColumns(v.health.story)"
            class="exec-visuals__state"
            [attr.data-state]="col.id"
          >
            <div class="exec-visuals__state-head">
              <span class="exec-visuals__state-index">{{ col.index }}</span>
              <app-cf-action-icon [name]="col.icon" />
              <div class="exec-visuals__state-titles">
                <span class="exec-visuals__state-eyebrow">{{ col.eyebrow }}</span>
                <h4>{{ col.title }}</h4>
              </div>
            </div>
            <ul class="exec-visuals__state-metrics" *ngIf="col.items.length; else stateEmpty">
              <li
                *ngFor="let item of col.items"
                [class.exec-visuals__state-metric--subset]="item.key === 'next_14_days'"
              >
                <button
                  *ngIf="storyDrill(item) as drill; else staticMetric"
                  type="button"
                  class="exec-visuals__state-metric"
                  (click)="openDrill(drill.graph_id, drill.data_element_id, drill.slice_id)"
                  [attr.aria-label]="'View details for ' + storyItemLabel(item)"
                >
                  <span class="exec-visuals__state-metric-copy">
                    <span class="exec-visuals__state-metric-label">{{ storyItemLabel(item) }}</span>
                    <span class="exec-visuals__state-metric-hint" *ngIf="storyItemHint(item)">{{ storyItemHint(item) }}</span>
                  </span>
                  <strong>{{ formatStoryItem(item) }}</strong>
                </button>
                <ng-template #staticMetric>
                  <div class="exec-visuals__state-metric exec-visuals__state-metric--static">
                    <span class="exec-visuals__state-metric-copy">
                      <span class="exec-visuals__state-metric-label">{{ storyItemLabel(item) }}</span>
                      <span class="exec-visuals__state-metric-hint" *ngIf="storyItemHint(item)">{{ storyItemHint(item) }}</span>
                    </span>
                    <strong>{{ formatStoryItem(item) }}</strong>
                  </div>
                </ng-template>
              </li>
            </ul>
            <ng-template #stateEmpty>
              <p class="cf-meta exec-visuals__state-empty">{{ col.empty }}</p>
            </ng-template>
          </li>
        </ul>
        <div class="exec-visuals__drivers" *ngIf="v.health.factors?.length">
          <div class="exec-visuals__drivers-head">
            <h4 id="exec-health-drivers-heading">Health drivers</h4>
            <p class="cf-helper">What feeds the 0–100 index</p>
          </div>
          <ul class="exec-visuals__drivers-grid" aria-labelledby="exec-health-drivers-heading">
            <li *ngFor="let factor of v.health.factors">
              <button
                type="button"
                class="cf-health-metric exec-visuals__factor-btn"
                [class.cf-health-metric--healthy]="factorDriverTone(factor) === 'healthy'"
                [class.cf-health-metric--attention]="factorDriverTone(factor) === 'attention'"
                [class.cf-health-metric--risk]="factorDriverTone(factor) === 'risk'"
                (click)="openDrill('financial_health', factor.key, factor.key)"
                [attr.aria-label]="'View details for ' + factor.label"
              >
                <div class="cf-health-metric__head">
                  <span class="cf-health-metric__title">{{ factor.label }}</span>
                  <span class="cf-meta" *ngIf="factor.weight_pct">{{ factor.weight_pct | number:'1.0-2' }}%</span>
                </div>
                <div class="cf-health-metric__score">
                  <strong class="cf-health-metric__value" *ngIf="!factor.not_applicable">{{ factor.score | number:'1.0-0' }}</strong>
                  <strong class="cf-health-metric__value exec-visuals__factor-score--na" *ngIf="factor.not_applicable">N/A</strong>
                </div>
                <div class="cf-health-metric__bar" role="presentation" *ngIf="!factor.not_applicable">
                  <span class="cf-health-metric__bar-fill" [style.width.%]="factor.score"></span>
                </div>
              </button>
            </li>
          </ul>
        </div>
      </section>

        <section
          *ngIf="showOverviewChartPanels"
          class="cf-chart-panel cf-panel exec-visuals__cell exec-visuals__split-panel exec-visuals__collections"
          role="region"
          aria-label="Collections"
          aria-labelledby="exec-collections-heading"
        >
          <div class="cf-chart-panel__head exec-visuals__split-head">
            <div>
              <h3 id="exec-collections-heading">Collections</h3>
              <p>{{ collectionsCaption }}</p>
            </div>
          </div>
          <p class="exec-visuals__sr-only">{{ collectionsAriaLabel }}</p>
          <div class="exec-visuals__split-body" *ngIf="hasCollectionsChart; else collectionsEmpty">
            <div class="exec-visuals__split-chart cf-chart-panel__chart-wrap">
              <canvas #collectionsCanvas role="img" [attr.aria-label]="collectionsAriaLabel"></canvas>
            </div>
            <aside class="exec-visuals__split-aside" aria-label="Collection comparison summary">
              <div
                class="exec-visuals__collections-growth"
                *ngIf="v.collections.collection_growth_pct != null"
              >
                <span
                  class="exec-visuals__collections-growth-value"
                  [class.up]="v.collections.collection_growth_pct > 0"
                  [class.down]="v.collections.collection_growth_pct < 0"
                >
                  {{ v.collections.collection_growth_pct > 0 ? '↑' : (v.collections.collection_growth_pct < 0 ? '↓' : '') }}
                  {{ v.collections.collection_growth_pct | number:'1.1-1' }}%
                </span>
                <span class="exec-visuals__collections-growth-label">vs {{ collectionsComparisonLabel }}</span>
              </div>
              <div class="exec-visuals__collections-stats">
                <button
                  type="button"
                  class="exec-visuals__collections-stat"
                  (click)="openDrill('collections', 'current_month_collected', 'current_month')"
                >
                  <span class="exec-visuals__collections-stat-label">{{ collectionsPeriodLabel }}</span>
                  <strong class="exec-visuals__collections-stat-value">{{ formatMoney(v.collections.current_month_collected) }}</strong>
                </button>
                <button
                  type="button"
                  class="exec-visuals__collections-stat"
                  (click)="openDrill('collections', 'previous_month_collected', 'previous_month')"
                >
                  <span class="exec-visuals__collections-stat-label">{{ collectionsComparisonLabel }}</span>
                  <strong class="exec-visuals__collections-stat-value">{{ formatMoney(v.collections.previous_month_collected) }}</strong>
                </button>
              </div>
              <div class="exec-visuals__split-legend cf-chart-panel__legend" aria-hidden="true">
                <span>
                  <span class="cf-chart-panel__swatch cf-chart-panel__swatch--collected"></span>
                  {{ collectionsPeriodLabel }}
                </span>
                <span>
                  <span class="cf-chart-panel__swatch exec-visuals__collections-swatch--previous"></span>
                  {{ collectionsComparisonLabel }}
                </span>
              </div>
            </aside>
          </div>
          <ng-template #collectionsEmpty>
            <p class="cf-chart-panel__empty">No collection activity in this period yet.</p>
          </ng-template>
        </section>

        <section
          *ngIf="showOverviewChartPanels"
          class="cf-chart-panel cf-panel exec-visuals__cell exec-visuals__split-panel exec-visuals__snapshot"
          role="region"
          aria-label="Collection snapshot"
          aria-labelledby="exec-snapshot-heading"
        >
          <div class="cf-chart-panel__head exec-visuals__split-head">
            <div>
              <h3 id="exec-snapshot-heading">Collection snapshot</h3>
              <p>Expected dues through today vs due-allocated collections</p>
            </div>
          </div>
          <p class="exec-visuals__sr-only">{{ snapshotAriaLabel }}</p>
          <div class="exec-visuals__split-body">
            <div class="exec-visuals__split-chart cf-chart-panel__chart-wrap">
              <canvas #snapshotCanvas role="img" [attr.aria-label]="snapshotAriaLabel"></canvas>
            </div>
            <aside class="exec-visuals__split-aside exec-visuals__split-aside--compact" aria-label="Collection snapshot summary">
              <div class="exec-visuals__split-metric-list">
                <button
                  type="button"
                  class="exec-visuals__split-metric"
                  (click)="openDrill('collection_snapshot', 'expected', 'expected')"
                >
                  <span class="exec-visuals__split-metric-label">Expected (due through today)</span>
                  <strong class="exec-visuals__split-metric-value">{{ formatMoney(snapshotVisual.expected) }}</strong>
                </button>
                <button
                  type="button"
                  class="exec-visuals__split-metric"
                  (click)="openDrill('collection_snapshot', 'collected', 'collected')"
                >
                  <span class="exec-visuals__split-metric-label">Collected (allocated to dues)</span>
                  <strong class="exec-visuals__split-metric-value">{{ formatMoney(snapshotVisual.collected) }}</strong>
                </button>
                <button
                  type="button"
                  class="exec-visuals__split-metric"
                  (click)="openDrill('collection_snapshot', 'outstanding', 'outstanding')"
                >
                  <span class="exec-visuals__split-metric-label">Outstanding</span>
                  <strong class="exec-visuals__split-metric-value">{{ formatMoney(snapshotVisual.outstanding) }}</strong>
                </button>
                <button
                  type="button"
                  class="exec-visuals__split-metric exec-visuals__split-metric--compact"
                  *ngIf="snapshotVisual.has_assessment"
                  (click)="openDrill('collection_snapshot', 'collection_rate', 'collection_rate')"
                >
                  <span class="exec-visuals__split-metric-label">Collection rate</span>
                  <strong class="exec-visuals__split-metric-value">{{ snapshotVisual.collection_rate_pct | number:'1.1-1' }}%</strong>
                </button>
              </div>
              <p class="exec-visuals__snapshot-na" *ngIf="!snapshotVisual.has_assessment">No assessment this month — no dues dated through today.</p>
            </aside>
          </div>
        </section>

        <section
          *ngIf="showOverviewChartPanels"
          class="cf-chart-panel cf-panel exec-visuals__cell exec-visuals__split-panel exec-visuals__outstanding"
          role="region"
          aria-label="Due schedule"
          aria-labelledby="exec-outstanding-heading"
        >
          <div class="cf-chart-panel__head exec-visuals__split-head">
            <div>
              <h3 id="exec-outstanding-heading">Due schedule</h3>
              <p>Overdue, next 14 days, and later collectable (disjoint)</p>
            </div>
          </div>
          <p class="exec-visuals__sr-only">{{ outstandingAriaLabel }}</p>
          <div class="exec-visuals__split-body exec-visuals__split-body--due-schedule" *ngIf="hasOutstandingChart; else outstandingEmpty">
            <ng-container *ngIf="v.outstanding as o">
              <div class="exec-visuals__split-chart exec-visuals__split-chart--donut exec-visuals__split-chart--due-schedule">
                <div class="exec-visuals__donut-ring exec-visuals__donut-wrap">
                  <canvas #outstandingCanvas role="img" [attr.aria-label]="outstandingAriaLabel"></canvas>
                </div>
              </div>
              <aside class="exec-visuals__split-aside exec-visuals__split-aside--due-schedule" aria-label="Due schedule summary">
                <div class="exec-visuals__due-schedule-strip" role="group" aria-label="Due schedule amounts">
                  <button
                    type="button"
                    class="exec-visuals__due-schedule-item"
                    [disabled]="o.overdue_amount <= 0"
                    (click)="openDrill('outstanding_overdue', 'overdue_amount', 'overdue')"
                  >
                    <span class="cf-chart-panel__swatch exec-visuals__swatch--overdue" aria-hidden="true"></span>
                    <span class="exec-visuals__due-schedule-item-copy">
                      <span class="exec-visuals__due-schedule-item-label">Overdue</span>
                      <strong class="exec-visuals__due-schedule-item-value">{{ formatMoney(o.overdue_amount) }}</strong>
                    </span>
                  </button>
                  <button
                    type="button"
                    class="exec-visuals__due-schedule-item"
                    [disabled]="(o.next_14_days_amount ?? 0) <= 0"
                    (click)="openDrill('outstanding_overdue', 'next_14_days_amount', 'upcoming_14d')"
                  >
                    <span class="cf-chart-panel__swatch exec-visuals__swatch--remaining" aria-hidden="true"></span>
                    <span class="exec-visuals__due-schedule-item-copy">
                      <span class="exec-visuals__due-schedule-item-label">Next 14 days</span>
                      <strong class="exec-visuals__due-schedule-item-value">{{ formatMoney(o.next_14_days_amount ?? 0) }}</strong>
                    </span>
                  </button>
                  <button
                    type="button"
                    class="exec-visuals__due-schedule-item"
                    [disabled]="(o.later_remaining_amount ?? 0) <= 0"
                    (click)="openDrill('outstanding_overdue', 'later_remaining_amount', 'later_remaining')"
                  >
                    <span class="cf-chart-panel__swatch exec-visuals__swatch--later" aria-hidden="true"></span>
                    <span class="exec-visuals__due-schedule-item-copy">
                      <span class="exec-visuals__due-schedule-item-label">Later</span>
                      <strong class="exec-visuals__due-schedule-item-value">{{ formatMoney(o.later_remaining_amount ?? 0) }}</strong>
                    </span>
                  </button>
                </div>
                <div class="exec-visuals__due-schedule-meta">
                  <button
                    type="button"
                    class="exec-visuals__due-schedule-meta-btn"
                    *ngIf="o.overdue_family_count > 0"
                    (click)="openDrill('outstanding_overdue', 'overdue_family_count', 'overdue')"
                  >
                    {{ o.overdue_family_count | number }} families overdue
                  </button>
                  <button
                    type="button"
                    class="exec-visuals__due-schedule-meta-btn"
                    *ngIf="(o.next_14_days_family_count ?? 0) > 0"
                    (click)="openDrill('outstanding_overdue', 'next_14_days_amount', 'upcoming_14d')"
                  >
                    {{ o.next_14_days_family_count | number }} due in 14 days
                  </button>
                  <button
                    type="button"
                    class="exec-visuals__due-schedule-meta-btn exec-visuals__due-schedule-meta-btn--total"
                    *ngIf="o.pending_dues > 0"
                    (click)="openDrill('outstanding_overdue', 'pending_dues', 'total_outstanding')"
                  >
                    Total {{ formatMoney(o.pending_dues) }}
                  </button>
                </div>
              </aside>
            </ng-container>
          </div>
          <ng-template #outstandingEmpty>
            <p class="cf-chart-panel__empty">No outstanding balances recorded.</p>
          </ng-template>
        </section>

        <section
          *ngIf="showOverviewChartPanels"
          class="cf-chart-panel cf-panel exec-visuals__cell exec-visuals__split-panel exec-visuals__participation"
          role="region"
          aria-label="Family participation"
          aria-labelledby="exec-participation-heading"
        >
          <div class="cf-chart-panel__head exec-visuals__split-head">
            <div>
              <h3 id="exec-participation-heading">Family participation</h3>
              <p>Active families contributing ({{ participationWindowCaption }})</p>
            </div>
          </div>
          <p class="exec-visuals__sr-only">{{ participationAriaLabel }}</p>
          <div class="exec-visuals__split-body exec-visuals__split-body--donut" *ngIf="v.participation.active_families > 0; else participationEmpty">
            <div class="exec-visuals__split-chart exec-visuals__split-chart--donut">
              <div class="exec-visuals__donut-ring exec-visuals__donut-wrap">
                <canvas #participationCanvas role="img" [attr.aria-label]="participationAriaLabel"></canvas>
                <div class="exec-visuals__donut-center" aria-hidden="true">
                  <strong>{{ v.participation.participation_rate | number:'1.1-1' }}%</strong>
                </div>
              </div>
            </div>
            <aside class="exec-visuals__split-aside exec-visuals__split-aside--compact" aria-label="Participation summary">
              <div class="exec-visuals__participation-hero">
                <p class="exec-visuals__participation-rate">
                  {{ v.participation.participation_rate | number:'1.1-1' }}%
                </p>
                <p class="exec-visuals__participation-counts">
                  {{ v.participation.participating_families }} of {{ v.participation.active_families }} families
                </p>
              </div>
              <div class="exec-visuals__split-metric-list">
                <button
                  type="button"
                  class="exec-visuals__split-metric exec-visuals__split-metric--compact"
                  (click)="openDrill('family_participation', 'participating_families', 'participating')"
                >
                  <span class="exec-visuals__split-metric-label">Participating</span>
                  <strong class="exec-visuals__split-metric-value">{{ v.participation.participating_families | number }}</strong>
                </button>
                <button
                  type="button"
                  class="exec-visuals__split-metric exec-visuals__split-metric--compact"
                  (click)="openDrill('family_participation', 'not_participating', 'not_participating')"
                >
                  <span class="exec-visuals__split-metric-label">Not yet contributing</span>
                  <strong class="exec-visuals__split-metric-value">{{ (v.participation.active_families - v.participation.participating_families) | number }}</strong>
                </button>
              </div>
              <div class="exec-visuals__split-legend cf-chart-panel__legend" aria-hidden="true">
                <span>
                  <span class="cf-chart-panel__swatch cf-chart-panel__swatch--collected"></span>
                  Participating
                </span>
                <span>
                  <span class="cf-chart-panel__swatch exec-visuals__swatch--inactive"></span>
                  Not yet contributing
                </span>
              </div>
            </aside>
          </div>
          <ng-template #participationEmpty>
            <p class="cf-chart-panel__empty">No active families to measure yet.</p>
          </ng-template>
        </section>

        <section
          *ngIf="showReportsChartPanels && v.projects?.length"
          class="cf-chart-panel cf-panel exec-visuals__cell exec-visuals__split-panel exec-visuals__projects"
          aria-labelledby="exec-projects-heading"
        >
          <div class="cf-chart-panel__head exec-visuals__split-head">
            <div>
              <h3 id="exec-projects-heading">Project funding</h3>
              <p>Active campaigns (up to five)</p>
            </div>
          </div>
          <ul class="exec-visuals__project-list">
            <li *ngFor="let project of v.projects">
              <span class="exec-visuals__project-name">{{ project.name }}</span>
              <span class="exec-visuals__project-pct">{{ project.funding_percentage | number:'1.0-0' }}%</span>
              <div class="exec-visuals__factor-bar" role="presentation">
                <span [style.width.%]="project.funding_percentage"></span>
              </div>
              <span class="exec-visuals__project-amounts">{{ formatMoney(project.collected) }} / {{ formatMoney(project.target_amount) }}</span>
            </li>
          </ul>
        </section>

        <section
          *ngIf="showReportsChartPanels && v.expenses_vs_collections as exp"
          class="cf-chart-panel cf-panel exec-visuals__cell exec-visuals__split-panel exec-visuals__expenses"
          aria-labelledby="exec-expenses-heading"
        >
          <div class="cf-chart-panel__head exec-visuals__split-head">
            <div>
              <h3 id="exec-expenses-heading">Collections vs recorded expenses</h3>
              <p>This month — not a surplus or deficit</p>
            </div>
          </div>
          <div class="exec-visuals__split-body" *ngIf="hasExpensesChart">
            <div class="exec-visuals__split-chart cf-chart-panel__chart-wrap">
              <canvas #expensesCanvas role="img" [attr.aria-label]="expensesAriaLabel"></canvas>
            </div>
            <aside class="exec-visuals__split-aside exec-visuals__split-aside--compact">
              <div class="exec-visuals__split-metric-list">
                <div class="exec-visuals__split-metric">
                  <span class="exec-visuals__split-metric-label">Collected</span>
                  <strong class="exec-visuals__split-metric-value">{{ formatMoney(exp.month_collected) }}</strong>
                </div>
                <div class="exec-visuals__split-metric">
                  <span class="exec-visuals__split-metric-label">Recorded expenses</span>
                  <strong class="exec-visuals__split-metric-value">{{ formatMoney(exp.month_expenses) }}</strong>
                </div>
              </div>
            </aside>
          </div>
        </section>

        <section
          *ngIf="showReportsChartPanels"
          class="cf-chart-panel cf-panel exec-visuals__cell exec-visuals__cell--line"
          role="region"
          aria-label="Collection trend"
          aria-labelledby="exec-trend-heading"
        >
          <div class="cf-chart-panel__head">
            <div>
              <h3 id="exec-trend-heading">Collection trend</h3>
              <p>Last 12 months collected</p>
            </div>
          </div>
          <p class="exec-visuals__sr-only">{{ trendAriaLabel }}</p>
          <div class="cf-chart-panel__chart-wrap" *ngIf="v.collection_trend?.length; else trendEmpty">
            <canvas #trendCanvas role="img" [attr.aria-label]="trendAriaLabel"></canvas>
          </div>
          <ng-template #trendEmpty>
            <p class="cf-chart-panel__empty">Not enough collection history yet.</p>
          </ng-template>
          <div class="exec-visuals__drill-actions" *ngIf="v.collection_trend?.length">
            <button
              type="button"
              class="cf-btn cf-btn--sm"
              *ngFor="let row of v.collection_trend"
              (click)="openDrill('collection_trend', 'collected', row.period)"
            >
              {{ formatShortMonth(row.label) }}
            </button>
          </div>
        </section>

        <section
          *ngIf="showReportsChartPanels"
          class="cf-chart-panel cf-panel exec-visuals__cell exec-visuals__cell--line"
          aria-labelledby="exec-forecast-heading"
        >
          <div class="cf-chart-panel__head">
            <div>
              <h3 id="exec-forecast-heading">Month-end forecast</h3>
              <p>Current pace vs projected collections</p>
            </div>
          </div>
          <p class="exec-visuals__sr-only">{{ forecastAriaLabel }}</p>
          <div class="cf-chart-panel__chart-wrap" *ngIf="hasForecastChart; else forecastEmpty">
            <canvas #forecastCanvas role="img" [attr.aria-label]="forecastAriaLabel"></canvas>
          </div>
          <ng-template #forecastEmpty>
            <p class="cf-chart-panel__empty">Not enough collection history yet.</p>
          </ng-template>
          <p class="exec-visuals__caption exec-visuals__caption--muted" *ngIf="summary.visuals?.forecast?.method">
            Method: {{ summary.visuals?.forecast?.method }} — illustrative pace, not committed revenue.
          </p>
          <p class="exec-visuals__caption" *ngIf="summary.forecast_narrative">{{ summary.forecast_narrative }}</p>
          <div class="exec-visuals__drill-actions" *ngIf="hasForecastChart && summary.visuals?.forecast as f">
            <button
              type="button"
              class="cf-btn cf-btn--sm"
              *ngFor="let row of (f.history | slice:-6)"
              (click)="openDrill('month_end_forecast', 'collected', row.period)"
            >
              {{ formatShortMonth(row.label) }} collected
            </button>
            <button type="button" class="cf-btn cf-btn--sm" (click)="openDrill('month_end_forecast', 'current_month_projection', 'current_month_projection')">
              Projected month-end
            </button>
          </div>
        </section>
    </div>
  `,
  styles: [`
    .exec-visuals {
      display: grid;
      gap: var(--cf-space-3);
      align-items: stretch;
    }
    .exec-visuals--cols-2 {
      grid-template-columns: repeat(2, minmax(0, 1fr));
    }
    .exec-visuals--health-only {
      grid-template-columns: minmax(0, 1fr);
    }
    .exec-visuals__cell {
      display: flex;
      flex-direction: column;
      min-width: 0;
      height: 100%;
    }
    .exec-visuals__cell.cf-chart-panel { flex: 1; }
    .exec-visuals__health {
      grid-column: 1 / -1;
      align-self: start;
    }
    .exec-visuals__health.cf-chart-panel {
      min-height: 0;
      padding: var(--cf-space-2) var(--cf-space-3);
    }
    .exec-visuals__health-hero {
      display: grid;
      grid-template-columns: minmax(0, 1fr) auto;
      gap: 0.25rem 1rem;
      align-items: center;
      margin-bottom: 0.5rem;
    }
    .exec-visuals__health-hero-title {
      display: flex;
      align-items: center;
      gap: 0.35rem;
      min-width: 0;
    }
    .exec-visuals__health-hero-title h3 {
      margin: 0;
      font-size: 1rem;
    }
    .exec-visuals__health-help {
      display: inline-flex;
      align-items: center;
      justify-content: center;
      margin: 0;
      padding: 0.15rem;
      min-width: 2.25rem;
      min-height: 2.25rem;
      border: 0;
      border-radius: 999px;
      background: transparent;
      color: var(--cf-slate-500);
      cursor: pointer;
    }
    .exec-visuals__health-help:hover,
    .exec-visuals__health-help[aria-expanded="true"] {
      color: var(--cf-primary);
      background: var(--cf-slate-100);
    }
    .exec-visuals__health-help:focus-visible {
      outline: 2px solid var(--cf-primary);
      outline-offset: 2px;
    }
    .exec-visuals__health-help app-cf-action-icon {
      --cf-icon-md: 0.9rem;
    }
    .exec-visuals__health-hero-index {
      display: flex;
      align-items: baseline;
      gap: 0.65rem;
      grid-column: 1;
    }
    .exec-visuals__health-method {
      grid-column: 2;
      grid-row: 1 / span 2;
      align-self: center;
      font-size: 0.72rem;
      white-space: nowrap;
    }
    .exec-visuals__health-score {
      display: inline-flex;
      align-items: baseline;
      gap: 0.25rem;
      margin: 0;
      padding: 0;
      border: 0;
      background: transparent;
      font: inherit;
      color: inherit;
      cursor: pointer;
    }
    .exec-visuals__health-score strong {
      font-size: 1.85rem;
      line-height: 1;
      font-variant-numeric: tabular-nums;
      font-weight: 700;
      color: var(--cf-slate-900);
    }
    .exec-visuals__health-score span {
      font-size: 0.75rem;
      color: var(--cf-slate-500);
      font-weight: 600;
    }
    .exec-visuals__health-score:focus-visible {
      outline: 2px solid var(--cf-primary);
      outline-offset: 3px;
      border-radius: 4px;
    }
    .exec-visuals__health-method-copy {
      margin: 0 0 0.55rem;
      max-width: 42rem;
    }
    .exec-visuals__states {
      display: grid;
      grid-template-columns: repeat(4, minmax(0, 1fr));
      gap: 0.5rem;
      margin: 0 0 0.65rem;
      padding: 0;
      list-style: none;
    }
    .exec-visuals__state {
      display: flex;
      flex-direction: column;
      gap: 0.4rem;
      min-width: 0;
      margin: 0;
      padding: 0.55rem 0.65rem 0.6rem;
      border: 1px solid var(--cf-panel-border);
      border-radius: var(--cf-radius-sm);
      border-left-width: 3px;
      background: var(--cf-panel-bg);
    }
    .exec-visuals__state[data-state="performing"] { border-left-color: var(--cf-forest); }
    .exec-visuals__state[data-state="attention"] { border-left-color: var(--cf-amber); }
    .exec-visuals__state[data-state="pending"] { border-left-color: var(--cf-slate-400); }
    .exec-visuals__state[data-state="opportunity"] { border-left-color: var(--cf-info); }
    .exec-visuals__state-head {
      display: grid;
      grid-template-columns: auto auto minmax(0, 1fr);
      gap: 0.35rem;
      align-items: start;
    }
    .exec-visuals__state-index {
      font-size: 0.62rem;
      font-weight: 700;
      letter-spacing: 0.06em;
      color: var(--cf-muted);
      padding-top: 0.12rem;
    }
    .exec-visuals__state-head app-cf-action-icon {
      --cf-icon-md: 0.95rem;
      color: var(--cf-slate-600);
      margin-top: 0.05rem;
    }
    .exec-visuals__state-titles h4 {
      margin: 0;
      font-size: 0.82rem;
      font-weight: 700;
      color: var(--cf-slate-900);
      line-height: 1.2;
    }
    .exec-visuals__state-eyebrow {
      display: block;
      font-size: 0.62rem;
      font-weight: 600;
      letter-spacing: 0.04em;
      text-transform: uppercase;
      color: var(--cf-muted);
      line-height: 1.2;
    }
    .exec-visuals__state-metrics {
      list-style: none;
      margin: 0;
      padding: 0;
      display: grid;
      gap: 0.28rem;
    }
    .exec-visuals__state-metric {
      display: flex;
      align-items: baseline;
      justify-content: space-between;
      gap: 0.4rem;
      width: 100%;
      margin: 0;
      padding: 0;
      border: 0;
      background: transparent;
      font: inherit;
      text-align: left;
      color: inherit;
      cursor: pointer;
    }
    .exec-visuals__state-metric--static { cursor: default; }
    .exec-visuals__state-metric:hover strong { color: var(--cf-primary); }
    .exec-visuals__state-metric--static:hover strong { color: inherit; }
    .exec-visuals__state-metric:focus-visible {
      outline: 2px solid var(--cf-primary);
      outline-offset: 2px;
      border-radius: 4px;
    }
    .exec-visuals__state-metric-copy {
      display: grid;
      gap: 0.05rem;
      min-width: 0;
    }
    .exec-visuals__state-metric-label {
      font-size: 0.74rem;
      color: var(--cf-slate-700);
      line-height: 1.25;
    }
    .exec-visuals__state-metric-hint {
      font-size: 0.62rem;
      color: var(--cf-muted);
      line-height: 1.2;
    }
    .exec-visuals__state-metric strong {
      font-size: 0.78rem;
      font-variant-numeric: tabular-nums;
      white-space: nowrap;
      color: var(--cf-slate-900);
    }
    .exec-visuals__state-metric--subset {
      padding-left: 0.55rem;
      border-left: 2px solid var(--cf-slate-200);
    }
    .exec-visuals__state-empty {
      margin: 0;
    }
    .exec-visuals__drivers {
      margin: 0;
      padding-top: 0.5rem;
      border-top: 1px solid var(--cf-panel-border);
    }
    .exec-visuals__drivers-head {
      display: flex;
      flex-wrap: wrap;
      align-items: baseline;
      justify-content: space-between;
      gap: 0.2rem 0.75rem;
      margin-bottom: 0.4rem;
    }
    .exec-visuals__drivers-head h4 {
      margin: 0;
      font-size: 0.7rem;
      font-weight: 700;
      letter-spacing: 0.04em;
      text-transform: uppercase;
      color: var(--cf-muted);
    }
    .exec-visuals__drivers-head .cf-helper {
      margin: 0;
    }
    .exec-visuals__drivers-grid {
      display: grid;
      grid-template-columns: repeat(4, minmax(0, 1fr));
      gap: 0.4rem;
      margin: 0;
      padding: 0;
      list-style: none;
    }
    .exec-visuals__drivers .cf-health-metric {
      appearance: none;
      width: 100%;
      padding: 0.4rem 0.5rem;
      gap: 0.22rem;
      text-align: left;
      font: inherit;
      color: inherit;
      cursor: pointer;
    }
    .exec-visuals__drivers .cf-health-metric:focus-visible {
      outline: 2px solid var(--cf-primary);
      outline-offset: 2px;
    }
    .exec-visuals__drivers .cf-health-metric__title {
      font-size: 0.68rem;
      text-transform: none;
      letter-spacing: 0;
      color: var(--cf-slate-700);
    }
    .exec-visuals__drivers .cf-health-metric__value {
      font-size: 1.05rem;
    }
    .exec-visuals__drivers .cf-health-metric__bar {
      height: 0.28rem;
    }
    .exec-visuals__factor-score--na {
      font-size: 0.85rem;
      color: var(--cf-slate-500);
    }
    .exec-visuals__snapshot-body {
      display: grid;
      gap: 0.5rem;
      padding: 0.25rem 0;
    }
    .exec-visuals__snapshot-metric {
      display: flex;
      justify-content: space-between;
      align-items: baseline;
      gap: 0.5rem;
      width: 100%;
      padding: 0.35rem 0;
      border: 0;
      background: transparent;
      font: inherit;
      text-align: left;
      cursor: pointer;
      color: inherit;
    }
    .exec-visuals__snapshot-metric:hover strong { color: var(--cf-primary); }
    .exec-visuals__snapshot-metric span { color: var(--cf-slate-600); font-size: 0.82rem; }
    .exec-visuals__snapshot-na {
      margin: 0;
      font-size: 0.82rem;
      color: var(--cf-slate-600);
    }
    .exec-visuals__project-list {
      list-style: none;
      margin: 0;
      padding: 0;
      display: grid;
      gap: 0.65rem;
    }
    .exec-visuals__project-list li {
      display: grid;
      gap: 0.2rem;
    }
    .exec-visuals__project-name { font-weight: 600; font-size: 0.88rem; }
    .exec-visuals__project-pct { font-size: 0.82rem; color: var(--cf-slate-600); }
    .exec-visuals__project-amounts { font-size: 0.78rem; color: var(--cf-slate-600); }
    .exec-visuals__swatch--later { background: var(--cf-slate-400, #94a3b8); }
    .exec-visuals__split-body--due-schedule {
      align-items: stretch;
    }
    .exec-visuals__split-chart--due-schedule {
      min-height: var(--exec-lead-chart-size);
      height: var(--exec-lead-chart-size);
      max-height: var(--exec-lead-chart-size);
    }
    .exec-visuals__split-aside--due-schedule {
      justify-content: flex-start;
      gap: 0.65rem;
      min-width: 0;
    }
    .exec-visuals__due-schedule-strip {
      display: flex;
      flex-direction: column;
      align-items: stretch;
      gap: 0.35rem;
      width: 100%;
    }
    .exec-visuals__due-schedule-item {
      display: flex;
      flex: 0 0 auto;
      width: 100%;
      min-width: 0;
      align-items: center;
      gap: 0.35rem;
      margin: 0;
      padding: 0.3rem 0.4rem;
      border: 1px solid var(--cf-panel-border, var(--cf-slate-200));
      border-radius: var(--cf-radius-sm, 6px);
      background: var(--cf-slate-50, #f8fafc);
      font: inherit;
      color: inherit;
      text-align: left;
      cursor: pointer;
      transition: border-color 0.15s ease, background-color 0.15s ease;
    }
    .exec-visuals__due-schedule-item:hover:not(:disabled) {
      border-color: var(--cf-slate-300, #cbd5e1);
      background: var(--cf-slate-100, #f1f5f9);
    }
    .exec-visuals__due-schedule-item:disabled {
      cursor: default;
      opacity: 0.72;
    }
    .exec-visuals__due-schedule-item:focus-visible {
      outline: 2px solid var(--cf-primary);
      outline-offset: 2px;
    }
    .exec-visuals__due-schedule-item .cf-chart-panel__swatch {
      flex-shrink: 0;
    }
    .exec-visuals__due-schedule-item-copy {
      display: flex;
      flex-direction: column;
      align-items: flex-start;
      gap: 0.1rem;
      min-width: 0;
      flex: 1;
    }
    .exec-visuals__due-schedule-item-label {
      font-size: 0.68rem;
      font-weight: 600;
      text-transform: uppercase;
      letter-spacing: 0.03em;
      color: var(--cf-muted);
      line-height: 1.2;
      white-space: nowrap;
    }
    .exec-visuals__due-schedule-item-value {
      font-size: 0.78rem;
      font-weight: 700;
      color: var(--cf-slate-900);
      line-height: 1.2;
      word-break: break-word;
    }
    .exec-visuals__due-schedule-meta {
      display: flex;
      flex-direction: column;
      align-items: flex-start;
      gap: 0.25rem;
      margin: 0;
      padding-top: 0.35rem;
      border-top: 1px solid var(--cf-panel-border, var(--cf-slate-200));
      width: 100%;
      font-size: 0.74rem;
      line-height: 1.35;
      color: var(--cf-slate-600);
      text-align: left;
    }
    .exec-visuals__due-schedule-meta-btn {
      margin: 0;
      padding: 0;
      border: 0;
      background: transparent;
      font: inherit;
      color: inherit;
      text-decoration: underline;
      text-underline-offset: 2px;
      cursor: pointer;
    }
    .exec-visuals__due-schedule-meta-btn:hover {
      color: var(--cf-primary);
    }
    .exec-visuals__due-schedule-meta-btn:focus-visible {
      outline: 2px solid var(--cf-primary);
      outline-offset: 2px;
      border-radius: 2px;
    }
    .exec-visuals__due-schedule-meta-btn--total {
      font-weight: 600;
      color: var(--cf-slate-800);
      text-decoration: none;
    }
    .exec-visuals__due-schedule-meta-btn--total:hover {
      color: var(--cf-primary);
      text-decoration: underline;
      text-underline-offset: 2px;
    }
    .exec-visuals__caption--muted { font-size: 0.78rem; color: var(--cf-slate-600); }
    .exec-visuals__split-panel.exec-visuals__collections,
    .exec-visuals__split-panel.exec-visuals__snapshot,
    .exec-visuals__participation {
      --exec-lead-chart-size: 202px;
    }
    .exec-visuals__outstanding {
      --exec-lead-chart-size: 163px;
    }
    .exec-visuals__gauge-wrap {
      position: relative;
      width: min(100%, var(--exec-lead-chart-size));
      aspect-ratio: 1;
      max-height: var(--exec-lead-chart-size);
      margin: 0;
      flex-shrink: 0;
      overflow: hidden;
      isolation: isolate;
    }
    .exec-visuals__gauge-wrap--interactive {
      display: block;
      padding: 0;
      border: 0;
      background: transparent;
      font: inherit;
      color: inherit;
      text-align: inherit;
      cursor: pointer;
      transition: transform 0.15s ease, box-shadow 0.15s ease;
    }
    .exec-visuals__gauge-wrap--interactive:hover {
      transform: scale(1.02);
    }
    .exec-visuals__gauge-wrap--interactive:focus-visible {
      outline: 2px solid var(--cf-primary);
      outline-offset: 3px;
      border-radius: 50%;
    }
    .exec-visuals__gauge-wrap > canvas {
      display: block;
      width: 100% !important;
      height: 100% !important;
      pointer-events: auto;
    }
    .exec-visuals__gauge-center {
      position: absolute;
      inset: 0;
      display: flex;
      flex-direction: column;
      align-items: center;
      justify-content: center;
      pointer-events: none;
    }
    .exec-visuals__gauge-center strong {
      font-size: clamp(1.75rem, 4vw, 2.35rem);
      line-height: 1;
      font-weight: 700;
      color: var(--cf-slate-900);
    }
    .exec-visuals__gauge-center span { color: var(--cf-muted); font-size: 0.8rem; font-weight: 500; }
    .exec-visuals__chip--prominent {
      font-size: 0.65rem;
      padding: 0.15rem 0.45rem;
    }
    .exec-visuals__factors--compact {
      gap: 0.2rem;
    }
    .exec-visuals__factors--compact .exec-visuals__factor-label {
      font-size: 0.75rem;
    }
    .exec-visuals__factors--compact .exec-visuals__factor-score {
      font-size: 0.72rem;
    }
    .exec-visuals__factors--compact .exec-visuals__factor-bar {
      height: 5px;
    }
    .exec-visuals__split-panel.cf-chart-panel,
    .exec-visuals__collections.cf-chart-panel {
      min-height: 0;
    }
    .exec-visuals__split-head {
      margin-bottom: var(--cf-space-2);
    }
    .exec-visuals__split-body {
      display: grid;
      grid-template-columns: minmax(0, 3fr) minmax(0, 2fr);
      gap: var(--cf-space-3);
      align-items: center;
      flex: 1;
      min-height: 0;
      width: 100%;
    }
    .exec-visuals__split-chart {
      display: flex;
      align-items: center;
      justify-content: center;
      width: 100%;
      min-height: var(--exec-lead-chart-size);
      height: var(--exec-lead-chart-size);
      max-height: var(--exec-lead-chart-size);
      cursor: pointer;
      max-width: none;
      margin: 0;
    }
    .exec-visuals__split-chart--donut {
      cursor: default;
    }
    .exec-visuals__donut-ring {
      position: relative;
      width: min(100%, var(--exec-lead-chart-size));
      aspect-ratio: 1;
      max-height: var(--exec-lead-chart-size);
      margin: 0 auto;
      flex-shrink: 0;
      cursor: pointer;
    }
    .exec-visuals__donut-ring > canvas {
      display: block;
      width: 100% !important;
      height: 100% !important;
      pointer-events: auto;
    }
    .exec-visuals__donut-center {
      position: absolute;
      inset: 0;
      display: flex;
      align-items: center;
      justify-content: center;
      pointer-events: none;
    }
    .exec-visuals__donut-center strong {
      font-size: 1.15rem;
      font-weight: 700;
      line-height: 1;
      letter-spacing: -0.02em;
      color: var(--cf-slate-900);
    }
    .exec-visuals__split-body .exec-visuals__split-chart.cf-chart-panel__chart-wrap canvas {
      display: block;
      width: 100% !important;
      height: 100% !important;
    }
    .exec-visuals__split-aside {
      display: flex;
      flex-direction: column;
      justify-content: center;
      gap: var(--cf-space-2);
      min-width: 0;
      min-height: 0;
      padding: 0 0 0 var(--cf-space-2);
      border-left: 1px solid var(--cf-panel-border, var(--cf-slate-200));
    }
    .exec-visuals__split-aside--compact {
      min-height: 0;
      gap: 0.35rem;
      justify-content: center;
    }
    .exec-visuals__split-aside--compact .exec-visuals__split-metric-list {
      gap: 0.25rem;
    }
    .exec-visuals__split-aside--compact .exec-visuals__split-metric {
      padding: 0.3rem 0.45rem;
    }
    .exec-visuals__split-aside--compact .exec-visuals__split-metric-value {
      font-size: 0.85rem;
    }
    .exec-visuals__split-aside--compact .exec-visuals__participation-rate {
      font-size: 1.1rem;
    }
    .exec-visuals__split-metric-list {
      display: flex;
      flex-direction: column;
      gap: 0.35rem;
      width: 100%;
    }
    .exec-visuals__split-metric {
      display: flex;
      flex-direction: column;
      align-items: flex-start;
      gap: 0.1rem;
      width: 100%;
      margin: 0;
      padding: 0.4rem 0.5rem;
      border: 1px solid transparent;
      border-radius: var(--cf-radius-sm, 6px);
      background: var(--cf-slate-50, #f8fafc);
      text-align: left;
      cursor: pointer;
      font: inherit;
      color: inherit;
      transition: border-color 0.15s ease, background-color 0.15s ease;
    }
    .exec-visuals__split-metric--compact {
      padding: 0.35rem 0.5rem;
    }
    .exec-visuals__split-metric:hover {
      border-color: var(--cf-panel-border, var(--cf-slate-200));
      background: var(--cf-slate-100, #f1f5f9);
    }
    .exec-visuals__split-metric:focus-visible {
      outline: 2px solid var(--cf-primary);
      outline-offset: 2px;
    }
    .exec-visuals__split-metric-label {
      font-size: 0.7rem;
      font-weight: 600;
      text-transform: uppercase;
      letter-spacing: 0.04em;
      color: var(--cf-muted);
      line-height: 1.2;
    }
    .exec-visuals__split-metric-value {
      font-size: 0.92rem;
      font-weight: 700;
      color: var(--cf-slate-900);
      line-height: 1.25;
      word-break: break-word;
    }
    .exec-visuals__split-legend {
      flex-direction: column;
      align-items: flex-start;
      gap: 0.35rem;
      margin: 0;
      padding-top: 0.15rem;
      font-size: 0.72rem;
    }
    .exec-visuals__swatch--overdue { background: #dc2626; }
    .exec-visuals__swatch--remaining { background: #f59e0b; }
    .exec-visuals__swatch--inactive { background: #e2e8f0; }
    .exec-visuals__participation-hero {
      display: flex;
      flex-direction: column;
      gap: 0.15rem;
    }
    .exec-visuals__participation-rate {
      margin: 0;
      font-size: 1.35rem;
      font-weight: 700;
      line-height: 1.1;
      letter-spacing: -0.02em;
      color: var(--cf-slate-900);
    }
    .exec-visuals__participation-counts {
      margin: 0;
      font-size: 0.78rem;
      color: var(--cf-slate-600);
      line-height: 1.35;
    }
    .exec-visuals__collections-growth {
      display: flex;
      flex-direction: column;
      gap: 0.1rem;
    }
    .exec-visuals__collections-growth-value {
      font-size: 1.1rem;
      font-weight: 700;
      line-height: 1.2;
      letter-spacing: -0.02em;
      color: var(--cf-slate-800);
    }
    .exec-visuals__collections-growth-value.up { color: #059669; }
    .exec-visuals__collections-growth-value.down { color: #dc2626; }
    .exec-visuals__collections-growth-label {
      font-size: 0.72rem;
      color: var(--cf-muted);
      line-height: 1.3;
    }
    .exec-visuals__collections-stats {
      display: flex;
      flex-direction: column;
      gap: 0.35rem;
      width: 100%;
    }
    .exec-visuals__collections-stat {
      display: flex;
      flex-direction: column;
      align-items: flex-start;
      gap: 0.1rem;
      width: 100%;
      margin: 0;
      padding: 0.4rem 0.5rem;
      border: 1px solid transparent;
      border-radius: var(--cf-radius-sm, 6px);
      background: var(--cf-slate-50, #f8fafc);
      text-align: left;
      cursor: pointer;
      font: inherit;
      color: inherit;
      transition: border-color 0.15s ease, background-color 0.15s ease;
    }
    .exec-visuals__collections-stat:hover {
      border-color: var(--cf-panel-border, var(--cf-slate-200));
      background: var(--cf-slate-100, #f1f5f9);
    }
    .exec-visuals__collections-stat:focus-visible {
      outline: 2px solid var(--cf-primary);
      outline-offset: 2px;
    }
    .exec-visuals__collections-stat-label {
      font-size: 0.7rem;
      font-weight: 600;
      text-transform: uppercase;
      letter-spacing: 0.04em;
      color: var(--cf-muted);
      line-height: 1.2;
    }
    .exec-visuals__collections-stat-value {
      font-size: 0.92rem;
      font-weight: 700;
      color: var(--cf-slate-900);
      line-height: 1.25;
      word-break: break-word;
    }
    .exec-visuals__collections-swatch--previous {
      background: #94a3b8;
    }
    .exec-visuals__chip {
      flex-shrink: 0;
      font-size: 0.68rem;
      font-weight: 600;
      text-transform: uppercase;
      letter-spacing: 0.03em;
      padding: 0.15rem 0.45rem;
      border-radius: 999px;
      background: var(--cf-slate-100);
      color: var(--cf-slate-700);
      white-space: nowrap;
    }
    .exec-visuals__chip[data-status="healthy"] { background: #d1fae5; color: #065f46; }
    .exec-visuals__chip[data-status="attention"] { background: #fef3c7; color: #92400e; }
    .exec-visuals__chip[data-status="risk"] { background: #fee2e2; color: #991b1b; }
    .exec-visuals__narrative {
      margin: 0;
      color: var(--cf-slate-700);
      line-height: 1.45;
      font-size: 0.82rem;
    }
    .exec-visuals__narrative--compact {
      display: -webkit-box;
      -webkit-line-clamp: 3;
      -webkit-box-orient: vertical;
      overflow: hidden;
      margin-bottom: 0.45rem;
    }
    .exec-visuals__drill-actions {
      display: flex;
      flex-wrap: wrap;
      gap: 0.35rem;
      margin-top: 0.5rem;
    }
    .exec-visuals__chip-link {
      border: 0;
      background: transparent;
      padding: 0;
      font: inherit;
      color: inherit;
      cursor: pointer;
      text-decoration: underline;
      text-underline-offset: 2px;
    }
    .exec-visuals__chip-link:focus-visible {
      outline: 2px solid var(--cf-primary);
      outline-offset: 2px;
    }
    .exec-visuals__factor-label {
      grid-column: 1;
      grid-row: 1;
      color: var(--cf-slate-700);
      line-height: 1.25;
    }
    .exec-visuals__factor-score {
      grid-column: 2;
      grid-row: 1;
      font-size: 0.78rem;
    }
    .exec-visuals__factors .exec-visuals__factor-bar {
      grid-column: 1 / -1;
      grid-row: 2;
    }
    .exec-visuals__factor-bar {
      height: 6px;
      background: var(--cf-slate-200);
      border-radius: 999px;
      overflow: hidden;
    }
    .exec-visuals__factor-bar span {
      display: block;
      height: 100%;
      background: linear-gradient(90deg, var(--cf-primary), var(--cf-forest));
    }
    .cf-chart-panel__chart-wrap {
      position: relative;
      height: 168px;
      width: 100%;
      flex: 0 0 auto;
      min-height: 0;
    }
    .exec-visuals__split-body .exec-visuals__split-chart.cf-chart-panel__chart-wrap {
      height: var(--exec-lead-chart-size);
      min-height: var(--exec-lead-chart-size);
      max-height: var(--exec-lead-chart-size);
      flex: 0 0 auto;
    }
    .exec-visuals__split-body--donut .exec-visuals__split-chart--donut.cf-chart-panel__chart-wrap,
    .exec-visuals__split-body--donut .exec-visuals__split-chart--donut,
    .exec-visuals__split-body--due-schedule .exec-visuals__split-chart--due-schedule {
      height: var(--exec-lead-chart-size);
      min-height: var(--exec-lead-chart-size);
      max-height: var(--exec-lead-chart-size);
      flex: 0 0 auto;
    }
    .exec-visuals__cell--line .cf-chart-panel__chart-wrap {
      height: 200px;
    }
    .exec-visuals__donut-wrap {
      max-width: 100%;
    }
    .exec-visuals__cell .cf-chart-panel__head h3 { font-size: 0.95rem; }
    .exec-visuals__cell .cf-chart-panel__head p { font-size: 0.8rem; margin: 0; }
    .exec-visuals__caption {
      margin: 0.5rem 0 0;
      font-size: 0.85rem;
      color: var(--cf-slate-700);
      line-height: 1.4;
    }
    .exec-visuals__caption .up { color: #059669; }
    .exec-visuals__caption .down { color: #dc2626; }
    .exec-visuals__caption--metrics {
      display: flex;
      flex-wrap: wrap;
      gap: 0.35rem 0.65rem;
      align-items: center;
    }
    .exec-visuals__donut-wrap { cursor: pointer; }
    .exec-visuals__sr-only {
      position: absolute;
      width: 1px;
      height: 1px;
      padding: 0;
      margin: -1px;
      overflow: hidden;
      clip: rect(0, 0, 0, 0);
      border: 0;
    }
    @media (max-width: 1100px) {
      .exec-visuals__states,
      .exec-visuals__drivers-grid {
        grid-template-columns: repeat(2, minmax(0, 1fr));
      }
    }
    @media (max-width: 900px) {
      .exec-visuals__split-panel.exec-visuals__collections,
      .exec-visuals__split-panel.exec-visuals__snapshot,
      .exec-visuals__participation {
        --exec-lead-chart-size: 182px;
      }
      .exec-visuals__outstanding {
        --exec-lead-chart-size: 150px;
      }
      .exec-visuals__health-hero {
        grid-template-columns: 1fr;
      }
      .exec-visuals__health-hero-index,
      .exec-visuals__health-method {
        grid-column: 1;
        grid-row: auto;
      }
      .exec-visuals__split-body {
        grid-template-columns: 1fr;
      }
      .exec-visuals__split-aside {
        border-left: 0;
        border-top: 1px solid var(--cf-panel-border, var(--cf-slate-200));
        padding: var(--cf-space-2) 0 0;
        min-height: 0;
        justify-content: flex-start;
      }
      .exec-visuals__split-legend {
        flex-direction: row;
        flex-wrap: wrap;
        gap: 0.65rem 0.85rem;
      }
    }
    @media (max-width: 640px) {
      .exec-visuals--cols-2 { grid-template-columns: 1fr; }
      .exec-visuals__states,
      .exec-visuals__drivers-grid {
        grid-template-columns: 1fr;
      }
    }
  `]
})
export class ExecutiveSummaryVisualsComponent implements AfterViewInit, OnChanges, OnDestroy {
  private readonly cdr = inject(ChangeDetectorRef);
  private readonly currency = inject(ChurchCurrencyService);

  @Input({ required: true }) summary!: ExecutiveReportSummary;
  /**
   * `dashboard` = stewardship health + overview charts (Collections, snapshot, due schedule, participation).
   * `reports` = leadership reports charts (projects, expenses, trend, forecast).
   * `health` = stewardship health only (tests). `all` = full board.
   */
  @Input() visualScope: 'all' | 'dashboard' | 'reports' | 'health' | 'charts' = 'all';
  @Output() drillDownRequested = new EventEmitter<ReportDrillDownRequestPayload>();

  get showHealthBlock(): boolean {
    return this.visualScope === 'all' || this.visualScope === 'dashboard' || this.visualScope === 'health';
  }

  get showOverviewChartPanels(): boolean {
    return this.visualScope === 'all' || this.visualScope === 'dashboard' || this.visualScope === 'charts';
  }

  get showReportsChartPanels(): boolean {
    return this.visualScope === 'all' || this.visualScope === 'reports' || this.visualScope === 'charts';
  }

  get usesChartGrid(): boolean {
    if (this.visualScope === 'health') {
      return false;
    }
    return this.showOverviewChartPanels || this.showReportsChartPanels;
  }

  @ViewChild('collectionsCanvas') collectionsCanvas?: ElementRef<HTMLCanvasElement>;
  @ViewChild('outstandingCanvas') outstandingCanvas?: ElementRef<HTMLCanvasElement>;
  @ViewChild('participationCanvas') participationCanvas?: ElementRef<HTMLCanvasElement>;
  @ViewChild('trendCanvas') trendCanvas?: ElementRef<HTMLCanvasElement>;
  @ViewChild('forecastCanvas') forecastCanvas?: ElementRef<HTMLCanvasElement>;
  @ViewChild('expensesCanvas') expensesCanvas?: ElementRef<HTMLCanvasElement>;
  @ViewChild('snapshotCanvas') snapshotCanvas?: ElementRef<HTMLCanvasElement>;

  private charts: Chart[] = [];
  healthMethodOpen = false;

  get hasCollectionsChart(): boolean {
    const c = this.summary?.visuals?.collections;
    return !!c && (c.current_month_collected > 0 || c.previous_month_collected > 0);
  }

  get hasOutstandingChart(): boolean {
    const o = this.summary?.visuals?.outstanding;
    if (!o) {
      return false;
    }
    const total =
      (o.overdue_amount ?? 0) +
      (o.next_14_days_amount ?? 0) +
      (o.later_remaining_amount ?? 0);
    return total > 0 || o.pending_dues > 0;
  }

  get hasExpensesChart(): boolean {
    const exp = this.summary?.visuals?.expenses_vs_collections;
    return !!exp && (exp.month_collected > 0 || exp.month_expenses > 0);
  }

  get snapshotVisual(): ExecutiveReportCollectionSnapshot {
    const snap = this.summary?.visuals?.collection_snapshot;
    const outstanding = this.summary?.visuals?.outstanding?.pending_dues ?? 0;

    return snap ?? {
      expected: 0,
      collected: 0,
      outstanding,
      collection_rate_pct: null,
      has_assessment: false,
      collected_label: 'due_allocated'
    };
  }

  get hasForecastChart(): boolean {
    const f = this.summary?.visuals?.forecast;
    return !!f && (f.history?.length > 0 || f.current_month_projection > 0);
  }

  get healthAriaLabel(): string {
    const h = this.summary?.visuals?.health;
    return h ? `Stewardship health score ${h.score} out of 100, ${h.label}` : '';
  }

  get healthGaugeActionAriaLabel(): string {
    const base = this.healthAriaLabel;
    return base ? `${base}. Open score breakdown.` : 'Open stewardship health score breakdown.';
  }

  get collectionsPeriodLabel(): string {
    return this.summary?.visuals?.collections?.period_label || 'This month';
  }

  get collectionsComparisonLabel(): string {
    return this.summary?.visuals?.collections?.comparison_label || 'Same days last month';
  }

  get collectionsCaption(): string {
    return `${this.collectionsPeriodLabel} vs ${this.collectionsComparisonLabel.toLowerCase()}`;
  }

  get participationWindowCaption(): string {
    const days = this.summary?.visuals?.participation?.window_days ?? 90;
    return `last ${days} days`;
  }

  get collectionsAriaLabel(): string {
    const c = this.summary?.visuals?.collections;
    if (!c) return '';
    return `${this.collectionsPeriodLabel} ${this.formatMoney(c.current_month_collected)}, ${this.collectionsComparisonLabel} ${this.formatMoney(c.previous_month_collected)}`;
  }

  get snapshotAriaLabel(): string {
    const snap = this.snapshotVisual;
    return `Expected ${this.formatMoney(snap.expected)}, collected ${this.formatMoney(snap.collected)}, outstanding ${this.formatMoney(snap.outstanding)}`;
  }

  get outstandingAriaLabel(): string {
    const o = this.summary?.visuals?.outstanding;
    if (!o) return '';
    return `Overdue ${this.formatMoney(o.overdue_amount)}, next 14 days ${this.formatMoney(o.next_14_days_amount ?? 0)}, later ${this.formatMoney(o.later_remaining_amount ?? 0)}`;
  }

  get expensesAriaLabel(): string {
    const exp = this.summary?.visuals?.expenses_vs_collections;
    if (!exp) {
      return '';
    }
    return `Collected ${this.formatMoney(exp.month_collected)}, recorded expenses ${this.formatMoney(exp.month_expenses)}`;
  }

  get participationAriaLabel(): string {
    const p = this.summary?.visuals?.participation;
    if (!p) return '';
    return `${p.participating_families} of ${p.active_families} active families contributed in the last ${p.window_days} days`;
  }

  get trendAriaLabel(): string {
    const n = this.summary?.visuals?.collection_trend?.length ?? 0;
    return `Collection trend over ${n} months`;
  }

  get forecastAriaLabel(): string {
    const f = this.summary?.visuals?.forecast;
    if (!f) return '';
    return `Current month collected ${this.formatMoney(f.current_month_collected)}, projected ${this.formatMoney(f.current_month_projection)}`;
  }

  ngAfterViewInit(): void {
    this.renderAll();
  }

  ngOnChanges(changes: SimpleChanges): void {
    if (
      (changes['summary'] && !changes['summary'].firstChange)
      || (changes['visualScope'] && !changes['visualScope'].firstChange)
    ) {
      queueMicrotask(() => this.renderAll());
    }
  }

  ngOnDestroy(): void {
    this.destroyCharts();
  }

  formatMoney(value: number): string {
    return formatFocCurrency(value, this.currency.currencyCode() ?? '');
  }

  hasHealthStory(story: ExecutiveReportVisuals['health']['story'] | undefined): boolean {
    if (!story) {
      return false;
    }
    return (
      (story.performing?.length ?? 0) > 0
      || (story.attention?.length ?? 0) > 0
      || (story.pending?.length ?? 0) > 0
      || (story.opportunity?.length ?? 0) > 0
    );
  }

  healthStateColumns(story: ExecutiveReportVisuals['health']['story'] | undefined): HealthStateColumn[] {
    return [
      {
        id: 'performing',
        index: '01',
        title: 'Performing',
        eyebrow: 'On track',
        icon: 'line-chart',
        empty: 'No collection activity this month',
        items: story?.performing ?? []
      },
      {
        id: 'attention',
        index: '02',
        title: 'Attention',
        eyebrow: 'Follow up',
        icon: 'users',
        empty: 'No overdue balances',
        items: story?.attention ?? []
      },
      {
        id: 'pending',
        index: '03',
        title: 'Pending',
        eyebrow: 'Coming due',
        icon: 'calendar-clock',
        empty: 'No remaining collectable dues',
        items: story?.pending ?? []
      },
      {
        id: 'opportunity',
        index: '04',
        title: 'Opportunity',
        eyebrow: 'Act now',
        icon: 'calendar-check',
        empty: 'No upcoming-due families or near-goal projects',
        items: story?.opportunity ?? []
      }
    ];
  }

  storyItemLabel(item: ExecutiveReportHealthStoryItem): string {
    switch (item.key) {
      case 'collected':
        return 'Collected this month';
      case 'growth':
        return 'Growth vs comparison period';
      case 'participation':
        return 'Family participation';
      case 'overdue_amount':
        return 'Overdue';
      case 'overdue_families':
        return 'Overdue families';
      case 'remaining_collectable':
        return 'Remaining collectable';
      case 'next_14_days':
        return 'Of that, due in 14 days';
      case 'upcoming_dues':
        return 'Families with upcoming dues';
      case 'project_near_goal':
        return item.label.replace(/\s+is\s+[\d.]+%\s+funded$/i, '').trim() || 'Project near goal';
      default:
        return item.label;
    }
  }

  storyItemHint(item: ExecutiveReportHealthStoryItem): string | null {
    switch (item.key) {
      case 'participation':
        return `${this.summary?.visuals?.participation?.window_days ?? 90} days`;
      case 'overdue_amount':
      case 'overdue_families':
        return 'Past due';
      case 'remaining_collectable':
        return 'Not overdue';
      case 'next_14_days':
        return 'Subset of remaining';
      case 'upcoming_dues':
        return 'Not overdue — due in the next 14 days';
      case 'project_near_goal':
        return 'Active project at 80%+ funded';
      default:
        return null;
    }
  }

  storyDrill(item: ExecutiveReportHealthStoryItem): ReportDrillDownRequestPayload | null {
    switch (item.key) {
      case 'collected':
        return { graph_id: 'collections', data_element_id: 'current_month_collected', slice_id: 'current_month' };
      case 'growth':
        return { graph_id: 'collections', data_element_id: 'previous_month_collected', slice_id: 'previous_month' };
      case 'participation':
        return { graph_id: 'family_participation', data_element_id: 'participating_families', slice_id: 'participating' };
      case 'overdue_amount':
        return { graph_id: 'outstanding_overdue', data_element_id: 'overdue_amount', slice_id: 'overdue' };
      case 'overdue_families':
        return { graph_id: 'outstanding_overdue', data_element_id: 'overdue_family_count', slice_id: 'overdue' };
      case 'remaining_collectable':
        return { graph_id: 'outstanding_overdue', data_element_id: 'remaining_collectable', slice_id: 'remaining_collectable' };
      case 'next_14_days':
      case 'upcoming_dues':
        return { graph_id: 'outstanding_overdue', data_element_id: 'next_14_days_amount', slice_id: 'upcoming_14d' };
      case 'project_near_goal':
        return { graph_id: 'financial_health', data_element_id: 'project_funding', slice_id: 'project_funding' };
      default:
        return null;
    }
  }

  formatStoryItem(item: ExecutiveReportHealthStoryItem): string {
    if (item.value_kind === 'money') {
      return this.formatMoney(item.value);
    }
    if (item.value_kind === 'percent') {
      return `${item.value.toFixed(1)}%`;
    }
    return `${item.value}`;
  }

  toggleHealthMethod(): void {
    this.healthMethodOpen = !this.healthMethodOpen;
    this.cdr.markForCheck();
  }

  statusTone(status: string): StatusBadgeTone {
    if (status === 'healthy') {
      return 'success';
    }
    if (status === 'risk') {
      return 'critical';
    }
    return 'warning';
  }

  factorDriverTone(factor: ExecutiveReportHealthFactor): 'healthy' | 'attention' | 'risk' | null {
    if (factor.not_applicable) {
      return null;
    }
    if (factor.score >= 80) {
      return 'healthy';
    }
    if (factor.score >= 50) {
      return 'attention';
    }
    return 'risk';
  }

  emitDrillDown(payload: ReportDrillDownRequestPayload): void {
    this.drillDownRequested.emit(payload);
  }

  openDrill(graphId: ReportDrillDownGraphId, dataElementId: string, sliceId: string): void {
    if (!(REPORT_DRILL_DOWN_GRAPH_IDS as readonly string[]).includes(graphId)) {
      return;
    }
    this.emitDrillDown({ graph_id: graphId, data_element_id: dataElementId, slice_id: sliceId });
  }

  statusLabel(status: string): string {
    return status === 'healthy' ? 'Healthy' : status === 'risk' ? 'High risk' : 'Needs attention';
  }

  private renderAll(): void {
    if (!this.summary?.visuals) {
      return;
    }
    if (!this.showOverviewChartPanels && !this.showReportsChartPanels) {
      this.destroyCharts();
      this.cdr.markForCheck();
      return;
    }
    this.destroyCharts();
    if (this.showOverviewChartPanels) {
      this.renderCollectionsBar();
      this.renderSnapshotBar();
      this.renderOutstandingDonut();
      this.renderParticipationDonut();
    }
    if (this.showReportsChartPanels) {
      this.renderTrendLine();
      this.renderForecastChart();
      this.renderExpensesBar();
    }
    this.cdr.markForCheck();
  }

  private destroyCharts(): void {
    for (const chart of this.charts) {
      chart.destroy();
    }
    this.charts = [];
  }

  private renderCollectionsBar(): void {
    const canvas = this.collectionsCanvas?.nativeElement;
    const c = this.summary.visuals?.collections;
    if (!canvas || !c || !this.hasCollectionsChart) {
      return;
    }
    const chart = new Chart(canvas, {
      type: 'bar',
      data: {
        labels: [this.collectionsPeriodLabel, this.collectionsComparisonLabel],
        datasets: [{
          label: 'Collected',
          data: [c.current_month_collected, c.previous_month_collected],
          backgroundColor: [CHART_COLORS.forest, CHART_COLORS.slate],
          borderRadius: 8,
          barPercentage: 0.55,
          categoryPercentage: 0.72,
          maxBarThickness: 88
        }]
      },
      options: {
        ...this.collectionsBarOptions(),
        onClick: (_event, elements) => {
          if (!elements.length || !c) {
            return;
          }
          const index = elements[0].index;
          if (index === 0) {
            this.openDrill('collections', 'current_month_collected', 'current_month');
          } else {
            this.openDrill('collections', 'previous_month_collected', 'previous_month');
          }
        }
      }
    });
    this.charts.push(chart);
  }

  private renderSnapshotBar(): void {
    const canvas = this.snapshotCanvas?.nativeElement;
    const snap = this.snapshotVisual;
    if (!canvas) {
      return;
    }

    const chart = new Chart(canvas, {
      type: 'bar',
      data: {
        labels: ['Expected', 'Collected'],
        datasets: [{
          label: 'Due snapshot',
          data: [snap.expected, snap.collected],
          backgroundColor: [CHART_COLORS.primary, CHART_COLORS.forest],
          borderRadius: 8,
          barPercentage: 0.55,
          categoryPercentage: 0.72,
          maxBarThickness: 88
        }]
      },
      options: {
        ...this.collectionsBarOptions(),
        onClick: (_event, elements) => {
          if (!elements.length) {
            return;
          }
          const index = elements[0].index;
          if (index === 0) {
            this.openDrill('collection_snapshot', 'expected', 'expected');
          } else {
            this.openDrill('collection_snapshot', 'collected', 'collected');
          }
        }
      }
    });
    this.charts.push(chart);
  }

  private renderOutstandingDonut(): void {
    const canvas = this.outstandingCanvas?.nativeElement;
    const o = this.summary.visuals?.outstanding;
    if (!canvas || !o || !this.hasOutstandingChart) {
      return;
    }
    const chart = new Chart(canvas, {
      type: 'doughnut',
      data: {
        labels: ['Overdue', 'Next 14 days', 'Later remaining'],
        datasets: [{
          data: [
            o.overdue_amount,
            o.next_14_days_amount ?? 0,
            o.later_remaining_amount ?? 0
          ],
          backgroundColor: [CHART_COLORS.risk, CHART_COLORS.amber, CHART_COLORS.slate],
          borderWidth: 0
        }]
      },
      options: {
        ...this.splitDonutOptions(),
        onHover: (event, elements) => {
          const target = event.native?.target as HTMLElement | undefined;
          if (target) {
            target.style.cursor = elements.length ? 'pointer' : 'default';
          }
        },
        onClick: (_event, elements) => {
          if (!elements.length) {
            return;
          }
          const index = elements[0].index;
          if (index === 0 && o.overdue_amount > 0) {
            this.emitDrillDown({ graph_id: 'outstanding_overdue', data_element_id: 'overdue_amount', slice_id: 'overdue' });
          } else if (index === 1 && (o.next_14_days_amount ?? 0) > 0) {
            this.emitDrillDown({ graph_id: 'outstanding_overdue', data_element_id: 'next_14_days_amount', slice_id: 'upcoming_14d' });
          } else if (index === 2 && (o.later_remaining_amount ?? 0) > 0) {
            this.emitDrillDown({ graph_id: 'outstanding_overdue', data_element_id: 'later_remaining_amount', slice_id: 'later_remaining' });
          }
        },
        plugins: {
          legend: { display: false },
          tooltip: {
            callbacks: {
              footer: () => 'Click to see families'
            }
          }
        }
      }
    });
    this.charts.push(chart);
  }

  private renderParticipationDonut(): void {
    const canvas = this.participationCanvas?.nativeElement;
    const p = this.summary.visuals?.participation;
    if (!canvas || !p || p.active_families <= 0) {
      return;
    }
    const notParticipating = Math.max(0, p.active_families - p.participating_families);
    const chart = new Chart(canvas, {
      type: 'doughnut',
      data: {
        labels: ['Participating', 'Not yet contributing'],
        datasets: [{
          data: [p.participating_families, notParticipating],
          backgroundColor: [CHART_COLORS.forest, CHART_COLORS.muted],
          borderWidth: 0
        }]
      },
      options: {
        ...this.splitDonutOptions(),
        onClick: (_event, elements) => {
          if (!elements.length || !p) {
            return;
          }
          const index = elements[0].index;
          if (index === 0) {
            this.openDrill('family_participation', 'participating_families', 'participating');
          } else {
            this.openDrill('family_participation', 'not_participating', 'not_participating');
          }
        },
        plugins: { legend: { display: false } }
      }
    });
    this.charts.push(chart);
  }

  private renderExpensesBar(): void {
    const canvas = this.expensesCanvas?.nativeElement;
    const exp = this.summary.visuals?.expenses_vs_collections;
    if (!canvas || !exp || !this.hasExpensesChart) {
      return;
    }
    const chart = new Chart(canvas, {
      type: 'bar',
      data: {
        labels: ['Collected', 'Recorded expenses'],
        datasets: [{
          label: 'This month',
          data: [exp.month_collected, exp.month_expenses],
          backgroundColor: [CHART_COLORS.forest, CHART_COLORS.slate],
          borderRadius: 8,
          barPercentage: 0.55,
          categoryPercentage: 0.72,
          maxBarThickness: 88
        }]
      },
      options: this.collectionsBarOptions()
    });
    this.charts.push(chart);
  }

  private renderTrendLine(): void {
    const canvas = this.trendCanvas?.nativeElement;
    const trend = this.summary.visuals?.collection_trend ?? [];
    if (!canvas || trend.length === 0) {
      return;
    }
    const chart = new Chart(canvas, {
      type: 'line',
      data: {
        labels: trend.map((row) => this.formatShortMonth(row.label)),
        datasets: [{
          label: 'Collected',
          data: trend.map((row) => row.collected),
          borderColor: CHART_COLORS.primary,
          backgroundColor: 'rgba(79, 70, 229, 0.12)',
          fill: true,
          tension: 0.3,
          pointRadius: 3
        }]
      },
      options: {
        ...this.lineOptions(),
        onClick: (_event, elements) => {
          if (!elements.length) {
            return;
          }
          const row = trend[elements[0].index];
          if (row) {
            this.openDrill('collection_trend', 'collected', row.period);
          }
        }
      }
    });
    this.charts.push(chart);
  }

  private renderForecastChart(): void {
    const canvas = this.forecastCanvas?.nativeElement;
    const f = this.summary.visuals?.forecast;
    if (!canvas || !f || !this.hasForecastChart) {
      return;
    }
    const history = (f.history ?? []).slice(-6);
    const labels = history.map((row) => this.formatShortMonth(row.label));
    const collected = history.map((row) => row.collected);
    const projectedTail: (number | null)[] = collected.map(() => null);
    if (projectedTail.length) {
      projectedTail[projectedTail.length - 1] = f.current_month_projection;
    } else {
      labels.push('This month');
      collected.push(f.current_month_collected);
      projectedTail.push(f.current_month_projection);
    }

    const chart = new Chart(canvas, {
      type: 'line',
      data: {
        labels,
        datasets: [
          {
            label: 'Monthly collected',
            data: collected,
            borderColor: CHART_COLORS.forest,
            backgroundColor: 'rgba(13, 148, 136, 0.1)',
            fill: true,
            tension: 0.3,
            pointRadius: 3
          },
          {
            label: 'Projected month-end',
            data: projectedTail,
            borderColor: CHART_COLORS.amber,
            borderDash: [6, 4],
            backgroundColor: 'transparent',
            tension: 0,
            pointRadius: 5,
            spanGaps: false
          }
        ]
      },
      options: {
        ...this.lineOptions(),
        interaction: { mode: 'nearest' as const, intersect: true },
        onClick: (_event, elements) => {
          if (!elements.length || !f) {
            return;
          }
          const el = elements[0];
          if (el.datasetIndex === 1) {
            this.openDrill('month_end_forecast', 'current_month_projection', 'current_month_projection');
            return;
          }
          const hist = (f.history ?? []).slice(-6);
          const row = hist[el.index];
          if (row) {
            this.openDrill('month_end_forecast', 'collected', row.period);
          }
        }
      }
    });
    this.charts.push(chart);
  }

  private barOptions() {
    return {
      responsive: true,
      maintainAspectRatio: false,
      plugins: { legend: { display: false } },
      scales: {
        x: { grid: { display: false } },
        y: { beginAtZero: true }
      }
    };
  }

  private collectionsBarOptions() {
    return {
      responsive: true,
      maintainAspectRatio: false,
      plugins: { legend: { display: false } },
      scales: {
        x: {
          grid: { display: false },
          border: { display: false },
          ticks: { display: false }
        },
        y: {
          beginAtZero: true,
          grid: { color: 'rgba(148, 163, 184, 0.18)' },
          border: { display: false },
          ticks: {
            maxTicksLimit: 5,
            font: { size: 11 },
            color: '#64748b',
            padding: 6
          }
        }
      }
    };
  }

  private splitDonutOptions() {
    return {
      responsive: true,
      maintainAspectRatio: false,
      cutout: '68%',
      layout: { padding: 2 }
    };
  }

  private lineOptions() {
    return {
      responsive: true,
      maintainAspectRatio: false,
      interaction: { mode: 'index' as const, intersect: false },
      plugins: { legend: { position: 'bottom' as const } },
      scales: {
        x: { grid: { display: false } },
        y: { beginAtZero: true }
      }
    };
  }

  formatShortMonth(label: string): string {
    const parts = label.trim().split(/\s+/);
    return parts.length >= 2 ? parts[0] : label;
  }
}
