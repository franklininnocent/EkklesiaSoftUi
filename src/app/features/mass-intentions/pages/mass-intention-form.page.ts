import { CommonModule } from '@angular/common';
import { Component, OnInit, inject, signal } from '@angular/core';
import { FormBuilder, ReactiveFormsModule, Validators } from '@angular/forms';
import { ActivatedRoute, Router, RouterModule } from '@angular/router';
import { debounceTime, distinctUntilChanged, switchMap } from 'rxjs/operators';
import { Subject, of } from 'rxjs';
import { AuthService } from '@core/services/auth.service';
import { ToastService } from '@core/services/toast.service';
import { ParishPerson, ParishPersonService } from '@features/settings/sacraments/services/person.service';
import { PageHeaderComponent } from '@shared/components/page-header/page-header.component';
import { CfCurrencyPipe } from '@shared/pipes/cf-currency.pipe';
import {
  ConfirmationModalComponent,
  ConfirmationResult,
} from '@shared/components/confirmation-modal/confirmation-modal.component';
import { AddMassPaymentModalComponent } from '../components/add-payment-modal.component';
import { TransferIntentionModalComponent } from '../components/transfer-intention-modal.component';
import {
  MassCelebrationSummary,
  MassIntentionRecord,
  MassIntentionsApiService,
  MassOfferingReceipt,
} from '../services/mass-intentions-api.service';
import { MassIntentionReceiptPrintService } from '../services/mass-intention-receipt-print.service';
import { formatMassDayTime } from '../utils/mass-celebration-display';
import {
  MassIntentionSaidProgress,
  massIntentionWorkflowBanner,
} from '../utils/mass-intention-status-display';

