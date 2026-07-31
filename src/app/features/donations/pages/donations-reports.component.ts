import { CommonModule } from '@angular/common';
import { ChangeDetectorRef, Component, OnDestroy, OnInit } from '@angular/core';
import { NavigationEnd, Router } from '@angular/router';
import { Subscription } from 'rxjs';
import { filter } from 'rxjs/operators';
import { AuthService } from '@core/services/auth.service';
import { DonationsService } from '../services/donations.service';
import { ReceiptPrintService } from '../services/receipt-print.service';
import { DonationReportExport, ExecutiveReportSummary, ParishComparisonReport } from '../models/donation.model';

@Component({
  selector: 'app-donations-reports',
  standalone: true,
  imports: [CommonModule],
  template: `
    <section class="reports cf-page">
      <header class="cf-hero">
        <h1>Leadership Reports</h1>
        <p>Executive summaries, parish comparisons, and exportable records for decision-making.</p>
      </header>

      <div class="cf-decision-strip" role="region" aria-label="Suggested next step" *ngIf="executiveSummary">
        <div class="cf-decision-strip__copy">
          <strong>{{ executiveSummary.title }}</strong>
          <span>{{ reportsDecisionHint }}</span>
        </div>
        <div class="cf-decision-strip__actions" *ngIf="canExportReports">
          <button type="button" class="cf-btn cf-btn-primary" (click)="printExecutiveBoardPack()">Print board pack</button>
          <button type="button" class="cf-btn" (click)="printStewardshipReport()">Print stewardship report</button>
        </div>
      </div>

      <div class="cf-filters cf-panel" *ngIf="canExportReports">
        <button class="cf-btn" (click)="exportReport('payments')" [disabled]="loading">Export payments CSV</button>
        <button class="cf-btn" (click)="exportReport('donation_entries')" [disabled]="loading">Export offerings CSV</button>
      </div>

      <article class="executive cf-panel" *ngIf="executiveSummary">
        <header class="executive__header">
          <h2>Executive summary</h2>
          <button type="button" class="cf-btn" (click)="loadExecutiveSummary()" [disabled]="executiveLoading">
            {{ executiveLoading ? 'Refreshing…' : 'Refresh' }}
          </button>
        </header>
        <p class="executive__narrative">{{ executiveSummary.narrative }}</p>

        <div class="story-grid" *ngIf="storyCards.length">
          <article class="story-card" *ngFor="let card of storyCards">
            <header>
              <span>{{ card.label }}</span>
              <strong>{{ card.value }}</strong>
            </header>
            <div class="story-bar"><span [style.width.%]="card.percent"></span></div>
            <p>{{ card.detail }}</p>
          </article>
        </div>

        <ul class="executive__highlights" *ngIf="executiveSummary.highlights?.length">
          <li *ngFor="let highlight of executiveSummary.highlights">{{ highlight }}</li>
        </ul>
        <p class="executive__forecast" *ngIf="executiveSummary.forecast_narrative">
          {{ executiveSummary.forecast_narrative }}
        </p>
        <div class="executive__metrics cf-kpi-grid" *ngIf="metricEntries.length">
          <div class="cf-kpi" *ngFor="let metric of metricEntries">
            <span>{{ metric.label }}</span>
            <strong>{{ metric.value }}</strong>
          </div>
        </div>
        <ul class="executive__actions" *ngIf="executiveSummary.recommended_actions?.length">
          <li *ngFor="let action of executiveSummary.recommended_actions">{{ action }}</li>
        </ul>
      </article>

      <article class="comparison cf-panel" *ngIf="parishComparison?.available">
        <header class="executive__header">
          <h2>{{ parishComparison?.title }}</h2>
          <button type="button" (click)="loadParishComparison()" [disabled]="comparisonLoading">
            {{ comparisonLoading ? 'Refreshing…' : 'Refresh Comparison' }}
          </button>
        </header>
        <p class="executive__narrative">{{ parishComparison?.narrative }}</p>
        <ul class="executive__highlights" *ngIf="parishComparison?.highlights?.length">
          <li *ngFor="let highlight of parishComparison?.highlights">{{ highlight }}</li>
        </ul>
        <table class="table" *ngIf="parishComparison?.parishes?.length">
          <thead>
            <tr>
              <th>Parish</th>
              <th>Health</th>
              <th>Participation</th>
              <th>Collected</th>
              <th>Outstanding</th>
            </tr>
          </thead>
          <tbody>
            <tr *ngFor="let parish of parishComparison?.parishes">
              <td>{{ parish.name }}</td>
              <td>{{ parish.health_score }}/100 · {{ parish.health_label }}</td>
              <td>{{ parish.participation_rate }}%</td>
              <td>{{ parish.total_collected | number:'1.2-2' }}</td>
              <td>{{ parish.pending_dues | number:'1.2-2' }}</td>
            </tr>
          </tbody>
        </table>
      </article>

      <table class="table" *ngIf="exports.length">
        <thead><tr><th>Type</th><th>Status</th><th>Created</th><th>File</th></tr></thead>
        <tbody>
          <tr *ngFor="let report of exports">
            <td>{{ report.report_type }}</td>
            <td>{{ report.status }}</td>
            <td>{{ report.created_at | date:'medium' }}</td>
            <td>{{ report.file_path || '-' }}</td>
          </tr>
        </tbody>
      </table>
    </section>
  `,
  styles: [`
    .executive { display: grid; gap: 0.75rem; }
    .executive__header { display: flex; justify-content: space-between; align-items: center; gap: 0.75rem; flex-wrap: wrap; }
    .executive__header h2 { margin: 0; font-size: 1.1rem; }
    .executive__narrative, .executive__forecast { margin: 0; color: var(--cf-slate-700); line-height: 1.5; }
    .executive__highlights, .executive__actions { margin: 0; padding-left: 1.1rem; color: var(--cf-slate-700); }
    .story-grid { display: grid; grid-template-columns: repeat(auto-fit, minmax(220px, 1fr)); gap: 0.75rem; }
    .story-card { background: var(--cf-panel-bg); border: 1px solid var(--cf-panel-border); border-radius: var(--cf-radius); padding: 0.75rem; display: grid; gap: 0.45rem; }
    .story-card header { display: flex; justify-content: space-between; gap: 0.5rem; align-items: baseline; }
    .story-card header span { color: var(--cf-muted); font-size: 0.78rem; text-transform: uppercase; letter-spacing: 0.04em; }
    .story-card p { margin: 0; color: var(--cf-slate-700); font-size: 0.85rem; line-height: 1.4; }
    .story-bar { height: 8px; background: var(--cf-slate-200); border-radius: 999px; overflow: hidden; }
    .story-bar span { display: block; height: 100%; background: linear-gradient(90deg, var(--cf-primary), var(--cf-forest)); }
    .table { width: 100%; border-collapse: collapse; }
    .table th, .table td { border-bottom: 1px solid var(--cf-panel-border); text-align: left; padding: 0.55rem; }
    .comparison { display: grid; gap: 0.75rem; }
  `]
})
export class DonationsReportsComponent implements OnInit, OnDestroy {
  exports: DonationReportExport[] = [];
  executiveSummary: ExecutiveReportSummary | null = null;
  parishComparison: ParishComparisonReport | null = null;
  metricEntries: Array<{ label: string; value: string }> = [];
  storyCards: Array<{ label: string; value: string; percent: number; detail: string }> = [];
  loading = false;
  executiveLoading = false;
  comparisonLoading = false;
  canExportReports = false;
  private routerSub?: Subscription;
  private skipNextNavReload = true;

