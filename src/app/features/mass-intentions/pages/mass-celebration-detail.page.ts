import { CommonModule } from '@angular/common';
import { Component, OnInit, inject, signal } from '@angular/core';
import { ActivatedRoute, Router, RouterModule } from '@angular/router';
import { AuthService } from '@core/services/auth.service';
import { ToastService } from '@core/services/toast.service';
import {
  ConfirmationModalComponent,
  ConfirmationResult,
} from '@shared/components/confirmation-modal/confirmation-modal.component';
import { PageHeaderComponent } from '@shared/components/page-header/page-header.component';
import { AddMassModalComponent } from '../components/add-mass-modal.component';
import { AssignIntentionsModalComponent } from '../components/assign-intentions-modal.component';
import { formatMassDayTime } from '../utils/mass-celebration-display';
import {
  CancelMassModalComponent,
  CancelMassPayload,
} from '../components/cancel-mass-modal.component';
import {
  MassCelebrationSummary,
  MassIntentionsApiService,
  MassCelebrationWorkspace,
} from '../services/mass-intentions-api.service';

@Component({
  selector: 'app-mass-celebration-detail-page',
  standalone: true,
  imports: [
    CommonModule,
    RouterModule,
    PageHeaderComponent,
    ConfirmationModalComponent,
    CancelMassModalComponent,
    AssignIntentionsModalComponent,
    AddMassModalComponent,
  ],
  template: `
    <div class="cf-page">
      @if (workspace(); as ws) {
        <app-page-header
          [title]="'Mass · ' + dayTime(ws.celebration)"
          [subtitle]="massSubtitle(ws)"
          [backLink]="['/mass-intentions/masses']"
          backLabel="Masses"
        >
          @if (canSchedule() && ws.celebration.status === 'scheduled') {
            <button type="button" class="cf-btn cf-btn-ghost" (click)="showEditMass.set(true)">Edit Mass</button>
            <button type="button" class="cf-btn cf-btn-ghost" (click)="showAssign.set(true)">Put on this Mass</button>
            <button type="button" class="cf-btn cf-btn-ghost" (click)="openCancel()">Cancel this Mass</button>
          }
        </app-page-header>

        @if (ws.intentions.length === 0) {
          <div class="cf-panel mass-detail__empty">
            <p>No intentions are on this Mass yet.</p>
          </div>
        } @else {
          <div class="cf-panel mass-detail__list">
            @for (row of ws.intentions; track row.obligation_id) {
              <label class="mass-detail__row">
                @if (canFulfil() && !row.is_said && ws.can_mark_said) {
                  <input
                    type="checkbox"
                    [checked]="selected().has(row.obligation_id)"
                    (change)="toggle(row.obligation_id)"
                  />
                }
                <span class="mass-detail__name">{{ row.beneficiary_name }}</span>
                <span class="mass-detail__text">{{ row.intention_text }}</span>
                @if (selected().has(row.obligation_id) && canFulfil() && !row.is_said && ws.can_mark_said) {
                  <input
                    type="text"
                    class="cf-control mass-detail__priest"
                    placeholder="Priest (if different)"
                    [value]="celebrantOverrides()[row.obligation_id] ?? ''"
                    (input)="setCelebrantOverride(row.obligation_id, $any($event.target).value)"
                  />
                }
                @if (row.is_said) {
                  <span class="mass-detail__said">Said</span>
                  @if (canFulfil() && row.fulfilment_id) {
                    <button type="button" class="cf-btn cf-btn-ghost" (click)="openUndo(row.fulfilment_id!)">
                      Undo
                    </button>
                  }
                }
              </label>
            }
          </div>

          @if (canFulfil() && ws.can_mark_said && hasUnsaid(ws)) {
            <div class="mass-detail__actions">
              <button
                type="button"
                class="cf-btn cf-btn-primary"
                [disabled]="selected().size === 0 || saving()"
                (click)="save()"
              >
                Mark as said
              </button>
            </div>
          }
        }
      } @else if (loadError()) {
        <p>Could not load this Mass.</p>
      } @else {
        <p>Loading…</p>
      }

      <app-add-mass-modal
        [open]="showEditMass()"
        [celebration]="workspace()?.celebration ?? null"
        (closed)="showEditMass.set(false)"
        (updated)="reload()"
      />

      <app-assign-intentions-modal
        [open]="showAssign()"
        [celebrationId]="celebrationId"
        [massCelebratedOn]="workspace()?.celebration?.celebrated_on ?? ''"
        (closed)="showAssign.set(false)"
        (assigned)="onAssigned()"
      />

      <app-confirmation-modal
        [show]="showCancelReason()"
        title="Cancel this Mass"
        message="Intentions are not deleted — you can move them to another Mass or leave them not scheduled."
        confirmText="Cancel this Mass"
        confirmButtonClass="btn-danger"
        [showDescriptionInput]="true"
        descriptionLabel="Reason"
        [descriptionRequired]="true"
        (confirmed)="onCancelReasonConfirmed($event)"
        (cancelled)="showCancelReason.set(false)"
        (closed)="showCancelReason.set(false)"
      />

      <app-cancel-mass-modal
        [open]="showCancelReassign()"
        [fixedReason]="cancelReason()"
        [intentions]="workspace()?.intentions ?? []"
        [otherCelebrations]="otherCelebrations()"
        (closed)="closeCancelReassign()"
        (confirmed)="onCancelMass($event)"
      />

      <app-confirmation-modal
        [show]="showUndo()"
        title="Undo said"
        message="This intention will show as not said on the register until someone marks it again."
        confirmText="Undo"
        confirmButtonClass="btn-danger"
        [showDescriptionInput]="true"
        descriptionLabel="Reason"
        [descriptionRequired]="true"
        (confirmed)="onUndoConfirmed($event)"
        (cancelled)="showUndo.set(false)"
        (closed)="showUndo.set(false)"
      />
    </div>
  `,
  styles: [
    `
      .mass-detail__list {
        display: grid;
        gap: var(--cf-space-2);
        padding: var(--cf-space-3);
      }
      .mass-detail__row {
        display: grid;
        grid-template-columns: auto 1fr auto;
        gap: var(--cf-space-2) var(--cf-space-3);
        align-items: center;
        min-height: var(--cf-touch-target);
        font-size: var(--cf-text-base);
        border-bottom: 1px solid var(--cf-color-border-subtle);
        padding: var(--cf-space-2) 0;
      }
      .mass-detail__priest {
        grid-column: 2 / -1;
        font-size: var(--cf-text-sm);
      }
      .mass-detail__text {
        grid-column: 2 / -1;
        font-size: var(--cf-text-sm);
        color: var(--cf-color-text-muted);
      }
      .mass-detail__said {
        font-size: var(--cf-text-sm);
        color: var(--cf-color-success, green);
      }
      .mass-detail__actions {
        display: flex;
        justify-content: flex-end;
        margin-top: var(--cf-space-4);
      }
      .mass-detail__empty {
        padding: var(--cf-space-3);
        font-size: var(--cf-text-base);
      }
    `,
  ],
})
export class MassCelebrationDetailPageComponent implements OnInit {
  private readonly api = inject(MassIntentionsApiService);
  private readonly route = inject(ActivatedRoute);
  private readonly router = inject(Router);
  private readonly auth = inject(AuthService);
  private readonly toast = inject(ToastService);