@Component({
  selector: 'app-mass-intention-form-page',
  standalone: true,
  imports: [
    CommonModule,
    ReactiveFormsModule,
    RouterModule,
    PageHeaderComponent,
    CfCurrencyPipe,
    AddMassPaymentModalComponent,
    TransferIntentionModalComponent,
    ConfirmationModalComponent,
  ],
  template: `
    <div class="cf-page mass-form">
      <app-page-header
        [title]="recordId ? 'Intention' : 'New intention'"
        subtitle="Who it is for and what to pray"
        [backLink]="['/mass-intentions/intentions']"
        backLabel="Intentions"
      />

      @if (loadError()) {
        <p class="mass-form__error">Could not load this intention.</p>
      } @else {
        @if (workflowBanner(); as banner) {
          <div class="cf-panel mass-form__workflow" role="status">
            <strong>{{ banner.title }}</strong>
            <p>{{ banner.detail }}</p>
          </div>
        }
        <form class="mass-form__form" [formGroup]="form" (ngSubmit)="save()">
          <div class="cf-panel mass-form__panel">
            <label class="mass-form__field">
              <span>For</span>
              <input
                class="cf-control"
                type="text"
                formControlName="beneficiary_name"
                autocomplete="off"
                (input)="onBeneficiaryInput()"
                (blur)="markTouched('beneficiary_name')"
              />
              @if (fieldError('beneficiary_name')) {
                <span class="mass-form__warn">{{ fieldError('beneficiary_name') }}</span>
              }
              @if (personResults().length) {
                <ul class="mass-form__suggestions" role="listbox">
                  @for (person of personResults(); track person.id) {
                    <li>
                      <button type="button" class="mass-form__suggestion" (click)="pickPerson(person)">
                        {{ personDisplay(person) }}
                      </button>
                    </li>
                  }
                </ul>
              }
            </label>

            <label class="mass-form__field">
              <span>Intention</span>
              <input
                class="cf-control"
                type="text"
                formControlName="intention_text"
                list="mass-intention-categories"
                (blur)="markTouched('intention_text')"
              />
              @if (fieldError('intention_text')) {
                <span class="mass-form__warn">{{ fieldError('intention_text') }}</span>
              }
              <datalist id="mass-intention-categories">
                @for (cat of intentionCategories(); track cat) {
                  <option [value]="cat"></option>
                }
              </datalist>
            </label>
            <label class="mass-form__field">
              <span>Note</span>
              <textarea class="cf-control" rows="2" formControlName="notes"></textarea>
            </label>
            @if (clarificationNotes()) {
              <div class="mass-form__clarify cf-panel">
                <strong>Details needed</strong>
                <p>{{ clarificationNotes() }}</p>
              </div>
            }

            <label class="mass-form__field mass-form__checkbox">
              <input type="checkbox" formControlName="do_not_announce" />
              <span>Do not announce the name</span>
            </label>

            <details class="mass-form__priest-details">
              <summary>Different words for the priest</summary>
              <label class="mass-form__field">
                <span>What the priest should say</span>
                <textarea class="cf-control" rows="2" formControlName="priest_text"></textarea>
              </label>
            </details>

            <label class="mass-form__field">
              <span>Asked by</span>
              <input class="cf-control" type="text" formControlName="requester_name" />
            </label>
            <label class="mass-form__field">
              <span>Phone</span>
              <input class="cf-control" type="text" formControlName="requester_phone" />
            </label>
          </div>

          <div class="cf-panel mass-form__panel">
            <label class="mass-form__field">
              <span>When</span>
              <input class="cf-control" type="date" formControlName="requested_date" />
            </label>
            <label class="mass-form__field mass-form__checkbox">
              <input type="checkbox" formControlName="date_must_be_kept" />
              <span>This date must be kept</span>
            </label>
            <label class="mass-form__field mass-form__checkbox">
              <input type="checkbox" formControlName="prohibit_transfer" />
              <span>Do not transfer to another parish</span>
            </label>
            <label class="mass-form__field mass-form__checkbox">
              <input type="checkbox" formControlName="is_collective" />
              <span>Collective intention (provincial authorization required)</span>
            </label>
            <label class="mass-form__field">
              <span>How many Masses</span>
              <input
                class="cf-control"
                type="number"
                min="1"
                max="99"
                formControlName="mass_count"
                (blur)="markTouched('mass_count')"
              />
              @if (fieldError('mass_count')) {
                <span class="mass-form__warn">{{ fieldError('mass_count') }}</span>
              }
            </label>
          </div>

          @if (!isAccepted() && canReview()) {
            <details class="cf-panel mass-form__panel mass-form__offering">
              <summary>They gave an offering</summary>
              <label class="mass-form__field">
                <span>Amount</span>
                <input class="cf-control" type="number" step="0.01" formControlName="offering_amount" />
              </label>
              <label class="mass-form__field">
                <span>Method</span>
                <select class="cf-control" formControlName="offering_payment_method">
                  <option value="cash">Cash</option>
                  <option value="cheque">Cheque</option>
                  <option value="transfer">Transfer</option>
                </select>
              </label>
              <label class="mass-form__field">
                <span>Date received</span>
                <input class="cf-control" type="date" formControlName="offering_received_on" />
              </label>
            </details>
          }

          @if (isAccepted() && canSeeOfferings()) {
            <div class="cf-panel mass-form__panel">
              <div class="mass-form__offering-head">
                <strong>Offering</strong>
                @if (canRecordOfferings()) {
                  <button type="button" class="cf-btn cf-btn-ghost" (click)="showPayment.set(true)">Add payment</button>
                }
              </div>
              @if (receipts().length === 0) {
                <p class="mass-form__muted">No payments recorded yet.</p>
              } @else {
                <ul class="mass-form__receipts">
                  @for (r of receipts(); track r.id) {
                    <li>
                      <span>{{ r.received_on }}</span>
                      <span>{{ r.amount | cfCurrency }}</span>
                      <span>{{ r.receipt_number }}</span>
                      @if (canRecordOfferings()) {
                        <button type="button" class="cf-btn cf-btn-ghost" (click)="openVoidReceipt(r.id)">Void</button>
                      }
                    </li>
                  }
                </ul>
              }
            </div>
          }

          @if (similarWarning()) {
            <p class="mass-form__warn">
              Someone with a similar name already has an intention around this date.
              @for (s of similarRecords(); track s.id) {
                <a class="mass-form__similar-link" [routerLink]="['/mass-intentions/intentions', s.id]">Open the other one</a>
              }
              <button type="button" class="cf-btn cf-btn-ghost" (click)="ackDuplicate()">Continue</button>
            </p>
          }

          @if (isAccepted() && canReview()) {
            <div class="cf-panel mass-form__panel mass-form__more-masses">
              <p class="mass-form__muted">Need more Masses for this intention? Increase the count — new ones start as not scheduled.</p>
              <button type="button" class="cf-btn cf-btn-ghost" (click)="saveMoreMasses()" [disabled]="saving()">
                Update Mass count
              </button>
              @if (!form.controls.prohibit_transfer.value) {
                <button type="button" class="cf-btn cf-btn-ghost" (click)="showTransfer.set(true)">
                  Transfer to another parish
                </button>
              }
            </div>
          }

          <div class="mass-form__actions">
            @if (!isAccepted() && status() !== 'withdrawn') {
              <button type="button" class="cf-btn cf-btn-ghost" (click)="save()" [disabled]="saving()">
                Save for later
              </button>
              @if (recordId) {
                <button type="button" class="cf-btn cf-btn-ghost" (click)="withdraw()" [disabled]="saving()">
                  Withdraw
                </button>
              }
              @if (canRegisterIntention()) {
                <button type="button" class="cf-btn cf-btn-primary" (click)="accept()" [disabled]="saving()">
                  Register intention
                </button>
              }
            }
          </div>
        </form>

        @if (isAccepted() && upcomingMasses().length) {
          <div class="cf-decision-strip mass-form__strip">
            <p><strong>Which Mass?</strong></p>
            @for (mass of upcomingMasses(); track mass.id) {
              <label class="mass-form__mass-row">
                <input
                  type="radio"
                  name="celebration"
                  [value]="mass.id"
                  [checked]="selectedCelebrationId() === mass.id"
                  (change)="selectedCelebrationId.set(mass.id)"
                />
                <span>{{ massLabel(mass) }}</span>
              </label>
            }
            @if (scheduleNeedsDateReason()) {
              <label class="mass-form__field">
                <span>Why is this Mass on a different day?</span>
                <textarea
                  class="cf-control"
                  rows="2"
                  [value]="dateVarianceReason()"
                  (input)="dateVarianceReason.set($any($event.target).value)"
                ></textarea>
              </label>
            }
            <div class="mass-form__strip-actions">
              <button type="button" class="cf-btn cf-btn-ghost" (click)="chooseLater()">Choose later</button>
              <button
                type="button"
                class="cf-btn cf-btn-primary"
                [disabled]="!selectedCelebrationId() || (scheduleNeedsDateReason() && !dateVarianceReason().trim())"
                (click)="scheduleSelected()"
              >
                Put on this Mass
              </button>
            </div>
          </div>
        }
      }

      <app-add-mass-payment-modal
        [open]="showPayment()"
        [requestId]="recordId"
        (closed)="showPayment.set(false)"
        (saved)="reloadReceipts()"
      />

      <app-transfer-intention-modal
        [open]="showTransfer()"
        [requestId]="recordId ?? ''"
        (closed)="showTransfer.set(false)"
        (transferred)="onTransferred()"
      />

      <app-confirmation-modal
        [show]="showVoidReceipt()"
        title="Void receipt"
        message="The payment stays in history but no longer counts toward offering totals."
        confirmText="Void receipt"
        confirmButtonClass="btn-danger"
        [showDescriptionInput]="true"
        descriptionLabel="Reason"
        [descriptionRequired]="true"
        (confirmed)="onVoidReceiptConfirmed($event)"
        (cancelled)="showVoidReceipt.set(false)"
        (closed)="showVoidReceipt.set(false)"
      />
    </div>
  `,
  styles: [
    `
      .mass-form__workflow {
        padding: var(--cf-space-3);
        margin-bottom: var(--cf-space-3);
        font-size: var(--cf-text-base);
      }
      .mass-form__workflow p {
        margin: var(--cf-space-2) 0 0;
        color: var(--cf-color-text-muted);
        line-height: 1.45;
      }
      .mass-form__form {
        display: grid;
        gap: var(--cf-space-4);
      }
      @media (min-width: 1024px) {
        .mass-form__form {
          grid-template-columns: 1fr 1fr;
        }
        .mass-form__actions,
        .mass-form__strip,
        .mass-form__warn {
          grid-column: 1 / -1;
        }
      }
      .mass-form__panel {
        padding: var(--cf-space-3);
        display: grid;
        gap: var(--cf-space-3);
      }
      .mass-form__field {
        display: grid;
        gap: var(--cf-space-2);
        font-size: var(--cf-text-base);
      }
      .mass-form__checkbox {
        grid-template-columns: auto 1fr;
        align-items: center;
      }
      .mass-form__actions {
        display: flex;
        justify-content: flex-end;
        gap: var(--cf-space-3);
        flex-wrap: wrap;
      }
      @media (max-width: 768px) {
        .mass-form__actions .cf-btn-primary {
          width: 100%;
          min-height: 44px;
        }
      }
      .mass-form__suggestions {
        list-style: none;
        margin: 0;
        padding: 0;
        border: 1px solid var(--cf-color-border-subtle);
        border-radius: var(--cf-radius-sm);
      }
      .mass-form__suggestion {
        width: 100%;
        text-align: left;
        padding: var(--cf-space-2) var(--cf-space-3);
        background: transparent;
        border: none;
        cursor: pointer;
        font-size: var(--cf-text-base);
      }
      .mass-form__warn {
        color: var(--cf-color-danger);
        font-size: var(--cf-text-base);
      }
      .mass-form__clarify {
        padding: var(--cf-space-3);
        font-size: var(--cf-text-sm);
        grid-column: 1 / -1;
      }
      .mass-form__clarify p {
        margin: var(--cf-space-2) 0 0;
        white-space: pre-wrap;
      }
      .mass-form__strip {
        padding: var(--cf-space-3);
        display: grid;
        gap: var(--cf-space-3);
      }
      .mass-form__mass-row {
        display: flex;
        gap: var(--cf-space-2);
        align-items: center;
        min-height: var(--cf-touch-target);
        font-size: var(--cf-text-base);
      }
      .mass-form__strip-actions {
        display: flex;
        justify-content: flex-end;
        gap: var(--cf-space-3);
      }
      .mass-form__priest-details summary {
        cursor: pointer;
        font-size: var(--cf-text-base);
        margin-bottom: var(--cf-space-2);
      }
      .mass-form__offering summary {
        cursor: pointer;
        font-size: var(--cf-text-base);
        font-weight: 600;
      }
      .mass-form__offering-head {
        display: flex;
        justify-content: space-between;
        align-items: center;
        margin-bottom: var(--cf-space-2);
      }
      .mass-form__muted {
        font-size: var(--cf-text-sm);
        color: var(--cf-color-text-muted);
      }
      .mass-form__receipts {
        list-style: none;
        margin: 0;
        padding: 0;
        font-size: var(--cf-text-sm);
      }
      .mass-form__receipts li {
        display: grid;
        grid-template-columns: 1fr auto auto auto;
        gap: var(--cf-space-3);
        padding: var(--cf-space-2) 0;
        border-bottom: 1px solid var(--cf-color-border-subtle);
      }
    `,
  ],
})
export class MassIntentionFormPageComponent implements OnInit {
  private readonly fb = inject(FormBuilder);
  private readonly api = inject(MassIntentionsApiService);
  private readonly persons = inject(ParishPersonService);
  private readonly auth = inject(AuthService);
  private readonly route = inject(ActivatedRoute);
  private readonly router = inject(Router);
  private readonly toast = inject(ToastService);
  private readonly receiptPrint = inject(MassIntentionReceiptPrintService);

