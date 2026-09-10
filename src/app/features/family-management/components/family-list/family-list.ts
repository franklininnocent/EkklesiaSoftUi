import { Component, OnInit, OnDestroy, ChangeDetectionStrategy, ChangeDetectorRef, inject } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule, ReactiveFormsModule, FormBuilder, FormGroup } from '@angular/forms';
import { Router, ActivatedRoute } from '@angular/router';
import { Subject, debounceTime, takeUntil, distinctUntilChanged } from 'rxjs';
import { ToastService } from '@core/services/toast.service';
import { AuthService } from '@core/services/auth.service';
import { FamilyService } from '../../../../core/services/family.service';
import { BCCService } from '../../../../core/services/bcc.service';
import { Family, BCC, FamilyStatistics, FamilyMember } from '../../../../core/models/family.model';
import { FamilyFormComponent } from '../family-form/family-form';
import { AdvancedSearchPanelComponent, SearchField, ActiveFilter } from '@shared/components/advanced-search-panel/advanced-search-panel.component';
import { PaginationComponent } from '@shared/components/pagination/pagination.component';
import { PageHeaderComponent } from '@shared/components/page-header/page-header.component';
import { ListToolbarComponent } from '@shared/components/list-toolbar/list-toolbar.component';
import { DataTableComponent } from '@shared/components/data-table/data-table.component';
import { StatusBadgeComponent } from '@shared/components/status-badge/status-badge.component';
import { CfEmptyStateComponent } from '@shared/components/cf-empty-state/cf-empty-state.component';
import { LoadingSkeletonComponent } from '@shared/components/loading-skeleton/loading-skeleton.component';
import { SubscriptionAccessService } from '@core/services/subscription-access.service';
import { DisableWhenReadOnlyDirective } from '@shared/directives/disable-when-read-only.directive';

@Component({
  selector: 'app-family-list',
  standalone: true,
  imports: [
    CommonModule,
    FormsModule,
    ReactiveFormsModule,
    FamilyFormComponent,
    AdvancedSearchPanelComponent,
    PaginationComponent,
    PageHeaderComponent,
    ListToolbarComponent,
    DataTableComponent,
    StatusBadgeComponent,
    CfEmptyStateComponent,
    LoadingSkeletonComponent,
    DisableWhenReadOnlyDirective,
  ],
  templateUrl: './family-list.html',
  styleUrls: ['./family-list.scss'],
  changeDetection: ChangeDetectionStrategy.OnPush
})
export class FamilyListComponent implements OnInit, OnDestroy {
  private destroy$ = new Subject<void>();
  private cdr = inject(ChangeDetectorRef);
  private readonly subscriptionAccess = inject(SubscriptionAccessService);

  families: Family[] = [];
  bccs: BCC[] = [];
  statistics: FamilyStatistics | null = null;

  currentPage = 1;
  totalPages = 1;
  totalRecords = 0;
  perPage = 20;
  perPageOptions = [10, 20, 50, 100];

  loading = false;
  loaded = false;
  error: string | null = null;
  showAdvancedSearch = false;
  showForm = false;
  selectedFamily: Family | null = null;

  filterForm: FormGroup;
  searchFields: SearchField[] = [];
  searchTerm = '';

  Math = Math;
  Object = Object;

  constructor(
    private familyService: FamilyService,
    private bccService: BCCService,
    private fb: FormBuilder,
    private router: Router,
    private route: ActivatedRoute,
    private toastService: ToastService,
    private authService: AuthService
  ) {
    this.filterForm = this.fb.group({
      search: [''],
      status: [''],
      bcc_id: [''],
      missing_sacrament: [''],
      progression: [''],
      city: [''],
      sort_by: ['created_at'],
      sort_order: ['desc']
    });
  }

  get isTenantAdmin(): boolean {
    return this.authService.isTenantAdmin();
  }

  get hasActiveFiltersOrSearch(): boolean {
    return this.getActiveFilterCount() > 0 || this.searchTerm.trim().length > 0;
  }

