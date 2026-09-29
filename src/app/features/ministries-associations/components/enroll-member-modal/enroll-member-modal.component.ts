import { CommonModule } from '@angular/common';
import { HttpErrorResponse } from '@angular/common/http';
import {
  ChangeDetectionStrategy,
  ChangeDetectorRef,
  Component,
  EventEmitter,
  Input,
  OnInit,
  Output,
  inject,
} from '@angular/core';
import {
  FormBuilder,
  ReactiveFormsModule,
  Validators,
} from '@angular/forms';
import { ModalShellComponent } from '@shared/components/modal-shell/modal-shell.component';
import { FormFieldComponent } from '@shared/components/form-field/form-field.component';
import {
  EnrollMemberPayload,
  GuestMember,
  MemberSource,
  MemberType,
  ParishionerLookupResult,
} from '../../models/ministries.model';
import { MinistriesApiService } from '../../services/ministries-api.service';
import { GuestMemberFormModalComponent } from '../guest-member-form-modal/guest-member-form-modal.component';
import { ParishionerLookupTypeaheadComponent } from '../parishioner-lookup-typeahead/parishioner-lookup-typeahead.component';

@Component({
  selector: 'app-enroll-member-modal',
  standalone: true,
  imports: [
    CommonModule,
    ReactiveFormsModule,
    ParishionerLookupTypeaheadComponent,
    GuestMemberFormModalComponent,
    ModalShellComponent,
    FormFieldComponent,
  ],
  templateUrl: './enroll-member-modal.component.html',
  styleUrl: './enroll-member-modal.component.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class EnrollMemberModalComponent implements OnInit {
  private readonly api = inject(MinistriesApiService);
  private readonly fb = inject(FormBuilder);
  private readonly cdr = inject(ChangeDetectorRef);

  @Input({ required: true }) organizationId!: string;
  @Output() enrolled = new EventEmitter<void>();
  @Output() cancel = new EventEmitter<void>();

  memberSource: MemberSource = 'parish';
  selectedParishioner: ParishionerLookupResult | null = null;
  selectedGuestId = '';
  guests: GuestMember[] = [];
  guestsLoading = false;
  guestsLoaded = false;
  guestsError: string | null = null;
  showCreateGuestModal = false;
  saving = false;
  formError: string | null = null;
  personError: string | null = null;
  submitted = false;

  readonly form = this.fb.nonNullable.group({
    joined_date: ['', Validators.required],
    member_type: ['regular' as MemberType, Validators.required],
    remarks: [''],
    emergency_contact: ['', Validators.maxLength(100)],
  });

  ngOnInit(): void {
    this.form.controls.joined_date.setValue(this.todayIsoDate());
  }

  get isParishSource(): boolean {
    return this.memberSource === 'parish';
  }

  setMemberSource(source: MemberSource): void {
    if (this.saving || this.memberSource === source) {
      return;
    }

    this.memberSource = source;
    this.personError = null;
    this.formError = null;
    this.selectedParishioner = null;
    this.selectedGuestId = '';

    if (source === 'guest' && !this.guestsLoaded && !this.guestsLoading) {
      this.loadGuests();
    }

    this.cdr.markForCheck();
  }

  onParishionerSelected(parishioner: ParishionerLookupResult | null): void {
    this.selectedParishioner = parishioner;
    this.personError = null;
    this.cdr.markForCheck();
  }

  onGuestChange(guestId: string): void {
    this.selectedGuestId = guestId;
    this.personError = null;
    this.cdr.markForCheck();
  }

  openCreateGuestModal(): void {
    if (this.saving) {
      return;
    }
    this.showCreateGuestModal = true;
    this.cdr.markForCheck();
  }

  closeCreateGuestModal(): void {
    this.showCreateGuestModal = false;
    this.cdr.markForCheck();
  }

  onGuestCreated(guest: GuestMember): void {
    this.guests = [guest, ...this.guests.filter((item) => item.id !== guest.id)];
    this.guestsLoaded = true;
    this.guestsError = null;
    this.selectedGuestId = guest.id;
    this.personError = null;
    this.showCreateGuestModal = false;
    this.cdr.markForCheck();
  }

  guestDisplayName(guest: GuestMember): string {
    return guest.display_name?.trim() || `${guest.first_name} ${guest.last_name}`.trim();
  }

  retryLoadGuests(): void {
    this.loadGuests();
  }

  onCancel(): void {
    if (this.saving || this.showCreateGuestModal) {
      return;
    }
    this.cancel.emit();
  }

  onSubmit(): void {
    this.submitted = true;
    this.formError = null;
    this.personError = null;

    if (this.isParishSource) {
      if (!this.selectedParishioner) {
        this.personError = 'Select a parish member.';
        this.cdr.markForCheck();
        return;
      }

      if (!this.selectedParishioner.eligible) {
        this.personError = 'Member is deceased or transferred in parish records';
        this.cdr.markForCheck();
        return;
      }
    } else if (!this.selectedGuestId) {
      this.personError = 'Select a guest.';
      this.cdr.markForCheck();
      return;
    }

    if (this.form.invalid) {
      this.form.markAllAsTouched();
      this.cdr.markForCheck();
      return;
    }

    const raw = this.form.getRawValue();
    const payload: EnrollMemberPayload = this.isParishSource
      ? {
          member_source: 'parish',
          family_member_id: this.selectedParishioner!.family_member_id,
          member_type: raw.member_type,
          joined_date: raw.joined_date,
          remarks: raw.remarks.trim() || null,
          emergency_contact: raw.emergency_contact.trim() || null,
        }
      : {
          member_source: 'guest',
          guest_member_id: this.selectedGuestId,
          member_type: raw.member_type,
          joined_date: raw.joined_date,
          remarks: raw.remarks.trim() || null,
        };

    this.saving = true;
    this.cdr.markForCheck();

    this.api.enrollMember(this.organizationId, payload).subscribe({
      next: () => {
        this.saving = false;
        this.enrolled.emit();
        this.cdr.markForCheck();
      },
      error: (error: unknown) => {
        this.saving = false;
        this.formError = this.mapEnrollError(error);
        this.cdr.markForCheck();
      },
    });
  }

  private loadGuests(): void {
    this.guestsLoading = true;
    this.guestsError = null;
    this.cdr.markForCheck();

    this.api.listGuestMembers({ per_page: 100 }).subscribe({
      next: (response) => {
        this.guests = response.data;
        this.guestsLoading = false;
        this.guestsLoaded = true;
        this.cdr.markForCheck();
      },
      error: () => {
        this.guests = [];
        this.guestsLoading = false;
        this.guestsLoaded = true;
        this.guestsError = 'Could not load guests. Please try again.';
        this.cdr.markForCheck();
      },
    });
  }

  private todayIsoDate(): string {
    const now = new Date();
    const year = now.getFullYear();
    const month = String(now.getMonth() + 1).padStart(2, '0');
    const day = String(now.getDate()).padStart(2, '0');
    return `${year}-${month}-${day}`;
  }

  private mapEnrollError(error: unknown): string {
    if (!(error instanceof HttpErrorResponse)) {
      return 'Could not enroll member. Please try again.';
    }

    const payload = error.error as {
      message?: string;
      errors?: Record<string, string[]>;
    } | null;

    const fieldMessages = payload?.errors
      ? Object.values(payload.errors).flat().join(' ')
      : '';
    const combined = `${payload?.message ?? ''} ${fieldMessages}`.toLowerCase();

    if (combined.includes('already')) {
      return 'Already enrolled in this organization';
    }
    if (
      combined.includes('deceased') ||
      combined.includes('transferred') ||
      combined.includes('not eligible')
    ) {
      return 'Member is deceased or transferred in parish records';
    }
    if (combined.includes('inactive') || combined.includes('must be active')) {
      return 'Organization must be active to enroll members';
    }

    return payload?.message || 'Could not enroll member. Please try again.';
  }
}
