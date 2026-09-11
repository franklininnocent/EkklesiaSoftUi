import { CommonModule } from '@angular/common';
import { ChangeDetectorRef, Component, OnDestroy, OnInit } from '@angular/core';
import { FormBuilder, FormsModule, ReactiveFormsModule, Validators } from '@angular/forms';
import { NavigationEnd, Router, RouterModule } from '@angular/router';
import { Subscription } from 'rxjs';
import { filter } from 'rxjs/operators';
import { DonationsService } from '../services/donations.service';
import { QuickCollectService } from '../services/quick-collect.service';
import { DonationProject } from '../models/donation.model';
import { FinancialActivityTimelineComponent } from '../components/financial-activity-timeline/financial-activity-timeline.component';
import { CfEmptyStateComponent } from '@shared/components/cf-empty-state/cf-empty-state.component';
import { ModalShellComponent } from '@shared/components/modal-shell/modal-shell.component';

@Component({
  selector: 'app-donations-campaigns',
  standalone: true,
  imports: [
    CommonModule,
    FormsModule,
    ReactiveFormsModule,
    RouterModule,
    FinancialActivityTimelineComponent,
    CfEmptyStateComponent,
    ModalShellComponent
  ],
  template: `
    <section class="campaigns-page cf-page">
      <header class="cf-hero">
        <h1>Fundraising Campaigns</h1>
        <p>Time-bound drives — see progress, spot gaps, and act before deadlines.</p>
      </header>

      <div class="cf-decision-strip" role="region" aria-label="Suggested next step" *ngIf="!loading && campaigns.length">
        <div class="cf-decision-strip__copy">
          <strong>{{ activeCampaignCount }} active · {{ fundingGap | number:'1.2-2' }} still to raise</strong>
          <span>{{ campaignDecisionHint }}</span>
        </div>
        <div class="cf-decision-strip__actions">
          <button type="button" class="cf-btn cf-btn-primary" (click)="openQuickCollect()">Collect Payment</button>
          <button type="button" class="cf-btn" (click)="toggleForm()">{{ showForm ? 'Close setup' : 'New campaign' }}</button>
        </div>
      </div>

      <app-modal-shell
        *ngIf="showForm"
        title="Set up a Campaign"
        size="sm"
        headerVariant="compact"
        bodyPadding="none"
        closeAriaLabel="Close campaign setup"
        [isSubmitting]="saving"
        (closeRequested)="toggleForm()"
      >
        <form [formGroup]="campaignForm" (ngSubmit)="saveCampaign()" class="cf-split-form-body" novalidate>
          <section class="cf-split-section" aria-labelledby="campaign-section-details">
            <h3 id="campaign-section-details" class="cf-split-section__title">Campaign details</h3>
            <div class="cf-split-grid">
              <div class="cf-split-field cf-split-field--full">
                <label for="campaign-name">Campaign name <span class="cf-split-req" aria-hidden="true">*</span></label>
                <input id="campaign-name" formControlName="name" placeholder="Campaign name" autocomplete="off" aria-required="true" />
              </div>
              <div class="cf-split-field">
                <label for="campaign-code">Code <span class="cf-split-req" aria-hidden="true">*</span></label>
                <input id="campaign-code" formControlName="code" placeholder="Code" autocomplete="off" aria-required="true" />
              </div>
              <div class="cf-split-field">
                <label for="campaign-type">Campaign type</label>
                <select id="campaign-type" formControlName="campaign_type">
                  <option value="general">General</option>
                  <option value="building">Building</option>
                  <option value="charity">Charity</option>
                  <option value="event">Event</option>
                </select>
              </div>
              <div class="cf-split-field">
                <label for="campaign-target">Target amount</label>
                <input id="campaign-target" formControlName="target_amount" type="number" placeholder="Target amount" />
              </div>
              <div class="cf-split-field">
                <label for="campaign-start">Start date</label>
                <input id="campaign-start" formControlName="start_date" type="date" />
              </div>
              <div class="cf-split-field">
                <label for="campaign-end">End date</label>
                <input id="campaign-end" formControlName="end_date" type="date" />
              </div>
            </div>
          </section>

          <div class="cf-split-form-actions">
            <button type="submit" class="cf-btn cf-btn-primary" [disabled]="campaignForm.invalid || saving">
              {{ saving ? 'Saving…' : 'Create Campaign' }}
            </button>
            <button type="button" class="cf-btn" (click)="toggleForm()" [disabled]="saving">Cancel</button>
          </div>
        </form>
      </app-modal-shell>

      <p *ngIf="loading" class="cf-state">Loading campaigns…</p>
      <p *ngIf="error" class="cf-state cf-state--error">{{ error }}</p>

      <div class="cf-filters cf-panel" *ngIf="!loading && campaigns.length">
        <input type="search" [(ngModel)]="tableSearch" placeholder="Search campaigns…" />
      </div>

      <div class="campaign-grid cf-card-grid" *ngIf="!loading && filteredCampaigns.length">
        <article
          class="campaign-card cf-card"
          *ngFor="let campaign of filteredCampaigns"
          [class.campaign-card--active]="selectedCampaignId === campaign.id"
          [class.campaign-card--attention]="isCampaignAtRisk(campaign)"
          [class.cf-card--active]="selectedCampaignId === campaign.id"
          (click)="selectCampaign(campaign)"
        >
          <div class="campaign-top">
            <strong>{{ campaign.name }}</strong>
            <span class="campaign-badge" [class.campaign-badge--attention]="isCampaignAtRisk(campaign)">
              {{ campaign.collection_percentage || 0 }}%
            </span>
          </div>
          <p>{{ campaign.code }} · {{ campaign.status }}</p>
          <p>{{ campaign.raised_amount | number:'1.2-2' }} of {{ campaign.target_amount | number:'1.2-2' }}</p>
          <p *ngIf="daysRemaining(campaign) !== null" class="campaign-deadline">
            {{ daysRemaining(campaign)! <= 0 ? 'Ended' : daysRemaining(campaign) + ' days left' }}
          </p>
          <div class="cf-progress"><span [style.width.%]="campaign.collection_percentage || 0"></span></div>
        </article>
      </div>

      <p *ngIf="!loading && campaigns.length && !filteredCampaigns.length" class="cf-state">No campaigns match your search.</p>

      <section class="campaign-detail cf-panel" *ngIf="selectedCampaign as campaign">
        <header>
          <h2>{{ campaign.name }}</h2>
          <div class="detail-actions">
            <button type="button" class="cf-btn cf-btn-primary" (click)="openQuickCollect()">Collect</button>
            <button type="button" class="cf-btn" (click)="selectedCampaignId = null">Close</button>
          </div>
        </header>
        <div class="cf-attention-callout" *ngIf="isCampaignAtRisk(campaign)">
          <p>{{ campaignGap(campaign) | number:'1.2-2' }} still needed · {{ campaign.collection_percentage || 0 }}% funded.</p>
        </div>
        <app-financial-activity-timeline
          subjectType="campaign"
          [subjectId]="campaign.id"
          title="Campaign Activity"
        ></app-financial-activity-timeline>
      </section>

      <app-cf-empty-state
        *ngIf="!loading && !campaigns.length && !error"
        icon="◆"
        title="No campaigns running"
        description="Launch a time-bound drive for building funds, charity events, or special appeals."
      >
        <button type="button" class="cf-btn cf-btn-primary" (click)="toggleForm()">Create campaign</button>
        <button type="button" class="cf-btn" (click)="openQuickCollect()">Collect Payment</button>
      </app-cf-empty-state>
    </section>
  `,
  styles: [`
    @use '../styles/stewardship-split-layout.scss';

    .cf-split-form-actions { justify-content: flex-end; }
    .campaign-top { display: flex; justify-content: space-between; gap: 0.5rem; align-items: flex-start; }
    .campaign-badge { padding: 0.15rem 0.45rem; border-radius: 999px; background: var(--cf-forest-soft); color: var(--cf-forest); font-size: 0.78rem; }
    .campaign-badge--attention { background: var(--cf-amber-soft); color: var(--cf-amber); }
    .campaign-deadline { margin: 0.25rem 0 0; color: var(--cf-muted); font-size: 0.82rem; }
    .campaign-card--attention { border-color: var(--cf-amber); }
    .campaign-detail header { display: flex; justify-content: space-between; align-items: center; gap: 0.75rem; flex-wrap: wrap; }
    .detail-actions { display: flex; gap: 0.45rem; }
    .campaign-detail h2 { margin: 0; font-size: 1.05rem; }
    .cf-progress { margin-top: 0.5rem; }
  `]
})
export class DonationsCampaignsComponent implements OnInit, OnDestroy {
  campaigns: DonationProject[] = [];
  tableSearch = '';
  selectedCampaignId: string | null = null;
  showForm = false;
  loading = false;
  saving = false;
  error: string | null = null;
  private routerSub?: Subscription;
  private skipNextNavReload = true;

