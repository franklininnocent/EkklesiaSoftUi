import { Component, OnDestroy, OnInit, ChangeDetectionStrategy, ChangeDetectorRef } from '@angular/core';
import { CommonModule, DatePipe } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { ActivatedRoute, Router } from '@angular/router';
import { SacramentService } from '../../services/sacrament.service';
import {
  Sacrament,
  SacramentCertificate,
  SacramentCertificateDownloadHistoryItem,
} from '../../models/sacrament.model';
import { ToastService } from '@core/services/toast.service';
import { Store } from '@ngrx/store';
import { AppState } from '@core/store';
import { selectCurrentTenant } from '@core/store/tenant/tenant.selectors';
import { Subject, switchMap, takeUntil } from 'rxjs';
import { TenantService } from '@core/services/tenant.service';
import { PageHeaderComponent } from '@shared/components/page-header/page-header.component';
import { CfEmptyStateComponent } from '@shared/components/cf-empty-state/cf-empty-state.component';
import { ChurchMetadata, PaperSize, SacramentCertificateData } from '../../certificates/models/certificate';
import { mapChurchDenominationCode } from '../../certificates/denomination/denomination.mapper';
import { mapDbSacramentToEngineType } from '../../certificates/denomination/capabilities';
import { mapProjectionToCertificateData } from '../../certificates/mappers/certificate-view.mapper';
import { mapLiveSacramentToCertificateData } from '../../certificates/mappers/live-sacrament.mapper';
import { liturgicalTerminology } from '../../certificates/terminology/en.catalog';
import { SacramentalCertificateComponent } from '../../certificates/layout/sacramental-certificate.component';

const SACRAMENT_VIEW_TYPE_CODES = new Set([
  'BAPTISM',
  'CONFIRMATION',
  'MATRIMONY',
  'MARRIAGE',
  'WEDDING',
  'EUCHARIST',
  'FIRST_COMMUNION',
  'FIRST_HOLY_COMMUNION',
  'RECONCILIATION',
  'CONFESSION',
  'PENANCE',
  'ANOINTING',
  'ANOINTING_SICK',
  'ANOINTINGOFTHESICK',
  'HOLY_ORDERS',
  'HOLYORDERS',
  'ORDINATION',
]);

@Component({
  selector: 'app-sacrament-detail',
  standalone: true,
  imports: [
    CommonModule,
    FormsModule,
    PageHeaderComponent,
    CfEmptyStateComponent,
    SacramentalCertificateComponent,
  ],
  templateUrl: './sacrament-detail.component.html',
  styleUrl: './sacrament-detail.component.scss',
  providers: [DatePipe],
  changeDetection: ChangeDetectionStrategy.OnPush
})
export class SacramentDetailComponent implements OnInit, OnDestroy {
  sacrament: Sacrament | null = null;
  loading = false;
  sacramentId: number | null = null;
  tenantName: string | null = null;
  churchProfileName: string | null = null;
  churchProfileAddress: string | null = null;
  churchProfileDiocese: string | null = null;
  churchDenominationCode = 'GENERIC';
  latestCertificateRecord: SacramentCertificate | null = null;
  downloadHistory: SacramentCertificateDownloadHistoryItem[] = [];
  certificateBusy = false;
  previewProjection: Record<string, unknown> | null = null;
  previewVersionLabel: string | null = null;
  isPreviewVisible = false;
  certView: SacramentCertificateData | null = null;
  readonly paper: PaperSize = 'A4';
  annotationBusy = false;
  annotationDraft = {
    annotation_type: '',
    effective_date: '',
    granting_authority: '',
    protocol_number: '',
    notes: '',
  };
  readonly annotationTypeOptions: Array<{ value: string; label: string }> = [
    { value: 'baptismal_register_notation', label: 'Noted in baptismal register' },
    { value: 'convalidation', label: 'Convalidation' },
    { value: 'declaration_of_nullity', label: 'Declaration of nullity' },
    { value: 'legitimate_dissolution', label: 'Legitimate dissolution' },
  ];
  private destroy$ = new Subject<void>();

  constructor(
    private sacramentService: SacramentService,
    private toastService: ToastService,
    private router: Router,
    private route: ActivatedRoute,
    private datePipe: DatePipe,
    private store: Store<AppState>,
    private tenantService: TenantService,
    private cdr: ChangeDetectorRef
  ) {}

