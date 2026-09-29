import { CommonModule } from '@angular/common';
import {
  ChangeDetectionStrategy,
  ChangeDetectorRef,
  Component,
  OnDestroy,
  OnInit,
} from '@angular/core';
import { FormsModule } from '@angular/forms';
import { RouterLink } from '@angular/router';
import { Subject, takeUntil } from 'rxjs';
import { AuthService } from '@core/services/auth.service';
import { ToastService } from '@core/services/toast.service';
import { ConfirmationModalComponent } from '@shared/components/confirmation-modal/confirmation-modal.component';
import { CfEmptyStateComponent } from '@shared/components/cf-empty-state/cf-empty-state.component';
import { DataTableComponent } from '@shared/components/data-table/data-table.component';
import { ListToolbarComponent } from '@shared/components/list-toolbar/list-toolbar.component';
import { LoadingSkeletonComponent } from '@shared/components/loading-skeleton/loading-skeleton.component';
import { ModalShellComponent } from '@shared/components/modal-shell/modal-shell.component';
import { PageHeaderComponent } from '@shared/components/page-header/page-header.component';
import { PaginationComponent } from '@shared/components/pagination/pagination.component';
import {
  StatusBadgeComponent,
  StatusBadgeTone,
} from '@shared/components/status-badge/status-badge.component';
import { PAGINATION_DEFAULTS } from '../../constants/sacrament.constants';
import { SacramentParticipantDraft } from '../../models/sacrament-definition.model';
import {
  MigrationConfidence,
  MigrationResolutionKind,
  SacramentMigrationReport,
  SacramentMigrationResolution,
} from '../../models/sacrament-migration.model';
import { SacramentMigrationService } from '../../services/sacrament-migration.service';
import { ParticipantSourceControlComponent } from '../shared/participant-source-control/participant-source-control.component';

export interface MigrationBackfillTotals {
  processed?: number;
  linked?: number;
  unresolved?: number;
  skipped?: number;
  failed?: number;
  created_participants?: number;
}

const ROLE_LABELS: Record<string, string> = {
  recipient: 'Recipient',
  bride: 'Bride',
  groom: 'Groom',
  father: 'Father',
  mother: 'Mother',
  godfather: 'Godfather',
  godmother: 'Godmother',
  sponsor: 'Sponsor',
  witness: 'Witness',
  minister: 'Minister',
  candidate: 'Candidate',
  co_consecrator: 'Co-consecrator',
};