  readonly campaignForm = this.fb.group({
    name: ['', Validators.required],
    code: ['', Validators.required],
    campaign_type: ['general'],
    target_amount: [0, [Validators.min(0)]],
    start_date: [''],
    end_date: [''],
    status: ['active']
  });

  constructor(
    private readonly donationsService: DonationsService,
    private readonly fb: FormBuilder,
    private readonly quickCollectService: QuickCollectService,
    private readonly router: Router,
    private readonly cdr: ChangeDetectorRef
  ) {}

  get activeCampaignCount(): number {
    return this.campaigns.filter((campaign) => campaign.status === 'active').length;
  }

  get fundingGap(): number {
    return this.campaigns.reduce((sum, campaign) => sum + this.campaignGap(campaign), 0);
  }

  get campaignDecisionHint(): string {
    const atRisk = this.campaigns.filter((campaign) => this.isCampaignAtRisk(campaign)).length;
    if (atRisk > 0) {
      return `${atRisk} campaign${atRisk === 1 ? '' : 's'} below 50% or nearing deadline — prioritize outreach.`;
    }
    return 'Select a campaign card to review activity and collect gifts.';
  }

  get filteredCampaigns(): DonationProject[] {
    const query = this.tableSearch.trim().toLowerCase();
    if (!query) {
      return this.campaigns;
    }
    return this.campaigns.filter((campaign) =>
      [campaign.name, campaign.code, campaign.campaign_type, campaign.status].join(' ').toLowerCase().includes(query)
    );
  }

