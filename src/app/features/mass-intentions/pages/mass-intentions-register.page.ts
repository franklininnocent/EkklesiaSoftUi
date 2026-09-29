import { CommonModule } from '@angular/common';
import { Component, inject, signal } from '@angular/core';
import { ActivatedRoute, RouterModule } from '@angular/router';
import { AuthService } from '@core/services/auth.service';
import { DataTableComponent } from '@shared/components/data-table/data-table.component';
import { ListToolbarComponent } from '@shared/components/list-toolbar/list-toolbar.component';
import { PageHeaderComponent } from '@shared/components/page-header/page-header.component';
import { formatMassDayTime } from '../utils/mass-celebration-display';
import { CfCurrencyPipe } from '@shared/pipes/cf-currency.pipe';
import {
  MassIntentionsApiService,
  MassListReportRow,
  MassesSaidReportRow,
  OfferingsReportRow,
  RegisterRow,
  StillToSayReportRow,
} from '../services/mass-intentions-api.service';

type ReportTab =
  | 'canonical'
  | 'mass-list'
  | 'still-to-say'
  | 'offerings'
  | 'masses-said';

@Component({
  selector: 'app-mass-intentions-register-page',
  standalone: true,
  imports: [CommonModule, RouterModule, PageHeaderComponent, CfCurrencyPipe, ListToolbarComponent, DataTableComponent],
  template: `
    <div class="cf-page">
      <app-page-header
        title="Reports"
        subtitle="Print-friendly lists for the parish register"
        [backLink]="['/mass-intentions']"
        backLabel="Dashboard"
      >
        <button type="button" class="cf-btn cf-btn-ghost" (click)="print()">Print</button>
        @if (canSeeOfferings()) {
          <button type="button" class="cf-btn cf-btn-ghost" (click)="downloadLedgerBridge()">
            Donations ledger export
          </button>
        }
      </app-page-header>

      <nav class="mass-reports__tabs" aria-label="Report type">
        @for (tab of visibleTabs(); track tab.id) {
          <button
            type="button"
            class="cf-btn cf-btn-ghost mass-reports__tab"
            [class.mass-reports__tab--active]="activeTab() === tab.id"
            (click)="selectTab(tab.id)"
          >
            {{ tab.label }}
          </button>
        }
      </nav>

      <app-list-toolbar
        searchPlaceholder="Filter this list…"
        [searchValue]="reportSearch()"
        [filterCount]="0"
        (searchChange)="reportSearch.set($event)"
      />

      @if (loading()) {
        <p>Loading…</p>
      } @else {
        <div class="cf-panel mass-register__table">
          <app-data-table [ariaBusy]="loading()">
          @switch (activeTab()) {
            @case ('canonical') {
              <table class="cf-data-table">
                <thead>
                  <tr>
                    <th>Name</th>
                    <th>Intention</th>
                    <th>Day asked</th>
                    <th>Said</th>
                  </tr>
                </thead>
                <tbody>
                  @for (row of filteredCanonical(); track row.request_id) {
                    <tr>
                      <td>{{ row.beneficiary_name }}</td>
                      <td>{{ row.intention_text }}</td>
                      <td>{{ row.requested_date || '—' }}</td>
                      <td>{{ row.progress }}</td>
                    </tr>
                  }
                </tbody>
              </table>
            }
            @case ('mass-list') {
              <table class="cf-data-table">
                <thead>
                  <tr>
                    <th>Day and time</th>
                    <th>Place</th>
                    <th>Priest</th>
                    <th>Intentions</th>
                    <th>Status</th>
                  </tr>
                </thead>
                <tbody>
                  @for (row of filteredMassList(); track row.celebration_id) {
                    <tr>
                      <td>{{ formatMassDayTime(row.celebrated_on, row.celebrated_at) }}</td>
                      <td>{{ row.place || '—' }}</td>
                      <td>{{ row.celebrant_name || '—' }}</td>
                      <td>{{ row.intention_count }}</td>
                      <td>{{ row.status }}</td>
                    </tr>
                  }
                </tbody>
              </table>
            }
            @case ('still-to-say') {
              <table class="cf-data-table">
                <thead>
                  <tr>
                    <th>Name</th>
                    <th>Intention</th>
                    <th>Mass #</th>
                    <th>Status</th>
                  </tr>
                </thead>
                <tbody>
                  @for (row of filteredStillToSay(); track row.obligation_id) {
                    <tr>
                      <td>{{ row.beneficiary_name }}</td>
                      <td>{{ row.intention_text }}</td>
                      <td>{{ row.sequence }}</td>
                      <td>{{ row.status }}</td>
                    </tr>
                  }
                </tbody>
              </table>
            }
            @case ('offerings') {
              <table class="cf-data-table mass-reports__money">
                <thead>
                  <tr>
                    <th>Date</th>
                    <th>Name</th>
                    <th>Receipt</th>
                    <th>Method</th>
                    <th class="mass-reports__amount">Amount</th>
                  </tr>
                </thead>
                <tbody>
                  @for (row of filteredOfferings(); track row.receipt_number) {
                    <tr>
                      <td>{{ row.received_on }}</td>
                      <td>{{ row.beneficiary_name }}</td>
                      <td>{{ row.receipt_number }}</td>
                      <td>{{ row.payment_method }}</td>
                      <td class="mass-reports__amount">{{ row.amount | cfCurrency }}</td>
                    </tr>
                  }
                </tbody>
              </table>
            }
            @case ('masses-said') {
              <table class="cf-data-table">
                <thead>
                  <tr>
                    <th>Said on</th>
                    <th>Mass day</th>
                    <th>Name</th>
                    <th>Intention</th>
                    <th>Priest</th>
                  </tr>
                </thead>
                <tbody>
                  @for (row of filteredMassesSaid(); track row.said_on + row.sequence) {
                    <tr>
                      <td>{{ row.said_on }}</td>
                      <td>{{ row.mass_day || '—' }}</td>
                      <td>{{ row.beneficiary_name }}</td>
                      <td>{{ row.intention_text }}</td>
                      <td>{{ row.celebrant || '—' }}</td>
                    </tr>
                  }
                </tbody>
              </table>
            }
          }
          </app-data-table>
        </div>
      }
    </div>
  `,
  styles: [
    `
      .mass-register__table {
        padding: var(--cf-space-3);
      }
      .mass-reports__tabs {
        display: flex;
        flex-wrap: wrap;
        gap: var(--cf-space-2);
        margin-bottom: var(--cf-space-3);
      }
      .mass-reports__tab--active {
        font-weight: 600;
        text-decoration: underline;
      }
      .mass-reports__amount {
        text-align: right;
        font-variant-numeric: tabular-nums;
      }
      @media print {
        .cf-btn,
        .mass-reports__tabs {
          display: none !important;
        }
      }
    `,
  ],
})
export class MassIntentionsRegisterPageComponent {
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

  private readonly allTabs: { id: ReportTab; label: string; needsOfferings?: boolean }[] = [
    { id: 'canonical', label: 'Canonical register' },
    { id: 'mass-list', label: 'Mass list' },
    { id: 'still-to-say', label: 'Still to say' },
    { id: 'offerings', label: 'Offerings', needsOfferings: true },
    { id: 'masses-said', label: 'Masses said' },
  ];

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

  selectTab(id: ReportTab): void {
    this.activeTab.set(id);
    this.reportSearch.set('');
    this.loadTab(id);
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
      case 'mass-list':
        this.api.getMassListReport().subscribe({
          next: (res) => {
            this.massList.set(res.data ?? []);
            done();
          },
          error: done,
        });
        break;
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
