import { CommonModule } from '@angular/common';
import { Component, inject, signal } from '@angular/core';
import { ActivatedRoute, RouterModule } from '@angular/router';
import { AuthService } from '@core/services/auth.service';
import { CfEmptyStateComponent } from '@shared/components/cf-empty-state/cf-empty-state.component';
import { DataTableComponent } from '@shared/components/data-table/data-table.component';
import { ListToolbarComponent } from '@shared/components/list-toolbar/list-toolbar.component';
import { LoadingSkeletonComponent } from '@shared/components/loading-skeleton/loading-skeleton.component';
import { PageHeaderComponent } from '@shared/components/page-header/page-header.component';
import { CfActionIconComponent } from '@shared/components/cf-action-icon/cf-action-icon.component';
import { StatusBadgeComponent, StatusBadgeTone } from '@shared/components/status-badge/status-badge.component';
import { CfCurrencyPipe } from '@shared/pipes/cf-currency.pipe';
import { formatMassDayTime } from '../utils/mass-celebration-display';
import {
  MassIntentionsApiService,
  MassListReportRow,
  MassesSaidReportRow,
  OfferingsReportRow,
  RegisterRow,
  StillToSayReportRow,
} from '../services/mass-intentions-api.service';
import {
  massIntentionsDashboardBackLink,
  massIntentionsReportsBackLabel,
} from '../utils/mass-intentions-chrome-header.util';

type ReportTab =
  | 'canonical'
  | 'mass-list'
  | 'still-to-say'
  | 'offerings'
  | 'masses-said';

@Component({
  selector: 'app-mass-intentions-register-page',
  standalone: true,
  imports: [
    CommonModule,
    RouterModule,
    PageHeaderComponent,
    CfCurrencyPipe,
    ListToolbarComponent,
    DataTableComponent,
    LoadingSkeletonComponent,
    CfEmptyStateComponent,
    StatusBadgeComponent,
    CfActionIconComponent,
  ],
  templateUrl: './mass-intentions-register.page.html',
  styleUrl: './mass-intentions-register.page.scss',
})
export class MassIntentionsRegisterPageComponent {
  readonly dashboardBackLink = massIntentionsDashboardBackLink();
  readonly dashboardBackLabel = massIntentionsReportsBackLabel();

  private readonly api = inject(MassIntentionsApiService);
  private readonly auth = inject(AuthService);
  private readonly route = inject(ActivatedRoute);

  readonly loading = signal(true);
  readonly reportSearch = signal('');
  readonly activeTab = signal<ReportTab>('canonical');
  readonly formatMassDayTime = formatMassDayTime;
  readonly canonical = signal<RegisterRow[]>([]);
  readonly massList = signal<MassListReportRow[]>([]);
  readonly stillToSay = signal<StillToSayReportRow[]>([]);
  readonly offerings = signal<OfferingsReportRow[]>([]);
  readonly massesSaid = signal<MassesSaidReportRow[]>([]);
  readonly massListRangeLabel = signal('');

  private readonly allTabs: { id: ReportTab; label: string; needsOfferings?: boolean }[] = [
    { id: 'canonical', label: 'Canonical register' },
    { id: 'mass-list', label: 'Mass list' },
    { id: 'still-to-say', label: 'Still to say' },
    { id: 'offerings', label: 'Offerings', needsOfferings: true },
    { id: 'masses-said', label: 'Masses said' },
  ];

  private readonly tabBlurbs: Record<ReportTab, string> = {
    canonical: 'Names, intentions, and progress for the canonical parish register.',
    'mass-list': 'Upcoming Masses and how many intentions are on each one.',
    'still-to-say': 'Intentions that still need to be said at Mass.',
    offerings: 'Stipends and offerings recorded with receipts.',
    'masses-said': 'Intentions already said, with Mass day and celebrant.',
  };

  visibleTabs(): { id: ReportTab; label: string }[] {
    const canMoney = this.auth.hasPermission('mass.intentions.offerings.view');
    return this.allTabs.filter((t) => !t.needsOfferings || canMoney);
  }

  constructor() {
    const tab = this.route.snapshot.queryParamMap.get('tab');
    const allowed = this.visibleTabs().some((item) => item.id === tab);
    const initial = allowed ? (tab as ReportTab) : 'canonical';
    this.activeTab.set(initial);
    this.loadTab(initial);
  }

  tabBlurb(): string {
    const base = this.tabBlurbs[this.activeTab()];
    if (this.activeTab() === 'mass-list' && this.massListRangeLabel()) {
      return `${base} ${this.massListRangeLabel()}`;
    }
    return base;
  }

  filteredRowCount(): number {
    return this.currentFilteredRows().length;
  }

  totalRowCount(): number {
    return this.currentRawRows().length;
  }

  resultsSummary(): string {
    const shown = this.filteredRowCount();
    const total = this.totalRowCount();
    let summary =
      shown === total
        ? `${shown} ${shown === 1 ? 'row' : 'rows'}`
        : `${shown} of ${total} rows`;
    if (this.activeTab() === 'mass-list' && this.massListRangeLabel()) {
      summary += ` ${this.massListRangeLabel()}`;
    }
    return summary;
  }

