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
import { ActivatedRoute, Router, RouterModule } from '@angular/router';
import { Subject, forkJoin, takeUntil } from 'rxjs';
import { AuthService } from '@core/services/auth.service';
import { ToastService } from '@core/services/toast.service';
import { ConfirmationModalComponent } from '@shared/components/confirmation-modal/confirmation-modal.component';
import { LoadingSkeletonComponent } from '@shared/components/loading-skeleton/loading-skeleton.component';
import { PageHeaderComponent } from '@shared/components/page-header/page-header.component';
import { StatusBadgeComponent, StatusBadgeTone } from '@shared/components/status-badge/status-badge.component';
import { TabStripComponent, TabStripItem } from '@shared/components/tab-strip/tab-strip.component';
import { AuditLogPanelComponent } from '../components/audit-log-panel/audit-log-panel.component';
import { OrganizationMembersTabComponent } from '../components/organization-members-tab/organization-members-tab.component';
import { OrganizationLeadershipTabComponent } from '../components/organization-leadership-tab/organization-leadership-tab.component';
import { OrganizationFormFieldsComponent } from '../components/organization-form-fields/organization-form-fields.component';
import {
  Organization,
  OrganizationCategory,
  OrganizationSocialLinks,
  OrganizationSummary,
  OrganizationType,
  UpdateOrganizationPayload,
} from '../models/ministries.model';
import { MinistriesApiService } from '../services/ministries-api.service';
import {
  createOrganizationFormGroup,
  mapOrganizationFieldMessage,
  todayIsoDate,
} from '../utils/organization-form.util';

type SocialLinkKey = keyof OrganizationSocialLinks;

const SOCIAL_LINK_LABELS: Record<SocialLinkKey, string> = {
  facebook: 'Facebook',
  instagram: 'Instagram',
  whatsapp: 'WhatsApp',
  youtube: 'YouTube',
  telegram: 'Telegram',
};

type OrganizationTab = 'profile' | 'members' | 'leadership' | 'audit';

const ORGANIZATION_TABS: OrganizationTab[] = [
  'profile',
  'members',
  'leadership',
  'audit',
];

const TAB_LABELS: Record<OrganizationTab, string> = {
  profile: 'Profile',
  members: 'Members',
  leadership: 'Leadership',
  audit: 'Audit',
};