  private resolveHeadMember(family: Family): FamilyMember | null {
    const members = family.members || [];
    if (!members.length) {
      return null;
    }

    const relPriority = ['self', 'head', 'head of family'];
    const byRelationship = members.find(member => {
      const rel = String(member.relationship_to_head || '').toLowerCase();
      return relPriority.includes(rel) && member.status === 'active';
    }) || members.find(member => {
      const rel = String(member.relationship_to_head || '').toLowerCase();
      return relPriority.includes(rel);
    });

    if (byRelationship) {
      return byRelationship;
    }

    const primaryContact = members.find(member => (member as any).is_primary_contact === true && member.status === 'active')
      || members.find(member => (member as any).is_primary_contact === true);
    if (primaryContact) {
      return primaryContact;
    }

    const activeMember = members.find(member => member.status === 'active');
    return activeMember || members[0];
  }

  getHeadContactInfo(family: Family): { phone: string | null; email: string | null } {
    const head = this.resolveHeadMember(family);
    const phone = head?.phone && String(head.phone).trim() ? String(head.phone).trim() : null;
    const email = head?.email && String(head.email).trim() ? String(head.email).trim() : null;
    return { phone, email };
  }

  ngOnInit(): void {
    this.initializeSearchFields();
    this.loadReferenceData();
    this.loadStatistics();
    this.applyQueryParams(this.route.snapshot.queryParamMap);
    this.route.queryParamMap
      .pipe(takeUntil(this.destroy$))
      .subscribe((params) => this.applyQueryParams(params));
    this.setupSearchDebounce();
  }

  private applyQueryParams(params: import('@angular/router').ParamMap): void {
    const missingSacrament = params.get('missing_sacrament') ?? '';
    const progression = params.get('progression') ?? '';
    const bccId = params.get('bcc_id') ?? '';
    let changed = false;

    if (this.filterForm.get('missing_sacrament')?.value !== missingSacrament) {
      this.filterForm.patchValue({
        missing_sacrament: missingSacrament,
        ...(missingSacrament ? { progression: '' } : {}),
      });
      changed = true;
    }

    if (this.filterForm.get('progression')?.value !== progression) {
      this.filterForm.patchValue({
        progression,
        ...(progression ? { missing_sacrament: '' } : {}),
      });
      changed = true;
    }

    if (bccId && this.filterForm.get('bcc_id')?.value !== bccId) {
      this.filterForm.patchValue({ bcc_id: bccId });
      changed = true;
    }

    const field = this.searchFields.find((row) => row.key === 'bcc_id');
    if (field && bccId) {
      field.value = bccId;
    }

    if (changed) {
      this.currentPage = 1;
      this.loadFamilies();
    } else if (!this.loaded) {
      this.loadFamilies();
    }
  }

  initializeSearchFields(): void {
    this.searchFields = [
      {
        key: 'status',
        label: 'Status',
        type: 'select',
        options: [
          { value: 'active', label: 'Active' },
          { value: 'inactive', label: 'Inactive' },
          { value: 'migrated', label: 'Migrated' }
        ],
        value: this.filterForm.get('status')?.value
      },
      {
        key: 'bcc_id',
        label: 'BCC',
        type: 'select',
        options: [],
        value: this.filterForm.get('bcc_id')?.value
      },
      {
        key: 'city',
        label: 'City',
        type: 'text',
        placeholder: 'Enter city name',
        value: this.filterForm.get('city')?.value
      }
    ];
  }

  ngOnDestroy(): void {
    this.destroy$.next();
    this.destroy$.complete();
  }

  private setupSearchDebounce(): void {
    this.filterForm.get('search')?.valueChanges
      .pipe(
        debounceTime(300),
        distinctUntilChanged(),
        takeUntil(this.destroy$)
      )
      .subscribe(() => {
        this.currentPage = 1;
        this.loadFamilies();
        this.cdr.markForCheck();
      });
  }

  private loadReferenceData(): void {
    this.bccService.getBCCs({ status: 'active' })
      .pipe(takeUntil(this.destroy$))
      .subscribe({
        next: (response) => {
          this.bccs = response.data;
          const bccField = this.searchFields.find(f => f.key === 'bcc_id');
          if (bccField) {
            bccField.options = this.bccs.map(bcc => ({
              value: bcc.id,
              label: bcc.name
            }));
          }
          this.cdr.markForCheck();
        },
        error: (error) => {
          console.error('Failed to load BCCs', error);
          this.cdr.markForCheck();
        }
      });
  }

