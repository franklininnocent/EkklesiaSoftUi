import { CommonModule } from '@angular/common';
import { HttpErrorResponse } from '@angular/common/http';
import {
  ChangeDetectionStrategy,
  ChangeDetectorRef,
  Component,
  Input,
  OnChanges,
  OnInit,
  SimpleChanges,
  inject,
} from '@angular/core';
import { FormBuilder, FormsModule, ReactiveFormsModule, Validators } from '@angular/forms';
import { ToastService } from '@core/services/toast.service';
import { RouterLink } from '@angular/router';
import {
  CfActionIconComponent,
  CfActionIconName,
} from '@shared/components/cf-action-icon/cf-action-icon.component';
import {
  CfActiveFilterChip,
  CfActiveFilterChipsComponent,
} from '@shared/components/cf-active-filter-chips/cf-active-filter-chips.component';
import { CfEmptyStateComponent } from '@shared/components/cf-empty-state/cf-empty-state.component';
import { DataTableComponent } from '@shared/components/data-table/data-table.component';
import { FormFieldComponent } from '@shared/components/form-field/form-field.component';
import {
  AdvancedSearchPanelComponent,
  SearchField,
} from '@shared/components/advanced-search-panel/advanced-search-panel.component';
import { ListToolbarComponent } from '@shared/components/list-toolbar/list-toolbar.component';
import { LoadingSkeletonComponent } from '@shared/components/loading-skeleton/loading-skeleton.component';
import { ModalShellComponent } from '@shared/components/modal-shell/modal-shell.component';
import {
  ConfirmationModalComponent,
  ConfirmationResult,
} from '@shared/components/confirmation-modal/confirmation-modal.component';
import { StatusBadgeComponent } from '@shared/components/status-badge/status-badge.component';
import {
  OrganizationCategory,
  OrganizationType,
  Position,
} from '../../models/ministries.model';
import { MinistriesApiService } from '../../services/ministries-api.service';
import { SortableDirective, SortEvent } from '@shared/directives/sortable.directive';

export type TaxonomyKind = 'categories' | 'types' | 'positions';

type TaxonomyItem = OrganizationCategory | OrganizationType | Position;

type TaxonomyStatusFilter = '' | 'active' | 'inactive';
type TaxonomyOccupancyFilter = '' | 'single' | 'multiple';
type TaxonomySortBy =
  | 'code'
  | 'name'
  | 'description'
  | 'display_order'
  | 'is_active'
  | 'single_occupancy';

