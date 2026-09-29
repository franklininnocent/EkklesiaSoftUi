import { CommonModule } from '@angular/common';
import {
  ChangeDetectionStrategy,
  ChangeDetectorRef,
  Component,
  Input,
  OnChanges,
  OnInit,
  SimpleChanges,
  inject,
} from '@angular/core';
import { BCCService } from '@core/services/bcc.service';
import { CfEmptyStateComponent } from '@shared/components/cf-empty-state/cf-empty-state.component';
import { DataTableComponent } from '@shared/components/data-table/data-table.component';
import { LoadingSkeletonComponent } from '@shared/components/loading-skeleton/loading-skeleton.component';
import { PaginationComponent } from '@shared/components/pagination/pagination.component';
import { BccAuditEntry, BccPaged } from '../../models/bcc.model';

@Component({
  selector: 'app-bcc-audit-tab',
  standalone: true,
  imports: [CommonModule, CfEmptyStateComponent, DataTableComponent, LoadingSkeletonComponent, PaginationComponent],
  templateUrl: './bcc-audit-tab.component.html',
  styleUrl: './bcc-audit-tab.component.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class BccAuditTabComponent implements OnInit, OnChanges {
  /** When set, loads audit for one BCC. When omitted, loads parish-wide BCC audit. */
  @Input() bccId: string | null = null;

  private readonly api = inject(BCCService);
  private readonly cdr = inject(ChangeDetectorRef);

  loading = true;
  loadError: string | null = null;
  rows: BccAuditEntry[] = [];
  page = 1;
  perPage = 15;
  total = 0;

  ngOnInit(): void {
    this.load();
  }

  ngOnChanges(changes: SimpleChanges): void {
    if (changes['bccId'] && !changes['bccId'].firstChange) {
      this.page = 1;
      this.load();
    }
  }

  load(): void {
    this.loading = true;
    this.loadError = null;
    this.api.getAuditLogs({ page: this.page, per_page: this.perPage }, this.bccId || undefined).subscribe({
      next: (res) => {
        const page = res as BccPaged<BccAuditEntry>;
        this.rows = page.data || [];
        this.total = page.meta?.total ?? 0;
        this.loading = false;
        this.cdr.markForCheck();
      },
      error: () => {
        this.loadError = 'Could not load audit entries.';
        this.loading = false;
        this.cdr.markForCheck();
      },
    });
  }
}
