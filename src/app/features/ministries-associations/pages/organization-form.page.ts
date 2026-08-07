import { CommonModule } from '@angular/common';
import { HttpErrorResponse } from '@angular/common/http';
import {
  ChangeDetectionStrategy,
  ChangeDetectorRef,
  Component,
  OnDestroy,
  OnInit,
  inject,
} from '@angular/core';
import { FormBuilder, ReactiveFormsModule } from '@angular/forms';
import { Router, RouterModule } from '@angular/router';
import { Subject, forkJoin, takeUntil } from 'rxjs';
import { AuthService } from '@core/services/auth.service';
import { ToastService } from '@core/services/toast.service';
import { LoadingSkeletonComponent } from '@shared/components/loading-skeleton/loading-skeleton.component';
import { PageHeaderComponent } from '@shared/components/page-header/page-header.component';
import {
  CreateOrganizationPayload,
  OrganizationCategory,
  OrganizationType,
} from '../models/ministries.model';
import { MinistriesApiService } from '../services/ministries-api.service';
import { OrganizationFormFieldsComponent } from '../components/organization-form-fields/organization-form-fields.component';
import {
  createOrganizationFormGroup,
  mapOrganizationFieldMessage,
  todayIsoDate,
} from '../utils/organization-form.util';

@Component({
  selector: 'app-organization-form-page',
  standalone: true,
  imports: [
    CommonModule,
    ReactiveFormsModule,
    RouterModule,
    PageHeaderComponent,
    LoadingSkeletonComponent,
    OrganizationFormFieldsComponent,
  ],
  templateUrl: './organization-form.page.html',
  styleUrl: './organization-form.page.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class OrganizationFormPageComponent implements OnInit, OnDestroy {
  private readonly destroy$ = new Subject<void>();
  private readonly api = inject(MinistriesApiService);
  private readonly authService = inject(AuthService);
  private readonly router = inject(Router);
  private readonly toastService = inject(ToastService);
  private readonly fb = inject(FormBuilder);
  private readonly cdr = inject(ChangeDetectorRef);

  categories: OrganizationCategory[] = [];
  types: OrganizationType[] = [];

  canAccess = false;
  loading = true;
  loadError: string | null = null;
  saving = false;
  submitted = false;
  formError: string | null = null;
  fieldErrors: Record<string, string> = {};

  readonly form = createOrganizationFormGroup(this.fb);

  ngOnInit(): void {
    this.canAccess = this.authService.hasPermission('ministries.create');

    if (!this.canAccess) {
      this.loading = false;
      this.cdr.markForCheck();
      return;
    }

    this.loadCreateOptions();
  }

  ngOnDestroy(): void {
    this.destroy$.next();
    this.destroy$.complete();
  }

  get maxEstablishedDate(): string {
    return todayIsoDate();
  }

  get hasTaxonomies(): boolean {
    return this.categories.length > 0 && this.types.length > 0;
  }

  get submitLabel(): string {
    return this.saving ? 'Saving…' : 'Create organization';
  }

  cancel(): void {
    void this.router.navigate(['/ministries']);
  }

  onSubmit(): void {
    this.submitted = true;
    this.formError = null;
    this.fieldErrors = {};

    if (!this.canAccess || !this.hasTaxonomies) {
      return;
    }

    if (this.form.invalid) {
      this.form.markAllAsTouched();
      this.cdr.markForCheck();
      return;
    }

    const payload = this.buildPayload();
    this.saving = true;
    this.cdr.markForCheck();

    this.api
      .createOrganization(payload)
      .pipe(takeUntil(this.destroy$))
      .subscribe({
        next: (response) => {
          this.saving = false;
          this.toastService.success('Organization created.');
          void this.router.navigate(['/ministries', response.data.id]);
          this.cdr.markForCheck();
        },
        error: (error: unknown) => {
          this.saving = false;
          this.applySubmitError(error, 'Could not create organization. Please try again.');
          this.cdr.markForCheck();
        },
      });
  }

  private loadCreateOptions(): void {
    this.loading = true;
    this.loadError = null;
    this.cdr.markForCheck();

    forkJoin({
      categories: this.api.listCategories({ is_active: true, per_page: 100 }),
      types: this.api.listTypes({ is_active: true, per_page: 100 }),
    })
      .pipe(takeUntil(this.destroy$))
      .subscribe({
        next: ({ categories, types }) => {
          this.categories = categories.data;
          this.types = types.data;
          this.loading = false;
          this.cdr.markForCheck();
        },
        error: () => {
          this.loadError = 'Could not load categories and types. Please try again.';
          this.loading = false;
          this.cdr.markForCheck();
        },
      });
  }

  private buildPayload(): CreateOrganizationPayload {
    const raw = this.form.getRawValue();
    const socialLinks = {
      facebook: raw.facebook.trim() || null,
      instagram: raw.instagram.trim() || null,
      whatsapp: raw.whatsapp.trim() || null,
      youtube: raw.youtube.trim() || null,
      telegram: raw.telegram.trim() || null,
    };
    const hasSocial = Object.values(socialLinks).some((value) => !!value);

    const payload: CreateOrganizationPayload = {
      code: raw.code.trim(),
      name: raw.name.trim(),
      short_name: raw.short_name.trim() || null,
      category_id: raw.category_id,
      type_id: raw.type_id,
      description: raw.description.trim() || null,
      vision: raw.vision.trim() || null,
      mission: raw.mission.trim() || null,
      objectives: raw.objectives.trim() || null,
      patron_saint: raw.patron_saint.trim() || null,
      established_date: raw.established_date || null,
      theme_color: raw.theme_color.trim() || null,
      email: raw.email.trim() || null,
      phone: raw.phone.trim() || null,
      website: raw.website.trim() || null,
      status: raw.status,
      settings: {
        allow_multi_role_holding: raw.allow_multi_role_holding,
        guests_can_hold_office: raw.guests_can_hold_office,
      },
    };

    if (hasSocial) {
      payload.social_links = socialLinks;
    }

    return payload;
  }

  private applySubmitError(error: unknown, fallback: string): void {
    if (!(error instanceof HttpErrorResponse)) {
      this.formError = fallback;
      return;
    }

    const payload = error.error as {
      message?: string;
      errors?: Record<string, string[]>;
    } | null;

    if (error.status === 422 && payload?.errors) {
      const next: Record<string, string> = {};
      for (const [field, messages] of Object.entries(payload.errors)) {
        if (!messages?.length) {
          continue;
        }
        const key = field.startsWith('social_links.')
          ? field.slice('social_links.'.length)
          : field;
        next[key] = mapOrganizationFieldMessage(key, messages[0]);
      }
      this.fieldErrors = next;
      const hasMappedField = Object.keys(next).some((key) => key in this.form.controls);
      this.formError = hasMappedField
        ? null
        : payload.message || 'Please fix the highlighted fields.';
      return;
    }

    this.formError = payload?.message || fallback;
  }
}
