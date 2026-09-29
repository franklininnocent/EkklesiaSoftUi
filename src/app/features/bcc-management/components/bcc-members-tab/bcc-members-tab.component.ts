import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import {
  ChangeDetectionStrategy,
  ChangeDetectorRef,
  Component,
  EventEmitter,
  Input,
  OnChanges,
  Output,
  SimpleChanges,
  inject,
} from '@angular/core';
import { RouterLink } from '@angular/router';
import { AuthService } from '@core/services/auth.service';
import { BCCService } from '@core/services/bcc.service';
import { ToastService } from '@core/services/toast.service';
import { SubscriptionAccessService } from '@core/services/subscription-access.service';
import {
  AdvancedSearchPanelComponent,
  SearchField,
} from '@shared/components/advanced-search-panel/advanced-search-panel.component';
import { ConfirmationModalComponent } from '@shared/components/confirmation-modal/confirmation-modal.component';
import { CfEmptyStateComponent } from '@shared/components/cf-empty-state/cf-empty-state.component';
import { DataTableComponent } from '@shared/components/data-table/data-table.component';
import { ListToolbarComponent } from '@shared/components/list-toolbar/list-toolbar.component';
import { LoadingSkeletonComponent } from '@shared/components/loading-skeleton/loading-skeleton.component';
import { PaginationComponent } from '@shared/components/pagination/pagination.component';
import { StatusBadgeComponent, StatusBadgeTone } from '@shared/components/status-badge/status-badge.component';
import {
  BccAgeBand,
  BccFamilyLookup,
  BccMembershipRow,
  BccPaged,
  BccPersonRow,
} from '../../models/bcc.model';

type MembersView = 'families' | 'people';

/** Membership statuses accepted by `GET /bccs/{id}/people`. */
const PEOPLE_STATUSES: { value: string; label: string }[] = [
  { value: 'active', label: 'Active' },
  { value: 'inactive', label: 'Inactive' },
  { value: 'deceased', label: 'Deceased' },
  { value: 'migrated', label: 'Transferred' },
];

/** Family statuses accepted by `GET /bccs/{id}/members`. */
const FAMILY_STATUSES: { value: string; label: string }[] = [
  { value: 'active', label: 'Active' },
  { value: 'inactive', label: 'Inactive' },
  { value: 'migrated', label: 'Transferred' },
];

const GENDERS: { value: string; label: string }[] = [
  { value: 'male', label: 'Male' },
  { value: 'female', label: 'Female' },
  { value: 'other', label: 'Other' },
  { value: 'unknown', label: 'Not recorded' },
];

/** Mirrors `BccAgeBands::definitions()` on the API. */
const AGE_BANDS: { value: BccAgeBand; label: string }[] = [
  { value: 'babies', label: 'Babies (0–2)' },
  { value: 'children', label: 'Children (3–12)' },
  { value: 'teenagers', label: 'Teenagers (13–17)' },
  { value: 'young_adults', label: 'Young adults (18–25)' },
  { value: 'adults', label: 'Adults (26–59)' },
  { value: 'seniors', label: 'Seniors (60+)' },
  { value: 'unknown', label: 'Date of birth not recorded' },
];

