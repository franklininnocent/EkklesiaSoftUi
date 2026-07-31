import { CommonModule } from '@angular/common';
import { ChangeDetectionStrategy, ChangeDetectorRef, Component, OnInit, inject } from '@angular/core';
import { RouterModule } from '@angular/router';
import { CommandCenterDataService } from '../dashboard/services/command-center-data.service';
import { CollectionHealthPayload, FinancialCommandCenterPayload } from '../models/donation.model';
import { refreshStewardshipView } from '../utils/stewardship-view.util';

@Component({
  selector: 'app-collection-health-center',
  standalone: true,
  imports: [CommonModule, RouterModule],
  templateUrl: './collection-health-center.page.html',
  styleUrl: './collection-health-center.page.scss',
  changeDetection: ChangeDetectionStrategy.OnPush
})
export class CollectionHealthCenterPageComponent implements OnInit {
  private readonly dataService = inject(CommandCenterDataService);
  private readonly cdr = inject(ChangeDetectorRef);

  data: FinancialCommandCenterPayload | null = null;
  loading = true;
  error: string | null = null;

  get health(): CollectionHealthPayload | null {
    return this.data?.collection_health ?? null;
  }

  get currencyCode(): string {
    return this.data?.meta?.currency_code || this.data?.tenant_context?.currency_code || 'INR';
  }

  ngOnInit(): void {
    this.reload();
  }

  reload(): void {
    this.loading = true;
    this.error = null;
    refreshStewardshipView(this.cdr);
    this.dataService.loadCommandCenter('month').subscribe({
      next: (payload) => {
        this.data = payload;
        this.loading = false;
        refreshStewardshipView(this.cdr);
      },
      error: () => {
        this.error = 'Unable to load collection health data.';
        this.loading = false;
        refreshStewardshipView(this.cdr);
      }
    });
  }

  severityLabel(severity: string): string {
    return severity === 'critical' ? 'Critical' : severity === 'warning' ? 'Warning' : 'Normal';
  }
}
