import {
  ChangeDetectionStrategy,
  ChangeDetectorRef,
  Component,
  OnDestroy,
  OnInit,
  inject,
} from '@angular/core';
import { CommonModule } from '@angular/common';
import { RouterLink } from '@angular/router';
import { Subject, takeUntil } from 'rxjs';
import { AuthService } from '@core/services/auth.service';
import { ToastService } from '@core/services/toast.service';
import { PageHeaderComponent } from '@shared/components/page-header/page-header.component';
import { DataTableComponent } from '@shared/components/data-table/data-table.component';
import { CfEmptyStateComponent } from '@shared/components/cf-empty-state/cf-empty-state.component';
import { LoadingSkeletonComponent } from '@shared/components/loading-skeleton/loading-skeleton.component';
import { StatusBadgeComponent } from '@shared/components/status-badge/status-badge.component';
import {
  ConfirmationModalComponent,
  ConfirmationResult,
} from '@shared/components/confirmation-modal/confirmation-modal.component';
import { TenantSacramentSetting } from './sacrament-settings.model';
import { SacramentSettingsService } from './sacrament-settings.service';

@Component({
  selector: 'app-sacrament-settings-page',
  standalone: true,
  imports: [
    CommonModule,
    RouterLink,
    PageHeaderComponent,
    DataTableComponent,
    CfEmptyStateComponent,
    LoadingSkeletonComponent,
    StatusBadgeComponent,
    ConfirmationModalComponent,
  ],
  templateUrl: './sacrament-settings.page.html',
  styleUrl: './sacrament-settings.page.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class SacramentSettingsPage implements OnInit, OnDestroy {
  private readonly api = inject(SacramentSettingsService);
  private readonly auth = inject(AuthService);
  private readonly toast = inject(ToastService);
  private readonly cdr = inject(ChangeDetectorRef);
  private readonly destroy$ = new Subject<void>();

  readonly canView =
    this.auth.isTenantAdmin() ||
    this.auth.hasPermission('sacraments.settings.view') ||
    this.auth.hasPermission('sacraments.settings.manage');
  readonly canManage =
    this.auth.isTenantAdmin() || this.auth.hasPermission('sacraments.settings.manage');

  rows: TenantSacramentSetting[] = [];
  loading = false;
  loaded = false;
  savingId: number | null = null;
  error: string | null = null;
  confirmOpen = false;
  pendingDeactivate: TenantSacramentSetting | null = null;

  readonly categoryLabels: Record<string, string> = {
    initiation: 'Initiation',
    healing: 'Healing',
    service: 'Service',
    other: 'Other',
  };

  ngOnInit(): void {
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
    this.api
      .list()
      .pipe(takeUntil(this.destroy$))
      .subscribe({
        next: (response) => {
          this.rows = response.data || [];
          this.loading = false;
          this.loaded = true;
          this.cdr.markForCheck();
        },
        error: (err) => {
          this.loading = false;
          this.loaded = true;
          this.error = err?.error?.message || 'Could not load sacrament settings.';
          this.cdr.markForCheck();
        },
      });
  }

  categoryLabel(category?: string | null): string {
    if (!category) {
      return '—';
    }
    return this.categoryLabels[category] || category;
  }

  onToggle(row: TenantSacramentSetting, event: Event): void {
    const input = event.target as HTMLInputElement;
    const next = input.checked;
    input.checked = row.is_active;

    if (!this.canManage || this.savingId !== null) {
      return;
    }

    if (row.is_active && !next) {
      this.pendingDeactivate = row;
      this.confirmOpen = true;
      this.cdr.markForCheck();
      return;
    }

    if (!row.is_active && next) {
      this.save(row, true);
    }
  }

  onDeactivateConfirmed(result: ConfirmationResult): void {
    this.confirmOpen = false;
    const row = this.pendingDeactivate;
    this.pendingDeactivate = null;
    if (!result.confirmed || !row) {
      this.cdr.markForCheck();
      return;
    }
    this.save(row, false);
  }

  get deactivateTitle(): string {
    const name = this.pendingDeactivate?.name || 'this sacrament';
    return `Deactivate ${name}?`;
  }

  get deactivateMessage(): string {
    const name = this.pendingDeactivate?.name || 'This sacrament';
    return (
      `${name} will no longer be available for new sacrament registration in this church. ` +
      `Existing records will not be deleted or changed. You can activate it again at any time.`
    );
  }

  private save(row: TenantSacramentSetting, isActive: boolean): void {
    this.savingId = row.sacrament_type_id;
    this.error = null;
    this.api
      .update(row.sacrament_type_id, isActive)
      .pipe(takeUntil(this.destroy$))
      .subscribe({
        next: (response) => {
          this.rows = this.rows.map((item) =>
            item.sacrament_type_id === row.sacrament_type_id ? response.data : item
          );
          this.savingId = null;
          this.toast.success(
            isActive
              ? `${response.data.name} is available for this church.`
              : `${response.data.name} is hidden from new registration.`
          );
          this.cdr.markForCheck();
        },
        error: (err) => {
          this.savingId = null;
          this.error = err?.error?.message || 'Could not update sacrament settings.';
          this.toast.error(this.error || 'Could not update sacrament settings.');
          this.cdr.markForCheck();
        },
      });
  }
}