  campaignGap(campaign: DonationProject): number {
    return Math.max(Number(campaign.target_amount || 0) - Number(campaign.raised_amount || 0), 0);
  }

  isCampaignAtRisk(campaign: DonationProject): boolean {
    if (campaign.status !== 'active') {
      return false;
    }
    const days = this.daysRemaining(campaign);
    const lowProgress = (campaign.collection_percentage ?? 0) < 50;
    return lowProgress || (days !== null && days <= 14);
  }

  daysRemaining(campaign: DonationProject): number | null {
    if (!campaign.end_date) {
      return null;
    }
    const end = new Date(campaign.end_date).getTime();
    const now = Date.now();
    return Math.ceil((end - now) / (1000 * 60 * 60 * 24));
  }

  openQuickCollect(): void {
    this.quickCollectService.open();
  }

  get selectedCampaign(): DonationProject | null {
    if (!this.selectedCampaignId) {
      return null;
    }
    return this.campaigns.find((campaign) => campaign.id === this.selectedCampaignId) ?? null;
  }

  selectCampaign(campaign: DonationProject): void {
    this.selectedCampaignId = campaign.id;
  }

  ngOnInit(): void {
    this.loadCampaigns();
    this.routerSub = this.router.events.pipe(filter((e): e is NavigationEnd => e instanceof NavigationEnd)).subscribe((e) => {
      if (!e.urlAfterRedirects.includes('/donations/campaigns')) {
        return;
      }
      if (this.skipNextNavReload) {
        this.skipNextNavReload = false;
        return;
      }
      this.loadCampaigns();
    });
  }

  ngOnDestroy(): void {
    this.routerSub?.unsubscribe();
  }

  toggleForm(): void {
    this.showForm = !this.showForm;
  }

  loadCampaigns(): void {
    this.loading = true;
    this.error = null;
    this.cdr.detectChanges();
    this.donationsService.getCampaigns().subscribe({
      next: (res) => {
        this.campaigns = res.data ?? [];
        this.loading = false;
        this.cdr.detectChanges();
      },
      error: (err: { message?: string }) => {
        this.error = err?.message || 'Failed to load campaigns.';
        this.loading = false;
        this.cdr.detectChanges();
      }
    });
  }

  saveCampaign(): void {
    if (this.campaignForm.invalid) {
      return;
    }

    this.saving = true;
    this.donationsService.createCampaign(this.campaignForm.getRawValue()).subscribe({
      next: () => {
        this.saving = false;
        this.showForm = false;
        this.campaignForm.reset({ campaign_type: 'general', target_amount: 0, status: 'active' });
        this.loadCampaigns();
        this.cdr.detectChanges();
      },
      error: () => {
        this.saving = false;
        this.error = 'Unable to create campaign.';
        this.cdr.detectChanges();
      }
    });
  }
}
