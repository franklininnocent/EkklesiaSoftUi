import { CommonModule } from '@angular/common';
import { ChangeDetectorRef, Component, DestroyRef, OnInit, inject } from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { HttpErrorResponse } from '@angular/common/http';
import { FormBuilder, FormsModule, ReactiveFormsModule, Validators } from '@angular/forms';
import { Router, RouterModule } from '@angular/router';
import { finalize } from 'rxjs/operators';
import { AuthService } from '@core/services/auth.service';
import { ChurchCurrencyService } from '@core/services/church-currency.service';
import {
  AdvancedSearchPanelComponent,
  SearchField,
} from '@shared/components/advanced-search-panel/advanced-search-panel.component';
import { DonationsService } from '../services/donations.service';
import { QuickCollectService } from '../services/quick-collect.service';
import { DonationProject, ProjectDashboard, ProjectFamilyProgressRow } from '../models/donation.model';
import { CfEmptyStateComponent } from '@shared/components/cf-empty-state/cf-empty-state.component';
import { ModalShellComponent } from '@shared/components/modal-shell/modal-shell.component';
import { CfCurrencyPipe } from '@shared/pipes/cf-currency.pipe';
import { CfDatePipe } from '@shared/pipes/cf-date.pipe';
import { CfActionIconComponent } from '@shared/components/cf-action-icon/cf-action-icon.component';
import { PageHeaderComponent } from '@shared/components/page-header/page-header.component';
import { ListToolbarComponent } from '@shared/components/list-toolbar/list-toolbar.component';
import { LoadingSkeletonComponent } from '@shared/components/loading-skeleton/loading-skeleton.component';
import { DataTableComponent } from '@shared/components/data-table/data-table.component';
import { StatusBadgeComponent, StatusBadgeTone } from '@shared/components/status-badge/status-badge.component';
import {
  StewardshipActiveFilterChipsComponent,
  StewardshipFilterChip,
} from '../components/stewardship-active-filter-chips/stewardship-active-filter-chips.component';
import { SortableDirective, SortDirection, SortEvent } from '@shared/directives/sortable.directive';
import { refreshStewardshipView, setupStewardshipRouteReload } from '../utils/stewardship-view.util';
import { localDateOnly } from '../utils/local-date-only';
import { formatFamilyHeadWithCode } from '@shared/utils/family-display.util';

type CampaignSortColumn = 'name' | 'start_date' | 'end_date';
type CampaignStatusFilter = '' | 'active' | 'draft' | 'completed' | 'cancelled';
type CampaignScheduleFilter = '' | 'upcoming' | 'in_progress' | 'ended';

@Component({
  selector: 'app-donations-campaigns',
  standalone: true,
  imports: [
    CommonModule,
    FormsModule,
    ReactiveFormsModule,
    RouterModule,
    CfEmptyStateComponent,
    ModalShellComponent,
    PageHeaderComponent,
    ListToolbarComponent,
    CfCurrencyPipe,
    CfDatePipe,
    CfActionIconComponent,
    LoadingSkeletonComponent,
    DataTableComponent,
    StatusBadgeComponent,
    StewardshipActiveFilterChipsComponent,
    AdvancedSearchPanelComponent,
    SortableDirective,
  ],
  templateUrl: './donations-campaigns.component.html',
  styleUrls: ['./donations-campaigns.component.scss', '../styles/stewardship-dashboard-shared.scss'],
})
export class DonationsCampaignsComponent implements OnInit {
  private readonly churchCurrency = inject(ChurchCurrencyService);
  private readonly destroyRef = inject(DestroyRef);

  campaigns: DonationProject[] = [];
  tableSearch = '';
  statusFilter: CampaignStatusFilter = '';
  scheduleFilter: CampaignScheduleFilter = '';
  typeFilter = '';
  selectedCampaignId: string | null = null;
  dashboard: ProjectDashboard | null = null;
  dashboardLoading = false;
  dashboardLoadError: string | null = null;
  familyRows: ProjectFamilyProgressRow[] = [];
  familyLoading = false;
  familyLoadError: string | null = null;
  showForm = false;
  showFilters = false;
  campaignsLoaded = false;
  saving = false;
  campaignsLoadError: string | null = null;
  createError: string | null = null;
  canManage = false;
  searchFields: SearchField[] = [];
  sortColumn: CampaignSortColumn = 'name';
  sortDirection: SortDirection = 'asc';