  private readonly beneficiarySearch$ = new Subject<string>();
  private beneficiaryPersonId: string | null = null;
  private duplicateAcknowledged = false;

  recordId: string | null = null;
  readonly saving = signal(false);
  readonly loadError = signal(false);
  readonly personResults = signal<ParishPerson[]>([]);
  readonly similarWarning = signal(false);
  readonly similarRecords = signal<MassIntentionRecord[]>([]);
  readonly clarificationNotes = signal<string | null>(null);
  readonly intentionCategories = signal<string[]>([]);
  readonly upcomingMasses = signal<MassCelebrationSummary[]>([]);
  readonly selectedCelebrationId = signal<string | null>(null);
  readonly dateVarianceReason = signal('');
  readonly receipts = signal<MassOfferingReceipt[]>([]);
  readonly showTransfer = signal(false);
  readonly showPayment = signal(false);
  readonly showVoidReceipt = signal(false);
  private voidReceiptId: string | null = null;
  readonly status = signal('draft');
  readonly saidProgress = signal<MassIntentionSaidProgress | null>(null);

  readonly form = this.fb.nonNullable.group({
    beneficiary_name: ['', Validators.required],
    intention_text: ['', Validators.required],
    do_not_announce: [false],
    priest_text: [''],
    notes: [''],
    requester_name: [''],
    requester_phone: [''],
    requested_date: [''],
    date_must_be_kept: [false],
    prohibit_transfer: [false],
    is_collective: [false],
    mass_count: [1, [Validators.required, Validators.min(1)]],
    offering_amount: [''],
    offering_payment_method: ['cash'],
    offering_received_on: [''],
  });