  selectTab(id: ReportTab): void {
    this.activeTab.set(id);
    this.reportSearch.set('');
    this.loadTab(id);
  }

  massStatusLabel(status?: string): string {
    if (status === 'cancelled') {
      return 'Cancelled';
    }
    if (status === 'scheduled') {
      return 'Scheduled';
    }
    return status ?? '—';
  }

  massStatusTone(status?: string): StatusBadgeTone {
    if (status === 'cancelled') {
      return 'neutral';
    }
    return 'info';
  }

  private matches(term: string, ...parts: (string | null | undefined)[]): boolean {
    const q = term.trim().toLowerCase();
    if (!q) {
      return true;
    }
    return parts.some((p) => (p ?? '').toLowerCase().includes(q));
  }

  filteredCanonical(): RegisterRow[] {
    const q = this.reportSearch();
    return this.canonical().filter((r) => this.matches(q, r.beneficiary_name, r.intention_text));
  }

  filteredMassList(): MassListReportRow[] {
    const q = this.reportSearch();
    return this.massList().filter((r) =>
      this.matches(q, r.place, r.celebrant_name, r.celebrated_on)
    );
  }

  filteredStillToSay(): StillToSayReportRow[] {
    const q = this.reportSearch();
    return this.stillToSay().filter((r) => this.matches(q, r.beneficiary_name, r.intention_text));
  }

  filteredOfferings(): OfferingsReportRow[] {
    const q = this.reportSearch();
    return this.offerings().filter((r) => this.matches(q, r.beneficiary_name, r.receipt_number));
  }

  filteredMassesSaid(): MassesSaidReportRow[] {
    const q = this.reportSearch();
    return this.massesSaid().filter((r) => this.matches(q, r.beneficiary_name, r.intention_text));
  }

  print(): void {
    window.print();
  }

  canSeeOfferings(): boolean {
    return this.auth.hasPermission('mass.intentions.offerings.view');
  }

  downloadLedgerBridge(): void {
    this.api.getDonationsLedgerBridge().subscribe({
      next: (res) => {
        const blob = new Blob([JSON.stringify({ data: res.data, meta: res.meta }, null, 2)], {
          type: 'application/json',
        });
        const url = URL.createObjectURL(blob);
        const anchor = document.createElement('a');
        anchor.href = url;
        anchor.download = 'mass-offerings-ledger-bridge.json';
        anchor.click();
        URL.revokeObjectURL(url);
      },
    });
  }

  private currentFilteredRows(): unknown[] {
    switch (this.activeTab()) {
      case 'canonical':
        return this.filteredCanonical();
      case 'mass-list':
        return this.filteredMassList();
      case 'still-to-say':
        return this.filteredStillToSay();
      case 'offerings':
        return this.filteredOfferings();
      case 'masses-said':
        return this.filteredMassesSaid();
      default:
        return [];
    }
  }

  private currentRawRows(): unknown[] {
    switch (this.activeTab()) {
      case 'canonical':
        return this.canonical();
      case 'mass-list':
        return this.massList();
      case 'still-to-say':
        return this.stillToSay();
      case 'offerings':
        return this.offerings();
      case 'masses-said':
        return this.massesSaid();
      default:
        return [];
    }
  }

  private isoDate(d: Date): string {
    const y = d.getFullYear();
    const m = String(d.getMonth() + 1).padStart(2, '0');
    const day = String(d.getDate()).padStart(2, '0');
    return `${y}-${m}-${day}`;
  }

  private formatRangeLabel(from: string, to: string): string {
    return `(from ${from} through ${to})`;
  }

  private loadTab(tab: ReportTab): void {
    this.loading.set(true);
    const done = (): void => this.loading.set(false);

    switch (tab) {
      case 'canonical':
        this.api.getCanonicalRegister().subscribe({
          next: (res) => {
            this.canonical.set(res.data ?? []);
            done();
          },
          error: done,
        });
        break;
      case 'mass-list': {
        const today = new Date();
        const from = this.isoDate(today);
        const toDate = new Date(today);
        toDate.setDate(toDate.getDate() + 14);
        const to = this.isoDate(toDate);
        this.massListRangeLabel.set(this.formatRangeLabel(from, to));
        this.api.getMassListReport(from, to).subscribe({
          next: (res) => {
            this.massList.set(res.data ?? []);
            done();
          },
          error: done,
        });
        break;
      }
      case 'still-to-say':
        this.api.getStillToSayReport().subscribe({
          next: (res) => {
            this.stillToSay.set(res.data ?? []);
            done();
          },
          error: done,
        });
        break;
      case 'offerings':
        this.api.getOfferingsReport().subscribe({
          next: (res) => {
            this.offerings.set(res.data ?? []);
            done();
          },
          error: done,
        });
        break;
      case 'masses-said':
        this.api.getMassesSaidReport().subscribe({
          next: (res) => {
            this.massesSaid.set(res.data ?? []);
            done();
          },
          error: done,
        });
        break;
    }
  }
}
