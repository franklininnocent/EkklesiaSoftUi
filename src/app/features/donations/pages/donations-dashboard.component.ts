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
import { DonationsService } from '../services/donations.service';
import { QuickCollectService } from '../services/quick-collect.service';
import { DonationDashboardSummary } from '../models/donation.model';

@Component({
  selector: 'app-donations-dashboard',
  standalone: true,
  imports: [CommonModule, RouterModule],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <section class="executive-dashboard">
      <header class="hero">
        <div>
          <h1>Financial Dashboard</h1>
          <p>Church financial health, collections, and families requiring attention.</p>
        </div>
        <div class="hero-actions">
          <button type="button" class="btn-primary" (click)="openQuickCollect()">+ Quick Collect</button>
          <button type="button" class="btn-secondary" (click)="reload()">Refresh</button>
        </div>
      </header>

      <div *ngIf="loading" class="state">Loading financial dashboard…</div>
      <div *ngIf="!loading && error" class="state error">{{ error }}</div>

      <ng-container *ngIf="!loading && summary">
        <article class="health-banner" [class]="summary.financial_health?.status || 'attention'">
          <div class="health-score">
            <span class="score-value">{{ summary.financial_health?.score || 0 }}</span>
            <span class="score-label">{{ summary.financial_health?.label || 'Calculating' }}</span>
          </div>
          <div class="health-copy">
            <h2>Financial Health Score</h2>
            <p>{{ summary.financial_health?.summary || 'Track collections, outstanding balances, and family participation from one place.' }}</p>
          </div>
          <div class="health-meta">
            <span>Families active: {{ summary.families?.active || 0 }}</span>
            <span>Participation (90d): {{ summary.families?.participation_rate || 0 }}%</span>
          </div>
        </article>

        <div class="kpi-grid">
          <article class="kpi"><span>Total Collected</span><strong>{{ summary.totals.collected | number:'1.2-2' }}</strong></article>
          <article class="kpi"><span>This Month</span><strong>{{ summary.period_collections?.current_month_collected || 0 | number:'1.2-2' }}</strong></article>
          <article class="kpi"><span>Annual (FY)</span><strong>{{ summary.period_collections?.annual_collected || 0 | number:'1.2-2' }}</strong></article>
          <article class="kpi warn"><span>Outstanding</span><strong>{{ summary.totals.pending_dues | number:'1.2-2' }}</strong></article>
          <article class="kpi"><span>Voluntary Gifts</span><strong>{{ summary.totals.voluntary_collected || 0 | number:'1.2-2' }}</strong></article>
          <article class="kpi"><span>Active Projects</span><strong>{{ summary.totals.active_projects || 0 }}</strong></article>
          <article class="kpi"><span>Active Families</span><strong>{{ summary.families?.active || 0 }}</strong></article>
          <article class="kpi"><span>Net Position</span><strong>{{ summary.totals.net | number:'1.2-2' }}</strong></article>
        </div>

        <div class="panels">
          <section class="panel">
            <div class="panel-head">
              <h3>Collection Trend</h3>
              <span>Last 12 months</span>
            </div>
            <div class="trend-chart">
              <div class="trend-bar" *ngFor="let row of summary.collection_trend">
                <div class="bar" [style.height.%]="barHeight(row.collected)"></div>
                <label>{{ row.label }}</label>
                <strong>{{ row.collected | number:'1.0-0' }}</strong>
              </div>
            </div>
          </section>

          <section class="panel">
            <div class="panel-head">
              <h3>Families Requiring Attention</h3>
              <span>{{ summary.attention_summary?.count || 0 }} families · {{ summary.attention_summary?.total_overdue_amount || 0 | number:'1.2-2' }} overdue</span>
            </div>
            <table class="table" *ngIf="summary.families_requiring_attention?.length; else noAttention">
              <thead><tr><th>Family</th><th>Overdue</th><th>Days</th><th></th></tr></thead>
              <tbody>
                <tr *ngFor="let row of summary.families_requiring_attention">
                  <td>
                    <strong>{{ row.family_name }}</strong>
                    <small>{{ row.family_code }}</small>
                  </td>
                  <td>{{ row.overdue_amount | number:'1.2-2' }}</td>
                  <td>{{ row.days_overdue }}</td>
                  <td><a [routerLink]="['/families', row.family_id]">View</a></td>
                </tr>
              </tbody>
            </table>
            <ng-template #noAttention><p class="empty">No overdue families right now.</p></ng-template>
          </section>
        </div>

        <div class="panels">
          <section class="panel">
            <div class="panel-head"><h3>Recent Activity</h3></div>
            <ul class="activity-list" *ngIf="summary.recent_activity?.length; else noActivity">
              <li *ngFor="let item of summary.recent_activity">
                <div>
                  <strong>{{ item.family_name || item.payer_name }}</strong>
                  <span>{{ item.date | date }} · {{ item.method }}</span>
                </div>
                <strong>{{ item.amount | number:'1.2-2' }}</strong>
              </li>
            </ul>
            <ng-template #noActivity><p class="empty">No recent payments recorded.</p></ng-template>
          </section>

          <section class="panel">
            <div class="panel-head"><h3>Active Projects</h3></div>
            <div class="project-list" *ngIf="summary.active_project_summaries?.length; else noProjects">
              <article *ngFor="let project of summary.active_project_summaries">
                <div class="project-top">
                  <strong>{{ project.name }}</strong>
                  <span>{{ project.funding_percentage }}%</span>
                </div>
                <div class="progress"><span [style.width.%]="project.funding_percentage"></span></div>
                <small>{{ project.collected | number:'1.2-2' }} of {{ project.target_amount | number:'1.2-2' }}</small>
              </article>
            </div>
            <ng-template #noProjects><p class="empty">No active fundraising projects.</p></ng-template>
          </section>
        </div>

        <nav class="quick-links">
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
    .executive-dashboard { padding: 1rem; display: grid; gap: 1rem; }
    .hero { display: flex; justify-content: space-between; gap: 1rem; flex-wrap: wrap; align-items: flex-start; }
    .hero h1 { margin: 0 0 0.25rem; }
    .hero p { margin: 0; color: #6b7280; }
    .hero-actions { display: flex; gap: 0.5rem; }
    .btn-primary, .btn-secondary { border-radius: 10px; padding: 0.55rem 0.9rem; cursor: pointer; border: 1px solid transparent; }
    .btn-primary { background: #2563eb; color: #fff; }
    .btn-secondary { background: #fff; border-color: #d1d5db; }
    .health-banner { display: grid; grid-template-columns: auto 1fr auto; gap: 1rem; align-items: center; padding: 1rem; border-radius: 16px; border: 1px solid #dbeafe; background: linear-gradient(135deg, #eff6ff, #fff); }
    .health-banner.attention { border-color: #fde68a; background: linear-gradient(135deg, #fffbeb, #fff); }
    .health-banner.risk { border-color: #fecaca; background: linear-gradient(135deg, #fef2f2, #fff); }
    .health-score { width: 84px; height: 84px; border-radius: 999px; display: grid; place-content: center; background: #2563eb; color: #fff; text-align: center; }
    .health-banner.attention .health-score { background: #d97706; }
    .health-banner.risk .health-score { background: #dc2626; }
    .score-value { font-size: 1.5rem; font-weight: 800; line-height: 1; }
    .score-label { font-size: 0.68rem; text-transform: uppercase; letter-spacing: 0.04em; }
    .health-copy h2 { margin: 0 0 0.25rem; font-size: 1.05rem; }
    .health-copy p { margin: 0; color: #374151; }
    .health-meta { display: grid; gap: 0.25rem; color: #4b5563; font-size: 0.88rem; text-align: right; }
    .kpi-grid { display: grid; grid-template-columns: repeat(auto-fit, minmax(150px, 1fr)); gap: 0.75rem; }
    .kpi { background: #fff; border: 1px solid #e5e7eb; border-radius: 12px; padding: 0.85rem; }
    .kpi span { display: block; color: #6b7280; font-size: 0.82rem; }
    .kpi strong { font-size: 1.15rem; }
    .kpi.warn strong { color: #b45309; }
    .panels { display: grid; grid-template-columns: repeat(auto-fit, minmax(320px, 1fr)); gap: 1rem; }
    .panel { background: #fff; border: 1px solid #e5e7eb; border-radius: 14px; padding: 1rem; }
    .panel-head { display: flex; justify-content: space-between; gap: 0.75rem; align-items: baseline; margin-bottom: 0.75rem; }
    .panel-head h3 { margin: 0; font-size: 1rem; }
    .panel-head span { color: #6b7280; font-size: 0.82rem; }
    .trend-chart { display: grid; grid-template-columns: repeat(6, 1fr); gap: 0.5rem; overflow-x: auto; }
    .trend-bar { display: grid; gap: 0.25rem; justify-items: center; min-width: 72px; }
    .trend-bar .bar { width: 100%; min-height: 8px; background: #dbeafe; border-radius: 999px 999px 4px 4px; align-self: end; }
    .trend-bar label, .trend-bar strong { font-size: 0.72rem; color: #4b5563; text-align: center; }
    .table { width: 100%; border-collapse: collapse; }
    .table th, .table td { border-bottom: 1px solid #e5e7eb; text-align: left; padding: 0.55rem 0.35rem; font-size: 0.88rem; }
    .table small { display: block; color: #6b7280; }
    .activity-list { list-style: none; margin: 0; padding: 0; display: grid; gap: 0.55rem; }
    .activity-list li { display: flex; justify-content: space-between; gap: 0.75rem; padding-bottom: 0.55rem; border-bottom: 1px solid #f3f4f6; }
    .activity-list span { display: block; color: #6b7280; font-size: 0.82rem; }
    .project-list { display: grid; gap: 0.75rem; }
    .project-top { display: flex; justify-content: space-between; gap: 0.5rem; }
    .progress { height: 8px; background: #e5e7eb; border-radius: 999px; overflow: hidden; margin: 0.35rem 0; }
    .progress span { display: block; height: 100%; background: #2563eb; }
    .quick-links { display: flex; flex-wrap: wrap; gap: 0.85rem; }
    .quick-links a { color: #2563eb; text-decoration: none; font-size: 0.92rem; }
    .empty, .state { color: #6b7280; margin: 0; }
    .state.error { color: #b91c1c; }
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