  ngOnInit(): void {
    this.beneficiarySearch$
      .pipe(
        debounceTime(250),
        distinctUntilChanged(),
        switchMap((term) => (term.length < 2 ? of({ data: [] as ParishPerson[] }) : this.persons.search(term)))
      )
      .subscribe((res) => this.personResults.set(res.data ?? []));

    this.api.getSettings().subscribe({
      next: (res) => this.intentionCategories.set(res.data.categories ?? []),
    });

    this.recordId = this.route.snapshot.paramMap.get('id');
    if (this.recordId) {
      this.api.getRequest(this.recordId).subscribe({
        next: (res) => {
          this.patchRecord(res.data);
          this.upcomingMasses.set(res.meta?.upcoming_celebrations ?? []);
          this.receipts.set(res.meta?.receipts ?? []);
        },
        error: () => this.loadError.set(true),
      });
    }
  }

  workflowBanner() {
    return massIntentionWorkflowBanner(this.status(), this.saidProgress());
  }

  canReview(): boolean {
    return this.auth.hasPermission('mass.intentions.review');
  }

  /** Registers the intention and creates Mass obligations (office workflow). */
  canRegisterIntention(): boolean {
    return this.canReview();
  }

  canSeeOfferings(): boolean {
    return this.auth.hasPermission('mass.intentions.offerings.view');
  }