  readonly pageTitle = 'Fundraising Campaigns';
  readonly pageSubtitle =
    'Time-bound appeals — track progress toward goals, spot gaps, and collect gifts before deadlines.';

  readonly campaignForm = this.fb.group({
    name: ['', Validators.required],
    code: ['', Validators.required],
    campaign_type: ['general'],
    description: [''],
    target_amount: [0, [Validators.min(0)]],
    start_date: [''],
    end_date: [''],
    status: ['active'],
  });

  constructor(
    private readonly donationsService: DonationsService,
    private readonly fb: FormBuilder,
    private readonly quickCollectService: QuickCollectService,
    private readonly authService: AuthService,
    private readonly router: Router,
    private readonly cdr: ChangeDetectorRef
  ) {}

  get currencySymbol(): string {
    return this.churchCurrency.currencySymbol() ?? '';
  }

  get activeFilterCount(): number {
    let count = 0;
    if (this.tableSearch.trim()) {
      count++;
    }
    if (this.statusFilter) {
      count++;
    }
    if (this.scheduleFilter) {
      count++;
    }
    if (this.typeFilter) {
      count++;
    }
    return count;
  }

  get activeFilterChips(): StewardshipFilterChip[] {
    const chips: StewardshipFilterChip[] = [];
    if (this.tableSearch.trim()) {
      chips.push({ key: 'search', label: `Search: ${this.tableSearch.trim()}` });
    }
    if (this.statusFilter) {
      chips.push({ key: 'status', label: `Status: ${this.statusFilterDisplay(this.statusFilter)}` });
    }
    if (this.scheduleFilter) {
      chips.push({ key: 'schedule', label: `Schedule: ${this.scheduleFilterLabel(this.scheduleFilter)}` });
    }
    if (this.typeFilter) {
      chips.push({ key: 'type', label: `Type: ${this.campaignTypeLabel(this.typeFilter)}` });
    }
    return chips;
  }

  get filteredCampaigns(): DonationProject[] {
    const query = this.tableSearch.trim().toLowerCase();
    return this.campaigns.filter((campaign) => {
      if (query) {
        const haystack = [campaign.name, campaign.code, campaign.campaign_type, campaign.status, campaign.description]
          .filter(Boolean)
          .join(' ')
          .toLowerCase();
        if (!haystack.includes(query)) {
          return false;
        }
      }
      if (this.statusFilter && campaign.status !== this.statusFilter) {
        return false;
      }
      if (this.typeFilter && campaign.campaign_type !== this.typeFilter) {
        return false;
      }
      if (this.scheduleFilter === 'upcoming' && !this.isUpcoming(campaign)) {
        return false;
      }
      if (this.scheduleFilter === 'in_progress' && !this.isInProgress(campaign)) {
        return false;
      }
      if (this.scheduleFilter === 'ended' && !this.isEndedByDate(campaign) && campaign.status !== 'completed' && campaign.status !== 'cancelled') {
        return false;
      }
      return true;
    });
  }

  get sortedCampaigns(): DonationProject[] {
    const rows = [...this.filteredCampaigns];
    rows.sort((a, b) => {
      const dir = this.sortDirection === 'asc' ? 1 : -1;
      if (this.sortColumn === 'name') {
        return dir * (a.name || '').localeCompare(b.name || '', undefined, { sensitivity: 'base' });
      }
      const aDate = a[this.sortColumn] || '';
      const bDate = b[this.sortColumn] || '';
      if (!aDate && !bDate) {
        return 0;
      }
      if (!aDate) {
        return 1;
      }
      if (!bDate) {
        return -1;
      }
      return dir * aDate.localeCompare(bDate);
    });
    return rows;
  }

  get selectedCampaign(): DonationProject | null {
    if (!this.selectedCampaignId) {
      return null;
    }
    return this.campaigns.find((campaign) => campaign.id === this.selectedCampaignId) ?? null;
  }

  ngOnInit(): void {
    this.canManage = this.authService.hasPermission('donations.manage');
    this.initSearchFields();
    this.loadCampaigns();
    this.donationsService.ledgerMutated$
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe(() => this.refreshAfterLedgerChange());
    setupStewardshipRouteReload(this.router, this.destroyRef, '/donations/campaigns', () => this.loadCampaigns());
  }

  trackCampaign(_index: number, campaign: DonationProject): string {
    return campaign.id;
  }

  onTableSearchChange(value: string): void {
    this.tableSearch = value;
    this.syncSearchFieldValues();
    this.cdr.markForCheck();
  }

