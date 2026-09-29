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
import { ModalShellComponent } from '@shared/components/modal-shell/modal-shell.component';
import { GuestMember, ParishionerLookupResult } from '../../models/ministries.model';
import { MinistriesApiService } from '../../services/ministries-api.service';
import { ParishionerLookupTypeaheadComponent } from '../parishioner-lookup-typeahead/parishioner-lookup-typeahead.component';

@Component({
  selector: 'app-link-parishioner-modal',
  standalone: true,
  imports: [CommonModule, ParishionerLookupTypeaheadComponent, ModalShellComponent],
  templateUrl: './link-parishioner-modal.component.html',
  styleUrl: './link-parishioner-modal.component.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class LinkParishionerModalComponent implements OnInit {
  private readonly api = inject(MinistriesApiService);
  private readonly cdr = inject(ChangeDetectorRef);

  @Input({ required: true }) guest!: GuestMember;
  @Output() linked = new EventEmitter<GuestMember>();
  @Output() cancel = new EventEmitter<void>();

  /** Empty so lookup runs without org-scoped exclusion. */
  readonly lookupOrganizationId = '';

  selectedParishioner: ParishionerLookupResult | null = null;
  saving = false;
  submitted = false;
  formError: string | null = null;
  alreadyLinked = false;

  ngOnInit(): void {
    this.alreadyLinked = !!this.guest.linked_family_member_id;
    if (this.alreadyLinked) {
      this.formError = 'This guest is already linked to a parishioner.';
    }
  }

  get guestDisplayName(): string {
    return this.guest.display_name?.trim() || `${this.guest.first_name} ${this.guest.last_name}`.trim();
  }

  get submitLabel(): string {
    return this.saving ? 'Linking…' : 'Link to parishioner';
  }

  onParishionerSelected(parishioner: ParishionerLookupResult | null): void {
    this.selectedParishioner = parishioner;
    this.formError = null;
    this.cdr.markForCheck();
  }

  onCancel(): void {
    if (this.saving) {
      return;
    }
    this.cancel.emit();
  }

  onSubmit(): void {
    this.submitted = true;
    this.formError = null;

    if (this.alreadyLinked || this.guest.linked_family_member_id) {
      this.formError = 'This guest is already linked to a parishioner.';
      this.cdr.markForCheck();
      return;
    }

    if (!this.selectedParishioner) {
      this.formError = 'Select a parishioner to link.';
      this.cdr.markForCheck();
      return;
    }

    if (!this.selectedParishioner.eligible) {
      this.formError = 'This parishioner is not eligible to link.';
      this.cdr.markForCheck();
      return;
    }

    this.saving = true;
    this.cdr.markForCheck();

    this.api
      .linkGuestParishioner(this.guest.id, {
        family_member_id: this.selectedParishioner.family_member_id,
      })
      .subscribe({
        next: (response) => {
          this.saving = false;
          this.linked.emit(response.data);
          this.cdr.markForCheck();
        },
        error: (error: unknown) => {
          this.saving = false;
          this.formError = this.mapError(error);
          this.cdr.markForCheck();
        },
      });
  }

  private mapError(error: unknown): string {
    if (!(error instanceof HttpErrorResponse)) {
      return 'Could not link parishioner. Please try again.';
    }

    const payload = error.error as {
      message?: string;
      errors?: Record<string, string[]>;
    } | null;

    const fieldMessages = payload?.errors
      ? Object.values(payload.errors).flat().join(' ')
      : '';
    const combined = `${payload?.message ?? ''} ${fieldMessages}`.toLowerCase();

    if (error.status === 422) {
      if (combined.includes('already') || combined.includes('linked')) {
        return 'This guest is already linked to a parishioner.';
      }
      if (
        combined.includes('ineligible') ||
        combined.includes('eligible') ||
        combined.includes('deceased') ||
        combined.includes('transferred') ||
        combined.includes('removed')
      ) {
        return 'This parishioner is not eligible to link.';
      }
      return payload?.message || fieldMessages || 'This parishioner cannot be linked.';
    }

    return payload?.message || 'Could not link parishioner. Please try again.';
  }
}
