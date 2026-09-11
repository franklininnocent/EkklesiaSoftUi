import {
  ChangeDetectionStrategy,
  ChangeDetectorRef,
  Component,
  OnDestroy,
  OnInit,
  inject,
  signal,
} from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { Subject, Subscription, interval, switchMap, takeUntil, takeWhile } from 'rxjs';
import { PageHeaderComponent } from '@shared/components/page-header/page-header.component';
import { CfEmptyStateComponent } from '@shared/components/cf-empty-state/cf-empty-state.component';
import { LoadingSkeletonComponent } from '@shared/components/loading-skeleton/loading-skeleton.component';
import { ModalShellComponent } from '@shared/components/modal-shell/modal-shell.component';
import { AuthService } from '@core/services/auth.service';
import { TenantDataExportService } from './tenant-data-export.service';
import {
  TenantDataExport,
  TenantDataExportModule,
  TenantDataExportStatus,
} from './tenant-data-export.model';

@Component({
  selector: 'app-data-export-page',
  standalone: true,
  imports: [
    CommonModule,
    FormsModule,
    PageHeaderComponent,
    CfEmptyStateComponent,
    LoadingSkeletonComponent,
    ModalShellComponent,
  ],
  templateUrl: './data-export.page.html',
  styleUrl: './data-export.page.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class DataExportPage implements OnInit, OnDestroy {
  private readonly api = inject(TenantDataExportService);
  private readonly auth = inject(AuthService);
  private readonly cdr = inject(ChangeDetectorRef);
  private readonly destroy$ = new Subject<void>();
  private pollSub: Subscription | null = null;

  readonly canExport = this.auth.hasTenantPermission('tenant.data.export');

  modules: TenantDataExportModule[] = [];
  selectedModules: Record<string, boolean> = {};
  includeMedia = false;
  exports: TenantDataExport[] = [];

  loadingModules = false;
  loadingHistory = false;
  loadedHistory = false;
  starting = false;
  downloadingId: string | null = null;
  actionId: string | null = null;

  showStartModal = false;
  /** Signal so OnPush reliably tears down the processing modal on download. */
  readonly showProgressModal = signal(false);
  activeExport: TenantDataExport | null = null;

  error: string | null = null;
  success: string | null = null;

  ngOnInit(): void {
    if (this.canExport) {
      this.reloadHistory();
    }
  }

  ngOnDestroy(): void {
    this.stopPolling();
    this.destroy$.next();
    this.destroy$.complete();
  }

  openStartModal(): void {
    if (!this.canExport || this.starting) {
      return;
    }
    this.error = null;
    this.includeMedia = false;
    this.showStartModal = true;
    this.loadModules();
    this.cdr.markForCheck();
  }

  closeStartModal(): void {
    if (this.starting) {
      return;
    }
    this.showStartModal = false;
    this.cdr.markForCheck();
  }

  closeProgressModal(): void {
    this.dismissProgressModal();
  }

  openProgressModal(): void {
    this.showProgressModal.set(true);
    this.cdr.markForCheck();
  }

  /** Footer Download on the processing modal — dismiss first, then start the file save. */
  downloadFromProgressModal(row: TenantDataExport): void {
    this.dismissProgressModal();
    this.download(row);
  }

  /** Tear down processing modal + scroll lock; flush CD after the current click. */
  private dismissProgressModal(): void {
    this.showProgressModal.set(false);
    this.stopPolling();
    document.body.style.overflow = '';
    this.cdr.markForCheck();
    queueMicrotask(() => this.cdr.detectChanges());
  }

  loadModules(): void {
    this.loadingModules = true;
    this.api
      .listModules()
      .pipe(takeUntil(this.destroy$))
      .subscribe({
        next: (modules) => {
          this.modules = modules;
          this.selectedModules = {};
          for (const mod of modules) {
            this.selectedModules[mod.key] = !!mod.default_selected;
          }
          this.loadingModules = false;
          this.cdr.markForCheck();
        },
        error: (err) => {
          this.loadingModules = false;
          this.error = err?.error?.message || 'Could not load export modules.';
          this.cdr.markForCheck();
        },
      });
  }

  reloadHistory(): void {
    this.loadingHistory = true;
    this.error = null;
    this.api
      .listExports(20)
      .pipe(takeUntil(this.destroy$))
      .subscribe({
        next: (rows) => {
          this.exports = rows;
          this.loadingHistory = false;
          this.loadedHistory = true;
          const active = rows.find((row) => row.status === 'queued' || row.status === 'processing');
          if (active) {
            this.activeExport = active;
            this.startPolling(active.id);
          }
          this.cdr.markForCheck();
        },
        error: (err) => {
          this.loadingHistory = false;
          this.loadedHistory = true;
          this.error = err?.error?.message || 'Could not load export history.';
          this.cdr.markForCheck();
        },
      });
  }

  get selectedCount(): number {
    return Object.values(this.selectedModules).filter(Boolean).length;
  }

  get estimatedRecords(): number {
    return this.modules.reduce(
      (sum, mod) => sum + (this.selectedModules[mod.key] ? Number(mod.estimated_records || 0) : 0),
      0
    );
  }

  get allSelected(): boolean {
    return this.modules.length > 0 && this.modules.every((mod) => this.selectedModules[mod.key]);
  }

  toggleSelectAll(checked: boolean): void {
    for (const mod of this.modules) {
      this.selectedModules[mod.key] = checked;
    }
    this.cdr.markForCheck();
  }

  onModuleSelectionChange(): void {
    this.cdr.markForCheck();
  }

  startExport(): void {
    if (!this.canExport || this.starting) {
      return;
    }
    const modules = this.modules.filter((mod) => this.selectedModules[mod.key]).map((mod) => mod.key);
    if (!modules.length) {
      this.error = 'Select at least one data module to export.';
      this.cdr.markForCheck();
      return;
    }

    this.starting = true;
    this.error = null;
    this.success = null;
    this.cdr.markForCheck();
    this.api
      .startExport({ modules, format: 'csv', include_media: this.includeMedia })
      .pipe(takeUntil(this.destroy$))
      .subscribe({
        next: (exportRow) => {
          this.starting = false;
          this.showStartModal = false;
          this.activeExport = exportRow;
          this.success = 'Export started. You can track progress below.';
          this.reloadHistory();
          if (exportRow.status === 'queued' || exportRow.status === 'processing') {
            this.showProgressModal.set(true);
            this.startPolling(exportRow.id);
          } else if (exportRow.status === 'completed') {
            this.success = 'Export is ready to download.';
          } else if (exportRow.status === 'failed') {
            this.error = exportRow.error_message || 'Export failed.';
          }
          this.cdr.markForCheck();
        },
        error: (err) => {
          this.starting = false;
          this.error = err?.error?.message || 'Could not start export.';
          this.cdr.markForCheck();
        },
      });
  }

  download(row: TenantDataExport): void {
    if (!row.downloadable || this.downloadingId) {
      return;
    }
    if (this.showProgressModal()) {
      this.dismissProgressModal();
    }

    this.downloadingId = row.id;
    this.error = null;
    this.success = null;
    this.cdr.markForCheck();

    this.api
      .download(row.id)
      .pipe(takeUntil(this.destroy$))
      .subscribe({
        next: (blob) => {
          void (async () => {
            try {
              if (!(blob instanceof Blob) || blob.size < 4) {
                throw new Error('Download failed — the export file was empty. Please try again.');
              }

              const headBuf = await blob.slice(0, 4).arrayBuffer();
              const header = new Uint8Array(headBuf);
              if (header[0] !== 0x50 || header[1] !== 0x4b) {
                throw new Error(
                  'Download did not return a ZIP file. Please try again or start a new export.'
                );
              }

              const zipBlob =
                blob.type === 'application/zip'
                  ? blob
                  : new Blob([blob], { type: 'application/zip' });
              const url = URL.createObjectURL(zipBlob);
              const anchor = document.createElement('a');
              anchor.href = url;
              anchor.download = `tenant-data-export-${row.id}.zip`;
              anchor.rel = 'noopener';
              anchor.style.display = 'none';
              document.body.appendChild(anchor);
              anchor.click();
              anchor.remove();
              window.setTimeout(() => URL.revokeObjectURL(url), 60_000);

              this.success = 'Download started.';
              // Ensure modal is gone after the async save completes too.
              this.dismissProgressModal();
              this.reloadHistory();
            } catch (err: any) {
              this.error = err?.message || 'Could not download export.';
            } finally {
              this.downloadingId = null;
              this.cdr.detectChanges();
            }
          })();
        },
        error: async (err) => {
          this.downloadingId = null;
          this.error =
            (await this.readBlobError(err)) ||
            err?.message ||
            'Could not download export.';
          this.cdr.markForCheck();
        },
      });
  }

  cancel(row: TenantDataExport): void {
    if (row.status !== 'queued' || this.actionId) {
      return;
    }
    this.actionId = row.id;
    this.api
      .cancel(row.id)
      .pipe(takeUntil(this.destroy$))
      .subscribe({
        next: () => {
          this.actionId = null;
          this.success = 'Export cancelled.';
          this.stopPolling();
          this.reloadHistory();
          this.cdr.markForCheck();
        },
        error: (err) => {
          this.actionId = null;
          this.error = err?.error?.message || 'Could not cancel export.';
          this.cdr.markForCheck();
        },
      });
  }

  retry(row: TenantDataExport): void {
    if (row.status !== 'failed' || this.actionId) {
      return;
    }
    this.actionId = row.id;
    this.api
      .retry(row.id)
      .pipe(takeUntil(this.destroy$))
      .subscribe({
        next: (exportRow) => {
          this.actionId = null;
          this.activeExport = exportRow;
          this.success = 'Export queued again.';
          this.showProgressModal.set(true);
          this.startPolling(exportRow.id);
          this.reloadHistory();
          this.cdr.markForCheck();
        },
        error: (err) => {
          this.actionId = null;
          this.error = err?.error?.message || 'Could not retry export.';
          this.cdr.markForCheck();
        },
      });
  }

  statusLabel(status: TenantDataExportStatus | string): string {
    switch (status) {
      case 'queued':
        return 'Queued';
      case 'processing':
        return 'Processing';
      case 'completed':
        return 'Completed';
      case 'failed':
        return 'Failed';
      case 'expired':
        return 'Expired';
      case 'cancelled':
        return 'Cancelled';
      default:
        return status;
    }
  }

  moduleProgressEntries(exportRow: TenantDataExport | null): Array<{ key: string; status: string; records: number }> {
    const modules = exportRow?.progress?.modules || {};
    return Object.entries(modules).map(([key, value]) => ({
      key,
      status: value?.status || 'pending',
      records: Number(value?.records || 0),
    }));
  }

  formatBytes(size?: number | null): string {
    if (size == null || size <= 0) {
      return '—';
    }
    if (size < 1024) {
      return `${size} B`;
    }
    if (size < 1024 * 1024) {
      return `${(size / 1024).toFixed(1)} KB`;
    }
    return `${(size / (1024 * 1024)).toFixed(1)} MB`;
  }

  formatDate(value?: string | null): string {
    if (!value) {
      return '—';
    }
    const date = new Date(value);
    if (Number.isNaN(date.getTime())) {
      return '—';
    }
    return date.toLocaleString();
  }

  modulesLabel(modules?: string[]): string {
    if (!modules?.length) {
      return '—';
    }
    return modules.join(', ');
  }

  private startPolling(exportId: string): void {
    this.stopPolling();
    this.pollSub = interval(2500)
      .pipe(
        takeUntil(this.destroy$),
        switchMap(() => this.api.getExport(exportId)),
        takeWhile(
          (row) => row.status === 'queued' || row.status === 'processing',
          true
        )
      )
      .subscribe({
        next: (row) => {
          this.activeExport = row;
          this.exports = this.exports.map((item) => (item.id === row.id ? row : item));
          if (row.status === 'completed') {
            this.success = 'Export is ready to download.';
            this.reloadHistory();
          } else if (row.status === 'failed') {
            this.error = row.error_message || 'Export failed.';
            this.reloadHistory();
          } else if (row.status === 'cancelled') {
            this.success = 'Export cancelled.';
            this.reloadHistory();
          }
          this.cdr.markForCheck();
        },
        error: () => {
          this.stopPolling();
        },
      });
  }

  private stopPolling(): void {
    this.pollSub?.unsubscribe();
    this.pollSub = null;
  }

  private async readBlobError(err: any): Promise<string | null> {
    if (typeof err?.message === 'string' && err.message && !err?.error) {
      return err.message;
    }
    const blob = err?.error;
    if (blob instanceof Blob) {
      try {
        const text = await blob.text();
        const json = JSON.parse(text);
        return json?.message || null;
      } catch {
        return null;
      }
    }
    return err?.error?.message || err?.message || null;
  }
}
