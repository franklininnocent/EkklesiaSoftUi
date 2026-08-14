import { Component, OnDestroy, OnInit, ChangeDetectionStrategy, ChangeDetectorRef } from '@angular/core';
import { CommonModule, DatePipe } from '@angular/common';
import { ActivatedRoute, Router } from '@angular/router';
import { SacramentService } from '../../services/sacrament.service';
import { Sacrament, SacramentCertificate } from '../../models/sacrament.model';
import { ToastService } from '@core/services/toast.service';
import { Store } from '@ngrx/store';
import { AppState } from '@core/store';
import { selectCurrentTenant } from '@core/store/tenant/tenant.selectors';
import { Subject, takeUntil } from 'rxjs';
import { TenantService } from '@core/services/tenant.service';
import { PageHeaderComponent } from '@shared/components/page-header/page-header.component';
import { StatusBadgeComponent, StatusBadgeTone } from '@shared/components/status-badge/status-badge.component';

@Component({
  selector: 'app-sacrament-detail',
  standalone: true,
  imports: [CommonModule, PageHeaderComponent, StatusBadgeComponent],
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
  certificates: SacramentCertificate[] = [];
  certificateBusy = false;
  previewProjection: Record<string, unknown> | null = null;
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
            this.loadCertificates();
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

  loadCertificates(): void {
    if (!this.sacramentId) {
      return;
    }
    this.sacramentService.listCertificates(this.sacramentId)
      .pipe(takeUntil(this.destroy$))
      .subscribe({
        next: (response) => {
          this.certificates = response.data ?? [];
          this.cdr.markForCheck();
        },
        error: () => {
          this.certificates = [];
          this.cdr.markForCheck();
        },
      });
  }

  supportsOfficialCertificate(): boolean {
    const code = (this.sacrament?.sacrament_type?.code || '').toUpperCase().trim();
    const supported = [
      'BAPTISM',
      'MATRIMONY',
      'MARRIAGE',
      'WEDDING',
      'CONFIRMATION',
      'EUCHARIST',
      'FIRST_COMMUNION',
      'ANOINTING',
      'HOLY_ORDERS',
    ];
    return supported.includes(code);
  }

  latestIssued(): SacramentCertificate | null {
    return this.certificates.find((c) => c.status === 'issued') || null;
  }

  detailTitle(): string {
    if (!this.sacrament) {
      return 'Sacrament record';
    }
    return this.sacrament.recipient_name || this.sacrament.sacrament_type?.name || 'Sacrament record';
  }

  detailSubtitle(): string {
    if (!this.sacrament) {
      return '';
    }
    const type = this.sacrament.sacrament_type?.name || 'Sacrament';
    const date = this.formatDate(this.sacrament.date_administered);
    return date ? `${type} · ${date}` : type;
  }

  certificateStatusLabel(status: string | undefined | null): string {
    switch ((status || '').toLowerCase()) {
      case 'draft_preview':
        return 'Preview';
      case 'issued':
        return 'Issued';
      case 'superseded':
        return 'Superseded';
      case 'voided':
        return 'Voided';
      default:
        return status ? String(status) : 'Unknown';
    }
  }

  certificateStatusTone(status: string | undefined | null): StatusBadgeTone {
    switch ((status || '').toLowerCase()) {
      case 'issued':
        return 'success';
      case 'draft_preview':
        return 'info';
      case 'superseded':
        return 'neutral';
      case 'voided':
        return 'critical';
      default:
        return 'neutral';
    }
  }

  /**
   * Human-readable fields from certificate preview projection (no raw JSON).
   */
  previewField(
    projection: Record<string, unknown>,
    key: 'recipient' | 'type' | 'date' | 'certificate_number' | 'status_label' | 'status_raw'
  ): string {
    const sacrament = (projection['sacrament'] as Record<string, unknown> | undefined) || {};
    const participants = Array.isArray(projection['participants'])
      ? (projection['participants'] as Array<Record<string, unknown>>)
      : [];

    switch (key) {
      case 'recipient': {
        const fromParticipant = participants.find((p) => {
          const role = String(p['role'] || '').toLowerCase();
          return role === 'recipient' || role === 'candidate';
        });
        const name =
          (fromParticipant?.['display_name'] as string | undefined) ||
          (sacrament['recipient_name'] as string | undefined) ||
          this.sacrament?.recipient_name;
        return name || '—';
      }
      case 'type':
        return (
          (sacrament['type_name'] as string | undefined) ||
          this.sacrament?.sacrament_type?.name ||
          '—'
        );
      case 'date': {
        const raw =
          (sacrament['date_administered'] as string | undefined) ||
          this.sacrament?.date_administered;
        return this.formatDate(raw) || '—';
      }
      case 'certificate_number':
        return (
          (sacrament['certificate_number'] as string | undefined) ||
          this.sacrament?.certificate_number ||
          '—'
        );
      case 'status_raw':
        // Preview panel always reflects a draft certificate projection.
        return 'draft_preview';
      case 'status_label':
        return this.certificateStatusLabel('draft_preview');
      default:
        return '—';
    }
  }

  onPreviewCertificate(): void {
    if (!this.sacramentId || this.certificateBusy) {
      return;
    }
    this.certificateBusy = true;
    this.sacramentService.previewCertificate(this.sacramentId)
      .pipe(takeUntil(this.destroy$))
      .subscribe({
        next: (response) => {
          this.previewProjection = (response.data.projection as Record<string, unknown>) || null;
          this.toastService.success('Preview ready. Generate to issue an official copy.');
          this.loadCertificates();
          this.certificateBusy = false;
          this.cdr.markForCheck();
        },
        error: (error) => {
          this.toastService.error(error?.message || 'Failed to preview certificate.');
          this.certificateBusy = false;
          this.cdr.markForCheck();
        },
      });
  }

  onGenerateCertificate(): void {
    if (!this.sacramentId || this.certificateBusy) {
      return;
    }
    this.certificateBusy = true;
    this.sacramentService.generateCertificate(this.sacramentId)
      .pipe(takeUntil(this.destroy$))
      .subscribe({
        next: () => {
          this.toastService.success('Official certificate generated.');
          this.previewProjection = null;
          this.loadCertificates();
          this.certificateBusy = false;
          this.cdr.markForCheck();
        },
        error: (error) => {
          this.toastService.error(error?.message || 'Failed to generate certificate.');
          this.certificateBusy = false;
          this.cdr.markForCheck();
        },
      });
  }

  onDownloadCertificate(cert: SacramentCertificate): void {
    if (this.certificateBusy || cert.status === 'draft_preview') {
      return;
    }
    this.certificateBusy = true;
    this.sacramentService.downloadCertificate(cert.id)
      .pipe(takeUntil(this.destroy$))
      .subscribe({
        next: (blob) => {
          const url = URL.createObjectURL(blob);
          const a = document.createElement('a');
          a.href = url;
          a.download = `sacrament-certificate-${cert.sacrament_id}-v${cert.version}.pdf`;
          a.click();
          URL.revokeObjectURL(url);
          this.toastService.success('Download started.');
          this.certificateBusy = false;
          this.cdr.markForCheck();
        },
        error: (error) => {
          this.toastService.error(error?.message || 'Failed to download certificate.');
          this.certificateBusy = false;
          this.cdr.markForCheck();
        },
      });
  }

  onReissueCertificate(cert: SacramentCertificate): void {
    if (this.certificateBusy) {
      return;
    }
    this.certificateBusy = true;
    this.sacramentService.reissueCertificate(cert.id)
      .pipe(takeUntil(this.destroy$))
      .subscribe({
        next: () => {
          this.toastService.success('Certificate reissued.');
          this.loadCertificates();
          this.certificateBusy = false;
          this.cdr.markForCheck();
        },
        error: (error) => {
          this.toastService.error(error?.message || 'Failed to reissue certificate.');
          this.certificateBusy = false;
          this.cdr.markForCheck();
        },
      });
  }

  onBack(): void {
    this.router.navigate(['/sacraments']);
  }

  onEdit(): void {
    if (this.sacrament) {
      // Open registry list modal — legacy /edit/:id form is retired (UX-0).
      this.router.navigate(['/sacraments'], {
        queryParams: { edit: this.sacrament.id },
      });
    }
  }

  onPrint(): void {
    window.print();
  }

  /**
   * Export to PDF
   */
  onExportPDF(): void {
    window.print();
  }

  /**
   * Export to Excel (CSV)
   */
  onExportExcel(): void {
    if (!this.sacrament) {
      return;
    }

    const headers = ['Field', 'Value'];
    const rows = [
      ['Recipient', this.sacrament.recipient_name || ''],
      ['Sacrament Type', this.sacrament.sacrament_type?.name || ''],
      ['Date Administered', this.formatDate(this.sacrament.date_administered)],
      ['Place Administered', this.sacrament.place_administered || ''],
      ['Minister Name', this.sacrament.minister_name || ''],
      ['Minister Title', this.sacrament.minister_title || ''],
      ['Certificate Number', this.sacrament.certificate_number || ''],
      ['Book Number', this.sacrament.book_number || ''],
      ['Page Number', this.sacrament.page_number || ''],
      ['Status', this.sacrament.status || ''],
      ['Notes', this.sacrament.notes || '']
    ];

    const csvContent = [
      headers.join(','),
      ...rows.map(row => row.map(cell => `"${String(cell).replace(/"/g, '""')}"`).join(','))
    ].join('\n');

    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
    const link = document.createElement('a');
    const url = URL.createObjectURL(blob);
    link.setAttribute('href', url);
    link.setAttribute('download', `sacrament_${this.sacrament.id}_${new Date().toISOString().split('T')[0]}.csv`);
    link.style.visibility = 'hidden';
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  }

  getStatusBadgeClass(status: string): string {
    const baseClass = 'status-badge';
    switch (status) {
      case 'registered':
      case 'active':
        return `${baseClass} status-active`;
      case 'voided':
      case 'cancelled':
        return `${baseClass} status-cancelled`;
      case 'conditional':
        return `${baseClass} status-conditional`;
      case 'conditional': return `${baseClass} status-conditional`;
      default: return baseClass;
    }
  }

  /**
   * Check if sacrament type is Marriage
   */
  isMarriage(): boolean {
    if (!this.sacrament?.sacrament_type) return false;
    const code = (this.sacrament.sacrament_type.code || '').toString().toUpperCase().trim();
    const name = (this.sacrament.sacrament_type.name || '').toString().toUpperCase().trim();
    const marriageCodes = ['MARRIAGE', 'MATRIMONY', 'WEDDING'];
    return marriageCodes.includes(code) || marriageCodes.some(mc => name.includes(mc));
  }

  /**
   * Check if sacrament type is Baptism
   */
  isBaptism(): boolean {
    if (!this.sacrament?.sacrament_type) return false;
    const code = (this.sacrament.sacrament_type.code || '').toString().toUpperCase().trim();
    const name = (this.sacrament.sacrament_type.name || '').toString().toUpperCase().trim();
    const baptismCodes = ['BAPTISM', 'BAPTISMO', 'BAPTIMAL', 'BAPTISE'];
    return baptismCodes.includes(code) || baptismCodes.some(bc => name.includes(bc));
  }

  /**
   * Get the church/parish name for display
   */
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
            const profile = response.data;
            this.churchProfileName = profile.name || null;
            const officialAddress =
              profile.addresses?.find((addr: any) => addr.address_type === 'official') ||
              profile.addresses?.[0] ||
              null;
            this.churchProfileAddress = this.formatAddress(officialAddress);
          }
          this.cdr.markForCheck();
        },
        error: () => {
          this.churchProfileName = null;
          this.churchProfileAddress = null;
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

  /**
   * Format date for display
   */
  formatDate(date: string | Date | null | undefined): string {
    if (!date) return '';
    return this.datePipe.transform(date, 'MMMM d, yyyy') || '';
  }
}


