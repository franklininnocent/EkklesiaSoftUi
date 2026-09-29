import {
  ChangeDetectionStrategy,
  ChangeDetectorRef,
  Component,
  EventEmitter,
  Input,
  OnDestroy,
  Output,
  inject,
} from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { Subject, takeUntil } from 'rxjs';
import { ToastService } from '@core/services/toast.service';
import { ModalShellComponent } from '@shared/components/modal-shell/modal-shell.component';
import { CatalogPlan, MigrateTenantsResult, PlanVersion } from '../../models/subscription-admin.models';
import { SubscriptionAdminService, subscriptionErrorMessage } from '../../services/subscription-admin.service';

const BATCH_SIZE = 100;

/** Moves churches from an older version of a plan to its active version: preview first, then confirm. */
@Component({
  selector: 'app-migrate-tenants-dialog',
  standalone: true,
  imports: [CommonModule, FormsModule, ModalShellComponent],
  templateUrl: './migrate-tenants-dialog.component.html',
  styleUrls: ['../../styles/subscription-admin.scss'],
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class MigrateTenantsDialogComponent implements OnDestroy {
  private readonly api = inject(SubscriptionAdminService);
  private readonly toast = inject(ToastService);
  private readonly cdr = inject(ChangeDetectorRef);
  private readonly destroy$ = new Subject<void>();

  @Input({ required: true }) plan!: CatalogPlan;
  @Input({ required: true }) target!: PlanVersion;
  @Input({ required: true }) from!: PlanVersion;
  @Output() closed = new EventEmitter<void>();
  @Output() migrated = new EventEmitter<void>();

  keepContractedPrice = true;
  reason = '';
  confirmImpact = false;

  busy = false;
  preview: MigrateTenantsResult | null = null;
  result: MigrateTenantsResult | null = null;
  totalMoved = 0;

  get lossyCount(): number {
    return (this.preview?.preview ?? []).filter((p) => p.requires_confirmation).length;
  }

  get reasonValid(): boolean {
    return this.reason.trim().length >= 3;
  }

  ngOnDestroy(): void {
    this.destroy$.next();
    this.destroy$.complete();
  }

  close(): void {
    if (this.busy) return;
    if (this.totalMoved > 0) this.migrated.emit();
    this.closed.emit();
  }

  runPreview(): void {
    if (!this.reasonValid) {
      this.toast.error('Add a short reason (at least 3 characters).', 'Reason required');
      return;
    }
    this.run(true);
  }

  runMigration(): void {
    if (!this.reasonValid) return;
    if (this.lossyCount > 0 && !this.confirmImpact) {
      this.toast.warning('Confirm that you understand some churches lose features or are over the new limits.', 'Please confirm');
      return;
    }
    this.run(false);
  }

  private run(dryRun: boolean): void {
    this.busy = true;
    this.cdr.markForCheck();
    this.api
      .migrateTenants(this.plan.id, this.target.id, {
        from_version_id: this.from.id,
        limit: BATCH_SIZE,
        keep_contracted_price: this.keepContractedPrice,
        confirm_impact: this.confirmImpact,
        dry_run: dryRun,
        reason: this.reason.trim(),
      })
      .pipe(takeUntil(this.destroy$))
      .subscribe({
        next: (res) => {
          this.busy = false;
          if (dryRun) {
            this.preview = res;
            this.result = null;
          } else {
            this.result = res;
            this.totalMoved += res.migrated.length;
            this.preview = null;
            this.confirmImpact = false;
            if (res.migrated.length) {
              this.toast.success(`${res.migrated.length} moved to version ${this.target.version_number}.`, 'Churches moved');
            }
          }
          this.cdr.markForCheck();
        },
        error: (err) => {
          this.busy = false;
          this.toast.error(subscriptionErrorMessage(err, 'Unable to move churches.'), 'Not moved');
          this.cdr.markForCheck();
        },
      });
  }
}