  readonly workspace = signal<MassCelebrationWorkspace | null>(null);
  readonly loadError = signal(false);
  readonly saving = signal(false);
  readonly selected = signal(new Set<string>());
  readonly celebrantOverrides = signal<Record<string, string>>({});
  readonly showEditMass = signal(false);
  readonly showAssign = signal(false);
  readonly showCancelReason = signal(false);
  readonly showCancelReassign = signal(false);
  readonly cancelReason = signal('');
  readonly otherCelebrations = signal<MassCelebrationSummary[]>([]);
  readonly showUndo = signal(false);
  private undoFulfilmentId: string | null = null;

  celebrationId = '';

  ngOnInit(): void {
    this.celebrationId = this.route.snapshot.paramMap.get('id') ?? '';
    this.reload();
  }

  canFulfil(): boolean {
    return this.auth.hasPermission('mass.intentions.fulfil');
  }

  canSchedule(): boolean {
    return this.auth.hasPermission('mass.intentions.schedule');
  }

  dayTime(celebration: MassCelebrationSummary): string {
    return formatMassDayTime(celebration.celebrated_on, celebration.celebrated_at);
  }

  massSubtitle(ws: MassCelebrationWorkspace): string {
    const parts = [ws.celebration.place, ws.celebration.celebrant_name].filter(Boolean);
    return parts.join(' · ') || 'Intentions for this Mass';
  }

