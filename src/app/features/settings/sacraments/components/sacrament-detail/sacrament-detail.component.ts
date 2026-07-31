import { Component, OnDestroy, OnInit, ChangeDetectionStrategy, ChangeDetectorRef } from '@angular/core';
import { CommonModule, DatePipe } from '@angular/common';
import { ActivatedRoute, Router } from '@angular/router';
import { SacramentService } from '../../services/sacrament.service';
import { Sacrament } from '../../models/sacrament.model';
import { ToastService } from '@core/services/toast.service';
import { Store } from '@ngrx/store';
import { AppState } from '@core/store';
import { selectCurrentTenant } from '@core/store/tenant/tenant.selectors';
import { Subject, takeUntil } from 'rxjs';
import { TenantService } from '@core/services/tenant.service';

@Component({
  selector: 'app-sacrament-detail',
  standalone: true,
  imports: [CommonModule],
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
          }
          this.loading = false;
          this.cdr.markForCheck();
        },
        error: (error) => {
          console.error('Error loading sacrament:', error);
          this.toastService.error('Failed to load sacrament details.');
          this.loading = false;
          this.cdr.markForCheck();
          this.router.navigate(['/settings/sacraments']);
        }
      });
  }

  onBack(): void {
    this.router.navigate(['/settings/sacraments']);
  }

  onEdit(): void {
    if (this.sacrament) {
      this.router.navigate(['/settings/sacraments/edit', this.sacrament.id]);
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
      case 'active': return `${baseClass} status-active`;
      case 'cancelled': return `${baseClass} status-cancelled`;
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