  private loadStatistics(): void {
    this.familyService.getStatistics()
      .pipe(takeUntil(this.destroy$))
      .subscribe({
        next: (response) => {
          if (response.success && response.data) {
            this.statistics = response.data;
          }
          this.cdr.markForCheck();
        },
        error: (error) => {
          console.error('Failed to load statistics', error);
          this.cdr.markForCheck();
        }
      });
  }

  loadFamilies(): void {
    this.loading = true;
    this.error = null;
    this.cdr.markForCheck();

    const formValue = this.filterForm.value;
    const filters: any = {
      page: this.currentPage,
      per_page: this.perPage
    };

    if (formValue.search) filters.search = Array.isArray(formValue.search) ? formValue.search[0] : formValue.search;
    if (formValue.status) filters.status = Array.isArray(formValue.status) ? formValue.status[0] : formValue.status;
    if (formValue.bcc_id) filters.bcc_id = Array.isArray(formValue.bcc_id) ? formValue.bcc_id[0] : formValue.bcc_id;
    if (formValue.missing_sacrament) {
      filters.missing_sacrament = Array.isArray(formValue.missing_sacrament)
        ? formValue.missing_sacrament[0]
        : formValue.missing_sacrament;
    }
    if (formValue.progression) {
      filters.progression = Array.isArray(formValue.progression)
        ? formValue.progression[0]
        : formValue.progression;
    }
    if (formValue.city) filters.city = Array.isArray(formValue.city) ? formValue.city[0] : formValue.city;
    if (formValue.sort_by) filters.sort_by = Array.isArray(formValue.sort_by) ? formValue.sort_by[0] : formValue.sort_by;
    if (formValue.sort_order) filters.sort_order = Array.isArray(formValue.sort_order) ? formValue.sort_order[0] : formValue.sort_order;

    Object.keys(filters).forEach(key => {
      if (filters[key] === '' || filters[key] === null || filters[key] === undefined) {
        delete filters[key];
      }
    });

    this.familyService.getFamilies(filters)
      .pipe(takeUntil(this.destroy$))
      .subscribe({
        next: (response) => {
          this.families = response.data;
          this.currentPage = response.current_page;
          this.totalPages = response.last_page;
          this.totalRecords = response.total;
          this.loading = false;
          this.loaded = true;
          this.cdr.markForCheck();
        },
        error: (error) => {
          this.error = 'Failed to load families. Please try again.';
          this.loading = false;
          this.loaded = true;
          console.error('Error loading families:', error);
          this.cdr.markForCheck();
        }
      });
  }

  onListSearchChange(value: string): void {
    this.searchTerm = value ?? '';
    this.filterForm.patchValue({ search: this.searchTerm });
  }

  onAdvancedSearch(searchValues: { [key: string]: any }): void {
    this.filterForm.patchValue({
      status: searchValues['status'] || '',
      bcc_id: searchValues['bcc_id'] || '',
      city: searchValues['city'] || ''
    });
    this.currentPage = 1;
    this.loadFamilies();
    this.showAdvancedSearch = false;
  }

  onClearAdvancedSearch(): void {
    this.filterForm.patchValue({
      status: '',
      bcc_id: '',
      city: ''
    });
    this.searchFields.forEach(field => {
      field.value = undefined;
    });
    this.currentPage = 1;
    this.loadFamilies();
  }

