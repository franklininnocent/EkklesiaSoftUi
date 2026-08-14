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
import { ToastService } from '@core/services/toast.service';
import { PageHeaderComponent } from '@shared/components/page-header/page-header.component';
import {
  SacramentMigrationReport,
  SacramentMigrationResolution,
} from '../../models/sacrament-migration.model';
import { SacramentMigrationService } from '../../services/sacrament-migration.service';
import { ParticipantSourceControlComponent } from '../shared/participant-source-control/participant-source-control.component';
import { SacramentParticipantDraft } from '../../models/sacrament-definition.model';

@Component({
  selector: 'app-sacrament-migration-queue',
  standalone: true,
  imports: [
    CommonModule,
    FormsModule,
    RouterLink,
    PageHeaderComponent,
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
  loading = false;
  busy = false;
  filterResolution: 'unresolved' | 'member' | 'external' | '' = 'unresolved';
  search = '';
  selected: SacramentMigrationResolution | null = null;
  resolveMode: 'member' | 'external' = 'external';
  resolveDraft: SacramentParticipantDraft | null = null;

  constructor(
    private readonly migration: SacramentMigrationService,
    private readonly toast: ToastService,
    private readonly cdr: ChangeDetectorRef
  ) {}

  ngOnInit(): void {
    this.reload();
  }

  ngOnDestroy(): void {
    this.destroy$.next();
    this.destroy$.complete();
  }

  reload(): void {
    this.loading = true;
    this.migration.getReport()
      .pipe(takeUntil(this.destroy$))
      .subscribe({
        next: (response) => {
          this.report = response.data;
          this.cdr.markForCheck();
        },
        error: (error) => this.toast.error(error?.message || 'Failed to load report'),
      });

    this.migration.list({
      resolution: this.filterResolution || undefined,
      q: this.search.trim() || undefined,
      per_page: 50,
    }).pipe(takeUntil(this.destroy$)).subscribe({
      next: (response) => {
        this.rows = response.data?.data ?? [];
        this.loading = false;
        this.cdr.markForCheck();
      },
      error: (error) => {
        this.toast.error(error?.message || 'Failed to load queue');
        this.loading = false;
        this.cdr.markForCheck();
      },
    });
  }

  onFilterChange(): void {
    this.reload();
  }

  runBackfill(dryRun: boolean): void {
    if (this.busy) {
      return;
    }
    this.busy = true;
    this.migration.backfill(dryRun)
      .pipe(takeUntil(this.destroy$))
      .subscribe({
        next: () => {
          this.toast.success(dryRun ? 'Dry run complete.' : 'Backfill complete.');
          this.busy = false;
          this.reload();
        },
        error: (error) => {
          this.toast.error(error?.message || 'Backfill failed.');
          this.busy = false;
          this.cdr.markForCheck();
        },
      });
  }

  openResolve(row: SacramentMigrationResolution): void {
    this.selected = row;
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
    this.cdr.markForCheck();
  }

  onResolveDraftChange(draft: SacramentParticipantDraft): void {
    this.resolveDraft = draft;
    this.resolveMode = draft.source === 'member' ? 'member' : 'external';
    this.cdr.markForCheck();
  }

  confirmResolve(): void {
    if (!this.selected || !this.resolveDraft || this.busy) {
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
            external_full_name:
              this.resolveDraft.external_full_name || this.resolveDraft.display_name || this.selected.legacy_name || '',
            external_date_of_birth: this.resolveDraft.external_date_of_birth || undefined,
          };

    this.busy = true;
    this.migration.resolve(this.selected.id, body)
      .pipe(takeUntil(this.destroy$))
      .subscribe({
        next: () => {
          this.toast.success('Resolved.');
          this.busy = false;
          this.closeResolve();
          this.reload();
        },
        error: (error) => {
          this.toast.error(error?.message || 'Resolve failed.');
          this.busy = false;
          this.cdr.markForCheck();
        },
      });
  }
}
