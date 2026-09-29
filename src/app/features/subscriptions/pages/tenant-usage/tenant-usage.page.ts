import { ChangeDetectionStrategy, ChangeDetectorRef, Component, OnDestroy, OnInit, inject } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { ActivatedRoute, RouterModule } from '@angular/router';
import { Subject, takeUntil } from 'rxjs';
import { AuthService } from '@core/services/auth.service';
import { CfEmptyStateComponent } from '@shared/components/cf-empty-state/cf-empty-state.component';
import { DataTableComponent } from '@shared/components/data-table/data-table.component';
import { LoadingSkeletonComponent } from '@shared/components/loading-skeleton/loading-skeleton.component';
import { StatusBadgeComponent, StatusBadgeTone } from '@shared/components/status-badge/status-badge.component';
import { TenantUsagePage, TenantUsageRow } from '../../models/subscription-admin.models';
import { SubscriptionAdminService, subscriptionErrorMessage } from '../../services/subscription-admin.service';
import { subscriptionAdminCapabilities } from '../../services/subscription-admin-access';

const PER_PAGE = 25;

/** Which churches are close to their plan limits, from the latest daily usage measurement. */
@Component({
  selector: 'app-tenant-usage-page',
  standalone: true,
  imports: [CommonModule, FormsModule, RouterModule, CfEmptyStateComponent, DataTableComponent, LoadingSkeletonComponent, StatusBadgeComponent],
  templateUrl: './tenant-usage.page.html',
  styleUrls: ['../../styles/subscription-admin.scss'],
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class TenantUsagePageComponent implements OnInit, OnDestroy {
  private readonly api = inject(SubscriptionAdminService);
  private readonly auth = inject(AuthService);
  private readonly route = inject(ActivatedRoute);
  private readonly cdr = inject(ChangeDetectorRef);
  private readonly destroy$ = new Subject<void>();
  private readonly reload$ = new Subject<void>();

  readonly can = subscriptionAdminCapabilities(this.auth);
  result: TenantUsagePage | null = null;
  attentionOnly = true;
  page = 1;
  loading = false;
  error: string | null = null;

  ngOnInit(): void {
    const attention = this.route.snapshot.queryParamMap.get('attention');
    this.attentionOnly = attention === null ? true : attention === '1';
    if (this.can.usage) this.load();
  }

  ngOnDestroy(): void {
    this.reload$.next();
    this.destroy$.next();
    this.destroy$.complete();
  }

  applyFilter(): void {
    this.page = 1;
    this.load();
  }

  goTo(page: number): void {
    const meta = this.result?.meta;
    if (!meta || page < 1 || page > meta.last_page) return;
    this.page = page;
    this.load();
  }

  levelLabel(level: string): string {
    switch (level) {
      case 'notice':
        return 'Getting busy';
      case 'warning':
        return 'Nearly full';
      case 'critical':
        return 'Almost full';
      case 'at_limit':
        return 'Full';
      case 'over_limit':
        return 'Over the limit';
      default:
        return 'Plenty of room';
    }
  }

  levelTone(level: string): StatusBadgeTone {
    switch (level) {
      case 'warning':
        return 'warning';
      case 'critical':
      case 'at_limit':
      case 'over_limit':
        return 'critical';
      default:
        return 'success';
    }
  }

  usageText(row: TenantUsageRow['usage'][number]): string {
    return row.limit === null ? `${row.usage.toLocaleString()} (no limit)` : `${row.usage.toLocaleString()} of ${row.limit.toLocaleString()}`;
  }

  load(): void {
    this.reload$.next();
    this.loading = true;
    this.error = null;
    this.cdr.markForCheck();
    this.api
      .tenantUsage({ attentionOnly: this.attentionOnly, page: this.page, perPage: PER_PAGE })
      .pipe(takeUntil(this.reload$), takeUntil(this.destroy$))
      .subscribe({
        next: (res) => {
          this.result = res;
          this.loading = false;
          this.cdr.markForCheck();
        },
        error: (err) => {
          this.error = subscriptionErrorMessage(err, 'Unable to load church usage.');
          this.loading = false;
          this.cdr.markForCheck();
        },
      });
  }

  trackByTenant(_index: number, row: TenantUsageRow): number {
    return row.tenant_id;
  }
}
