import { CommonModule } from '@angular/common';
import { ChangeDetectorRef, Component, DestroyRef, OnInit } from '@angular/core';
import { FormBuilder, ReactiveFormsModule, Validators } from '@angular/forms';
import { Router } from '@angular/router';
import { AuthService } from '@core/services/auth.service';
import { LoadingSkeletonComponent } from '@shared/components/loading-skeleton/loading-skeleton.component';
import { PageHeaderComponent } from '@shared/components/page-header/page-header.component';
import { DonationsService } from '../services/donations.service';
import { FinancialAiStatus } from '../models/donation.model';
import { refreshStewardshipView, setupStewardshipRouteReload } from '../utils/stewardship-view.util';

@Component({
  selector: 'app-donations-settings',
  standalone: true,
  imports: [CommonModule, ReactiveFormsModule, LoadingSkeletonComponent, PageHeaderComponent],
  templateUrl: './donations-settings.component.html',
  styleUrl: './donations-settings.component.scss'
})
export class DonationsSettingsComponent implements OnInit {
  saving = false;
  message = '';
  canEditSettings = false;
  settingsLoaded = false;
  aiStatus: FinancialAiStatus | null = null;

  form = this.fb.group({
    default_currency: ['INR', Validators.required],
    financial_year_start_month: ['01', Validators.required],
    financial_year_start_day: ['01', Validators.required],
    tax_registration_number: [''],
    tax_acknowledgement_note: [''],
    receipt_prefix_enabled: [true],
    receipt_prefix: ['RCPT', Validators.required],
    upi_vpa: [''],
    upi_payee_name: [''],
    financial_ai_llm_enabled: [true],
    metadata: this.fb.control<Record<string, unknown>>({})
  });

  constructor(
    private fb: FormBuilder,
    private donationsService: DonationsService,
    private authService: AuthService,
    private router: Router,
    private cdr: ChangeDetectorRef,
    private destroyRef: DestroyRef
  ) {}

  ngOnInit(): void {
    this.canEditSettings = this.authService.hasPermission('church.settings.edit');
    if (this.canEditSettings) {
      this.loadSettings();
      setupStewardshipRouteReload(this.router, this.destroyRef, '/donations/settings', () => this.loadSettings());
    } else {
      this.settingsLoaded = true;
    }
  }

  private loadSettings(): void {
    this.settingsLoaded = false;
    refreshStewardshipView(this.cdr);
    let pending = 2;
    const finish = () => {
      pending -= 1;
      if (pending <= 0) {
        this.settingsLoaded = true;
        refreshStewardshipView(this.cdr);
      }
    };

    this.donationsService.getFinancialAiStatus().subscribe({
      next: (res) => {
        this.aiStatus = res.data;
        finish();
      },
      error: () => finish()
    });
    this.donationsService.getSettings().subscribe({
      next: (res) => {
        if (res.data) {
          const metadata = (res.data.metadata ?? {}) as Record<string, unknown>;
          this.form.patchValue({
            ...res.data,
            upi_vpa: String(metadata['upi_vpa'] ?? ''),
            upi_payee_name: String(metadata['upi_payee_name'] ?? ''),
            financial_ai_llm_enabled: metadata['financial_ai_llm_enabled'] !== false
          });
        }
        finish();
      },
      error: () => finish()
    });
  }

  get settingsDecisionHint(): string {
    if (!this.form.value.upi_vpa) {
      return 'Add UPI VPA to enable QR collection in Quick Collect and Collection Day.';
    }
    if (this.aiStatus && !this.aiStatus.whatsapp_business_enabled) {
      return 'WhatsApp uses manual wa.me links until Business API credentials are configured.';
    }
    return 'Changes apply parish-wide to receipts, collection, and AI assistant.';
  }

  save(): void {
    if (!this.canEditSettings) return;
    if (this.form.invalid) return;
    this.saving = true;
    this.message = '';
    const raw = this.form.getRawValue();
    const payload = {
      ...raw,
      metadata: {
        ...(raw.metadata ?? {}),
        upi_vpa: raw.upi_vpa,
        upi_payee_name: raw.upi_payee_name,
        financial_ai_llm_enabled: raw.financial_ai_llm_enabled
      }
    };
    delete (payload as Record<string, unknown>)['upi_vpa'];
    delete (payload as Record<string, unknown>)['upi_payee_name'];
    delete (payload as Record<string, unknown>)['financial_ai_llm_enabled'];
    this.donationsService.updateSettings(payload as Record<string, unknown>).subscribe({
      next: () => {
        this.saving = false;
        this.message = 'Settings saved.';
        this.donationsService.getFinancialAiStatus().subscribe({
          next: (res) => {
            this.aiStatus = res.data;
            refreshStewardshipView(this.cdr);
          }
        });
        refreshStewardshipView(this.cdr);
      },
      error: () => {
        this.saving = false;
        this.message = 'Failed to save settings.';
        refreshStewardshipView(this.cdr);
      }
    });
  }
}
