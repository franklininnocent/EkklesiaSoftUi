import {
  ChangeDetectionStrategy,
  ChangeDetectorRef,
  Component,
  OnDestroy,
  OnInit,
  inject,
} from '@angular/core';
import { CommonModule } from '@angular/common';
import { ActivatedRoute, Router, RouterLink } from '@angular/router';
import { Subject, takeUntil } from 'rxjs';
import { AuthService } from '@core/services/auth.service';
import { ToastService } from '@core/services/toast.service';
import { PageHeaderComponent } from '@shared/components/page-header/page-header.component';
import { StatusBadgeComponent, StatusBadgeTone } from '@shared/components/status-badge/status-badge.component';
import { CfEmptyStateComponent } from '@shared/components/cf-empty-state/cf-empty-state.component';
import { LoadingSkeletonComponent } from '@shared/components/loading-skeleton/loading-skeleton.component';
import { ConfirmationModalComponent } from '@shared/components/confirmation-modal/confirmation-modal.component';
import { DefaultSeedsService } from './default-seeds.service';
import {
  DefaultSeedCatalogItem,
  DefaultSeedCatalogSummary,
  DefaultSeedExecutionResult,
  DefaultSeedStatus,
} from './default-seeds.model';

interface ModuleGroup {
  module: string;
  label: string;
  items: DefaultSeedCatalogItem[];
}