  getActiveFilters(): ActiveFilter[] {
    const filters: ActiveFilter[] = [];
    const values = this.filterForm.value;

    if (values.status) {
      const statusLabels: {[key: string]: string} = {
        'active': 'Active',
        'inactive': 'Inactive',
        'migrated': 'Migrated'
      };
      filters.push({
        key: 'status',
        label: 'Status',
        value: values.status,
        displayValue: statusLabels[values.status] || values.status
      });
    }

    if (values.bcc_id) {
      const bcc = this.bccs.find(b => b.id === values.bcc_id);
      filters.push({
        key: 'bcc_id',
        label: 'BCC',
        value: values.bcc_id,
        displayValue: bcc?.name || String(values.bcc_id)
      });
    }

    if (values.missing_sacrament) {
      filters.push({
        key: 'missing_sacrament',
        label: 'Missing sacrament',
        value: values.missing_sacrament,
        displayValue: this.missingSacramentLabel(String(values.missing_sacrament)),
      });
    }

    if (values.progression) {
      filters.push({
        key: 'progression',
        label: 'Progression',
        value: values.progression,
        displayValue: this.progressionLabel(String(values.progression)),
      });
    }

    if (values.city) {
      filters.push({
        key: 'city',
        label: 'City',
        value: values.city,
        displayValue: values.city
      });
    }

    return filters;
  }

  getActiveFilterCount(): number {
    return this.getActiveFilters().length;
  }

  removeFilter(filter: ActiveFilter): void {
    this.filterForm.patchValue({
      [filter.key]: ''
    });

    const field = this.searchFields.find(f => f.key === filter.key);
    if (field) {
      field.value = undefined;
    }

    this.currentPage = 1;
    this.loadFamilies();
  }

  clearAllFilters(): void {
    this.filterForm.reset({
      search: '',
      status: '',
      bcc_id: '',
      missing_sacrament: '',
      progression: '',
      city: '',
      sort_by: 'created_at',
      sort_order: 'desc'
    });
    this.searchTerm = '';
    this.searchFields.forEach(field => {
      field.value = undefined;
    });
    this.currentPage = 1;
    this.loadFamilies();
  }

  onPageChange(page: number): void {
    if (page >= 1 && page <= this.totalPages) {
      this.currentPage = page;
      this.loadFamilies();
    }
  }

  onPageSizeChange(pageSize: number): void {
    this.perPage = pageSize;
    this.currentPage = 1;
    this.loadFamilies();
  }

  sortBy(column: string): void {
    const currentSortValue = this.filterForm.get('sort_by')?.value;
    const currentOrderValue = this.filterForm.get('sort_order')?.value;

    const currentSort = Array.isArray(currentSortValue) ? currentSortValue[0] : currentSortValue;
    const currentOrder = Array.isArray(currentOrderValue) ? currentOrderValue[0] : currentOrderValue;

    if (currentSort === column) {
      this.filterForm.patchValue({
        sort_order: currentOrder === 'asc' ? 'desc' : 'asc'
      });
    } else {
      this.filterForm.patchValue({
        sort_by: column,
        sort_order: 'asc'
      });
    }

    this.currentPage = 1;
    this.loadFamilies();
  }

  getSortIcon(column: string): string {
    const currentSortValue = this.filterForm.get('sort_by')?.value;
    const currentOrderValue = this.filterForm.get('sort_order')?.value;

    const currentSort = Array.isArray(currentSortValue) ? currentSortValue[0] : currentSortValue;
    const currentOrder = Array.isArray(currentOrderValue) ? currentOrderValue[0] : currentOrderValue;

    if (currentSort !== column) return '↕';
    return currentOrder === 'asc' ? '↑' : '↓';
  }

  viewFamily(family: Family): void {
    this.router.navigate(['/families', family.id]);
  }

  isReadOnly(): boolean {
    return this.subscriptionAccess.isReadOnly();
  }

  createFamily(): void {
    if (this.isReadOnly()) {
      this.toastService.warning('Read-only mode: renew subscription to add families.', 'Read-only');
      return;
    }
    this.selectedFamily = null;
    this.showForm = true;
  }