  ngOnInit(): void {
    const id = this.route.snapshot.paramMap.get('id');
    if (id) {
      this.sacramentId = parseInt(id, 10);
      this.loadSacrament();
    }

    this.store.select(selectCurrentTenant)
      .pipe(takeUntil(this.destroy$))
      .subscribe((tenant) => {
        this.tenantName = tenant?.name || null;
        this.rebuildCertificateView();
        this.cdr.markForCheck();
      });

    this.loadChurchProfile();
  }

  ngOnDestroy(): void {
    this.destroy$.next();
    this.destroy$.complete();
  }

  loadSacrament(): void {
    if (!this.sacramentId) return;

    this.loading = true;
    this.cdr.markForCheck();
    this.sacramentService.getSacrament(this.sacramentId)
      .pipe(takeUntil(this.destroy$))
      .subscribe({
        next: (response) => {
          if (response.success) {
            this.sacrament = response.data;
            this.loadCertificateViewDetails();
          }
          this.loading = false;
          this.cdr.markForCheck();
        },
        error: (error) => {
          console.error('Error loading sacrament:', error);
          this.toastService.error('Failed to load sacrament details.');
          this.loading = false;
          this.cdr.markForCheck();
          this.router.navigate(['/sacraments']);
        }
      });
  }

  loadCertificateViewDetails(): void {
    if (!this.sacramentId) {
      return;
    }
    this.sacramentService.getCertificateViewDetails(this.sacramentId)
      .pipe(takeUntil(this.destroy$))
      .subscribe({
        next: (response) => {
          this.latestCertificateRecord = response.data.latest_certificate;
          this.downloadHistory = response.data.download_history ?? [];
          if (this.latestCertificateRecord?.projection) {
            this.applyCertificatePreview(this.latestCertificateRecord);
          } else if (response.data.live_projection) {
            this.previewProjection = response.data.live_projection as Record<string, unknown>;
            this.previewVersionLabel = 'Live preview';
            this.rebuildCertificateView();
          } else {
            this.refreshLiveCertificateView();
          }
          this.isPreviewVisible = !!this.certView;
          this.cdr.markForCheck();
        },
        error: () => {
          this.latestCertificateRecord = null;
          this.downloadHistory = [];
          this.refreshLiveCertificateView();
          this.isPreviewVisible = !!this.certView;
          this.cdr.markForCheck();
        },
      });
  }

  supportsOfficialCertificate(): boolean {
    const code = (this.sacrament?.sacrament_type?.code || '').toUpperCase().trim();
    return SACRAMENT_VIEW_TYPE_CODES.has(code);
  }

  latestIssued(): SacramentCertificate | null {
    return this.latestCertificateRecord;
  }

  private applyCertificatePreview(cert: SacramentCertificate | null): boolean {
    if (!cert?.projection) {
      return false;
    }
    this.previewProjection = cert.projection as Record<string, unknown>;
    const templateVersion = cert.template_version || '1.1.0';
    this.previewVersionLabel = `v${templateVersion.replace(/^v/i, '')}`;
    this.rebuildCertificateView();
    return true;
  }

  private scrollToCertificatePreview(): void {
    if (typeof document === 'undefined') {
      return;
    }
    document.getElementById('certificate-preview')?.scrollIntoView({ behavior: 'smooth', block: 'start' });
  }

  certificateTypeBadge(): string {
    if (!this.sacrament?.sacrament_type) {
      return 'Sacramental Certificate';
    }
    const church = this.churchMetadata();
    const engineType = mapDbSacramentToEngineType(
      this.sacrament.sacrament_type.code || '',
      church.denominationType
    );
    return liturgicalTerminology(church.denominationType, engineType).sacramentTitle;
  }

  detailSubtitle(): string {
    if (!this.sacrament) {
      return '';
    }
    const date = this.formatDate(this.sacrament.date_administered);
    const record = `Record #${this.sacrament.id}`;
    return date ? `${record} · ${date}` : record;
  }

  onPreviewCertificate(): void {
    if (this.certificateBusy || !this.supportsOfficialCertificate()) {
      return;
    }
    this.ensureCertificateView();
    this.isPreviewVisible = true;
    this.scrollToCertificatePreview();
    this.cdr.markForCheck();
  }

  formatDate(date: string | Date | null | undefined): string {
    if (!date) return '';
    return this.datePipe.transform(date, 'MMMM d, yyyy') || '';
  }

  formatDateTime(date: string | Date | null | undefined): string {
    if (!date) return '—';
    return this.datePipe.transform(date, 'dd MMM yyyy, hh:mm a') || '—';
  }