@Component({
  selector: 'app-taxonomy-crud-panel',
  standalone: true,
  imports: [
    CommonModule,
    FormsModule,
    ReactiveFormsModule,
    RouterLink,
    CfActionIconComponent,
    CfActiveFilterChipsComponent,
    CfEmptyStateComponent,
    DataTableComponent,
    FormFieldComponent,
    AdvancedSearchPanelComponent,
    ListToolbarComponent,
    LoadingSkeletonComponent,
    ModalShellComponent,
    ConfirmationModalComponent,
    StatusBadgeComponent,
    SortableDirective,
  ],
  templateUrl: './taxonomy-crud-panel.component.html',
  styleUrl: './taxonomy-crud-panel.component.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class TaxonomyCrudPanelComponent implements OnInit, OnChanges {
  private readonly api = inject(MinistriesApiService);
  private readonly toastService = inject(ToastService);
  private readonly fb = inject(FormBuilder);
  private readonly cdr = inject(ChangeDetectorRef);

  private loadSeq = 0;

  @Input({ required: true }) kind!: TaxonomyKind;
  @Input() canConfigure = false;

  readonly listTitles: Record<TaxonomyKind, string> = {
    categories: 'Categories',
    types: 'Types',
    positions: 'Positions',
  };

  items: TaxonomyItem[] = [];
  loaded = false;
  loadError: string | null = null;
  tableSearch = '';
  showFilters = false;
  statusFilter: TaxonomyStatusFilter = '';
  occupancyFilter: TaxonomyOccupancyFilter = '';
  sortBy: TaxonomySortBy = 'display_order';
  sortDir: 'asc' | 'desc' = 'asc';
  searchFields: SearchField[] = [];
  showForm = false;
  editingId: string | null = null;
  saving = false;
  statusUpdatingId: string | null = null;
  statusError: string | null = null;
  submitted = false;
  formError: string | null = null;
  fieldErrors: Record<string, string> = {};
  selectedId: string | null = null;
  confirmDeactivateOpen = false;
  pendingDeactivate: TaxonomyItem | null = null;
  private pendingDeactivateViaForm = false;

  form = this.fb.nonNullable.group({
    code: [
      '',
      [
        Validators.required,
        Validators.minLength(2),
        Validators.maxLength(50),
        Validators.pattern(/^[a-zA-Z0-9-]+$/),
      ],
    ],
    name: [
      '',
      [Validators.required, Validators.minLength(2), Validators.maxLength(100)],
    ],
    description: [''],
    display_order: [0, [Validators.min(0)]],
    is_active: [true],
    single_occupancy: [true],
  });

  ngOnInit(): void {
    this.initSearchFields();
    this.load();
  }

  ngOnChanges(changes: SimpleChanges): void {
    if (changes['kind'] && !changes['kind'].firstChange) {
      this.tableSearch = '';
      this.resetDrawerFilters();
      this.statusError = null;
      this.selectedId = null;
      this.closeForm();
      this.initSearchFields();
      this.load();
    }
  }

  get drawerFilterCount(): number {
    let count = this.statusFilter ? 1 : 0;
    if (this.isPositionsKind && this.occupancyFilter) {
      count += 1;
    }
    return count;
  }

  get hasActiveFilters(): boolean {
    return this.activeFilterChips.length > 0;
  }

  get activeFilterChips(): CfActiveFilterChip[] {
    const chips: CfActiveFilterChip[] = [];
    const query = this.tableSearch.trim();
    if (query) {
      chips.push({ key: 'search', label: 'Search', value: query });
    }
    if (this.statusFilter) {
      chips.push({
        key: 'statusFilter',
        label: 'Status',
        value: this.statusFilter === 'active' ? 'Active' : 'Inactive',
      });
    }
    if (this.isPositionsKind && this.occupancyFilter) {
      chips.push({
        key: 'occupancyFilter',
        label: 'Occupancy',
        value: this.occupancyFilter === 'single' ? 'Single' : 'Multiple',
      });
    }
    return chips;
  }

  get filteredItems(): TaxonomyItem[] {
    let result = this.items;

    const query = this.tableSearch.trim().toLowerCase();
    if (query) {
      result = result.filter((item) =>
        [item.code, item.name, item.description]
          .filter(Boolean)
          .join(' ')
          .toLowerCase()
          .includes(query),
      );
    }

    if (this.statusFilter === 'active') {
      result = result.filter((item) => item.is_active);
    } else if (this.statusFilter === 'inactive') {
      result = result.filter((item) => !item.is_active);
    }

    if (this.isPositionsKind && this.occupancyFilter === 'single') {
      result = result.filter((item) => this.isPosition(item) && item.single_occupancy);
    } else if (this.isPositionsKind && this.occupancyFilter === 'multiple') {
      result = result.filter((item) => this.isPosition(item) && !item.single_occupancy);
    }

    return [...result].sort((a, b) => this.compareItems(a, b));
  }

  get singularLabel(): string {
    switch (this.kind) {
      case 'categories':
        return 'category';
      case 'types':
        return 'type';
      case 'positions':
        return 'position';
    }
  }

  get addActionLabel(): string {
    return `Add ${this.singularLabel}`;
  }

  get listTitle(): string {
    return this.listTitles[this.kind];
  }

  get isPositionsKind(): boolean {
    return this.kind === 'positions';
  }

  get formTitle(): string {
    return this.editingId ? `Edit ${this.singularLabel}` : `Add ${this.singularLabel}`;
  }

  get submitLabel(): string {
    if (this.saving) {
      return 'Saving…';
    }
    return this.editingId ? 'Save changes' : `Add ${this.singularLabel}`;
  }

  onSearchChange(value: string): void {
    this.tableSearch = value;
    this.cdr.markForCheck();
  }

  onAdvancedSearch(values: { [key: string]: unknown }): void {
    this.statusFilter = ((values['statusFilter'] as TaxonomyStatusFilter) || '') as TaxonomyStatusFilter;
    this.occupancyFilter = ((values['occupancyFilter'] as TaxonomyOccupancyFilter) || '') as TaxonomyOccupancyFilter;
    this.sortBy = ((values['sortBy'] as TaxonomySortBy) || 'display_order') as TaxonomySortBy;
    this.sortDir = ((values['sortDir'] as 'asc' | 'desc') || 'asc') as 'asc' | 'desc';
    this.showFilters = false;
    this.cdr.markForCheck();
  }

  onClearAdvancedSearch(): void {
    this.resetDrawerFilters();
    this.initSearchFields();
    this.cdr.markForCheck();
  }

  onSort(event: SortEvent): void {
    if (!this.isSortableColumn(event.column)) {
      return;
    }
    this.sortBy = event.column as TaxonomySortBy;
    this.sortDir = event.direction ?? 'asc';
    this.initSearchFields();
    this.cdr.markForCheck();
  }

  onActiveFilterChipRemove(chip: CfActiveFilterChip): void {
    switch (chip.key) {
      case 'search':
        this.tableSearch = '';
        break;
      case 'statusFilter':
        this.statusFilter = '';
        break;
      case 'occupancyFilter':
        this.occupancyFilter = '';
        break;
    }
    this.initSearchFields();
    this.cdr.markForCheck();
  }

  clearAllListFilters(): void {
    this.tableSearch = '';
    this.resetDrawerFilters();
    this.initSearchFields();
    this.cdr.markForCheck();
  }

  statusLabel(item: TaxonomyItem): string {
    return item.is_active ? 'Active' : 'Inactive';
  }

  statusTone(item: TaxonomyItem): 'success' | 'neutral' {
    return item.is_active ? 'success' : 'neutral';
  }

  occupancyLabel(item: TaxonomyItem): string {
    return this.isPosition(item) && item.single_occupancy ? 'Single' : 'Multiple';
  }

  get selectedItem(): TaxonomyItem | null {
    if (!this.selectedId) {
      return null;
    }
    const item = this.items.find((row) => row.id === this.selectedId);
    if (!item) {
      return null;
    }
    return this.filteredItems.some((row) => row.id === item.id) ? item : null;
  }

  get editSelectedAriaLabel(): string {
    const item = this.selectedItem;
    return item ? `Edit ${item.name}` : 'Edit';
  }

  get statusSelectedAriaLabel(): string {
    const item = this.selectedItem;
    if (!item) {
      return 'Deactivate';
    }
    if (this.statusUpdatingId === item.id) {
      return 'Updating status…';
    }
    return item.is_active ? `Deactivate ${item.name}` : `Activate ${item.name}`;
  }

  get statusSelectedIcon(): CfActionIconName {
    const item = this.selectedItem;
    if (item && !item.is_active) {
      return 'play';
    }
    return 'badge-minus';
  }

  get statusUpdatingSelected(): boolean {
    const item = this.selectedItem;
    return !!item && this.statusUpdatingId === item.id;
  }

  get canToggleStatusSelected(): boolean {
    const item = this.selectedItem;
    return !!item && !this.statusUpdatingId;
  }

  isSelected(item: TaxonomyItem): boolean {
    return this.selectedId === item.id;
  }

  onSelectItem(item: TaxonomyItem, checked: boolean): void {
    if (checked) {
      this.selectedId = item.id;
    } else if (this.selectedId === item.id) {
      this.selectedId = null;
    }
    this.cdr.markForCheck();
  }

  editSelected(): void {
    const item = this.selectedItem;
    if (!item) {
      return;
    }
    this.editItem(item);
  }

  toggleStatusSelected(): void {
    const item = this.selectedItem;
    if (!item) {
      return;
    }
    if (item.is_active) {
      this.pendingDeactivate = item;
      this.confirmDeactivateOpen = true;
      this.cdr.markForCheck();
      return;
    }
    this.toggleStatus(item);
  }

  get deactivateConfirmTitle(): string {
    const name = this.pendingDeactivate?.name ?? this.singularLabel;
    return `Deactivate ${name}?`;
  }

  get deactivateConfirmMessage(): string {
    const name = this.pendingDeactivate?.name ?? `This ${this.singularLabel}`;
    const item = this.pendingDeactivate;
    if (item && this.isPosition(item)) {
      return (
        `${name} will be hidden from new leadership assignment forms. ` +
        `Current leadership records are not changed. You can activate it again at any time.`
      );
    }
    return (
      `${name} will be hidden from new organization and leadership forms. ` +
      `Existing organizations are not changed. You can activate it again at any time.`
    );
  }

  onDeactivateConfirmed(result: ConfirmationResult): void {
    this.confirmDeactivateOpen = false;
    const item = this.pendingDeactivate;
    const viaForm = this.pendingDeactivateViaForm;
    this.pendingDeactivate = null;
    this.pendingDeactivateViaForm = false;
    if (!result.confirmed || !item) {
      this.cdr.markForCheck();
      return;
    }
    if (viaForm) {
      this.executeSave();
      return;
    }
    this.toggleStatus(item);
  }

  closeDeactivateConfirm(): void {
    this.confirmDeactivateOpen = false;
    this.pendingDeactivate = null;
    this.pendingDeactivateViaForm = false;
    this.cdr.markForCheck();
  }

  nameErrorText(): string | null {
    const field = this.fieldError('name');
    if (field) {
      return field;
    }
    if (!this.submitted) {
      return null;
    }
    if (this.form.controls.name.hasError('required')) {
      return 'Name is required.';
    }
    if (this.form.controls.name.hasError('minlength')) {
      return 'Name must be at least 2 characters.';
    }
    if (this.form.controls.name.hasError('maxlength')) {
      return 'Name must be 100 characters or fewer.';
    }
    return null;
  }

  codeErrorText(): string | null {
    const field = this.fieldError('code');
    if (field) {
      return field;
    }
    if (!this.submitted) {
      return null;
    }
    if (this.form.controls.code.hasError('required')) {
      return 'Code is required.';
    }
    if (this.form.controls.code.hasError('minlength')) {
      return 'Code must be at least 2 characters.';
    }
    if (this.form.controls.code.hasError('maxlength')) {
      return 'Code must be 50 characters or fewer.';
    }
    if (this.form.controls.code.hasError('pattern')) {
      return 'Use letters, numbers, and hyphens only.';
    }
    return null;
  }

  orderErrorText(): string | null {
    const field = this.fieldError('display_order');
    if (field) {
      return field;
    }
    if (this.submitted && this.form.controls.display_order.hasError('min')) {
      return 'Order cannot be negative.';
    }
    return null;
  }

  private initSearchFields(): void {
    const fields: SearchField[] = [
      {
        key: 'statusFilter',
        label: 'Status',
        type: 'select',
        options: [
          { value: 'active', label: 'Active' },
          { value: 'inactive', label: 'Inactive' },
        ],
        value: this.statusFilter || undefined,
      },
    ];

    if (this.isPositionsKind) {
      fields.push({
        key: 'occupancyFilter',
        label: 'Occupancy',
        type: 'select',
        options: [
          { value: 'single', label: 'Single' },
          { value: 'multiple', label: 'Multiple' },
        ],
        value: this.occupancyFilter || undefined,
      });
    }

    fields.push(
      {
        key: 'sortBy',
        label: 'Sort by',
        type: 'select',
        options: [
          { value: 'display_order', label: 'Order' },
          { value: 'code', label: 'Code' },
          { value: 'name', label: 'Name' },
          { value: 'description', label: 'Description' },
          { value: 'is_active', label: 'Status' },
          ...(this.isPositionsKind
            ? [{ value: 'single_occupancy', label: 'Occupancy' }]
            : []),
        ],
        value: this.sortBy,
      },
      {
        key: 'sortDir',
        label: 'Sort direction',
        type: 'select',
        options: [
          { value: 'asc', label: 'Ascending' },
          { value: 'desc', label: 'Descending' },
        ],
        value: this.sortDir,
      },
    );

    this.searchFields = fields;
  }

  private resetDrawerFilters(): void {
    this.statusFilter = '';
    this.occupancyFilter = '';
    this.sortBy = 'display_order';
    this.sortDir = 'asc';
  }

  private isSortableColumn(column: string): boolean {
    const base: TaxonomySortBy[] = [
      'code',
      'name',
      'description',
      'display_order',
      'is_active',
    ];
    if (base.includes(column as TaxonomySortBy)) {
      return true;
    }
    return column === 'single_occupancy' && this.isPositionsKind;
  }

  private compareItems(a: TaxonomyItem, b: TaxonomyItem): number {
    let cmp = 0;
    switch (this.sortBy) {
      case 'display_order':
        cmp = a.display_order - b.display_order;
        break;
      case 'name':
        cmp = a.name.localeCompare(b.name, undefined, { sensitivity: 'base' });
        break;
      case 'code':
        cmp = a.code.localeCompare(b.code, undefined, { sensitivity: 'base' });
        break;
      case 'description':
        cmp = (a.description ?? '').localeCompare(b.description ?? '', undefined, {
          sensitivity: 'base',
        });
        break;
      case 'is_active':
        cmp = Number(a.is_active) - Number(b.is_active);
        break;
      case 'single_occupancy':
        cmp =
          Number(this.isPosition(a) && a.single_occupancy) -
          Number(this.isPosition(b) && b.single_occupancy);
        break;
      default:
        cmp = a.display_order - b.display_order;
    }

    if (cmp === 0) {
      cmp =
        a.display_order - b.display_order ||
        a.name.localeCompare(b.name, undefined, { sensitivity: 'base' });
    }

    return this.sortDir === 'desc' ? -cmp : cmp;
  }

  load(): void {
    const seq = ++this.loadSeq;
    this.loaded = false;
    this.loadError = null;
    this.statusError = null;
    this.cdr.markForCheck();

    const request$ =
      this.kind === 'categories'
        ? this.api.listCategories()
        : this.kind === 'types'
          ? this.api.listTypes()
          : this.api.listPositions();

    request$.subscribe({
      next: (response) => {
        if (seq !== this.loadSeq) {
          return;
        }

        this.items = [...response.data].sort(
          (a, b) => a.display_order - b.display_order || a.name.localeCompare(b.name),
        );
        this.loaded = true;
        this.cdr.markForCheck();
      },
      error: () => {
        if (seq !== this.loadSeq) {
          return;
        }

        this.loaded = true;
        this.loadError = `Unable to load ${this.listTitle.toLowerCase()}. Please try again.`;
        this.cdr.markForCheck();
      },
    });
  }

  openCreateForm(): void {
    this.selectedId = null;
    this.editingId = null;
    this.submitted = false;
    this.formError = null;
    this.fieldErrors = {};
    this.form.reset({
      code: '',
      name: '',
      description: '',
      display_order: 0,
      is_active: true,
      single_occupancy: true,
    });
    this.form.controls.code.enable();
    this.showForm = true;
    this.cdr.markForCheck();
  }

  editItem(item: TaxonomyItem): void {
    this.editingId = item.id;
    this.submitted = false;
    this.formError = null;
    this.fieldErrors = {};
    this.form.reset({
      code: item.code,
      name: item.name,
      description: item.description ?? '',
      display_order: item.display_order,
      is_active: item.is_active,
      single_occupancy: this.isPosition(item) ? item.single_occupancy : true,
    });
    this.form.controls.code.disable();
    this.showForm = true;
    this.cdr.markForCheck();
  }

  closeForm(): void {
    this.showForm = false;
    this.editingId = null;
    this.submitted = false;
    this.formError = null;
    this.fieldErrors = {};
    this.form.controls.code.enable();
    this.form.reset({
      code: '',
      name: '',
      description: '',
      display_order: 0,
      is_active: true,
      single_occupancy: true,
    });
  }

  fieldError(controlName: string): string | null {
    return this.fieldErrors[controlName] ?? null;
  }

  save(): void {
    this.submitted = true;
    this.formError = null;
    this.fieldErrors = {};

    if (this.form.invalid || this.saving) {
      this.form.markAllAsTouched();
      this.cdr.markForCheck();
      return;
    }

    const raw = this.form.getRawValue();
    if (this.editingId && this.isPositionsKind && !raw.is_active) {
      const existing = this.items.find((row) => row.id === this.editingId);
      if (existing?.is_active) {
        this.pendingDeactivate = existing;
        this.pendingDeactivateViaForm = true;
        this.confirmDeactivateOpen = true;
        this.cdr.markForCheck();
        return;
      }
    }

    this.executeSave();
  }

  private executeSave(): void {
    const raw = this.form.getRawValue();
    const description = raw.description.trim() || null;
    this.saving = true;
    this.cdr.markForCheck();

    const createPayload = {
      code: raw.code.trim(),
      name: raw.name.trim(),
      description,
      display_order: Number(raw.display_order) || 0,
      is_active: raw.is_active,
    };

    const updatePayload = {
      name: raw.name.trim(),
      description,
      display_order: Number(raw.display_order) || 0,
      is_active: raw.is_active,
    };

    const request$ = this.buildSaveRequest(createPayload, updatePayload, raw.single_occupancy);

    request$.subscribe({
      next: (response) => {
        this.saving = false;
        this.toastService.success(
          response.message ||
            (this.editingId
              ? `${this.capitalize(this.singularLabel)} updated.`
              : `${this.capitalize(this.singularLabel)} created.`),
          'Success',
        );
        this.closeForm();
        this.load();
        this.cdr.markForCheck();
      },
      error: (err) => {
        this.saving = false;
        this.applySaveError(err);
        this.cdr.markForCheck();
      },
    });
  }

  toggleStatus(item: TaxonomyItem): void {
    if (this.statusUpdatingId) {
      return;
    }

    const nextActive = !item.is_active;
    const actionLabel = nextActive ? 'activated' : 'deactivated';
    this.statusUpdatingId = item.id;
    this.statusError = null;
    this.cdr.markForCheck();

    const request$ =
      this.kind === 'categories'
        ? this.api.updateCategoryStatus(item.id, { is_active: nextActive })
        : this.kind === 'types'
          ? this.api.updateTypeStatus(item.id, { is_active: nextActive })
          : this.api.updatePositionStatus(item.id, { is_active: nextActive });

    request$.subscribe({
      next: (response) => {
        this.statusUpdatingId = null;
        this.statusError = null;
        this.toastService.success(
          response.message || `${this.capitalize(this.singularLabel)} ${actionLabel}.`,
          'Success',
        );
        if (this.editingId === item.id) {
          this.closeForm();
        }
        this.load();
        this.cdr.markForCheck();
      },
      error: (err) => {
        this.statusUpdatingId = null;
        const message = this.mapStatusError(err, nextActive);
        this.statusError = message;
        this.toastService.error(
          message,
          `Could not ${nextActive ? 'activate' : 'deactivate'} ${this.singularLabel}`,
        );
        this.cdr.markForCheck();
      },
    });
  }

  isPosition(item: TaxonomyItem): item is Position {
    return 'single_occupancy' in item;
  }

  clearStatusError(): void {
    this.statusError = null;
    this.cdr.markForCheck();
  }

  private buildSaveRequest(
    createPayload: {
      code: string;
      name: string;
      description: string | null;
      display_order: number;
      is_active: boolean;
    },
    updatePayload: {
      name: string;
      description: string | null;
      display_order: number;
      is_active: boolean;
    },
    singleOccupancy: boolean,
  ) {
    if (this.kind === 'categories') {
      return this.editingId
        ? this.api.updateCategory(this.editingId, updatePayload)
        : this.api.createCategory(createPayload);
    }

    if (this.kind === 'types') {
      return this.editingId
        ? this.api.updateType(this.editingId, updatePayload)
        : this.api.createType(createPayload);
    }

    // Positions Form Requests do not accept `description` (no DB column).
    const { description: _ignoredCreateDescription, ...positionCreateBase } = createPayload;
    const { description: _ignoredUpdateDescription, ...positionUpdateBase } = updatePayload;
    const positionCreate = { ...positionCreateBase, single_occupancy: singleOccupancy };
    const positionUpdate = { ...positionUpdateBase, single_occupancy: singleOccupancy };

    return this.editingId
      ? this.api.updatePosition(this.editingId, positionUpdate)
      : this.api.createPosition(positionCreate);
  }

  private mapStatusError(error: unknown, activating: boolean): string {
    const fallback = activating
      ? `Could not activate this ${this.singularLabel}. Please try again.`
      : `Could not deactivate this ${this.singularLabel}. Please try again.`;

    if (!(error instanceof HttpErrorResponse)) {
      return fallback;
    }

    const payload = error.error as {
      message?: string;
      errors?: Record<string, string[] | unknown>;
    } | null;

    const fieldMessages = payload?.errors
      ? Object.values(payload.errors)
          .flatMap((value) => (Array.isArray(value) ? value : []))
          .filter((value): value is string => typeof value === 'string' && value.trim().length > 0)
          .join(' ')
      : '';

    if (error.status === 422) {
      return (
        payload?.message?.trim() ||
        fieldMessages ||
        (activating
          ? `This ${this.singularLabel} could not be activated.`
          : `This ${this.singularLabel} cannot be deactivated while it is still in use.`)
      );
    }

    return payload?.message?.trim() || fieldMessages || fallback;
  }

  private applySaveError(error: unknown): void {
    if (!(error instanceof HttpErrorResponse)) {
      this.formError = 'Something went wrong. Please try again.';
      this.toastService.error(this.formError, `Could not save ${this.singularLabel}`);
      return;
    }

    const payload = error.error as {
      message?: string;
      errors?: Record<string, string[]>;
    } | null;

    if (error.status === 422 && payload?.errors) {
      const next: Record<string, string> = {};
      for (const [field, messages] of Object.entries(payload.errors)) {
        if (messages?.length) {
          next[field] = this.mapTaxonomyFieldMessage(field, messages[0]);
        }
      }
      this.fieldErrors = next;
      const hasMappedField = Object.keys(next).some((key) => key in this.form.controls);
      this.formError = hasMappedField
        ? null
        : payload.message?.trim() || 'Please fix the highlighted fields.';
      this.toastService.error(
        this.formError ||
          next['code'] ||
          next['name'] ||
          payload.message?.trim() ||
          'Please fix the highlighted fields.',
        `Could not save ${this.singularLabel}`,
      );
      return;
    }

    this.formError = payload?.message?.trim() || 'Something went wrong. Please try again.';
    this.toastService.error(this.formError, `Could not save ${this.singularLabel}`);
  }

  private mapTaxonomyFieldMessage(field: string, message: string): string {
    const lower = message.toLowerCase();
    if (field === 'code' && (lower.includes('unique') || lower.includes('taken') || lower.includes('already'))) {
      return 'This code is already used.';
    }
    if (field === 'name' && (lower.includes('unique') || lower.includes('taken') || lower.includes('already'))) {
      return 'This name is already used.';
    }
    if (field === 'code' && lower.includes('system')) {
      return 'System code cannot be changed.';
    }
    return message;
  }

  private parseError(err: unknown): string {
    if (err instanceof HttpErrorResponse) {
      const payload = err.error as {
        message?: string;
        errors?: Record<string, string[]>;
      } | null;
      if (err.status === 422 && payload?.errors) {
        const fieldMessages = Object.values(payload.errors)
          .flat()
          .filter((value): value is string => typeof value === 'string' && value.trim().length > 0);
        if (fieldMessages.length) {
          return fieldMessages[0];
        }
      }
      return payload?.message?.trim() || 'Something went wrong. Please try again.';
    }

    const body = (err as { error?: { message?: string } })?.error;
    return body?.message || 'Something went wrong. Please try again.';
  }

  private capitalize(value: string): string {
    return value.charAt(0).toUpperCase() + value.slice(1);
  }
}