  constructor(
    private donationsService: DonationsService,
    private authService: AuthService,
    private receiptPrintService: ReceiptPrintService,
    private router: Router,
    private cdr: ChangeDetectorRef
  ) {}

  ngOnInit(): void {
    this.canExportReports = this.authService.hasAnyPermission(['reports.export', 'donations.export', 'donations.reports']);
    this.reloadAll();
    this.routerSub = this.router.events.pipe(filter((e): e is NavigationEnd => e instanceof NavigationEnd)).subscribe((e) => {
      if (!e.urlAfterRedirects.includes('/donations/reports')) {
        return;
      }
      if (this.skipNextNavReload) {
        this.skipNextNavReload = false;
        return;
      }
      this.reloadAll();
    });
  }

  ngOnDestroy(): void {
    this.routerSub?.unsubscribe();
  }

  private reloadAll(): void {
    this.load();
    this.loadExecutiveSummary();
    this.loadParishComparison();
  }

  get reportsDecisionHint(): string {
    if (this.executiveSummary?.recommended_actions?.length) {
      return this.executiveSummary.recommended_actions[0];
    }
    return this.executiveSummary?.narrative || 'Refresh the summary before leadership meetings.';
  }

  load(): void {
    this.donationsService.listExports().subscribe({
      next: (res) => {
        this.exports = res.data?.data ?? [];
        this.cdr.detectChanges();
      }
    });
  }

