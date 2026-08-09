import {
  ChangeDetectionStrategy,
  ChangeDetectorRef,
  Component,
  OnDestroy,
  OnInit,
  inject,
} from '@angular/core';
import { CommonModule } from '@angular/common';
import { ActivatedRoute, RouterModule } from '@angular/router';
import { HttpErrorResponse } from '@angular/common/http';
import { Subject, combineLatest, takeUntil } from 'rxjs';
import { CfEmptyStateComponent } from '@shared/components/cf-empty-state/cf-empty-state.component';
import { LoadingSkeletonComponent } from '@shared/components/loading-skeleton/loading-skeleton.component';
import { PageHeaderComponent } from '@shared/components/page-header/page-header.component';
import { SectionCardComponent } from '@shared/components/section-card/section-card.component';
import { StatusBadgeComponent, StatusBadgeTone } from '@shared/components/status-badge/status-badge.component';
import { MinistriesInsightsApiService } from '../services/ministries-insights-api.service';
import {
  MinistriesInsightsTenantDetail,
  MinistriesInsightsWindowDays,
} from '../models/ministries-insights.model';
import { insightsFeatureLabel, insightsStatusLabel } from '../utils/insights-labels';

@Component({
  selector: 'app-ministries-insights-tenant-detail-page',
  standalone: true,
  imports: [
    CommonModule,
    RouterModule,
    CfEmptyStateComponent,
    LoadingSkeletonComponent,
    PageHeaderComponent,
    SectionCardComponent,
    StatusBadgeComponent,
  ],
  templateUrl: './tenant-detail.page.html',
  styleUrl: './tenant-detail.page.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class MinistriesInsightsTenantDetailPageComponent implements OnInit, OnDestroy {
  private readonly api = inject(MinistriesInsightsApiService);
  private readonly route = inject(ActivatedRoute);
  private readonly cdr = inject(ChangeDetectorRef);
  private readonly destroy$ = new Subject<void>();

  loading = true;
  error: string | null = null;
  detail: MinistriesInsightsTenantDetail | null = null;
  windowDays: MinistriesInsightsWindowDays = 30;
  private tenantId = 0;

  ngOnInit(): void {
    combineLatest([this.route.paramMap, this.route.queryParamMap])
      .pipe(takeUntil(this.destroy$))
      .subscribe(([params, query]) => {
        this.tenantId = Number(params.get('tenantId'));
        const n = Number(query.get('window_days'));
        this.windowDays = n === 7 || n === 90 ? n : 30;
        this.load();
      });
  }

  ngOnDestroy(): void {
    this.destroy$.next();
    this.destroy$.complete();
  }

  featureEntries(): Array<{ key: string; label: string; used: boolean; event_count: number }> {
    if (!this.detail?.feature_adoption) {
      return [];
    }
    return Object.entries(this.detail.feature_adoption).map(([key, value]) => ({
      key,
      label: insightsFeatureLabel(key),
      used: value.used,
      event_count: value.event_count,
    }));
  }

  usageEntries(): Array<{
    window_days: number;
    meaningful_actions: number;
    prior_meaningful_actions: number;
    active_days: number;
    usage_trend: string;
  }> {
    if (!this.detail?.usage) {
      return [];
    }
    return Object.values(this.detail.usage).sort((a, b) => a.window_days - b.window_days);
  }

  statusLabel(value: string): string {
    return insightsStatusLabel(value);
  }

  toneForStatus(status: string): StatusBadgeTone {
    switch (status) {
      case 'enabled':
      case 'active':
      case 'highly_engaged':
      case 'ok':
      case 'up':
        return 'success';
      case 'attention':
      case 'not_started':
      case 'inactive':
      case 'declining':
      case 'flat':
        return 'warning';
      case 'critical':
      case 'disabled':
      case 'down':
        return 'critical';
      default:
        return 'neutral';
    }
  }

  private load(): void {
    if (!this.tenantId) {
      this.error = 'Tenant not found.';
      this.loading = false;
      this.cdr.markForCheck();
      return;
    }

    this.loading = true;
    this.error = null;
    this.cdr.markForCheck();

    this.api
      .getTenantDetail(this.tenantId, this.windowDays)
      .pipe(takeUntil(this.destroy$))
      .subscribe({
        next: (detail) => {
          this.detail = detail;
          this.loading = false;
          this.cdr.markForCheck();
        },
        error: (err: HttpErrorResponse) => {
          this.loading = false;
          this.error =
            err.status === 404
              ? 'Tenant not found.'
              : err.status === 401 || err.status === 403
                ? 'You do not have permission to view this tenant.'
                : 'Unable to load tenant detail.';
          this.cdr.markForCheck();
        },
      });
  }
}