  onSort(event: SortEvent): void {
    this.sortColumn = event.column as CampaignSortColumn;
    this.sortDirection = event.direction;
    this.cdr.markForCheck();
  }

  onAdvancedSearch(values: Record<string, unknown>): void {
    this.tableSearch = String(values['search'] ?? '').trim();
    this.statusFilter = (values['status'] as CampaignStatusFilter) || '';
    this.scheduleFilter = (values['schedule'] as CampaignScheduleFilter) || '';
    this.typeFilter = String(values['campaign_type'] ?? '');
    this.showFilters = false;
    this.syncSearchFieldValues();
    this.cdr.markForCheck();
  }

  onClearAdvancedSearch(): void {
    this.clearAllFilters();
    this.showFilters = false;
  }

  onActiveFilterChipRemove(chip: StewardshipFilterChip): void {
    if (chip.key === 'search') {
      this.tableSearch = '';
    } else if (chip.key === 'status') {
      this.statusFilter = '';
    } else if (chip.key === 'schedule') {
      this.scheduleFilter = '';
    } else if (chip.key === 'type') {
      this.typeFilter = '';
    }
    this.syncSearchFieldValues();
    this.cdr.markForCheck();
  }

  clearAllFilters(): void {
    this.tableSearch = '';
    this.statusFilter = '';
    this.scheduleFilter = '';
    this.typeFilter = '';
    this.syncSearchFieldValues();
    this.cdr.markForCheck();
  }

  openCreateForm(): void {
    this.createError = null;
    this.campaignForm.reset({
      campaign_type: 'general',
      description: '',
      target_amount: 0,
      status: 'active',
      start_date: '',
      end_date: '',
    });
    this.showForm = true;
  }

  closeCreateForm(): void {
    this.showForm = false;
    this.createError = null;
  }

  campaignGap(campaign: DonationProject): number {
    return Math.max(Number(campaign.target_amount || 0) - Number(campaign.raised_amount || 0), 0);
  }

  hasFundingTarget(campaign: DonationProject): boolean {
    return Number(campaign.target_amount || 0) > 0;
  }

  progressPercent(campaign: DonationProject): number {
    if (!this.hasFundingTarget(campaign)) {
      return 0;
    }
    if (campaign.collection_percentage != null) {
      return Math.min(100, Math.round(campaign.collection_percentage));
    }
    const target = Number(campaign.target_amount || 0);
    const raised = Number(campaign.raised_amount || 0);
    return target > 0 ? Math.min(100, Math.round((raised / target) * 100)) : 0;
  }

  isCampaignAtRisk(campaign: DonationProject): boolean {
    if (campaign.status !== 'active') {
      return false;
    }
    const days = this.daysRemaining(campaign);
    const lowProgress = this.hasFundingTarget(campaign) && this.progressPercent(campaign) < 50;
    return lowProgress || (days !== null && days <= 14 && days >= 0);
  }

  daysRemaining(campaign: DonationProject): number | null {
    if (!campaign.end_date) {
      return null;
    }
    const end = new Date(campaign.end_date).getTime();
    const now = Date.now();
    return Math.ceil((end - now) / (1000 * 60 * 60 * 24));
  }

  campaignEndedByDate(campaign: DonationProject): boolean {
    return this.isEndedByDate(campaign);
  }

  isDeadlineUrgent(campaign: DonationProject): boolean {
    const days = this.daysRemaining(campaign);
    return days !== null && days > 0 && days <= 14;
  }

  remainingLabel(campaign: DonationProject): string {
    if (!campaign.end_date) {
      return '—';
    }
    if (this.campaignEndedByDate(campaign)) {
      return 'Ended';
    }
    const days = this.daysRemaining(campaign);
    if (days === null || days <= 0) {
      return 'Ends today';
    }
    return days === 1 ? '1 day left' : `${days} days left`;
  }

  campaignTypeLabel(type?: string | null): string {
    const labels: Record<string, string> = {
      general: 'General',
      building: 'Building',
      charity: 'Charity',
      event: 'Event',
    };
    return labels[type ?? ''] ?? 'General';
  }

  statusLabel(campaign: DonationProject): string {
    const status = campaign.status;
    if (status === 'active') {
      if (this.isUpcoming(campaign)) {
        return 'Upcoming';
      }
      if (this.isEndedByDate(campaign)) {
        return 'Ended';
      }
      return 'Active';
    }
    if (status === 'draft') {
      return 'Draft';
    }
    if (status === 'completed') {
      return 'Completed';
    }
    if (status === 'cancelled') {
      return 'Cancelled';
    }
    return status;
  }

