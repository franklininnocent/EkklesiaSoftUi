import { CommonModule } from '@angular/common';
import { ChangeDetectorRef, Component, OnInit } from '@angular/core';
import { AuthService } from '@core/services/auth.service';
import { CfEmptyStateComponent } from '@shared/components/cf-empty-state/cf-empty-state.component';
import { LoadingSkeletonComponent } from '@shared/components/loading-skeleton/loading-skeleton.component';
import {
  StewardshipConfirmDialogComponent,
  StewardshipConfirmResult
} from '../components/stewardship-confirm-dialog/stewardship-confirm-dialog.component';
import { DonationsService } from '../services/donations.service';
import { DonationApproval } from '../models/donation.model';
import { CfActionIconComponent } from '@shared/components/cf-action-icon/cf-action-icon.component';
import { CfDatePipe } from '@shared/pipes/cf-date.pipe';
import { PageHeaderComponent } from '@shared/components/page-header/page-header.component';
import { DataTableComponent } from '@shared/components/data-table/data-table.component';
import { StewardshipTablePanelComponent } from '../components/stewardship-table-panel/stewardship-table-panel.component';

@Component({
  selector: 'app-donations-approvals',
  standalone: true,
  imports: [
    CfDatePipe,
    CommonModule,
    CfEmptyStateComponent,
    LoadingSkeletonComponent,
    StewardshipConfirmDialogComponent,
    CfActionIconComponent,
    PageHeaderComponent,
    DataTableComponent,
    StewardshipTablePanelComponent,
  ],
  template: `
    <section class="approvals cf-page cf-financial-dashboard">
      <app-page-header
        title="Approvals"
        subtitle="Review refund requests. Approving a refund returns money on the family books."
      ></app-page-header>

      <p *ngIf="!canApprove" class="cf-state cf-state--error">
        You do not have permission to approve refunds.
      </p>

      <ng-container *ngIf="canApprove">
        <div *ngIf="!loaded" class="cf-loading-block cf-panel" role="status" aria-live="polite" aria-busy="true">
          <app-loading-skeleton label="Loading approvals…" type="table" [rows]="4" [columns]="5"></app-loading-skeleton>
        </div>

        <p *ngIf="loaded && loadError" class="cf-inline-alert cf-panel" role="alert">{{ loadError }}</p>
        <p *ngIf="message" class="cf-state cf-state--success">{{ message }}</p>

        <app-stewardship-table-panel
          *ngIf="loaded && !loadError && approvals.length"
          title="Refund approvals"
          [meta]="approvals.length + ' request' + (approvals.length === 1 ? '' : 's')"
        >
          <app-data-table>
            <thead>
              <tr>
                <th scope="col">Requested</th>
                <th scope="col">Action</th>
                <th scope="col">Status</th>
                <th scope="col">Reason</th>
                <th scope="col" class="cf-table__actions-col"><span class="sr-only">Actions</span></th>
              </tr>
            </thead>
            <tbody>
              <tr *ngFor="let approval of approvals">
                <td>{{ approval.created_at | cfDate:'datetime' }}</td>
                <td>{{ approval.action }}</td>
                <td>{{ approval.status }}</td>
                <td>{{ approval.reason || '—' }}</td>
                <td class="cf-table__actions-cell">
                  <div class="cf-row-actions" *ngIf="approval.status === 'pending'">
                    <button
                      aria-label="Approve"
                      title="Approve"
                      type="button"
                      class="cf-btn cf-btn-icon cf-btn-primary cf-btn--sm"
                      (click)="openDecision(approval, 'approved')"
                    >
                      <app-cf-action-icon name="check" />
                    </button>
                    <button
                      aria-label="Decline"
                      title="Decline"
                      type="button"
                      class="cf-btn cf-btn-icon cf-btn--sm"
                      (click)="openDecision(approval, 'rejected')"
                    >
                      <app-cf-action-icon name="x-circle" />
                    </button>
                  </div>
                </td>
              </tr>
            </tbody>
          </app-data-table>
        </app-stewardship-table-panel>

        <app-cf-empty-state
          *ngIf="loaded && !loadError && !approvals.length"
          icon="✓"
          title="No refund approvals waiting"
          description="Refund requests from the Payment Register appear here for a treasurer to approve."
        ></app-cf-empty-state>
      </ng-container>

      <app-stewardship-confirm-dialog
        *ngIf="pendingDecision"
        [title]="pendingDecision.decision === 'approved' ? 'Approve this refund?' : 'Decline this refund?'"
        [message]="pendingDecision.decision === 'approved'
          ? 'Approving returns this money on the family books and voids the current receipt if the payment is fully refunded.'
          : 'Declining leaves the original payment and family balances unchanged.'"
        [confirmLabel]="pendingDecision.decision === 'approved' ? 'Approve refund' : 'Decline refund'"
        [saving]="saving"
        [error]="dialogError"
        (cancelled)="closeDecision()"
        (confirmed)="confirmDecision($event)"
      ></app-stewardship-confirm-dialog>
    </section>
  `
})
export class DonationsApprovalsComponent implements OnInit {
  approvals: DonationApproval[] = [];
  loaded = false;
  loadError: string | null = null;
  message = '';
  canApprove = false;
  saving = false;
  dialogError: string | null = null;
  pendingDecision: { approval: DonationApproval; decision: 'approved' | 'rejected' } | null = null;

  constructor(
    private donationsService: DonationsService,
    private authService: AuthService,
    private cdr: ChangeDetectorRef
  ) {}

  ngOnInit(): void {
    this.canApprove = this.authService.hasPermission('donations.approvals');
    if (this.canApprove) {
      this.load();
    } else {
      this.loaded = true;
    }
  }

  load(): void {
    this.loaded = false;
    this.loadError = null;
    this.donationsService.listApprovals({ per_page: '50' }).subscribe({
      next: (res) => {
        this.approvals = res.data?.data ?? [];
        this.loaded = true;
        this.cdr.markForCheck();
      },
      error: () => {
        this.loadError = 'Unable to load approvals.';
        this.loaded = true;
        this.cdr.markForCheck();
      }
    });
  }

  openDecision(approval: DonationApproval, decision: 'approved' | 'rejected'): void {
    this.dialogError = null;
    this.pendingDecision = { approval, decision };
  }

  closeDecision(): void {
    if (!this.saving) {
      this.pendingDecision = null;
      this.dialogError = null;
    }
  }

  confirmDecision(result: StewardshipConfirmResult): void {
    if (!this.pendingDecision) {
      return;
    }
    this.saving = true;
    this.dialogError = null;
    this.donationsService.decideApproval(this.pendingDecision.approval.id, {
      decision: this.pendingDecision.decision,
      note: result.reason
    }).subscribe({
      next: () => {
        this.saving = false;
        this.message = this.pendingDecision?.decision === 'approved'
          ? 'Refund approved. Family balances are updated.'
          : 'Refund request declined. Nothing changed on the family books.';
        this.pendingDecision = null;
        this.load();
      },
      error: (err: { error?: { message?: string } }) => {
        this.saving = false;
        this.dialogError = err?.error?.message || 'Unable to save this decision.';
        this.cdr.markForCheck();
      }
    });
  }
}
