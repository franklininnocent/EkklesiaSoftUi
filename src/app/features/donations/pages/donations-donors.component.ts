import { CommonModule } from '@angular/common';
import { ChangeDetectorRef, Component, OnDestroy, OnInit } from '@angular/core';
import { FormBuilder, ReactiveFormsModule, Validators } from '@angular/forms';
import { NavigationEnd, Router, RouterModule } from '@angular/router';
import { filter, Subscription } from 'rxjs';
import { AuthService } from '@core/services/auth.service';
import {
  AdvancedSearchPanelComponent,
  SearchField,
} from '@shared/components/advanced-search-panel/advanced-search-panel.component';
import { CfEmptyStateComponent } from '@shared/components/cf-empty-state/cf-empty-state.component';
import { DataTableComponent } from '@shared/components/data-table/data-table.component';
import { ListToolbarComponent } from '@shared/components/list-toolbar/list-toolbar.component';
import { LoadingSkeletonComponent } from '@shared/components/loading-skeleton/loading-skeleton.component';
import { PageHeaderComponent } from '@shared/components/page-header/page-header.component';
import { StewardshipActiveFilterChipsComponent } from '../components/stewardship-active-filter-chips/stewardship-active-filter-chips.component';
import { DonationsService } from '../services/donations.service';
import { QuickCollectService } from '../services/quick-collect.service';
import { Donor } from '../models/donation.model';
import { CfActionIconComponent } from '@shared/components/cf-action-icon/cf-action-icon.component';
import { ModalShellComponent } from '@shared/components/modal-shell/modal-shell.component';
import { SortableDirective, SortDirection, SortEvent } from '@shared/directives/sortable.directive';

type DonorSortColumn = 'name' | 'donor_type' | 'contact';

@Component({
  selector: 'app-donations-donors',
  standalone: true,
  imports: [
    CommonModule,
    ReactiveFormsModule,
    RouterModule,
    CfEmptyStateComponent,
    LoadingSkeletonComponent,
    CfActionIconComponent,
    PageHeaderComponent,
    ListToolbarComponent,
    StewardshipActiveFilterChipsComponent,
    AdvancedSearchPanelComponent,
    DataTableComponent,
    ModalShellComponent,
    SortableDirective,
  ],
  templateUrl: './donations-donors.component.html',
  styleUrls: ['./donations-donors.component.scss', '../styles/stewardship-dashboard-shared.scss'],
})
export class DonationsDonorsComponent implements OnInit, OnDestroy {
  donors: Donor[] = [];
  donorsLoaded = false;
  donorsLoadError: string | null = null;
  private loadDonorsSeq = 0;
  private routerSub?: Subscription;
  private skipNextNavReload = true;
  tableSearch = '';
  showForm = false;
  showFilters = false;
  saving = false;
  canManage = false;
  searchFields: SearchField[] = [];
  sortColumn: DonorSortColumn = 'name';
  sortDirection: SortDirection = 'asc';

  form = this.fb.group({
    name: ['', Validators.required],
    email: [''],
    phone: [''],
    donor_type: ['external'],
  });

  constructor(
    private fb: FormBuilder,
    private donationsService: DonationsService,
    private authService: AuthService,
    private quickCollectService: QuickCollectService,
    private router: Router,
    private cdr: ChangeDetectorRef
  ) {}

  ngOnInit(): void {
    this.canManage = this.authService.hasPermission('donations.manage');
    this.initSearchFields();
    this.load();
    this.routerSub = this.router.events.pipe(filter((e): e is NavigationEnd => e instanceof NavigationEnd)).subscribe((e) => {
      if (!e.urlAfterRedirects.includes('/donations/donors')) {
        return;
      }
      if (this.skipNextNavReload) {
        this.skipNextNavReload = false;
        return;
      }
      this.load();
    });
  }

  ngOnDestroy(): void {
    this.routerSub?.unsubscribe();
  }

  get activeFilterCount(): number {
    return this.tableSearch.trim() ? 1 : 0;
  }

  get activeFilterChips(): { label: string }[] {
    if (!this.tableSearch.trim()) {
      return [];
    }
    return [{ label: `Search: ${this.tableSearch.trim()}` }];
  }