  statusTone(campaign: DonationProject): StatusBadgeTone {
    if (campaign.status === 'active') {
      if (this.isCampaignAtRisk(campaign)) {
        return 'warning';
      }
      if (this.isUpcoming(campaign)) {
        return 'info';
      }
      return 'success';
    }
    if (campaign.status === 'completed') {
      return 'info';
    }
    if (campaign.status === 'cancelled') {
      return 'neutral';
    }
    return 'neutral';
  }

  openQuickCollect(campaign?: { id: string } | null): void {
    const projectId = campaign?.id ?? this.selectedCampaignId ?? undefined;
    this.quickCollectService.open(projectId ? { projectId, campaignId: projectId } : {});
  }

  collectForFamily(row: ProjectFamilyProgressRow): void {
    const campaignId = this.selectedCampaignId ?? undefined;
    this.quickCollectService.open({
      familyId: row.family_id,
      projectId: campaignId,
      campaignId,
    });
  }

  familyProgressLabel(row: ProjectFamilyProgressRow): string {
    return formatFamilyHeadWithCode(row);
  }

  trackFamilyRow(_index: number, row: ProjectFamilyProgressRow): string {
    return row.family_id;
  }

  fundingTarget(campaign: DonationProject): number {
    return Number(this.dashboard?.totals.overall_target ?? campaign.target_amount ?? 0);
  }

  fundingCollected(campaign: DonationProject): number {
    return Number(this.dashboard?.totals.collected ?? campaign.raised_amount ?? 0);
  }

  get showFamilyBreakdown(): boolean {
    const progress = this.dashboard?.family_progress ?? [];
    if (progress.length > 0) {
      return true;
    }
    const families = this.dashboard?.families;
    if (!families) {
      return false;
    }
    return families.completed > 0 || families.partial > 0 || families.exempt > 0;
  }

  fundingOutstanding(campaign: DonationProject): number {
    if (this.dashboard) {
      return Number(this.dashboard.totals.outstanding ?? 0);
    }
    return this.campaignGap(campaign);
  }

  viewCampaign(campaign: DonationProject): void {
    if (this.selectedCampaignId === campaign.id && this.dashboard) {
      return;
    }
    this.selectedCampaignId = campaign.id;
    this.dashboard = null;
    this.dashboardLoadError = null;
    this.familyRows = [];
    this.familyLoadError = null;
    this.loadSelectedDashboard(campaign.id, true);
    this.loadFamilyProgress(campaign.id);
  }

  private refreshAfterLedgerChange(): void {
    this.donationsService
      .getCampaigns()
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe({
        next: (res) => {
          this.campaigns = res.data ?? [];
          refreshStewardshipView(this.cdr);
        },
      });

    if (this.selectedCampaignId) {
      this.loadSelectedDashboard(this.selectedCampaignId, false);
      this.loadFamilyProgress(this.selectedCampaignId);
    }
  }

  private loadSelectedDashboard(campaignId: string, showLoader: boolean): void {
    this.dashboardLoadError = null;
    this.dashboardLoading = showLoader;
    refreshStewardshipView(this.cdr);
    this.donationsService
      .getCampaignDashboard(campaignId)
      .pipe(
        finalize(() => {
          this.dashboardLoading = false;
          refreshStewardshipView(this.cdr);
        })
      )
      .subscribe({
        next: (res) => {
          if (this.selectedCampaignId === campaignId) {
            this.dashboard = res.data;
          }
        },
        error: () => {
          if (this.selectedCampaignId === campaignId) {
            this.dashboardLoadError = 'Unable to load campaign summary. Please try again.';
          }
        },
      });
  }

  closeCampaignDetail(): void {
    this.selectedCampaignId = null;
    this.dashboard = null;
    this.dashboardLoadError = null;
    this.familyRows = [];
    this.familyLoadError = null;
  }

  private loadFamilyProgress(campaignId: string): void {
    this.familyLoading = true;
    this.familyLoadError = null;
    this.donationsService
      .getProjectFamilyProgress(campaignId, { per_page: 50, sort: 'outstanding_amount', direction: 'desc' })
      .pipe(finalize(() => {
        this.familyLoading = false;
        refreshStewardshipView(this.cdr);
      }))
      .subscribe({
        next: (res) => {
          if (this.selectedCampaignId === campaignId) {
            this.familyRows = res.data?.data ?? [];
          }
        },
        error: () => {
          if (this.selectedCampaignId === campaignId) {
            this.familyLoadError = 'Unable to load family balances for this campaign.';
          }
        },
      });
  }