  formatHistoryVersion(item: SacramentCertificateDownloadHistoryItem): string {
    const version = item.template_version || '1.1.0';
    return version.startsWith('v') ? version : `v${version}`;
  }

  displayValue(value: string | null | undefined): string {
    const trimmed = (value || '').trim();
    return trimmed || '—';
  }

  certificateDataIncomplete(): string | null {
    if (!this.sacrament || !this.supportsOfficialCertificate()) {
      return null;
    }
    if (this.isMarriage()) {
      const groom = (this.sacrament.marriage_groom_full_name || '').trim();
      const bride = (this.sacrament.marriage_bride_full_name || '').trim();
      if (!groom || !bride) {
        return 'Certificate data incomplete — please fill required register fields.';
      }
      return null;
    }
    const recipient = (this.sacrament.recipient_name || '').trim();
    if (!recipient) {
      return 'Certificate data incomplete — please fill required register fields.';
    }
    return null;
  }

  onDownloadCertificate(): void {
    if (!this.sacramentId || this.certificateBusy || !this.supportsOfficialCertificate()) {
      return;
    }
    this.certificateBusy = true;
    this.cdr.markForCheck();

    const triggerDownload = () => {
      const version = this.latestIssued()?.version ?? 1;
      this.sacramentService.downloadLatestCertificate(this.sacramentId!)
        .pipe(takeUntil(this.destroy$))
        .subscribe({
          next: (blob) => {
            const url = URL.createObjectURL(blob);
            const a = document.createElement('a');
            a.href = url;
            a.download = `sacrament-certificate-${this.sacramentId}-v${version}.pdf`;
            a.click();
            URL.revokeObjectURL(url);
            this.toastService.success('Download started.');
            this.certificateBusy = false;
            this.loadCertificateViewDetails();
          },
          error: (error) => {
            this.toastService.error(error?.message || 'Failed to download certificate.');
            this.certificateBusy = false;
            this.cdr.markForCheck();
          },
        });
    };

    if (this.latestIssued()) {
      triggerDownload();
      return;
    }

    this.sacramentService.generateCertificate(this.sacramentId)
      .pipe(
        takeUntil(this.destroy$),
        switchMap(() => this.sacramentService.getCertificateViewDetails(this.sacramentId!))
      )
      .subscribe({
        next: (response) => {
          this.latestCertificateRecord = response.data.latest_certificate;
          triggerDownload();
        },
        error: (error) => {
          this.toastService.error(error?.message || 'Failed to generate certificate.');
          this.certificateBusy = false;
          this.cdr.markForCheck();
        },
      });
  }

  churchMetadata(): ChurchMetadata {
    const denominationType = mapChurchDenominationCode(this.churchDenominationCode);
    return {
      name: this.getChurchName(),
      diocese: this.churchProfileDiocese,
      address: this.getChurchAddress(),
      logoUrl: null,
      denominationCode: this.churchDenominationCode,
      denominationType,
    };
  }

  private ensureCertificateView(): void {
    if (this.certView) {
      return;
    }
    if (this.latestCertificateRecord?.projection) {
      this.applyCertificatePreview(this.latestCertificateRecord);
      return;
    }
    this.refreshLiveCertificateView();
  }

  private refreshLiveCertificateView(): void {
    if (!this.sacrament || !this.supportsOfficialCertificate()) {
      this.certView = null;
      this.previewProjection = null;
      this.previewVersionLabel = null;
      return;
    }
    try {
      const mapped = mapLiveSacramentToCertificateData(this.sacrament, this.churchMetadata(), this.paper);
      mapped.paper = this.paper;
      this.certView = mapped;
      this.previewVersionLabel = 'Live preview';
      this.isPreviewVisible = true;
    } catch (error) {
      console.error('Failed to build live certificate view:', error);
      this.certView = null;
    }
  }

  private rebuildCertificateView(): void {
    try {
      const fromProjection = mapProjectionToCertificateData(this.previewProjection, {
        paper: this.paper,
        churchFallback: this.churchMetadata(),
      });
      if (fromProjection) {
        fromProjection.paper = this.paper;
        this.certView = fromProjection;
        this.isPreviewVisible = true;
        return;
      }
      this.refreshLiveCertificateView();
    } catch (error) {
      console.error('Failed to build certificate view:', error);
      this.refreshLiveCertificateView();
    }
  }