  loadExecutiveSummary(): void {
    this.executiveLoading = true;
    this.cdr.detectChanges();
    this.donationsService.getExecutiveReportSummary().subscribe({
      next: (res) => {
        this.executiveSummary = res.data;
        this.metricEntries = Object.entries(res.data?.metrics ?? {}).map(([key, value]) => ({
          label: key.replace(/_/g, ' '),
          value: value === null || value === undefined ? '—' : String(value)
        }));
        this.storyCards = this.buildStoryCards(res.data);
        this.executiveLoading = false;
        this.cdr.detectChanges();
      },
      error: () => {
        this.executiveLoading = false;
        this.cdr.detectChanges();
      }
    });
  }

  loadParishComparison(): void {
    this.comparisonLoading = true;
    this.donationsService.getParishComparisonReport().subscribe({
      next: (res) => {
        this.parishComparison = res.data?.available ? res.data : null;
        this.comparisonLoading = false;
        this.cdr.detectChanges();
      },
      error: () => {
        this.comparisonLoading = false;
        this.cdr.detectChanges();
      }
    });
  }

  printStewardshipReport(): void {
    this.receiptPrintService.printStewardshipReport();
  }

  printExecutiveBoardPack(): void {
    this.receiptPrintService.printExecutiveBoardPack();
  }

  exportReport(reportType: string): void {
    if (!this.canExportReports) return;
    this.loading = true;
    this.donationsService.exportReport({ report_type: reportType }).subscribe({
      next: () => {
        this.loading = false;
        this.load();
        this.cdr.detectChanges();
      },
      error: () => {
        this.loading = false;
        this.cdr.detectChanges();
      }
    });
  }

  private buildStoryCards(summary: ExecutiveReportSummary): Array<{ label: string; value: string; percent: number; detail: string }> {
    const metrics = summary.metrics ?? {};
    const healthScore = Number(metrics['health_score'] ?? 0);
    const monthCollected = Number(metrics['current_month_collected'] ?? 0);
    const pendingDues = Number(metrics['pending_dues'] ?? 0);
    const participation = Number(metrics['participation_rate'] ?? 0);
    const forecast = Number(metrics['forecast_projection'] ?? 0);
    const totalExposure = monthCollected + pendingDues;

    return [
      {
        label: 'Financial Health',
        value: `${healthScore}/100`,
        percent: Math.max(0, Math.min(100, healthScore)),
        detail: String(metrics['health_status'] ?? 'Parish stewardship health score for leadership review.')
      },
      {
        label: 'This Month Collected',
        value: monthCollected.toLocaleString(undefined, { maximumFractionDigits: 0 }),
        percent: totalExposure > 0 ? Math.round((monthCollected / totalExposure) * 100) : 0,
        detail: pendingDues > 0 ? `${pendingDues.toLocaleString(undefined, { maximumFractionDigits: 0 })} still outstanding.` : 'No outstanding dues recorded this month.'
      },
      {
        label: 'Family Participation',
        value: `${participation}%`,
        percent: Math.max(0, Math.min(100, participation)),
        detail: 'Share of active families contributing this period.'
      },
      {
        label: 'Forecast Projection',
        value: forecast.toLocaleString(undefined, { maximumFractionDigits: 0 }),
        percent: monthCollected > 0 ? Math.min(100, Math.round((forecast / Math.max(monthCollected, 1)) * 100)) : 0,
        detail: summary.forecast_narrative || 'Projected month-end collections based on recent pace.'
      }
    ];
  }
}
