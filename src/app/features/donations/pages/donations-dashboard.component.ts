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
import { NavigationEnd, Router, RouterModule } from '@angular/router';
import { Subject, of } from 'rxjs';
import { catchError, filter, switchMap } from 'rxjs/operators';
import { PageHeaderComponent } from '@shared/components/page-header/page-header.component';
import { DonationsService } from '../services/donations.service';
import { QuickCollectService } from '../services/quick-collect.service';
import { DonationDashboardSummary } from '../models/donation.model';

@Component({
  selector: 'app-donations-dashboard',
  standalone: true,
  imports: [CommonModule, RouterModule, PageHeaderComponent],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <section class="donations-dashboard cf-page cf-financial-dashboard">
      <app-page-header
        title="Financial Dashboard"
        [titleLevel]="3"
        subtitle="Church financial health, collections, and families requiring attention."
      >
        <button type="button" class="cf-btn cf-btn-primary" (click)="openQuickCollect()">+ Quick Collect</button>
        <button type="button" class="cf-btn" (click)="reload()">Refresh</button>
      </app-page-header>

      <div
        *ngIf="loading"
        class="cf-loading-block cf-panel"
        role="status"
        aria-live="polite"
        aria-busy="true"
      >
        <p class="cf-loading-block__label">Loading financial dashboard…</p>
      </div>

      <div *ngIf="!loading && error" class="cf-inline-alert cf-panel" role="alert">
        {{ error }}
      </div>

      <ng-container *ngIf="!loading && summary">
        <article
          class="health-banner cf-panel"
          [attr.data-status]="healthStatus"
        >
          <div class="cf-health-gauge" [attr.data-status]="healthStatus">
            <div
              class="health-score-chip"
              [class.health-score-chip--healthy]="healthStatus === 'healthy'"
              [class.health-score-chip--attention]="healthStatus === 'attention'"
              [class.health-score-chip--risk]="healthStatus === 'risk'"
            >
              <span class="health-score-chip__value">{{ summary.financial_health?.score || 0 }}</span>
              <span class="health-score-chip__label">{{ summary.financial_health?.label || 'Calculating' }}</span>
            </div>
          </div>
          <div class="health-copy">
            <h2 class="cf-section-title">Financial Health Score</h2>
            <p class="cf-meta">{{ summary.financial_health?.summary || 'Track collections, outstanding balances, and family participation from one place.' }}</p>
          </div>
          <div class="health-meta cf-meta">
            <span>Families active: {{ summary.families?.active || 0 }}</span>
            <span>Participation (90d): {{ summary.families?.participation_rate || 0 }}%</span>
          </div>
        </article>

        <div class="cf-kpi-grid">
          <article class="cf-kpi"><span>Total Collected</span><strong>{{ summary.totals.collected | number:'1.2-2' }}</strong></article>
          <article class="cf-kpi"><span>This Month</span><strong>{{ summary.period_collections?.current_month_collected || 0 | number:'1.2-2' }}</strong></article>
          <article class="cf-kpi"><span>Annual (FY)</span><strong>{{ summary.period_collections?.annual_collected || 0 | number:'1.2-2' }}</strong></article>
          <article class="cf-kpi cf-kpi--warn"><span>Outstanding</span><strong>{{ summary.totals.pending_dues | number:'1.2-2' }}</strong></article>
          <article class="cf-kpi"><span>Voluntary Gifts</span><strong>{{ summary.totals.voluntary_collected || 0 | number:'1.2-2' }}</strong></article>
          <article class="cf-kpi"><span>Active Projects</span><strong>{{ summary.totals.active_projects || 0 }}</strong></article>
          <article class="cf-kpi"><span>Active Families</span><strong>{{ summary.families?.active || 0 }}</strong></article>
          <article class="cf-kpi"><span>Net Position</span><strong>{{ summary.totals.net | number:'1.2-2' }}</strong></article>
        </div>

        <div class="panels">
          <section class="cf-panel">
            <div class="panel-head">
              <h3 class="cf-section-title">Collection Trend</h3>
              <span class="cf-meta">Last 12 months</span>
            </div>
            <div class="trend-chart" *ngIf="summary.collection_trend?.length; else noTrend">
              <div class="trend-bar" *ngFor="let row of summary.collection_trend">
                <div class="bar" [style.height.%]="barHeight(row.collected)"></div>
                <label class="cf-chart-panel__label">{{ row.label }}</label>
                <strong class="cf-chart-panel__label">{{ row.collected | number:'1.0-0' }}</strong>
              </div>
            </div>
            <ng-template #noTrend><p class="cf-meta">No collection trend data yet.</p></ng-template>
          </section>

          <section class="cf-panel">
            <div class="panel-head">
              <h3 class="cf-section-title">Families Requiring Attention</h3>
              <span class="cf-meta">{{ summary.attention_summary?.count || 0 }} families · {{ summary.attention_summary?.total_overdue_amount || 0 | number:'1.2-2' }} overdue</span>
            </div>
            <div class="cf-table-responsive" *ngIf="summary.families_requiring_attention?.length; else noAttention">
              <table class="cf-table">
                <thead><tr><th>Family</th><th>Overdue</th><th>Days</th><th></th></tr></thead>
                <tbody>
                  <tr *ngFor="let row of summary.families_requiring_attention">
                    <td>
                      <strong>{{ row.family_name }}</strong>
                      <small class="cf-meta">{{ row.family_code }}</small>
                    </td>
                    <td>{{ row.overdue_amount | number:'1.2-2' }}</td>
                    <td>{{ row.days_overdue }}</td>
                    <td><a class="donations-dashboard__view" [routerLink]="['/families', row.family_id]">View</a></td>
                  </tr>
                </tbody>
              </table>
            </div>
            <ng-template #noAttention><p class="cf-meta">No overdue families right now.</p></ng-template>
          </section>
        </div>

        <div class="panels">
          <section class="cf-panel">
            <div class="panel-head">
              <h3 class="cf-section-title">Recent Activity</h3>
            </div>
            <ul class="activity-list" *ngIf="summary.recent_activity?.length; else noActivity">
              <li *ngFor="let item of summary.recent_activity">
                <div>
                  <strong>{{ item.family_name || item.payer_name }}</strong>
                  <span class="cf-meta">{{ item.date | date }} · {{ item.method }}</span>
                </div>
                <strong>{{ item.amount | number:'1.2-2' }}</strong>
              </li>
            </ul>
            <ng-template #noActivity><p class="cf-meta">No recent payments recorded.</p></ng-template>
          </section>

          <section class="cf-panel">
            <div class="panel-head">
              <h3 class="cf-section-title">Active Projects</h3>
            </div>
            <div class="project-list" *ngIf="summary.active_project_summaries?.length; else noProjects">
              <article *ngFor="let project of summary.active_project_summaries">
                <div class="project-top">
                  <strong>{{ project.name }}</strong>
                  <span class="cf-meta">{{ project.funding_percentage }}%</span>
                </div>
                <div class="progress" aria-hidden="true">
                  <span [style.width.%]="project.funding_percentage"></span>
                </div>
                <small class="cf-meta">{{ project.collected | number:'1.2-2' }} of {{ project.target_amount | number:'1.2-2' }}</small>
              </article>
            </div>
            <ng-template #noProjects><p class="cf-meta">No active fundraising projects.</p></ng-template>
          </section>
        </div>

        <nav class="quick-links" aria-label="Financial shortcuts">
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
    :host { display: block; }

    .health-banner {
      display: grid;
      grid-template-columns: auto 1fr auto;
      gap: var(--cf-space-3);
      align-items: center;
      border-left: 3px solid var(--cf-primary);
    }

    .health-banner[data-status='healthy'] { border-left-color: var(--cf-forest); }
    .health-banner[data-status='attention'] { border-left-color: var(--cf-amber); }
    .health-banner[data-status='risk'] { border-left-color: var(--cf-critical); }

    .health-score-chip {
      width: 3.75rem;
      height: 3.75rem;
      border-radius: var(--cf-radius-pill);
      display: grid;
      place-content: center;
      text-align: center;
      color: #fff;
      background: var(--cf-primary);
    }

    .health-score-chip--healthy { background: var(--cf-forest); }
    .health-score-chip--attention { background: var(--cf-amber); }
    .health-score-chip--risk { background: var(--cf-critical); }

    .health-score-chip__value {
      font-size: 1rem;
      font-weight: 700;
      line-height: 1;
      font-variant-numeric: tabular-nums;
    }

    .health-score-chip__label {
      font-size: var(--cf-text-xs);
      text-transform: uppercase;
      letter-spacing: 0.04em;
      line-height: 1.2;
      margin-top: 0.15rem;
    }

    .health-copy .cf-section-title { margin: 0 0 0.2rem; }
    .health-copy .cf-meta { margin: 0; }
    .health-meta { display: grid; gap: 0.2rem; text-align: right; }

    .cf-kpi--warn strong { color: var(--cf-amber); }

    .panels {
      display: grid;
      grid-template-columns: repeat(auto-fit, minmax(320px, 1fr));
      gap: var(--cf-page-gap);
    }

    .panel-head {
      display: flex;
      justify-content: space-between;
      gap: 0.75rem;
      align-items: baseline;
      margin-bottom: 0.75rem;
      flex-wrap: wrap;
    }

    .panel-head .cf-section-title { margin: 0; }

    .trend-chart {
      display: grid;
      grid-template-columns: repeat(6, 1fr);
      gap: 0.5rem;
      overflow-x: auto;
      align-items: end;
      min-height: 8rem;
    }

    .trend-bar {
      display: grid;
      grid-template-rows: 1fr auto auto;
      gap: 0.2rem;
      justify-items: center;
      min-width: 4.5rem;
      height: 100%;
    }

    .trend-bar .bar {
      width: 100%;
      min-height: 8px;
      background: var(--cf-primary-soft, #dbeafe);
      border-radius: var(--cf-radius-pill) var(--cf-radius-pill) 4px 4px;
      align-self: end;
    }

    .cf-table small.cf-meta { display: block; }

    .donations-dashboard__view {
      color: var(--cf-primary);
      font-size: var(--cf-text-sm);
      text-decoration: none;
    }

    .activity-list {
      list-style: none;
      margin: 0;
      padding: 0;
      display: grid;
      gap: 0.55rem;
    }

    .activity-list li {
      display: flex;
      justify-content: space-between;
      gap: 0.75rem;
      padding-bottom: 0.55rem;
      border-bottom: 1px solid var(--cf-panel-border);
    }

    .activity-list .cf-meta { display: block; }

    .project-list { display: grid; gap: 0.75rem; }

    .project-top {
      display: flex;
      justify-content: space-between;
      gap: 0.5rem;
    }

    .progress {
      height: 8px;
      background: var(--cf-slate-100);
      border-radius: var(--cf-radius-pill);
      overflow: hidden;
      margin: 0.35rem 0;
    }

    .progress span {
      display: block;
      height: 100%;
      background: var(--cf-primary);
    }

    .quick-links {
      display: flex;
      flex-wrap: wrap;
      gap: 0.75rem;
    }

    .quick-links a {
      color: var(--cf-primary);
      text-decoration: none;
      font-size: var(--cf-text-base);
    }

    @media (max-width: 768px) {
      .health-banner {
        grid-template-columns: 1fr;
        justify-items: start;
      }

      .health-meta { text-align: left; }
    }
  `]
})
export class DonationsDashboardComponent implements OnInit {
  private readonly donationsService = inject(DonationsService);
  private readonly quickCollectService = inject(QuickCollectService);
  private readonly cdr = inject(ChangeDetectorRef);
  private readonly router = inject(Router);
  private readonly destroyRef = inject(DestroyRef);
  private readonly reload$ = new Subject<void>();
  private maxTrend = 1;

  summary: DonationDashboardSummary | null = null;
  loading = true;
  error: string | null = null;

  get healthStatus(): 'healthy' | 'attention' | 'risk' {
    const status = this.summary?.financial_health?.status;
    if (status === 'healthy' || status === 'risk') {
      return status;
    }
    return 'attention';
  }

  ngOnInit(): void {
    this.reload$.pipe(
      switchMap(() => {
        this.loading = true;
        this.error = null;
        this.summary = null;
        this.cdr.markForCheck();
        return this.donationsService.getDashboardSummary().pipe(catchError(() => of(null)));
      }),
      takeUntilDestroyed(this.destroyRef)
    ).subscribe((res) => {
      if (res?.data) {
        this.summary = res.data;
        this.maxTrend = Math.max(1, ...(res.data.collection_trend ?? []).map((row) => row.collected));
        this.error = null;
      } else {
        this.summary = null;
        this.error = 'Failed to load financial dashboard.';
      }
      this.loading = false;
      this.cdr.markForCheck();
    });

    this.reload$.next();

    this.router.events.pipe(
      filter((event): event is NavigationEnd => event instanceof NavigationEnd),
      filter((event) => this.isDonationsDashboardRoute(event.urlAfterRedirects)),
      takeUntilDestroyed(this.destroyRef)
    ).subscribe(() => this.reload$.next());
  }

  reload(): void {
    this.reload$.next();
  }

  openQuickCollect(): void {
    this.quickCollectService.open();
  }

  barHeight(value: number): number {
    return Math.max(8, Math.round((value / this.maxTrend) * 100));
  }

  private isDonationsDashboardRoute(url: string): boolean {
    const path = url.split('?')[0].replace(/\/$/, '');
    return path.endsWith('/donations');
  }
}