  canRecordOfferings(): boolean {
    return this.auth.hasPermission('mass.intentions.offerings.record');
  }

  reloadReceipts(): void {
    if (!this.recordId) {
      return;
    }
    this.api.getRequest(this.recordId).subscribe({
      next: (res) => this.receipts.set(res.meta?.receipts ?? []),
    });
  }

  onTransferred(): void {
    this.toast.success('Transfer sent. The other parish must accept it.');
  }

  openVoidReceipt(receiptId: string): void {
    this.voidReceiptId = receiptId;
    this.showVoidReceipt.set(true);
  }

  onVoidReceiptConfirmed(result: ConfirmationResult): void {
    if (!result.confirmed || !this.voidReceiptId || !result.description?.trim()) {
      return;
    }
    this.api.voidReceipt(this.voidReceiptId, result.description.trim()).subscribe({
      next: () => {
        this.showVoidReceipt.set(false);
        this.voidReceiptId = null;
        this.reloadReceipts();
      },
    });
  }

  isAccepted(): boolean {
    return this.status() === 'accepted';
  }

  massLabel(mass: MassCelebrationSummary): string {
    const day = formatMassDayTime(mass.celebrated_on, mass.celebrated_at);
    return [day, mass.place].filter(Boolean).join(' · ');
  }

  markTouched(controlName: 'beneficiary_name' | 'intention_text' | 'mass_count'): void {
    this.form.controls[controlName].markAsTouched();
  }

  fieldError(controlName: 'beneficiary_name' | 'intention_text' | 'mass_count'): string | null {
    const control = this.form.controls[controlName];
    if (!control.touched || !control.invalid) {
      return null;
    }
    if (controlName === 'beneficiary_name') {
      return 'Enter who this Mass is for.';
    }
    if (controlName === 'intention_text') {
      return 'Enter what to pray for.';
    }
    if (control.hasError('min')) {
      return 'Enter at least one Mass.';
    }
    return 'Enter how many Masses to say.';
  }

