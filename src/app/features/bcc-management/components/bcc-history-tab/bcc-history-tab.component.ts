import { CommonModule } from '@angular/common';
import { ChangeDetectionStrategy, ChangeDetectorRef, Component, Input, OnChanges, inject } from '@angular/core';
import { BCCService } from '@core/services/bcc.service';
import { CfEmptyStateComponent } from '@shared/components/cf-empty-state/cf-empty-state.component';
import { DataTableComponent } from '@shared/components/data-table/data-table.component';
import { LoadingSkeletonComponent } from '@shared/components/loading-skeleton/loading-skeleton.component';
import { PaginationComponent } from '@shared/components/pagination/pagination.component';
import { BccMembershipRow, BccPaged } from '../../models/bcc.model';

@Component({
  selector: 'app-bcc-history-tab',
  standalone: true,
  imports: [CommonModule, CfEmptyStateComponent, DataTableComponent, LoadingSkeletonComponent, PaginationComponent],
  templateUrl: './bcc-history-tab.component.html',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class BccHistoryTabComponent implements OnChanges {
  @Input({ required: true }) bccId!: string;

  private readonly api = inject(BCCService);
  private readonly cdr = inject(ChangeDetectorRef);

  loading = true;
  loadError: string | null = null;
  rows: BccMembershipRow[] = [];
  page = 1;
  perPage = 15;
  total = 0;

  ngOnChanges(): void {
    if (this.bccId) {
      this.load();
    }
  }

  load(): void {
    this.loading = true;
    this.api.getMemberHistory(this.bccId, { page: this.page, per_page: this.perPage }).subscribe({
      next: (res) => {
        const page = res as BccPaged<BccMembershipRow>;
        this.rows = page.data || [];
        this.total = page.meta?.total ?? 0;
        this.loading = false;
        this.cdr.markForCheck();
      },
      error: () => {
        this.loadError = 'Could not load membership history.';
        this.loading = false;
        this.cdr.markForCheck();
      },
    });
  }
}