  deleteFamily(family: Family): void {
    if (this.isReadOnly()) {
      this.toastService.warning('Read-only mode: renew subscription to delete families.', 'Read-only');
      return;
    }
    if (!this.isTenantAdmin) {
      this.toastService.error('Only Tenant Administrators can delete families.', 'Permission Denied', 5000);
      return;
    }

    const familyName = family.family_name || family.family_code || 'this family';
    const memberCount = family.members?.length || 0;
    const warningMessage = memberCount > 0
      ? `Are you sure you want to delete ${familyName}? This will also delete ${memberCount} member(s) associated with this family. This action cannot be undone.`
      : `Are you sure you want to delete ${familyName}? This action cannot be undone.`;

    if (!confirm(warningMessage)) {
      return;
    }

    this.loading = true;
    this.cdr.markForCheck();

    this.familyService.deleteFamily(family.id)
      .pipe(takeUntil(this.destroy$))
      .subscribe({
        next: (response) => {
          if (response.success) {
            this.toastService.success('Family deleted successfully', 'Success', 4000);
            this.loadFamilies();
          } else {
            this.toastService.error(response.message || 'Failed to delete family', 'Error', 5000);
          }
          this.loading = false;
          this.cdr.markForCheck();
        },
        error: (err) => {
          console.error('Error deleting family:', err);
          this.toastService.error(err.error?.message || 'Failed to delete family', 'Error', 6000);
          this.loading = false;
          this.cdr.markForCheck();
        }
      });
  }

  onFormSave(_family: Family): void {
    this.showForm = false;
    this.selectedFamily = null;
    this.loadFamilies();
    this.loadStatistics();
    this.toastService.success('Family saved successfully!', 'Success');
  }

  onFormCancel(): void {
    this.showForm = false;
    this.selectedFamily = null;
  }

  getInitials(name: string): string {
    if (!name) return '';
    const parts = name.trim().split(/\s+/).filter(Boolean);
    if (parts.length === 1) {
      return parts[0].slice(0, 2).toUpperCase();
    }
    const first = parts[0].charAt(0);
    const last = parts[parts.length - 1].charAt(0);
    return (first + last).toUpperCase();
  }

  private brokenAvatarIds = new Set<string>();

  isAvatarBroken(family: Family): boolean {
    return this.brokenAvatarIds.has(family.id);
  }

  onAvatarError(family: Family): void {
    this.brokenAvatarIds.add(family.id);
  }

  getAvatarColorClass(seed: string | undefined): string {
    const text = (seed || '').trim();
    if (!text) return 'avatar-color-1';
    let hash = 0;
    for (let i = 0; i < text.length; i++) {
      hash = ((hash << 5) - hash) + text.charCodeAt(i);
      hash |= 0;
    }
    const idx = Math.abs(hash) % 8;
    return `avatar-color-${idx + 1}`;
  }

  getHeadImageUrl(family: Family): string | null {
    if (family.head_profile_image_full_url && family.head_profile_image_full_url.trim()) {
      return family.head_profile_image_full_url;
    }

    if (family.head_profile_image_url && family.head_profile_image_url.trim()) {
      if (family.head_profile_image_url.startsWith('http://') || family.head_profile_image_url.startsWith('https://')) {
        return family.head_profile_image_url;
      }
      return family.head_profile_image_url;
    }

    if (family.head_avatar_url && family.head_avatar_url.trim()) {
      return family.head_avatar_url;
    }

    const headMember = this.resolveHeadMember(family);
    if (headMember) {
      const member = headMember as any;
      if (member.profile_image_full_url && member.profile_image_full_url.trim()) {
        return member.profile_image_full_url;
      }
      if (member.profile_image_url && member.profile_image_url.trim()) {
        return member.profile_image_url;
      }
      if (member.avatar_url && member.avatar_url.trim()) {
        return member.avatar_url;
      }
    }

    return null;
  }

  private missingSacramentLabel(code: string): string {
    const labels: Record<string, string> = {
      BAPTISM: 'Baptism',
      EUCHARIST: 'First Communion',
      CONFIRMATION: 'Confirmation',
      MATRIMONY: 'Marriage',
    };

    return labels[code.toUpperCase()] ?? code;
  }

  private progressionLabel(key: string): string {
    const labels: Record<string, string> = {
      baptized_without_communion: 'Baptized, no First Communion (age 10+)',
      baptized_without_confirmation: 'Baptized, no Confirmation (age 10+)',
      female_unmarried_over_18: 'Female (>18) - Not Married',
      male_unmarried_over_23: 'Male (>23) - Not Married',
    };

    return labels[key] ?? key;
  }
}
