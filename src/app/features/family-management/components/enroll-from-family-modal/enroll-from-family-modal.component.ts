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
import { FormBuilder, ReactiveFormsModule, Validators } from '@angular/forms';
import {
  EnrollFromFamilyPayload,
  MemberType,
  Organization,
} from '@features/ministries-associations/models/ministries.model';
import { MinistriesApiService } from '@features/ministries-associations/services/ministries-api.service';
import { ModalShellComponent } from '@shared/components';

@Component({
  selector: 'app-enroll-from-family-modal',
  standalone: true,
  imports: [CommonModule, ReactiveFormsModule, ModalShellComponent],
  templateUrl: './enroll-from-family-modal.component.html',
  styleUrl: './enroll-from-family-modal.component.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class EnrollFromFamilyModalComponent implements OnInit {
  private readonly api = inject(MinistriesApiService);
  private readonly fb = inject(FormBuilder);
  private readonly cdr = inject(ChangeDetectorRef);

  @Input({ required: true }) familyMemberId!: string;
  @Output() enrolled = new EventEmitter<void>();
  @Output() cancel = new EventEmitter<void>();

  organizations: Organization[] = [];
  organizationsLoading = false;
  organizationsLoaded = false;
  organizationsError: string | null = null;
  saving = false;
  formError: string | null = null;
  submitted = false;

  readonly form = this.fb.nonNullable.group({
    organization_id: ['', Validators.required],
    joined_date: ['', Validators.required],
    member_type: ['regular' as MemberType, Validators.required],
    remarks: [''],
  });

  ngOnInit(): void {
    this.form.controls.joined_date.setValue(this.todayIsoDate());
    this.loadOrganizations();
  }

  retryLoadOrganizations(): void {
    this.loadOrganizations();
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

    if (this.form.invalid) {
      this.form.markAllAsTouched();
      this.cdr.markForCheck();
      return;
    }

    const raw = this.form.getRawValue();
    const payload: EnrollFromFamilyPayload = {
      organization_id: raw.organization_id,
      member_type: raw.member_type,
      joined_date: raw.joined_date,
      remarks: raw.remarks.trim() || null,
    };

    this.saving = true;
    this.cdr.markForCheck();

    this.api.enrollFromFamily(this.familyMemberId, payload).subscribe({
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

  private loadOrganizations(): void {
    this.organizationsLoading = true;
    this.organizationsError = null;
    this.cdr.markForCheck();

    this.api.listOrganizations({ status: 'active', per_page: 100 }).subscribe({
      next: (response) => {
        this.organizations = response.data ?? [];
        this.organizationsLoading = false;
        this.organizationsLoaded = true;
        this.cdr.markForCheck();
      },
      error: () => {
        this.organizations = [];
        this.organizationsLoading = false;
        this.organizationsLoaded = true;
        this.organizationsError = 'Could not load organizations. Please try again.';
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
    // errorInterceptor normalizes HttpErrorResponse into `{ message, status, errors }`.
    const { message, fieldMessages } = this.normalizeEnrollError(error);
    const combined = `${message ?? ''} ${fieldMessages}`.toLowerCase();

    if (combined.includes('already')) {
      return 'Already enrolled in this organization';
    }
    if (
      combined.includes('deceased') ||
      combined.includes('transferred') ||
      combined.includes('not eligible') ||
      combined.includes('ineligible')
    ) {
      return 'Member is deceased or transferred';
    }
    if (combined.includes('inactive') || combined.includes('must be active')) {
      return 'Organization is not active';
    }

    return message || 'Could not enroll member. Please try again.';
  }

  private normalizeEnrollError(error: unknown): {
    message?: string;
    fieldMessages: string;
  } {
    if (error instanceof HttpErrorResponse) {
      const payload = error.error as {
        message?: string;
        errors?: Record<string, string[]>;
      } | null;

      return {
        message: payload?.message,
        fieldMessages: payload?.errors ? Object.values(payload.errors).flat().join(' ') : '',
      };
    }

    if (error && typeof error === 'object') {
      const payload = error as {
        message?: string;
        errors?: Record<string, string[]>;
      };

      return {
        message: payload.message,
        fieldMessages: payload.errors ? Object.values(payload.errors).flat().join(' ') : '',
      };
    }

    return { fieldMessages: '' };
  }
}
