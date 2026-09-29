import { ChangeDetectionStrategy, ChangeDetectorRef, Component, OnDestroy, OnInit, inject } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { Subject, takeUntil } from 'rxjs';
import { AuthService } from '@core/services/auth.service';
import { CfEmptyStateComponent } from '@shared/components/cf-empty-state/cf-empty-state.component';
import { DataTableComponent } from '@shared/components/data-table/data-table.component';
import { LoadingSkeletonComponent } from '@shared/components/loading-skeleton/loading-skeleton.component';
import { CatalogAuditEntry, PageMeta } from '../../models/subscription-admin.models';
import { SubscriptionAdminService, subscriptionErrorMessage } from '../../services/subscription-admin.service';
import { subscriptionAdminCapabilities } from '../../services/subscription-admin-access';

const PER_PAGE = 25;

@Component({
  selector: 'app-subscription-audit-page',
  standalone: true,
  imports: [CommonModule, FormsModule, CfEmptyStateComponent, DataTableComponent, LoadingSkeletonComponent],
  templateUrl: './subscription-audit.page.html',
  styleUrls: ['../../styles/subscription-admin.scss'],
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class SubscriptionAuditPage implements OnInit, OnDestroy {
  private readonly api = inject(SubscriptionAdminService);
  private readonly auth = inject(AuthService);
  private readonly cdr = inject(ChangeDetectorRef);
  private readonly destroy$ = new Subject<void>();
  private readonly reload$ = new Subject<void>();

  readonly can = subscriptionAdminCapabilities(this.auth);
  readonly entityTypes: { value: string | null; label: string }[] = [
    { value: null, label: 'Everything' },
    { value: 'plan', label: 'Plans' },
    { value: 'plan_version', label: 'Plan versions' },
    { value: 'feature', label: 'Features' },
    { value: 'policy', label: 'Policies' },
  ];

  entries: CatalogAuditEntry[] = [];
  meta: PageMeta | null = null;
  entityType: string | null = null;
  page = 1;
  loading = false;
  error: string | null = null;
  expandedId: number | null = null;

  ngOnInit(): void {
    if (this.can.audit) this.load();
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
    if (!this.meta || page < 1 || page > this.meta.last_page) return;
    this.page = page;
    this.load();
  }

  toggle(id: number): void {
    this.expandedId = this.expandedId === id ? null : id;
    this.cdr.markForCheck();
  }

  describe(entry: CatalogAuditEntry): string {
    return entry.operation.replace(/_/g, ' ').replace(/^./, (c) => c.toUpperCase());
  }

  entityLabel(entry: CatalogAuditEntry): string {
    const type = this.entityTypes.find((t) => t.value === entry.entity_type)?.label ?? entry.entity_type;
    return entry.entity_id ? `${type} #${entry.entity_id}` : type;
  }

  pretty(value: unknown): string {
    return value == null ? '—' : JSON.stringify(value, null, 2);
  }

  load(): void {
    this.reload$.next();
    this.loading = true;
    this.error = null;
    this.cdr.markForCheck();
    this.api
      .catalogAudits({ entityType: this.entityType, page: this.page, perPage: PER_PAGE })
      .pipe(takeUntil(this.reload$), takeUntil(this.destroy$))
      .subscribe({
        next: (res) => {
          this.entries = res.data;
          this.meta = res.meta;
          this.loading = false;
          this.cdr.markForCheck();
        },
        error: (err) => {
          this.error = subscriptionErrorMessage(err, 'Unable to load change history.');
          this.loading = false;
          this.cdr.markForCheck();
        },
      });
  }
}