  onBeneficiaryInput(): void {
    this.beneficiaryPersonId = null;
    this.beneficiarySearch$.next(this.form.controls.beneficiary_name.value);
  }

  pickPerson(person: ParishPerson): void {
    this.beneficiaryPersonId = person.id;
    this.form.controls.beneficiary_name.setValue(this.personDisplay(person));
    this.personResults.set([]);
  }

  personDisplay(person: ParishPerson): string {
    return person.full_name_display || `${person.first_name} ${person.last_name}`.trim();
  }

  ackDuplicate(): void {
    this.duplicateAcknowledged = true;
    this.similarWarning.set(false);
  }

  save(): void {
    if (this.form.invalid) {
      this.form.markAllAsTouched();
      this.toast.error('Add who the intention is for and what to pray.', 'Not saved');
      return;
    }
    this.persist(false);
  }

  accept(): void {
    if (!this.recordId) {
      this.persist(true);
      return;
    }
    this.runAccept(this.recordId);
  }

  private persist(acceptAfterCreate = false): void {
    this.saving.set(true);
    const body = this.payload();
    if (this.recordId) {
      this.api.updateRequest(this.recordId, body).subscribe({
        next: (res) => this.afterSave(res.data, acceptAfterCreate),
        error: (err) => this.onSaveFailed(err),
      });
      return;
    }

    this.api.createRequest(body).subscribe({
      next: (res) => {
        if (res.meta?.similar?.length && !this.duplicateAcknowledged) {
          this.similarRecords.set(res.meta.similar);
          this.similarWarning.set(true);
        }
        this.afterSave(res.data, acceptAfterCreate);
      },
      error: (err) => this.onSaveFailed(err),
    });
  }

  private runAccept(id: string): void {
    if (this.form.invalid) {
      this.form.markAllAsTouched();
      return;
    }
    this.saving.set(true);
    const payload: Record<string, unknown> = {
      mass_count: this.form.controls.mass_count.value,
      duplicate_warning_acknowledged: this.duplicateAcknowledged,
    };
    const amount = this.form.controls.offering_amount.value;
    if (amount) {
      payload['offering_amount'] = amount;
      payload['offering_payment_method'] = this.form.controls.offering_payment_method.value;
      payload['offering_received_on'] = this.form.controls.offering_received_on.value || undefined;
    }
    this.api.acceptRequest(id, payload).subscribe({
      next: (res) => {
        this.saving.set(false);
        this.patchRecord(res.data);
        this.upcomingMasses.set(res.meta?.upcoming_celebrations ?? []);
        this.toast.success('Intention registered.');
        const receipt = res.meta?.last_receipt;
        if (receipt) {
          this.receiptPrint.print(receipt, res.data.beneficiary_name);
        }
      },
      error: (err) => {
        this.saving.set(false);
        if (err?.error?.errors?.duplicate_warning) {
          this.similarWarning.set(true);
          if (this.recordId) {
            this.api.getRequest(this.recordId).subscribe();
          }
          return;
        }
        this.toast.error(this.readSaveError(err), 'Not saved');
      },
    });
  }

  scheduleNeedsDateReason(): boolean {
    const celebrationId = this.selectedCelebrationId();
    if (!celebrationId || !this.form.controls.date_must_be_kept.value) {
      return false;
    }
    const requested = this.form.controls.requested_date.value;
    if (!requested) {
      return false;
    }
    const mass = this.upcomingMasses().find((m) => m.id === celebrationId);
    return mass ? mass.celebrated_on !== requested : false;
  }

  scheduleSelected(): void {
    const id = this.recordId;
    const celebrationId = this.selectedCelebrationId();
    if (!id || !celebrationId) {
      return;
    }
    const reason = this.scheduleNeedsDateReason() ? this.dateVarianceReason().trim() : undefined;
    this.api.scheduleRequest(id, celebrationId, reason).subscribe({
      next: (res) => {
        this.dateVarianceReason.set('');
        this.patchRecord(res.data);
      },
    });
  }

  chooseLater(): void {
    void this.router.navigateByUrl('/mass-intentions');
  }