  get filteredDonors(): Donor[] {
    const query = this.tableSearch.trim().toLowerCase();
    const base = !query
      ? this.donors
      : this.donors.filter((donor) =>
          [donor.name, donor.email, donor.phone, donor.donor_type]
            .filter(Boolean)
            .join(' ')
            .toLowerCase()
            .includes(query)
        );
    if (!this.sortDirection) {
      return base;
    }
    const direction = this.sortDirection === 'asc' ? 1 : -1;
    return [...base].sort((a, b) => direction * this.compareDonorsForSort(a, b));
  }

  onSort(event: SortEvent): void {
    if (event.column !== 'name' && event.column !== 'donor_type' && event.column !== 'contact') {
      return;
    }
    this.sortColumn = event.column as DonorSortColumn;
    this.sortDirection = event.direction ?? 'asc';
    this.cdr.detectChanges();
  }

  trackDonor(_index: number, donor: Donor): string {
    return donor.id;
  }

  donorTypeLabel(type?: string): string {
    return (
      {
        external: 'External',
        individual: 'Individual',
        family: 'Family',
        organization: 'Organization',
      } as Record<string, string>
    )[type || 'external'] || type || '—';
  }

  openQuickCollect(): void {
    this.quickCollectService.open();
  }

  openAddDonor(): void {
    this.form.reset({ name: '', email: '', phone: '', donor_type: 'external' });
    this.showForm = true;
  }

  closeAddDonor(): void {
    if (this.saving) {
      return;
    }
    this.showForm = false;
  }

  onAdvancedSearch(values: { [key: string]: unknown }): void {
    this.tableSearch = String(values['search'] ?? '').trim();
    this.showFilters = false;
    this.syncSearchFieldValues();
    this.cdr.detectChanges();
  }

  onClearAdvancedSearch(): void {
    this.tableSearch = '';
    this.showFilters = false;
    this.syncSearchFieldValues();
    this.cdr.detectChanges();
  }

  clearSearchFilter(): void {
    this.onClearAdvancedSearch();
  }

  load(): void {
    const seq = ++this.loadDonorsSeq;
    this.donorsLoaded = false;
    this.donorsLoadError = null;
    this.donationsService.getDonors().subscribe({
      next: (res) => {
        if (seq !== this.loadDonorsSeq) {
          return;
        }
        const rows = Array.isArray(res.data?.data) ? res.data.data : [];
        this.donors = rows;
        this.donorsLoaded = true;
        this.cdr.detectChanges();
      },
      error: () => {
        if (seq !== this.loadDonorsSeq) {
          return;
        }
        this.donorsLoaded = true;
        this.donorsLoadError = 'Unable to load donors. Please try again.';
        this.cdr.detectChanges();
      },
    });
  }

  save(): void {
    if (this.form.invalid) {
      return;
    }
    this.saving = true;
    this.donationsService.createDonor(this.form.getRawValue()).subscribe({
      next: () => {
        this.saving = false;
        this.form.reset({ donor_type: 'external' });
        this.showForm = false;
        this.load();
        this.cdr.detectChanges();
      },
      error: () => {
        this.saving = false;
        this.cdr.detectChanges();
      },
    });
  }

  private initSearchFields(): void {
    this.searchFields = [
      {
        key: 'search',
        label: 'Name, email, or phone',
        type: 'text',
        placeholder: 'Filter donors…',
        value: this.tableSearch.trim() || undefined,
      },
    ];
  }

  private syncSearchFieldValues(): void {
    const field = this.searchFields.find((f) => f.key === 'search');
    if (field) {
      field.value = this.tableSearch.trim() || undefined;
    }
  }

  private compareDonorsForSort(a: Donor, b: Donor): number {
    const col = this.sortColumn;
    if (col === 'name') {
      return (a.name || '').localeCompare(b.name || '', undefined, { sensitivity: 'base' });
    }
    if (col === 'donor_type') {
      return this.donorTypeLabel(a.donor_type).localeCompare(this.donorTypeLabel(b.donor_type), undefined, {
        sensitivity: 'base',
      });
    }
    return this.donorContactSortKey(a).localeCompare(this.donorContactSortKey(b), undefined, { sensitivity: 'base' });
  }

  private donorContactSortKey(donor: Donor): string {
    const email = (donor.email || '').trim();
    const phone = (donor.phone || '').trim();
    if (email && phone) {
      return `${email} ${phone}`.toLowerCase();
    }
    return (email || phone || '').toLowerCase();
  }
}