  loadCampaigns(): void {
    this.campaignsLoaded = false;
    this.campaignsLoadError = null;
    refreshStewardshipView(this.cdr);
    this.donationsService
      .getCampaigns()
      .pipe(
        takeUntilDestroyed(this.destroyRef),
        finalize(() => {
          this.campaignsLoaded = true;
          refreshStewardshipView(this.cdr);
        })
      )
      .subscribe({
        next: (res) => {
          this.campaigns = res.data ?? [];
        },
        error: (err: HttpErrorResponse) => {
          this.campaignsLoadError =
            err.error?.message || err.message || 'Unable to load campaigns. Please check your connection and try again.';
        },
      });
  }

  saveCampaign(): void {
    if (this.campaignForm.invalid) {
      return;
    }

    this.saving = true;
    this.createError = null;
    this.donationsService.createCampaign(this.campaignForm.getRawValue()).subscribe({
      next: () => {
        this.saving = false;
        this.showForm = false;
        this.campaignForm.reset({
          campaign_type: 'general',
          description: '',
          target_amount: 0,
          status: 'active',
        });
        this.loadCampaigns();
        this.cdr.detectChanges();
      },
      error: (err: HttpErrorResponse) => {
        this.saving = false;
        this.createError = err.error?.message || 'Unable to create campaign.';
        this.cdr.detectChanges();
      },
    });
  }

  private initSearchFields(): void {
    this.searchFields = [
      {
        key: 'search',
        label: 'Search',
        type: 'text',
        placeholder: 'Name, code, or description…',
        value: this.tableSearch.trim() || undefined,
      },
      {
        key: 'status',
        label: 'Status',
        type: 'select',
        value: this.statusFilter || undefined,
        options: [
          { label: 'Any status', value: '' },
          { label: 'Active', value: 'active' },
          { label: 'Draft', value: 'draft' },
          { label: 'Completed', value: 'completed' },
          { label: 'Cancelled', value: 'cancelled' },
        ],
      },
      {
        key: 'schedule',
        label: 'Schedule',
        type: 'select',
        value: this.scheduleFilter || undefined,
        options: [
          { label: 'Any schedule', value: '' },
          { label: 'Upcoming (not started)', value: 'upcoming' },
          { label: 'In progress', value: 'in_progress' },
          { label: 'Ended', value: 'ended' },
        ],
      },
      {
        key: 'campaign_type',
        label: 'Campaign type',
        type: 'select',
        value: this.typeFilter || undefined,
        options: [
          { label: 'Any type', value: '' },
          { label: 'General', value: 'general' },
          { label: 'Building', value: 'building' },
          { label: 'Charity', value: 'charity' },
          { label: 'Event', value: 'event' },
        ],
      },
    ];
  }

  private syncSearchFieldValues(): void {
    const set = (key: string, value: string | undefined) => {
      const field = this.searchFields.find((f) => f.key === key);
      if (field) {
        field.value = value;
      }
    };
    set('search', this.tableSearch.trim() || undefined);
    set('status', this.statusFilter || undefined);
    set('schedule', this.scheduleFilter || undefined);
    set('campaign_type', this.typeFilter || undefined);
  }

  private statusFilterDisplay(value: CampaignStatusFilter): string {
    const labels: Record<string, string> = {
      active: 'Active',
      draft: 'Draft',
      completed: 'Completed',
      cancelled: 'Cancelled',
    };
    return labels[value] || value;
  }

  private scheduleFilterLabel(value: CampaignScheduleFilter): string {
    const labels: Record<string, string> = {
      upcoming: 'Upcoming',
      in_progress: 'In progress',
      ended: 'Ended',
    };
    return labels[value] || value;
  }

  private isUpcoming(campaign: DonationProject): boolean {
    if (!campaign.start_date) {
      return false;
    }
    return campaign.start_date > localDateOnly();
  }

  private isEndedByDate(campaign: DonationProject): boolean {
    if (!campaign.end_date) {
      return false;
    }
    return campaign.end_date < localDateOnly();
  }

  private isInProgress(campaign: DonationProject): boolean {
    if (campaign.status !== 'active') {
      return false;
    }
    const today = localDateOnly();
    const afterStart = !campaign.start_date || campaign.start_date <= today;
    const beforeEnd = !campaign.end_date || campaign.end_date >= today;
    return afterStart && beforeEnd;
  }
}
