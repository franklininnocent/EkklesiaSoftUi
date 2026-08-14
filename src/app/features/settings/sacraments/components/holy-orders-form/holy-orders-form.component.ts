import { CommonModule } from '@angular/common';
import { Component, OnDestroy, OnInit, inject } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { Router, RouterLink } from '@angular/router';
import { Subject, takeUntil } from 'rxjs';
import { AuthService } from '../../../../../core/services/auth.service';
import { ToastService } from '../../../../../core/services/toast.service';
import { PageHeaderComponent } from '../../../../../shared/components/page-header/page-header.component';
import { ButtonComponent } from '../../../../../shared/components/button/button.component';
import { SacramentCreateRequest, SacramentType } from '../../models/sacrament.model';
import { SacramentParticipantDraft } from '../../models/sacrament-definition.model';
import { SacramentService } from '../../services/sacrament.service';
import { SacramentFormService } from '../../services/sacrament-form.service';
import { ParticipantSourceControlComponent } from '../shared/participant-source-control/participant-source-control.component';
import { MinisterPickerComponent } from '../shared/minister-picker/minister-picker.component';
import { SacramentReviewPanelComponent } from '../shared/sacrament-review-panel/sacrament-review-panel.component';

/**
 * Phase 10C — dedicated multi-step Holy Orders registration (ADR-21).
 */
@Component({
  selector: 'app-holy-orders-form',
  standalone: true,
  imports: [
    CommonModule,
    FormsModule,
    RouterLink,
    PageHeaderComponent,
    ButtonComponent,
    ParticipantSourceControlComponent,
    MinisterPickerComponent,
    SacramentReviewPanelComponent,
  ],
  templateUrl: './holy-orders-form.component.html',
  styleUrl: './holy-orders-form.component.scss',
})
export class HolyOrdersFormComponent implements OnInit, OnDestroy {
  private readonly destroy$ = new Subject<void>();
  private readonly sacramentService = inject(SacramentService);
  private readonly formService = inject(SacramentFormService);
  private readonly authService = inject(AuthService);
  private readonly toast = inject(ToastService);
  private readonly router = inject(Router);

  step = 1;
  readonly totalSteps = 8;
  readonly steps = [
    'Details',
    'Candidate',
    'Ordaining Bishop',
    'Additional Ministers',
    'Diocese / Place',
    'Registry',
    'Review',
    'Save',
  ];
  saving = false;

  sacramentTypes: SacramentType[] = [];
  holyOrdersTypeId: number | null = null;
  holyOrdersEnabled = true;
  tenantId: number | null = null;

  formData: Record<string, string | number | null | undefined> = {
    date_administered: '',
    place_administered: '',
    book_number: '',
    page_number: '',
    registry_entry: '',
    certificate_number: '',
    notes: '',
    ordination_type: 'PRESBYTERATE',
    diocese_name: '',
    place_detail: '',
    recipient_name: '',
  };

  candidateDraft: SacramentParticipantDraft | null = null;
  ministerDraft: SacramentParticipantDraft | null = null;
  coConsecratorDrafts: SacramentParticipantDraft[] = [];
  witnessDrafts: SacramentParticipantDraft[] = [];

  ngOnInit(): void {
    const user = this.authService.currentUserValue;
    this.tenantId = user?.tenant_id ?? null;
    this.sacramentService.getSacramentTypes()
      .pipe(takeUntil(this.destroy$))
      .subscribe({
        next: (response) => {
          this.sacramentTypes = response?.data || [];
          const ho = this.sacramentTypes.find((t) =>
            ['HOLY_ORDERS', 'HOLYORDERS', 'ORDINATION'].includes((t.code || '').toUpperCase())
          );
          this.holyOrdersTypeId = ho?.id ?? null;
          this.holyOrdersEnabled = !!ho && ho.enabled_for_tenant !== false;
        },
      });
  }

  ngOnDestroy(): void {
    this.destroy$.next();
    this.destroy$.complete();
  }

  next(): void {
    if (this.step < this.totalSteps) {
      this.step += 1;
    }
  }

  back(): void {
    if (this.step > 1) {
      this.step -= 1;
    }
  }

  addCoConsecrator(): void {
    this.coConsecratorDrafts = [
      ...this.coConsecratorDrafts,
      { role: 'co_consecrator', source: 'external', external_full_name: '', external_minister_role: 'bishop' },
    ];
  }

