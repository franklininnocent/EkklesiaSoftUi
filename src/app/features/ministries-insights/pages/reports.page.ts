import {
  ChangeDetectionStrategy,
  ChangeDetectorRef,
  Component,
  OnDestroy,
  OnInit,
  inject,
} from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { ActivatedRoute, Router, RouterModule } from '@angular/router';
import { HttpErrorResponse } from '@angular/common/http';
import { Subject, takeUntil } from 'rxjs';
import { CfEmptyStateComponent } from '@shared/components/cf-empty-state/cf-empty-state.component';
import { DataTableComponent } from '@shared/components/data-table/data-table.component';
import { LoadingSkeletonComponent } from '@shared/components/loading-skeleton/loading-skeleton.component';
import { SectionCardComponent } from '@shared/components/section-card/section-card.component';
import { MinistriesInsightsApiService } from '../services/ministries-insights-api.service';
import {
  MinistriesInsightsReportCatalogItem,
  MinistriesInsightsReportSummary,
  MinistriesInsightsWindowDays,
} from '../models/ministries-insights.model';
import { insightsFieldLabel } from '../utils/insights-labels';

@Component({
  selector: 'app-ministries-insights-reports-page',
  standalone: true,
  imports: [
    CommonModule,
    FormsModule,
    RouterModule,
    CfEmptyStateComponent,
    DataTableComponent,
    LoadingSkeletonComponent,
    SectionCardComponent,
  ],
  templateUrl: './reports.page.html',
  styleUrl: './reports.page.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class MinistriesInsightsReportsPageComponent implements OnInit, OnDestroy {
  private readonly api = inject(MinistriesInsightsApiService);
  private readonly route = inject(ActivatedRoute);
  private readonly router = inject(Router);
  private readonly cdr = inject(ChangeDetectorRef);
  private readonly destroy$ = new Subject<void>();

  readonly windows: Array<{ days: MinistriesInsightsWindowDays; label: string }> = [
    { days: 7, label: '7D' },
    { days: 30, label: '30D' },
    { days: 90, label: '90D' },
    { days: 180, label: '6M' },
    { days: 365, label: '12M' },
  ];

  catalog: MinistriesInsightsReportCatalogItem[] = [];
  selectedType = '';
  windowDays: MinistriesInsightsWindowDays = 30;
  report: MinistriesInsightsReportSummary | null = null;
  loadingCatalog = true;
  loadingReport = false;
  exporting = false;
  error: string | null = null;
  unauthorized = false;

  ngOnInit(): void {
    this.api
      .getReportCatalog()
      .pipe(takeUntil(this.destroy$))
      .subscribe({
        next: (catalog) => {
          this.catalog = catalog;
          this.loadingCatalog = false;
          this.route.queryParamMap.pipe(takeUntil(this.destroy$)).subscribe((params) => {
            const type = params.get('type') || catalog[0]?.type || '';
            const days = Number(params.get('window_days') || 30) as MinistriesInsightsWindowDays;
            this.windowDays = ([7, 30, 90, 180, 365] as MinistriesInsightsWindowDays[]).includes(days)
              ? days
              : 30;
            this.selectedType = type;
            if (type) {
              this.loadReport();
            }
            this.cdr.markForCheck();
          });
          this.cdr.markForCheck();
        },
        error: (err: HttpErrorResponse) => this.handleError(err, true),
      });
  }

  ngOnDestroy(): void {
    this.destroy$.next();
    this.destroy$.complete();
  }

  selectReport(type: string): void {
    this.patchQuery({ type, window_days: this.windowDays });
  }

  setWindow(days: MinistriesInsightsWindowDays): void {
    this.patchQuery({ type: this.selectedType, window_days: days });
  }

  exportCsv(): void {
    if (!this.selectedType || this.exporting) {
      return;
    }
    this.exporting = true;
    this.api
      .downloadReportCsv(this.selectedType, this.windowDays)
      .pipe(takeUntil(this.destroy$))
      .subscribe({
        next: (blob) => {
          const url = URL.createObjectURL(blob);
          const a = document.createElement('a');
          a.href = url;
          a.download = `ministries-insights-${this.selectedType}-${new Date().toISOString().slice(0, 10)}.csv`;
          a.click();
          URL.revokeObjectURL(url);
          this.exporting = false;
          this.cdr.markForCheck();
        },
        error: () => {
          this.exporting = false;
          this.error = 'Could not export CSV. Check export permission.';
          this.cdr.markForCheck();
        },
      });
  }

  selectedMeta(): MinistriesInsightsReportCatalogItem | undefined {
    return this.catalog.find((item) => item.type === this.selectedType);
  }

  summaryEntries(): Array<{ key: string; value: string }> {
    const summary = this.report?.summary;
    if (!summary) {
      return [];
    }
    return Object.entries(summary)
      .filter(([, value]) => typeof value !== 'object' || value === null)
      .map(([key, value]) => ({
        key: insightsFieldLabel(key),
        value: value === null || value === undefined ? '—' : String(value),
      }));
  }

  previewRows(): Record<string, unknown>[] {
    return (this.report?.preview ?? []) as Record<string, unknown>[];
  }

  previewKeys(): string[] {
    const first = this.previewRows()[0];
    if (!first) {
      return [];
    }
    return Object.keys(first).filter((key) => typeof first[key] !== 'object' || first[key] === null);
  }

  headerLabel(key: string): string {
    return insightsFieldLabel(key);
  }

  cellValue(row: Record<string, unknown>, key: string): string {
    const value = row[key];
    if (value === null || value === undefined) {
      return '—';
    }
    return String(value);
  }

  private loadReport(): void {
    if (!this.selectedType) {
      return;
    }
    this.loadingReport = true;
    this.error = null;
    this.unauthorized = false;
    this.api
      .getReportSummary(this.selectedType, this.windowDays)
      .pipe(takeUntil(this.destroy$))
      .subscribe({
        next: (report) => {
          this.report = report;
          this.loadingReport = false;
          this.cdr.markForCheck();
        },
        error: (err: HttpErrorResponse) => this.handleError(err, false),
      });
  }

  private patchQuery(patch: Record<string, string | number>): void {
    void this.router.navigate([], {
      relativeTo: this.route,
      queryParams: patch,
      queryParamsHandling: 'merge',
    });
  }

  private handleError(err: HttpErrorResponse, catalog: boolean): void {
    if (catalog) {
      this.loadingCatalog = false;
    }
    this.loadingReport = false;
    this.unauthorized = err.status === 403;
    this.error = this.unauthorized
      ? 'You do not have permission to view reports.'
      : 'Unable to load reports.';
    this.cdr.markForCheck();
  }
}
