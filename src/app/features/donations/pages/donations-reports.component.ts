import { CommonModule } from '@angular/common';
import { ChangeDetectorRef, Component, OnDestroy, OnInit } from '@angular/core';
import { ActivatedRoute, NavigationEnd, Router, RouterModule } from '@angular/router';
import { Subscription } from 'rxjs';
import { filter } from 'rxjs/operators';
import { AuthService } from '@core/services/auth.service';
import { EntitlementService } from '@core/services/entitlement.service';
import { DonationsService } from '../services/donations.service';
import { DonationReportExport } from '../models/donation.model';
import { DonationsReportsWorkbenchComponent } from './reports/donations-reports-workbench.component';

@Component({
  selector: 'app-donations-reports',
  standalone: true,
  imports: [CommonModule, RouterModule, DonationsReportsWorkbenchComponent],
  template: `
    <section class="reports cf-page cf-financial-dashboard">
      <app-donations-reports-workbench
        [canExport]="canExportReports"
        [advancedReports]="advancedReports"
        [exports]="exports"
        [exportsLoading]="exportsLoading"
        (refreshExports)="load()"
      />
    </section>
  `,
})
export class DonationsReportsComponent implements OnInit, OnDestroy {
  exports: DonationReportExport[] = [];
  exportsLoading = false;
  canExportReports = false;
  advancedReports = true;
  private routerSub?: Subscription;
  private skipNextNavReload = true;
  private exportPollTimer?: ReturnType<typeof setInterval>;

  constructor(
    private donationsService: DonationsService,
    private authService: AuthService,
    private router: Router,
    private route: ActivatedRoute,
    private cdr: ChangeDetectorRef,
    private entitlements: EntitlementService
  ) {}

  ngOnInit(): void {
    this.canExportReports = this.authService.hasAnyPermission(['reports.export', 'donations.export', 'donations.reports']);
    if (this.route.snapshot.queryParamMap.get('tab') === 'leadership') {
      const query = { ...this.route.snapshot.queryParams };
      delete query['tab'];
      void this.router.navigate([], {
        relativeTo: this.route,
        queryParams: query,
        replaceUrl: true,
      });
    }
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
    this.clearExportPolling();
  }

  private reloadAll(): void {
    this.load();
    this.entitlements.load().subscribe(() => {
      this.advancedReports = this.entitlements.hasFeature('ADVANCED_FINANCIAL_REPORTING');
      this.cdr.detectChanges();
    });
  }

  load(silent = false): void {
    if (!silent) {
      this.exportsLoading = true;
    }
    this.donationsService.listExports().subscribe({
      next: (res) => {
        this.exports = res.data?.data ?? [];
        this.exportsLoading = false;
        this.syncExportPolling();
        this.cdr.detectChanges();
      },
      error: () => {
        this.exports = [];
        this.exportsLoading = false;
        this.clearExportPolling();
        this.cdr.detectChanges();
      }
    });
  }

  private syncExportPolling(): void {
    this.clearExportPolling();
    const hasPending = this.exports.some(
      (row) => row.status === 'queued' || row.status === 'processing',
    );
    if (hasPending) {
      this.exportPollTimer = setInterval(() => this.load(true), 5000);
    }
  }

  private clearExportPolling(): void {
    if (this.exportPollTimer) {
      clearInterval(this.exportPollTimer);
      this.exportPollTimer = undefined;
    }
  }
}