  isMarriage(): boolean {
    if (!this.sacrament?.sacrament_type) return false;
    const code = (this.sacrament.sacrament_type.code || '').toString().toUpperCase().trim();
    const name = (this.sacrament.sacrament_type.name || '').toString().toUpperCase().trim();
    const marriageCodes = ['MARRIAGE', 'MATRIMONY', 'WEDDING'];
    return marriageCodes.includes(code) || marriageCodes.some(mc => name.includes(mc));
  }

  marriageClassificationLabel(): string {
    switch (this.sacrament?.marriage_canonical_classification) {
      case 'both_catholic':
        return 'Both Catholic';
      case 'mixed_marriage':
        return 'Mixed marriage';
      case 'disparity_of_cult':
        return 'Disparity of cult';
      case 'other':
        return 'Other';
      default:
        return '';
    }
  }

  registerNotes(): NonNullable<Sacrament['canonical_annotations']> {
    return this.sacrament?.canonical_annotations || [];
  }

  addRegisterNote(): void {
    if (!this.sacramentId || !this.annotationDraft.annotation_type || this.annotationBusy) {
      return;
    }
    this.annotationBusy = true;
    this.cdr.markForCheck();
    this.sacramentService.createCanonicalAnnotation(this.sacramentId, {
      annotation_type: this.annotationDraft.annotation_type,
      effective_date: this.annotationDraft.effective_date || null,
      granting_authority: this.annotationDraft.granting_authority || null,
      protocol_number: this.annotationDraft.protocol_number || null,
      notes: this.annotationDraft.notes || null,
    }).pipe(takeUntil(this.destroy$)).subscribe({
      next: () => {
        this.annotationDraft = {
          annotation_type: '',
          effective_date: '',
          granting_authority: '',
          protocol_number: '',
          notes: '',
        };
        this.annotationBusy = false;
        this.toastService.success('Register note recorded. It stays in the parish register and is not printed on the certificate.');
        this.loadSacrament();
      },
      error: (error) => {
        this.annotationBusy = false;
        this.toastService.error(error?.message || 'Could not record this register note.');
        this.cdr.markForCheck();
      },
    });
  }

  removeRegisterNote(annotationId: number | undefined): void {
    if (!this.sacramentId || !annotationId || this.annotationBusy) {
      return;
    }
    this.annotationBusy = true;
    this.cdr.markForCheck();
    this.sacramentService.deleteCanonicalAnnotation(this.sacramentId, annotationId)
      .pipe(takeUntil(this.destroy$))
      .subscribe({
        next: () => {
          this.annotationBusy = false;
          this.toastService.success('Register note removed.');
          this.loadSacrament();
        },
        error: (error) => {
          this.annotationBusy = false;
          this.toastService.error(error?.message || 'Could not remove this register note.');
          this.cdr.markForCheck();
        },
      });
  }

  getChurchName(): string {
    return this.churchProfileName || this.tenantName || this.sacrament?.place_administered || 'Parish Church';
  }

  getChurchAddress(): string | null {
    return this.churchProfileAddress || null;
  }

  private loadChurchProfile(): void {
    this.tenantService.getChurchProfile()
      .pipe(takeUntil(this.destroy$))
      .subscribe({
        next: (response) => {
          if (response.success && response.data) {
            const profileData = response.data as typeof response.data & {
              church_profile?: { archdiocese?: { name?: string } };
              churchProfile?: { archdiocese?: { name?: string } };
            };
            const profile = profileData;
            this.churchProfileName = profile.name || null;
            this.churchDenominationCode = String(profile.denomination || 'GENERIC');
            const churchProfile = profile.church_profile ?? profile.churchProfile;
            this.churchProfileDiocese = churchProfile?.archdiocese?.name || null;
            const officialAddress =
              profile.addresses?.find((addr: any) => addr.address_type === 'official') ||
              profile.addresses?.[0] ||
              null;
            this.churchProfileAddress = this.formatAddress(officialAddress);
            this.rebuildCertificateView();
          }
          this.cdr.markForCheck();
        },
        error: () => {
          this.churchProfileName = null;
          this.churchProfileAddress = null;
          this.churchProfileDiocese = null;
          this.cdr.markForCheck();
        }
      });
  }

  private formatAddress(address: any): string | null {
    if (!address) return null;
    const parts: string[] = [];
    if (address.line1) parts.push(address.line1);
    if (address.line2) parts.push(address.line2);
    if (address.city) parts.push(address.city);
    if (address.state_province) parts.push(address.state_province);
    if (address.country) parts.push(address.country);
    if (address.pin_zip_code) parts.push(address.pin_zip_code);
    return parts.length ? parts.join(', ') : null;
  }
}