  removeCoConsecrator(index: number): void {
    this.coConsecratorDrafts = this.coConsecratorDrafts.filter((_, i) => i !== index);
  }

  onCandidateChange(draft: SacramentParticipantDraft): void {
    this.candidateDraft = draft;
    if (draft.display_name || draft.external_full_name) {
      this.formData['recipient_name'] = draft.display_name || draft.external_full_name || '';
    }
  }

  onMinisterChange(draft: SacramentParticipantDraft): void {
    this.ministerDraft = draft;
  }

  reviewParticipants(): SacramentParticipantDraft[] {
    return [
      ...(this.candidateDraft ? [this.candidateDraft] : []),
      ...(this.ministerDraft ? [this.ministerDraft] : []),
      ...this.coConsecratorDrafts,
      ...this.witnessDrafts,
    ];
  }

  /** Humanize API enum values for review (PRESBYTERATE → Presbyterate). */
  ordinationTypeLabel(value: string | number | null | undefined): string {
    if (value == null || value === '') {
      return '—';
    }
    const key = String(value).toUpperCase();
    const labels: Record<string, string> = {
      DIACONATE: 'Diaconate',
      PRESBYTERATE: 'Presbyterate',
      EPISCOPATE: 'Episcopate',
    };
    if (labels[key]) {
      return labels[key];
    }
    return String(value)
      .toLowerCase()
      .replace(/_/g, ' ')
      .replace(/\b\w/g, (c) => c.toUpperCase());
  }

  registrySummary(): string {
    const book = this.formData['book_number'] ? String(this.formData['book_number']) : '';
    const page = this.formData['page_number'] ? String(this.formData['page_number']) : '';
    const entry = this.formData['registry_entry'] ? String(this.formData['registry_entry']) : '';
    const parts = [book, page, entry].filter(Boolean);
    return parts.length ? parts.join(' / ') : '—';
  }

  save(): void {
    if (!this.holyOrdersEnabled) {
      this.toast.error('Holy Orders is not available for new registration in this church.');
      return;
    }
    if (!this.tenantId || !this.holyOrdersTypeId) {
      this.toast.error('Holy Orders type is not available.');
      return;
    }
    if (!this.formData['date_administered'] || !this.formData['ordination_type']) {
      this.toast.error('Date and ordination type are required.');
      return;
    }

    const participants = this.formService.buildHolyOrdersParticipants({
      candidate: this.candidateDraft,
      minister: this.ministerDraft,
      coConsecrators: this.coConsecratorDrafts,
      witnesses: this.witnessDrafts,
      formData: this.formData,
    });

    if (participants.length < 2) {
      this.toast.error('Candidate and ordaining bishop are required.');
      return;
    }

    const payload: SacramentCreateRequest = {
      tenant_id: this.tenantId,
      sacrament_type_id: this.holyOrdersTypeId,
      recipient_name: String(this.formData['recipient_name'] || 'Candidate'),
      date_administered: String(this.formData['date_administered']),
      place_administered: this.formData['place_administered']
        ? String(this.formData['place_administered'])
        : undefined,
      book_number: this.formData['book_number'] ? String(this.formData['book_number']) : undefined,
      page_number: this.formData['page_number'] ? String(this.formData['page_number']) : undefined,
      registry_entry: this.formData['registry_entry'] ? String(this.formData['registry_entry']) : undefined,
      certificate_number: this.formData['certificate_number']
        ? String(this.formData['certificate_number'])
        : undefined,
      notes: this.formData['notes'] ? String(this.formData['notes']) : undefined,
      typed_attributes: {
        ordination_type: String(this.formData['ordination_type']),
        diocese_name: this.formData['diocese_name'] ? String(this.formData['diocese_name']) : undefined,
        place_detail: this.formData['place_detail'] ? String(this.formData['place_detail']) : undefined,
      },
      participants,
    };

    this.saving = true;
    this.sacramentService.createSacrament(payload)
      .pipe(takeUntil(this.destroy$))
      .subscribe({
        next: (res) => {
          this.saving = false;
          this.toast.success(res.message || 'Holy Orders registered.');
          void this.router.navigate(['/sacraments/view', res.data.id]);
        },
        error: (err) => {
          this.saving = false;
          const msg = err?.error?.message || 'Failed to register Holy Orders.';
          this.toast.error(msg);
        },
      });
  }
}