  hasUnsaid(ws: MassCelebrationWorkspace): boolean {
    return ws.intentions.some((i) => !i.is_said);
  }

  toggle(obligationId: string): void {
    const next = new Set(this.selected());
    if (next.has(obligationId)) {
      next.delete(obligationId);
      const overrides = { ...this.celebrantOverrides() };
      delete overrides[obligationId];
      this.celebrantOverrides.set(overrides);
    } else {
      next.add(obligationId);
    }
    this.selected.set(next);
  }

  setCelebrantOverride(obligationId: string, value: string): void {
    this.celebrantOverrides.update((map) => ({ ...map, [obligationId]: value }));
  }

  save(): void {
    const ids = [...this.selected()];
    if (!ids.length) {
      return;
    }
    this.saving.set(true);
    this.api.confirmSaid(this.celebrationId, ids, this.celebrantOverrides()).subscribe({
      next: (res) => {
        this.workspace.set(res.data);
        this.selected.set(new Set());
        this.celebrantOverrides.set({});
        this.saving.set(false);
        this.toast.success('Marked as said.');
      },
      error: () => this.saving.set(false),
    });
  }

  openUndo(fulfilmentId: string): void {
    this.undoFulfilmentId = fulfilmentId;
    this.showUndo.set(true);
  }

  onUndoConfirmed(result: ConfirmationResult): void {
    if (!result.confirmed || !this.undoFulfilmentId || !result.description?.trim()) {
      return;
    }
    this.api.undoFulfilment(this.undoFulfilmentId, result.description.trim()).subscribe({
      next: () => {
        this.showUndo.set(false);
        this.undoFulfilmentId = null;
        this.reload();
      },
    });
  }

  openCancel(): void {
    this.api.listCelebrations({ status: 'scheduled', per_page: 100 }).subscribe({
      next: (res) => {
        this.otherCelebrations.set((res.data ?? []).filter((c) => c.id !== this.celebrationId));
        this.showCancelReason.set(true);
      },
    });
  }

  onCancelReasonConfirmed(result: ConfirmationResult): void {
    if (!result.confirmed || !result.description?.trim()) {
      return;
    }
    const reason = result.description.trim();
    this.cancelReason.set(reason);
    this.showCancelReason.set(false);

    const ws = this.workspace();
    const needsReassign = ws?.intentions.some((row) => !row.is_said) ?? false;
    if (needsReassign) {
      this.showCancelReassign.set(true);
      return;
    }

    this.onCancelMass({ reason, reassignments: [] });
  }

  closeCancelReassign(): void {
    this.showCancelReassign.set(false);
    this.cancelReason.set('');
  }

  onAssigned(): void {
    this.showAssign.set(false);
    this.reload();
  }

  onCancelMass(payload: CancelMassPayload): void {
    this.api.cancelCelebration(this.celebrationId, payload).subscribe({
      next: () => {
        this.closeCancelReassign();
        void this.router.navigateByUrl('/mass-intentions/masses');
      },
    });
  }

  reload(): void {
    this.api.getCelebrationWorkspace(this.celebrationId).subscribe({
      next: (res) => this.workspace.set(res.data),
      error: () => this.loadError.set(true),
    });
  }
}