@Component({
  selector: 'app-default-seeds-page',
  standalone: true,
  imports: [
    CommonModule,
    RouterLink,
    PageHeaderComponent,
    StatusBadgeComponent,
    CfEmptyStateComponent,
    LoadingSkeletonComponent,
    ConfirmationModalComponent,
  ],
  templateUrl: './default-seeds.page.html',
  styleUrl: './default-seeds.page.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class DefaultSeedsPage implements OnInit, OnDestroy {
  private readonly api = inject(DefaultSeedsService);
  private readonly auth = inject(AuthService);
  private readonly toast = inject(ToastService);
  private readonly router = inject(Router);
  private readonly route = inject(ActivatedRoute);
  private readonly cdr = inject(ChangeDetectorRef);
  private readonly destroy$ = new Subject<void>();

  readonly canView =
    this.auth.hasTenantPermission('settings.default-seeds.view') ||
    this.auth.hasTenantPermission('settings.default-seeds.run');
  readonly canRun = this.auth.hasTenantPermission('settings.default-seeds.run');

  seeders: DefaultSeedCatalogItem[] = [];
  summary: DefaultSeedCatalogSummary = {
    available: 0,
    partially_initialized: 0,
    initialized: 0,
    total: 0,
  };

  loading = false;
  loaded = false;
  error: string | null = null;
  executing = false;
  chooseIndividually = false;
  selectedIds = new Set<string>();
  rowResults = new Map<string, DefaultSeedExecutionResult>();

  showConfirm = false;
  pendingIds: string[] = [];
  moduleFilter: string | null = null;

  ngOnInit(): void {
    this.route.queryParamMap.pipe(takeUntil(this.destroy$)).subscribe((params) => {
      const module = params.get('module');
      this.moduleFilter = module === 'donations' || module === 'ministries' ? module : null;
      this.cdr.markForCheck();
    });

    if (this.canView) {
      this.reload();
    }
  }

  ngOnDestroy(): void {
    this.destroy$.next();
    this.destroy$.complete();
  }

  reload(): void {
    this.loading = true;
    this.error = null;
    this.cdr.markForCheck();

    this.api.getCatalog().subscribe({
      next: (payload) => {
        this.seeders = payload.seeders ?? [];
        this.summary = payload.summary ?? this.summary;
        this.loading = false;
        this.loaded = true;
        this.cdr.markForCheck();
      },
      error: () => {
        this.loading = false;
        this.loaded = true;
        this.error = 'Could not load recommended lists. Please try again.';
        this.cdr.markForCheck();
      },
    });
  }

  get visibleSeeders(): DefaultSeedCatalogItem[] {
    if (!this.moduleFilter) {
      return this.seeders;
    }

    return this.seeders.filter((item) => item.module === this.moduleFilter);
  }

  get moduleGroups(): ModuleGroup[] {
    const map = new Map<string, ModuleGroup>();
    for (const item of this.visibleSeeders) {
      const existing = map.get(item.module);
      if (existing) {
        existing.items.push(item);
      } else {
        map.set(item.module, {
          module: item.module,
          label: item.module_label,
          items: [item],
        });
      }
    }

    return Array.from(map.values());
  }

  get hasMissing(): boolean {
    return this.visibleSeeders.some((item) => item.missing_count > 0);
  }

  get allComplete(): boolean {
    return this.visibleSeeders.length > 0 && this.visibleSeeders.every((item) => item.status === 'initialized');
  }

  get selectedCount(): number {
    return this.selectedIds.size;
  }

  get decisionTitle(): string {
    if (this.moduleFilter === 'donations') {
      return 'Add recommended offering categories';
    }
    if (this.moduleFilter === 'ministries') {
      return 'Add recommended ministry lists';
    }

    return 'Add recommended lists for your church';
  }

  get decisionSubtitle(): string {
    return 'This fills in the standard categories, types, and positions your parish does not have yet.';
  }

  toggleChooseIndividually(): void {
    this.chooseIndividually = !this.chooseIndividually;
    if (!this.chooseIndividually) {
      this.selectedIds.clear();
    }
    this.cdr.markForCheck();
  }

  isSelectable(item: DefaultSeedCatalogItem): boolean {
    return item.missing_count > 0 && this.canRun;
  }

  isSelected(id: string): boolean {
    return this.selectedIds.has(id);
  }

  toggleSelected(item: DefaultSeedCatalogItem, checked: boolean): void {
    if (!this.isSelectable(item)) {
      return;
    }

    if (checked) {
      this.selectedIds.add(item.id);
    } else {
      this.selectedIds.delete(item.id);
    }
    this.cdr.markForCheck();
  }

  selectAllMissing(): void {
    this.chooseIndividually = true;
    this.selectedIds.clear();
    for (const item of this.visibleSeeders) {
      if (this.isSelectable(item)) {
        this.selectedIds.add(item.id);
      }
    }
    this.cdr.markForCheck();
  }

  promptAddAllMissing(): void {
    const ids = this.visibleSeeders.filter((item) => item.missing_count > 0).map((item) => item.id);
    if (!ids.length) {
      return;
    }
    this.pendingIds = ids;
    this.showConfirm = true;
    this.cdr.markForCheck();
  }

  promptAddSelected(): void {
    const ids = Array.from(this.selectedIds);
    if (!ids.length) {
      return;
    }
    this.pendingIds = ids;
    this.showConfirm = true;
    this.cdr.markForCheck();
  }

  promptAddOne(item: DefaultSeedCatalogItem): void {
    if (!this.isSelectable(item)) {
      return;
    }
    this.pendingIds = [item.id];
    this.showConfirm = true;
    this.cdr.markForCheck();
  }

  cancelConfirm(): void {
    this.showConfirm = false;
    this.pendingIds = [];
    this.cdr.markForCheck();
  }

  confirmAdd(): void {
    if (!this.pendingIds.length || this.executing) {
      return;
    }

    this.showConfirm = false;
    this.executing = true;
    this.cdr.markForCheck();

    this.api.execute(this.pendingIds).subscribe({
      next: (payload) => {
        this.executing = false;
        for (const result of payload.results ?? []) {
          this.rowResults.set(result.id, result);
        }
        const created = (payload.results ?? []).reduce((sum, row) => sum + (row.created_count ?? 0), 0);
        if (created > 0) {
          this.toast.success(
            `Added ${created} recommended list${created === 1 ? '' : 's'}. Existing parish labels were not changed.`,
            'Lists added',
          );
        } else {
          this.toast.info('Recommended lists are already in place. Nothing new was added.', 'Already complete');
        }
        this.selectedIds.clear();
        this.pendingIds = [];
        this.reload();
      },
      error: (err) => {
        this.executing = false;
        this.pendingIds = [];
        const message = err?.error?.message ?? 'Some lists could not be added. Please try again.';
        this.toast.error(message, 'Could not add lists');
        this.reload();
      },
    });
  }

  confirmMessage(): string {
    const names: string[] = [];
    for (const id of this.pendingIds) {
      const item = this.seeders.find((row) => row.id === id);
      if (item?.missing_names?.length) {
        names.push(...item.missing_names);
      }
    }

    const unique = Array.from(new Set(names));
    const preview = unique.slice(0, 8).join(', ');
    const extra = unique.length > 8 ? ` and ${unique.length - 8} more` : '';
    const listText = unique.length ? `This will add: ${preview}${extra}.` : 'This will add the missing recommended lists.';

    return `${listText} Existing parish lists will not be changed or deleted.`;
  }

  statusLabel(status: DefaultSeedStatus, item: DefaultSeedCatalogItem): string {
    if (status === 'available') {
      return 'Not added yet';
    }
    if (status === 'partially_initialized') {
      return `Some added · ${item.matched_count} of ${item.expected_count}`;
    }
    if (status === 'initialized') {
      return 'Complete';
    }

    return 'Unavailable';
  }

  statusTone(status: DefaultSeedStatus): StatusBadgeTone {
    if (status === 'initialized') {
      return 'success';
    }
    if (status === 'partially_initialized') {
      return 'warning';
    }
    if (status === 'available') {
      return 'info';
    }

    return 'neutral';
  }

  rowResult(item: DefaultSeedCatalogItem): DefaultSeedExecutionResult | undefined {
    return this.rowResults.get(item.id);
  }

  openLink(item: DefaultSeedCatalogItem): string[] {
    return [item.open_route];
  }

  openQuery(item: DefaultSeedCatalogItem): Record<string, string> | null {
    return item.open_query ?? null;
  }
}