@Component({
  selector: 'app-bcc-members-tab',
  standalone: true,
  imports: [
    CommonModule,
    FormsModule,
    RouterLink,
    ListToolbarComponent,
    DataTableComponent,
    PaginationComponent,
    LoadingSkeletonComponent,
    CfEmptyStateComponent,
    StatusBadgeComponent,
    ConfirmationModalComponent,
    AdvancedSearchPanelComponent,
  ],
  templateUrl: './bcc-members-tab.component.html',
  styleUrl: './bcc-members-tab.component.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class BccMembersTabComponent implements OnChanges {
  @Input({ required: true }) bccId!: string;
  @Input() bccStatus = 'active';
  @Input() initialQuery: Record<string, string> = {};

  /** Keeps the URL in step with the list so filtered views stay shareable. */
  @Output() queryChange = new EventEmitter<Record<string, string>>();

  private readonly api = inject(BCCService);
  private readonly auth = inject(AuthService);
  private readonly toast = inject(ToastService);
  private readonly cdr = inject(ChangeDetectorRef);
  private readonly subscriptionAccess = inject(SubscriptionAccessService);

  view: MembersView = 'people';
  search = '';
  loading = true;
  loadError: string | null = null;
  families: BccMembershipRow[] = [];
  people: BccPersonRow[] = [];
  page = 1;
  perPage = 15;
  total = 0;
  showAssign = false;
  lookupSearch = '';
  lookupResults: BccFamilyLookup[] = [];
  selectedFamily: BccFamilyLookup | null = null;
  transfer = false;
  confirmRemove: BccMembershipRow | null = null;
  genderFilter = '';
  statusFilter = '';
  ageBand = '';

  showFilters = false;
  searchFields: SearchField[] = [];

  private hydrated = false;

  get canManage(): boolean {
    return this.auth.hasPermission('bcc.manage_members');
  }

  get canAssign(): boolean {
    return this.canManage && this.bccStatus === 'active';
  }

  /** Filters that apply to the current view only, so the badge never overcounts. */
  get activeFilterCount(): number {
    const applied = [this.statusFilter];
    if (this.view === 'people') {
      applied.push(this.genderFilter, this.ageBand);
    }
    return applied.filter((value) => !!value).length;
  }

  get hasActiveFilters(): boolean {
    return !!this.search.trim() || this.activeFilterCount > 0;
  }

  /** Plain-language recap of what the list is currently narrowed to. */
  get filterSummary(): string {
    const parts: string[] = [];
    const statusOptions = this.view === 'people' ? PEOPLE_STATUSES : FAMILY_STATUSES;
    const status = statusOptions.find((option) => option.value === this.statusFilter);
    if (status) {
      parts.push(status.label);
    }
    if (this.view === 'people') {
      const gender = GENDERS.find((option) => option.value === this.genderFilter);
      if (gender) {
        parts.push(gender.label);
      }
      const band = AGE_BANDS.find((option) => option.value === this.ageBand);
      if (band) {
        parts.push(band.label);
      }
    }
    return parts.join(' · ');
  }

  ngOnChanges(changes: SimpleChanges): void {
    if (!this.bccId) {
      return;
    }

    const requestedView = this.initialQuery['view'];
    const nextView: MembersView =
      requestedView === 'families' || requestedView === 'people' ? requestedView : 'people';
    const nextGender = this.initialQuery['gender'] || '';
    const nextStatus = this.initialQuery['status'] || '';
    const nextAgeBand = this.initialQuery['age_band'] || '';

    // The URL is updated when filters are applied here, which re-emits this
    // input. Skip the reload when nothing actually differs from current state.
    const unchanged =
      this.hydrated &&
      nextView === this.view &&
      nextGender === this.genderFilter &&
      nextStatus === this.statusFilter &&
      nextAgeBand === this.ageBand;
    if (unchanged) {
      return;
    }

    this.view = nextView;
    this.genderFilter = nextGender;
    this.statusFilter = nextStatus;
    this.ageBand = nextAgeBand;
    this.sanitizeFiltersForView();
    this.buildSearchFields();
    this.hydrated = true;
    this.load();
  }

  onFiltersOpened(): void {
    this.buildSearchFields();
    this.showFilters = true;
    this.cdr.markForCheck();
  }

  onFiltersApplied(values: { [key: string]: unknown }): void {
    this.statusFilter = (values['status'] as string) || '';
    this.genderFilter = this.view === 'people' ? ((values['gender'] as string) || '') : '';
    this.ageBand = this.view === 'people' ? ((values['age_band'] as string) || '') : '';
    this.sanitizeFiltersForView();
    this.buildSearchFields();
    this.showFilters = false;
    this.page = 1;
    this.load();
    this.emitQueryChange();
  }

  onFiltersCleared(): void {
    this.statusFilter = '';
    this.genderFilter = '';
    this.ageBand = '';
    this.buildSearchFields();
    this.page = 1;
    this.load();
    this.emitQueryChange();
  }

  closeFilters(): void {
    this.showFilters = false;
    this.cdr.markForCheck();
  }

  /** Used by the empty state: drops search as well as the drawer filters. */
  clearAll(): void {
    this.search = '';
    this.onFiltersCleared();
  }

  /**
   * People and family endpoints accept different filters: gender/life stage are
   * person-level only, and family status has no "deceased" value. Drop anything
   * the active view's endpoint would reject instead of sending an invalid query.
   */
  private emitQueryChange(): void {
    this.queryChange.emit({
      view: this.view,
      gender: this.genderFilter,
      status: this.statusFilter,
      age_band: this.ageBand,
    });
  }

  private sanitizeFiltersForView(): void {
    if (this.view === 'people') {
      if (!PEOPLE_STATUSES.some((option) => option.value === this.statusFilter)) {
        this.statusFilter = '';
      }
      if (!GENDERS.some((option) => option.value === this.genderFilter)) {
        this.genderFilter = '';
      }
      if (!AGE_BANDS.some((option) => option.value === this.ageBand)) {
        this.ageBand = '';
      }
      return;
    }

    this.genderFilter = '';
    this.ageBand = '';
    if (!FAMILY_STATUSES.some((option) => option.value === this.statusFilter)) {
      this.statusFilter = '';
    }
  }

  private buildSearchFields(): void {
    const statusOptions = this.view === 'people' ? PEOPLE_STATUSES : FAMILY_STATUSES;
    const fields: SearchField[] = [
      {
        key: 'status',
        label: this.view === 'people' ? 'Membership status' : 'Family status',
        type: 'select',
        options: statusOptions,
        value: this.statusFilter || undefined,
      },
    ];

    if (this.view === 'people') {
      fields.push(
        {
          key: 'gender',
          label: 'Gender',
          type: 'select',
          options: GENDERS,
          value: this.genderFilter || undefined,
        },
        {
          key: 'age_band',
          label: 'Life stage',
          type: 'select',
          options: AGE_BANDS,
          value: this.ageBand || undefined,
        }
      );
    }

    this.searchFields = fields;
  }

  /** Life stage label matching BCC age bands (babies → seniors). */
  lifeStage(person: BccPersonRow): string {
    const age = person.age;
    if (age === null || age === undefined || age < 0) {
      return 'Not recorded';
    }
    if (age <= 2) {
      return 'Baby';
    }
    if (age <= 12) {
      return 'Child';
    }
    if (age <= 17) {
      return 'Teenager';
    }
    if (age <= 25) {
      return 'Young adult';
    }
    if (age <= 59) {
      return 'Adult';
    }
    return 'Senior';
  }

  memberDetailLink(person: BccPersonRow): string[] | null {
    if (!person.family_id || !person.id) {
      return null;
    }
    return ['/families', person.family_id];
  }

  memberDetailQuery(person: BccPersonRow): Record<string, string> {
    return { member: person.id };
  }

  familyDetailLink(familyId: string | null | undefined): string[] | null {
    if (!familyId) {
      return null;
    }
    return ['/families', familyId];
  }

  genderLabel(person: BccPersonRow): string {
    const gender = (person.gender || '').trim().toLowerCase();
    if (!gender) {
      return 'Not recorded';
    }
    return gender.charAt(0).toUpperCase() + gender.slice(1);
  }

  setView(view: MembersView): void {
    if (this.view === view) {
      return;
    }
    this.view = view;
    this.sanitizeFiltersForView();
    this.buildSearchFields();
    this.page = 1;
    this.load();
    this.emitQueryChange();
  }

  onSearch(value: string): void {
    this.search = value;
    this.page = 1;
    this.load();
  }

  load(): void {
    this.loading = true;
    this.loadError = null;
    const params = { search: this.search, page: this.page, per_page: this.perPage };
    const request =
      this.view === 'people'
        ? this.api.getPeople(this.bccId, {
            ...params,
            gender: this.genderFilter,
            status: this.statusFilter,
            age_band: this.ageBand,
          })
        : this.api.getMembers(this.bccId, { ...params, status: this.statusFilter });

    request.subscribe({
      next: (res) => {
        const page = res as BccPaged<BccMembershipRow | BccPersonRow>;
        if (this.view === 'people') {
          this.people = (page.data || []) as BccPersonRow[];
        } else {
          this.families = (page.data || []) as BccMembershipRow[];
        }
        this.total = page.meta?.total ?? 0;
        this.page = page.meta?.current_page ?? 1;
        this.loading = false;
        this.cdr.markForCheck();
      },
      error: () => {
        this.loadError = 'Could not load members.';
        this.loading = false;
        this.cdr.markForCheck();
      },
    });
  }

  onPageChange(page: number): void {
    this.page = page;
    this.load();
  }

  openAssign(): void {
    if (this.subscriptionAccess.isReadOnly()) {
      this.toast.warning('Read-only mode: renew subscription to assign families.', 'Read-only');
      return;
    }
    this.showAssign = true;
    this.selectedFamily = null;
    this.lookupSearch = '';
    this.lookupResults = [];
    this.cdr.markForCheck();
  }

  searchFamilies(): void {
    this.api.lookupFamilies({ search: this.lookupSearch, exclude_bcc_id: this.bccId, per_page: 20 }).subscribe({
      next: (res) => {
        const page = res as BccPaged<BccFamilyLookup>;
        this.lookupResults = page.data || [];
        this.cdr.markForCheck();
      },
    });
  }

  assignSelected(): void {
    if (this.subscriptionAccess.isReadOnly()) {
      this.toast.warning('Read-only mode: renew subscription to assign families.', 'Read-only');
      return;
    }
    if (!this.selectedFamily) {
      return;
    }
    this.api
      .assignMembers(this.bccId, [this.selectedFamily.id], { transfer: this.transfer || !this.selectedFamily.eligible })
      .subscribe({
        next: () => {
          this.toast.success('Family added to this BCC.');
          this.showAssign = false;
          this.load();
        },
        error: (err) => {
          const conflict = err?.error?.errors?.conflict;
          if (conflict?.type === 'bcc_membership_exists') {
            this.toast.error(
              `${this.selectedFamily?.family_name} already belongs to ${conflict.existing_bcc_name || 'another BCC'}. Enable transfer to move them.`
            );
            this.transfer = true;
          } else {
            this.toast.error(err?.error?.message || 'Could not assign family.');
          }
          this.cdr.markForCheck();
        },
      });
  }

  confirmRemoval(row: BccMembershipRow): void {
    this.confirmRemove = row;
  }

  removeConfirmed(result: { confirmed: boolean }): void {
    const row = this.confirmRemove;
    this.confirmRemove = null;
    if (!result.confirmed || !row) {
      return;
    }
    if (this.subscriptionAccess.isReadOnly()) {
      this.toast.warning('Read-only mode: renew subscription to remove families.', 'Read-only');
      return;
    }
    this.api.removeMember(this.bccId, row.id).subscribe({
      next: () => {
        this.toast.success('Family removed from this BCC.');
        this.load();
      },
      error: (err) => this.toast.error(err?.error?.message || 'Could not remove family.'),
    });
  }

  statusTone(status: string): StatusBadgeTone {
    return status === 'active' ? 'success' : 'neutral';
  }
}