  saveMoreMasses(): void {
    const id = this.recordId;
    if (!id) {
      return;
    }
    this.saving.set(true);
    this.api.updateRequest(id, { mass_count: this.form.controls.mass_count.value }).subscribe({
      next: (res) => {
        this.saving.set(false);
        this.patchRecord(res.data);
      },
      error: () => this.saving.set(false),
    });
  }

  withdraw(): void {
    const id = this.recordId;
    if (!id) {
      return;
    }
    this.saving.set(true);
    this.api.withdrawRequest(id).subscribe({
      next: (res) => {
        this.saving.set(false);
        this.patchRecord(res.data);
      },
      error: () => this.saving.set(false),
    });
  }

  private payload(): Record<string, unknown> {
    return {
      beneficiary_person_id: this.beneficiaryPersonId,
      beneficiary_name: this.form.controls.beneficiary_name.value,
      intention_text: this.form.controls.intention_text.value,
      priest_text: this.form.controls.priest_text.value || null,
      notes: this.form.controls.notes.value || null,
      announce_name: !this.form.controls.do_not_announce.value,
      requester_name: this.form.controls.requester_name.value || null,
      requester_phone: this.form.controls.requester_phone.value || null,
      requested_date: this.form.controls.requested_date.value || null,
      date_must_be_kept: this.form.controls.date_must_be_kept.value,
      prohibit_transfer: this.form.controls.prohibit_transfer.value,
      is_collective: this.form.controls.is_collective.value,
      mass_count: this.form.controls.mass_count.value,
    };
  }

  private afterSave(data: MassIntentionRecord, acceptAfterCreate: boolean): void {
    this.saving.set(false);
    const id = data.id;
    if (!this.recordId) {
      void this.router.navigate(['/mass-intentions/intentions', String(id).toLowerCase()], { replaceUrl: true });
      this.recordId = id;
    }
    this.patchRecord(data);
    if (!acceptAfterCreate) {
      this.toast.success('Saved. Use Register intention when the parish is ready to accept it.');
    }
    if (acceptAfterCreate) {
      this.runAccept(id);
    }
  }

  private onSaveFailed(err: unknown): void {
    this.saving.set(false);
    this.toast.error(this.readSaveError(err), 'Not saved');
  }

  private readSaveError(err: unknown): string {
    if (err && typeof err === 'object' && 'error' in err) {
      const body = (err as { error?: { message?: string; errors?: Record<string, string[]> } }).error;
      if (body?.message && typeof body.message === 'string') {
        return body.message;
      }
      if (body?.errors) {
        const messages = Object.values(body.errors).flat().filter((line) => typeof line === 'string' && line.length > 0);
        if (messages.length) {
          return messages.join(' ');
        }
      }
    }
    return 'Could not save this intention. Try again.';
  }

  private patchRecord(data: MassIntentionRecord): void {
    this.status.set(data.status);
    this.saidProgress.set(data.said_progress ?? null);
    this.form.patchValue({
      beneficiary_name: data.beneficiary_name,
      intention_text: data.intention_text,
      do_not_announce: !data.announce_name,
      priest_text: data.priest_text ?? '',
      notes: data.notes ?? '',
      requester_name: data.requester_name ?? '',
      requester_phone: data.requester_phone ?? '',
      requested_date: data.requested_date ?? '',
      date_must_be_kept: data.date_must_be_kept,
      prohibit_transfer: data.prohibit_transfer ?? false,
      is_collective: data.is_collective ?? false,
      mass_count: data.mass_count_accepted ?? data.mass_count_requested ?? 1,
    });
    if (data.beneficiary_person_id) {
      this.beneficiaryPersonId = data.beneficiary_person_id;
    }
    if (data.status === 'awaiting_clarification' && data.notes) {
      const marker = 'Details needed:';
      const idx = data.notes.indexOf(marker);
      this.clarificationNotes.set(idx >= 0 ? data.notes.slice(idx + marker.length).trim() : data.notes);
    } else {
      this.clarificationNotes.set(null);
    }
    this.updateFormDisabledState();
  }

  private updateFormDisabledState(): void {
    if (this.isAccepted()) {
      this.form.disable();
      if (this.canReview()) {
        this.form.controls.mass_count.enable();
      }
      return;
    }
    if (this.status() === 'withdrawn') {
      this.form.disable();
      return;
    }
    this.form.enable();
  }
}