@Component({
  selector: 'app-sacrament-migration-queue',
  standalone: true,
  imports: [
    CommonModule,
    FormsModule,
    RouterLink,
    PageHeaderComponent,
    ListToolbarComponent,
    LoadingSkeletonComponent,
    DataTableComponent,
    StatusBadgeComponent,
    PaginationComponent,
    CfEmptyStateComponent,
    ConfirmationModalComponent,
    ModalShellComponent,
    ParticipantSourceControlComponent,
  ],
  templateUrl: './sacrament-migration-queue.component.html',
  styleUrl: './sacrament-migration-queue.component.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class SacramentMigrationQueueComponent implements OnInit, OnDestroy {
  private readonly destroy$ = new Subject<void>();

  report: SacramentMigrationReport | null = null;
  rows: SacramentMigrationResolution[] = [];
  reportLoading = false;
  queueLoading = false;
  queueLoaded = false;
  reportError: string | null = null;
  queueError: string | null = null;
  busy = false;
  filterResolution: 'unresolved' | 'member' | 'external' | '' = 'unresolved';
  search = '';
  currentPage: number = PAGINATION_DEFAULTS.DEFAULT_PAGE;
  perPage: number = PAGINATION_DEFAULTS.DEFAULT_PER_PAGE;
  totalItems = 0;
  readonly pageSizeOptions: number[] = [...PAGINATION_DEFAULTS.PAGE_SIZE_OPTIONS];

  showScanConfirm = false;
  lastScan: { dryRun: boolean; totals: MigrationBackfillTotals } | null = null;

  selected: SacramentMigrationResolution | null = null;
  resolveMode: 'member' | 'external' = 'external';
  resolveDraft: SacramentParticipantDraft | null = null;
  resolveError: string | null = null;

  constructor(
    private readonly migration: SacramentMigrationService,
    private readonly authService: AuthService,
    private readonly toast: ToastService,
    private readonly cdr: ChangeDetectorRef
  ) {}

  ngOnInit(): void {
    this.loadReport();
    this.loadQueue();
  }

  ngOnDestroy(): void {
    this.destroy$.next();
    this.destroy$.complete();
  }

  get canResolve(): boolean {
    return this.authService.hasPermission('sacraments.migration.resolve');
  }

  get hasActiveFilters(): boolean {
    return this.search.trim() !== '' || this.filterResolution !== 'unresolved';
  }

  get emptyTitle(): string {
    if (this.hasActiveFilters) {
      return 'No names match';
    }
    if (this.filterResolution === 'unresolved') {
      if ((this.report?.total_resolutions ?? 0) === 0) {
        return 'No names to link yet';
      }
      return 'Nothing is waiting';
    }
    return 'No names in this list';
  }

  get emptyDescription(): string {
    if (this.hasActiveFilters) {
      return 'Try another status or clear the search.';
    }
    if (this.filterResolution === 'unresolved') {
      if ((this.report?.total_resolutions ?? 0) === 0) {
        return 'Preview a scan to see how many written names are still on older records. A preview changes nothing.';
      }
      return 'Every name in this list has been decided. Choose All to review them.';
    }
    return 'Try another status filter.';
  }

  loadReport(): void {
    this.reportLoading = true;
    this.reportError = null;
    this.migration
      .getReport()
      .pipe(takeUntil(this.destroy$))
      .subscribe({
        next: (response) => {
          this.report = response.data;
          this.reportLoading = false;
          this.cdr.markForCheck();
        },
        error: (error) => {
          this.reportError = error?.message || 'Failed to load progress.';
          this.reportLoading = false;
          this.cdr.markForCheck();
        },
      });
  }

  loadQueue(): void {
    this.queueLoading = true;
    this.queueError = null;
    this.migration
      .list({
        resolution: this.filterResolution || undefined,
        q: this.search.trim() || undefined,
        page: this.currentPage,
        per_page: this.perPage,
      })
      .pipe(takeUntil(this.destroy$))
      .subscribe({
        next: (response) => {
          this.rows = response.data?.data ?? [];
          this.currentPage = response.data?.current_page ?? this.currentPage;
          this.totalItems = response.data?.total ?? 0;
          this.queueLoading = false;
          this.queueLoaded = true;
          this.cdr.markForCheck();
        },
        error: (error) => {
          this.queueError = error?.message || 'Failed to load names.';
          this.queueLoading = false;
          this.queueLoaded = true;
          this.cdr.markForCheck();
        },
      });
  }

  reloadAll(): void {
    this.loadReport();
    this.loadQueue();
  }

  onSearchChange(term: string): void {
    this.search = term;
    this.currentPage = 1;
    this.loadQueue();
  }

  onStatusChange(): void {
    this.currentPage = 1;
    this.loadQueue();
  }

  onPageChange(page: number): void {
    this.currentPage = page;
    this.loadQueue();
  }

  onPageSizeChange(size: number): void {
    this.perPage = size;
    this.currentPage = 1;
    this.loadQueue();
  }

  showUnresolvedQueue(): void {
    this.filterResolution = 'unresolved';
    this.currentPage = 1;
    this.loadQueue();
  }

  requestPreviewScan(): void {
    this.runBackfill(true);
  }

  requestScanRecords(): void {
    if (!this.canResolve || this.busy) {
      return;
    }
    this.showScanConfirm = true;
    this.cdr.markForCheck();
  }

  confirmScan(): void {
    this.showScanConfirm = false;
    this.runBackfill(false);
  }

  cancelScanConfirm(): void {
    this.showScanConfirm = false;
    this.cdr.markForCheck();
  }

  runBackfill(dryRun: boolean): void {
    if (this.busy) {
      return;
    }
    this.busy = true;
    this.migration
      .backfill(dryRun)
      .pipe(takeUntil(this.destroy$))
      .subscribe({
        next: (response) => {
          const totals = (response.data?.totals ?? {}) as MigrationBackfillTotals;
          this.lastScan = { dryRun, totals };
          if (response.data?.report) {
            this.report = response.data.report as SacramentMigrationReport;
          }
          this.toast.success(dryRun ? 'Preview complete.' : 'Scan complete.');
          this.busy = false;
          this.reloadAll();
        },
        error: (error) => {
          this.toast.error(error?.message || 'Scan failed.');
          this.busy = false;
          this.cdr.markForCheck();
        },
      });
  }

  openResolve(row: SacramentMigrationResolution): void {
    this.selected = row;
    this.resolveError = null;
    this.resolveMode = row.candidate_member_id ? 'member' : 'external';
    this.resolveDraft = {
      role: row.participant_role,
      source: this.resolveMode === 'member' ? 'member' : 'external',
      family_member_id: row.candidate_member_id,
      display_name: row.candidate_member_name || row.legacy_name || undefined,
      external_full_name: row.legacy_name || undefined,
      external_date_of_birth: row.legacy_dob || undefined,
    };
    this.cdr.markForCheck();
  }

  closeResolve(): void {
    this.selected = null;
    this.resolveDraft = null;
    this.resolveError = null;
    this.cdr.markForCheck();
  }

  onResolveDraftChange(draft: SacramentParticipantDraft): void {
    this.resolveDraft = draft;
    this.resolveMode = draft.source === 'member' ? 'member' : 'external';
    this.resolveError = null;
    this.cdr.markForCheck();
  }

  confirmResolve(): void {
    if (!this.selected || !this.resolveDraft || this.busy) {
      return;
    }

    if (this.resolveMode === 'member' && !this.resolveDraft.family_member_id) {
      this.resolveError = 'Choose a parish member before saving.';
      this.cdr.markForCheck();
      return;
    }

    const externalName =
      this.resolveDraft.external_full_name ||
      this.resolveDraft.display_name ||
      this.selected.legacy_name ||
      '';
    if (this.resolveMode === 'external' && !externalName.trim()) {
      this.resolveError = 'Enter a name for the person outside the parish.';
      this.cdr.markForCheck();
      return;
    }

    const body =
      this.resolveMode === 'member'
        ? {
            resolution: 'member' as const,
            family_member_id: this.resolveDraft.family_member_id || undefined,
          }
        : {
            resolution: 'external' as const,
            external_full_name: externalName.trim(),
            external_date_of_birth: this.resolveDraft.external_date_of_birth || undefined,
          };

    this.busy = true;
    this.resolveError = null;
    this.migration
      .resolve(this.selected.id, body)
      .pipe(takeUntil(this.destroy$))
      .subscribe({
        next: () => {
          this.toast.success('Decision saved.');
          this.busy = false;
          this.closeResolve();
          this.reloadAll();
        },
        error: (error) => {
          const message = error?.message || 'Could not save this decision.';
          this.resolveError = message;
          this.toast.error(message);
          this.busy = false;
          this.cdr.markForCheck();
        },
      });
  }

  roleLabel(role: string): string {
    return ROLE_LABELS[role] ?? this.capitalizeWords(role);
  }

  confidenceLabel(confidence: MigrationConfidence): string {
    switch (confidence) {
      case 'exact':
        return 'Exact match';
      case 'ambiguous':
        return 'More than one match';
      default:
        return 'No match';
    }
  }

  confidenceTone(confidence: MigrationConfidence): StatusBadgeTone {
    switch (confidence) {
      case 'exact':
        return 'info';
      case 'ambiguous':
        return 'warning';
      default:
        return 'neutral';
    }
  }

  resolutionLabel(resolution: MigrationResolutionKind): string {
    switch (resolution) {
      case 'member':
        return 'Parish member';
      case 'external':
        return 'Outside the parish';
      default:
        return 'Needs a decision';
    }
  }

  resolutionTone(resolution: MigrationResolutionKind): StatusBadgeTone {
    switch (resolution) {
      case 'member':
        return 'success';
      case 'external':
        return 'neutral';
      default:
        return 'warning';
    }
  }

  decisionModalDescription(): string {
    if (!this.selected) {
      return '';
    }
    const role = this.roleLabel(this.selected.participant_role);
    const name = this.selected.legacy_name || 'Unknown name';
    const dob = this.selected.legacy_dob ? ` (${this.selected.legacy_dob})` : '';
    return `${role} on the record: ${name}${dob}.`;
  }

  scanResultHeadline(): string {
    if (!this.lastScan) {
      return '';
    }
    return this.lastScan.dryRun ? 'Preview only. Nothing was saved.' : 'Scan finished.';
  }

  private capitalizeWords(value: string): string {
    return value
      .split(/[_\s-]+/)
      .filter(Boolean)
      .map((part) => part.charAt(0).toUpperCase() + part.slice(1))
      .join(' ');
  }
}