@Component({
  selector: 'app-organization-detail-page',
  standalone: true,
  imports: [
    CommonModule,
    ReactiveFormsModule,
    RouterModule,
    LoadingSkeletonComponent,
    PageHeaderComponent,
    StatusBadgeComponent,
    TabStripComponent,
    OrganizationFormFieldsComponent,
    OrganizationMembersTabComponent,
    OrganizationLeadershipTabComponent,
    AuditLogPanelComponent,
    ConfirmationModalComponent,
  ],
  templateUrl: './organization-detail.page.html',
  styleUrl: './organization-detail.page.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class OrganizationDetailPageComponent implements OnInit, OnDestroy {
  private readonly destroy$ = new Subject<void>();
  private readonly api = inject(MinistriesApiService);
  private readonly authService = inject(AuthService);
  private readonly toastService = inject(ToastService);
  private readonly route = inject(ActivatedRoute);
  private readonly router = inject(Router);
  private readonly fb = inject(FormBuilder);
  private readonly cdr = inject(ChangeDetectorRef);

  readonly tabs = ORGANIZATION_TABS;
  readonly tabLabels = TAB_LABELS;

  organization: Organization | null = null;
  summary: OrganizationSummary | null = null;
  categories: OrganizationCategory[] = [];
  types: OrganizationType[] = [];
  activeTab: OrganizationTab = 'profile';

  loading = true;
  loadError: string | null = null;

  canEdit = false;
  canArchive = false;
  editingProfile = false;
  savingProfile = false;
  statusBusy = false;
  archiveBusy = false;
  restoreBusy = false;
  showArchiveConfirm = false;
  submitted = false;
  formError: string | null = null;
  fieldErrors: Record<string, string> = {};

  private organizationId: string | null = null;

  readonly form = createOrganizationFormGroup(this.fb);

  get tabStripItems(): TabStripItem[] {
    return this.tabs.map((tab) => ({
      id: tab,
      label: this.tabLabels[tab],
      domId: this.tabId(tab),
      ariaControls: this.panelId(tab),
    }));
  }

  get profileSocialLinks(): Array<{ label: string; value: string }> {
    return this.socialLinks(this.organization?.social_links);
  }

  get maxEstablishedDate(): string {
    return todayIsoDate();
  }

  get isArchived(): boolean {
    return !!this.organization?.deleted_at;
  }

  get headerStatusLabel(): string {
    if (!this.organization) {
      return '';
    }
    return this.isArchived ? 'Archived' : this.statusLabel(this.organization.status);
  }

  get headerStatusTone(): StatusBadgeTone {
    if (this.isArchived) {
      return 'neutral';
    }
    return this.organization?.status === 'active' ? 'success' : 'neutral';
  }

  ngOnInit(): void {
    this.canEdit = this.authService.hasPermission('ministries.edit');
    this.canArchive = this.authService.hasPermission('ministries.delete');
    this.initializeTabFromQuery();

    const id = this.route.snapshot.paramMap.get('id');
    if (!id) {
      this.loadError = 'Organization not found.';
      this.loading = false;
      this.cdr.markForCheck();
      return;
    }

    this.organizationId = id;
    this.loadOrganization(id);
  }

  ngOnDestroy(): void {
    this.destroy$.next();
    this.destroy$.complete();
  }

  onTabChange(tabId: string): void {
    this.setActiveTab(tabId as OrganizationTab);
  }

  setActiveTab(tab: OrganizationTab): void {
    if (this.activeTab === tab) {
      return;
    }

    this.activeTab = tab;
    void this.router.navigate([], {
      relativeTo: this.route,
      queryParams: { tab: tab === 'profile' ? null : tab },
      queryParamsHandling: 'merge',
      replaceUrl: true,
    });
    this.cdr.markForCheck();
  }

  tabId(tab: OrganizationTab): string {
    return `organization-tab-${tab}`;
  }

  panelId(tab: OrganizationTab): string {
    return `organization-panel-${tab}`;
  }

  statusLabel(status: Organization['status']): string {
    return status === 'active' ? 'Active' : 'Inactive';
  }

  displayValue(value: string | null | undefined): string {
    const trimmed = value?.trim();
    return trimmed ? trimmed : '—';
  }

  yesNo(value: boolean | undefined): string {
    return value ? 'Yes' : 'No';
  }

  formatDate(value: string | null | undefined): string {
    if (!value) {
      return '—';
    }

    const date = new Date(`${value}T00:00:00`);
    if (Number.isNaN(date.getTime())) {
      return value;
    }

    return date.toLocaleDateString(undefined, {
      year: 'numeric',
      month: 'short',
      day: 'numeric',
    });
  }

  socialLinks(
    links: OrganizationSocialLinks | null | undefined,
  ): Array<{ label: string; value: string }> {
    if (!links) {
      return [];
    }

    return (Object.keys(SOCIAL_LINK_LABELS) as SocialLinkKey[])
      .map((key) => {
        const value = links[key]?.trim();
        return value ? { label: SOCIAL_LINK_LABELS[key], value } : null;
      })
      .filter((item): item is { label: string; value: string } => item !== null);
  }

  retryLoad(): void {
    if (!this.organizationId) {
      return;
    }
    this.loadOrganization(this.organizationId);
  }

  onLeadershipChanged(): void {
    this.refreshHeader();
  }

  startEditProfile(): void {
    if (!this.canEdit || !this.organization || this.isArchived) {
      return;
    }

    this.ensureTaxonomiesLoaded(() => {
      this.patchFormFromOrganization(this.organization!);
      this.editingProfile = true;
      this.submitted = false;
      this.formError = null;
      this.fieldErrors = {};
      this.setActiveTab('profile');
      this.cdr.markForCheck();
    });
  }

  cancelEditProfile(): void {
    this.editingProfile = false;
    this.submitted = false;
    this.formError = null;
    this.fieldErrors = {};
    this.cdr.markForCheck();
  }

  saveProfile(): void {
    if (!this.canEdit || !this.organizationId || !this.organization) {
      return;
    }

    this.submitted = true;
    this.formError = null;
    this.fieldErrors = {};

    if (this.form.invalid) {
      this.form.markAllAsTouched();
      this.cdr.markForCheck();
      return;
    }

    const payload = this.buildPayload();
    this.savingProfile = true;
    this.cdr.markForCheck();

    this.api
      .updateOrganization(this.organizationId, payload)
      .pipe(takeUntil(this.destroy$))
      .subscribe({
        next: (response) => {
          this.organization = {
            ...response.data,
            category: response.data.category ?? this.organization?.category,
            type: response.data.type ?? this.organization?.type,
            settings: response.data.settings ?? this.organization?.settings,
          };
          this.editingProfile = false;
          this.savingProfile = false;
          this.toastService.success('Organization updated.');
          this.refreshHeader();
          this.cdr.markForCheck();
        },
        error: (error: unknown) => {
          this.savingProfile = false;
          this.applySubmitError(error, 'Could not update organization. Please try again.');
          this.cdr.markForCheck();
        },
      });
  }

  toggleStatus(): void {
    if (!this.canEdit || !this.organizationId || !this.organization || this.isArchived) {
      return;
    }

    const nextStatus = this.organization.status === 'active' ? 'inactive' : 'active';
    this.statusBusy = true;
    this.cdr.markForCheck();

    this.api
      .updateOrganizationStatus(this.organizationId, { status: nextStatus })
      .pipe(takeUntil(this.destroy$))
      .subscribe({
        next: (response) => {
          this.organization = {
            ...this.organization!,
            ...response.data,
            category: response.data.category ?? this.organization?.category,
            type: response.data.type ?? this.organization?.type,
            settings: response.data.settings ?? this.organization?.settings,
          };
          this.statusBusy = false;
          this.toastService.success(
            nextStatus === 'active' ? 'Organization activated.' : 'Organization deactivated.',
          );
          this.cdr.markForCheck();
        },
        error: (error: unknown) => {
          this.statusBusy = false;
          const message =
            error instanceof HttpErrorResponse
              ? (error.error as { message?: string } | null)?.message
              : null;
          this.toastService.error(message || 'Could not update status. Please try again.');
          this.cdr.markForCheck();
        },
      });
  }

  openArchiveConfirm(): void {
    if (!this.canArchive || !this.organization || this.isArchived) {
      return;
    }
    this.showArchiveConfirm = true;
    this.cdr.markForCheck();
  }

  cancelArchive(): void {
    this.showArchiveConfirm = false;
    this.cdr.markForCheck();
  }

  confirmArchive(): void {
    if (!this.canArchive || !this.organizationId) {
      return;
    }

    this.archiveBusy = true;
    this.cdr.markForCheck();

    this.api
      .deleteOrganization(this.organizationId)
      .pipe(takeUntil(this.destroy$))
      .subscribe({
        next: () => {
          this.archiveBusy = false;
          this.showArchiveConfirm = false;
          this.toastService.success('Organization archived.');
          void this.router.navigate(['/ministries']);
          this.cdr.markForCheck();
        },
        error: (error: unknown) => {
          this.archiveBusy = false;
          this.showArchiveConfirm = false;
          if (error instanceof HttpErrorResponse && error.status === 409) {
            this.toastService.error(
              'Clear active members and office bearers before archiving.',
            );
          } else {
            const message =
              error instanceof HttpErrorResponse
                ? (error.error as { message?: string } | null)?.message
                : null;
            this.toastService.error(message || 'Could not archive organization. Please try again.');
          }
          this.cdr.markForCheck();
        },
      });
  }

  restoreOrganization(): void {
    if (!this.canArchive || !this.organizationId || !this.isArchived) {
      return;
    }

    this.restoreBusy = true;
    this.cdr.markForCheck();

    this.api
      .restoreOrganization(this.organizationId)
      .pipe(takeUntil(this.destroy$))
      .subscribe({
        next: (response) => {
          this.organization = {
            ...response.data,
            category: response.data.category ?? this.organization?.category,
            type: response.data.type ?? this.organization?.type,
            settings: response.data.settings ?? this.organization?.settings,
          };
          this.restoreBusy = false;
          this.toastService.success('Organization restored.');
          this.refreshHeader();
          this.cdr.markForCheck();
        },
        error: (error: unknown) => {
          this.restoreBusy = false;
          const message =
            error instanceof HttpErrorResponse
              ? (error.error as { message?: string } | null)?.message
              : null;
          this.toastService.error(message || 'Could not restore organization. Please try again.');
          this.cdr.markForCheck();
        },
      });
  }

  private initializeTabFromQuery(): void {
    this.applyTabFromQuery(this.route.snapshot.queryParamMap.get('tab'));

    this.route.queryParamMap.pipe(takeUntil(this.destroy$)).subscribe((params) => {
      this.applyTabFromQuery(params.get('tab'));
    });
  }

  private applyTabFromQuery(tab: string | null): void {
    const next: OrganizationTab =
      tab && ORGANIZATION_TABS.includes(tab as OrganizationTab)
        ? (tab as OrganizationTab)
        : 'profile';

    if (this.activeTab === next) {
      return;
    }

    this.activeTab = next;
    this.cdr.markForCheck();
  }

  private loadOrganization(id: string): void {
    this.loading = true;
    this.loadError = null;
    this.editingProfile = false;
    this.cdr.markForCheck();

    forkJoin({
      organization: this.api.getOrganization(id, 'category,type,settings'),
      summary: this.api.getOrganizationSummary(id),
    })
      .pipe(takeUntil(this.destroy$))
      .subscribe({
        next: ({ organization, summary }) => {
          this.organization = organization.data;
          this.summary = summary.data;
          this.loading = false;
          this.cdr.markForCheck();
        },
        error: () => {
          this.organization = null;
          this.summary = null;
          this.loadError = 'Could not load organization. Please try again.';
          this.loading = false;
          this.cdr.markForCheck();
        },
      });
  }

  private refreshHeader(): void {
    if (!this.organizationId) {
      return;
    }

    forkJoin({
      organization: this.api.getOrganization(this.organizationId, 'category,type,settings'),
      summary: this.api.getOrganizationSummary(this.organizationId),
    })
      .pipe(takeUntil(this.destroy$))
      .subscribe({
        next: ({ organization, summary }) => {
          this.organization = organization.data;
          this.summary = summary.data;
          this.cdr.markForCheck();
        },
      });
  }

  private ensureTaxonomiesLoaded(done: () => void): void {
    if (this.categories.length && this.types.length) {
      done();
      return;
    }

    forkJoin({
      categories: this.api.listCategories({ is_active: true, per_page: 100 }),
      types: this.api.listTypes({ is_active: true, per_page: 100 }),
    })
      .pipe(takeUntil(this.destroy$))
      .subscribe({
        next: ({ categories, types }) => {
          this.categories = categories.data;
          this.types = types.data;
          done();
          this.cdr.markForCheck();
        },
        error: () => {
          this.toastService.error('Could not load categories and types. Please try again.');
          this.cdr.markForCheck();
        },
      });
  }

  private patchFormFromOrganization(org: Organization): void {
    const links = org.social_links;
    this.form.patchValue({
      code: org.code,
      name: org.name,
      short_name: org.short_name ?? '',
      category_id: org.category_id,
      type_id: org.type_id,
      description: org.description ?? '',
      vision: org.vision ?? '',
      mission: org.mission ?? '',
      objectives: org.objectives ?? '',
      patron_saint: org.patron_saint ?? '',
      established_date: org.established_date ?? '',
      theme_color: org.theme_color ?? '',
      email: org.email ?? '',
      phone: org.phone ?? '',
      website: org.website ?? '',
      facebook: links?.facebook ?? '',
      instagram: links?.instagram ?? '',
      whatsapp: links?.whatsapp ?? '',
      youtube: links?.youtube ?? '',
      telegram: links?.telegram ?? '',
      status: org.status,
      allow_multi_role_holding: !!org.settings?.allow_multi_role_holding,
      guests_can_hold_office: !!org.settings?.guests_can_hold_office,
    });
  }

  private buildPayload(): UpdateOrganizationPayload {
    const raw = this.form.getRawValue();
    const socialLinks = {
      facebook: raw.facebook.trim() || null,
      instagram: raw.instagram.trim() || null,
      whatsapp: raw.whatsapp.trim() || null,
      youtube: raw.youtube.trim() || null,
      telegram: raw.telegram.trim() || null,
    };
    const hasSocial = Object.values(socialLinks).some((value) => !!value);

    const payload: UpdateOrganizationPayload = {
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
      social_links: hasSocial
        ? socialLinks
        : {
            facebook: null,
            instagram: null,
            whatsapp: null,
            youtube: null,
            telegram: null,
          },
    };

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
          : field.startsWith('settings.')
            ? field.slice('settings.'.length)
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
