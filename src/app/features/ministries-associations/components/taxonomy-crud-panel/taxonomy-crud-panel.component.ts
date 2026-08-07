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
import {
  ActionBarComponent,
  ActionBarItem,
} from '@shared/components/action-bar/action-bar.component';
import { CfEmptyStateComponent } from '@shared/components/cf-empty-state/cf-empty-state.component';
import { ConfirmationModalComponent } from '@shared/components/confirmation-modal/confirmation-modal.component';
import { DataTableComponent } from '@shared/components/data-table/data-table.component';
import { FormFieldComponent } from '@shared/components/form-field/form-field.component';
import { ListToolbarComponent } from '@shared/components/list-toolbar/list-toolbar.component';
import { LoadingSkeletonComponent } from '@shared/components/loading-skeleton/loading-skeleton.component';
import { ModalShellComponent } from '@shared/components/modal-shell/modal-shell.component';
import { StatusBadgeComponent } from '@shared/components/status-badge/status-badge.component';
import {
  OrganizationCategory,
  OrganizationType,
  Position,
} from '../../models/ministries.model';
import { MinistriesApiService } from '../../services/ministries-api.service';

export type TaxonomyKind = 'categories' | 'types' | 'positions';

type TaxonomyItem = OrganizationCategory | OrganizationType | Position;

@Component({
  selector: 'app-taxonomy-crud-panel',
  standalone: true,
  imports: [
    CommonModule,
    FormsModule,
    ReactiveFormsModule,
    ActionBarComponent,
    CfEmptyStateComponent,
    ConfirmationModalComponent,
    DataTableComponent,
    FormFieldComponent,
    ListToolbarComponent,
    LoadingSkeletonComponent,
    ModalShellComponent,
    StatusBadgeComponent,
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
  readonly seedConfirmMessage =
    'This adds parish defaults without overwriting existing records';

  items: TaxonomyItem[] = [];
  loaded = false;
  loadError: string | null = null;
  tableSearch = '';
  showForm = false;
  editingId: string | null = null;
  saving = false;
  seeding = false;
  showSeedConfirm = false;
  statusUpdatingId: string | null = null;
  statusError: string | null = null;
  submitted = false;
  formError: string | null = null;
  fieldErrors: Record<string, string> = {};

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
    this.load();
  }

  ngOnChanges(changes: SimpleChanges): void {
    if (changes['kind'] && !changes['kind'].firstChange) {
      this.tableSearch = '';
      this.showSeedConfirm = false;
      this.statusError = null;
      this.closeForm();
      this.load();
    }
  }

  get filteredItems(): TaxonomyItem[] {
    const query = this.tableSearch.trim().toLowerCase();
    if (!query) {
      return this.items;
    }

    return this.items.filter((item) =>
      [item.code, item.name, item.description]
        .filter(Boolean)
        .join(' ')
        .toLowerCase()
        .includes(query),
    );
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

  statusLabel(item: TaxonomyItem): string {
    return item.is_active ? 'Active' : 'Inactive';
  }

  statusTone(item: TaxonomyItem): 'success' | 'neutral' {
    return item.is_active ? 'success' : 'neutral';
  }

  occupancyLabel(item: TaxonomyItem): string {
    return this.isPosition(item) && item.single_occupancy ? 'Single' : 'Multiple';
  }

  rowActions(item: TaxonomyItem): ActionBarItem[] {
    return [
      { id: 'edit', label: 'Edit', tier: 'secondary' },
      {
        id: 'toggle-status',
        label:
          this.statusUpdatingId === item.id
            ? 'Updating…'
            : item.is_active
              ? 'Deactivate'
              : 'Activate',
        tier: 'secondary',
        disabled: this.statusUpdatingId === item.id,
      },
    ];
  }

  onRowAction(actionId: string, item: TaxonomyItem): void {
    if (actionId === 'edit') {
      this.editItem(item);
      return;
    }
    if (actionId === 'toggle-status') {
      this.toggleStatus(item);
    }
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

  seedDefaults(): void {
    if (this.seeding) {
      return;
    }

    this.showSeedConfirm = true;
    this.cdr.markForCheck();
  }

  cancelSeedDefaults(): void {
    this.showSeedConfirm = false;
    this.cdr.markForCheck();
  }

  confirmSeedDefaults(): void {
    if (this.seeding) {
      return;
    }

    this.showSeedConfirm = false;
    this.seeding = true;
    this.cdr.markForCheck();

    const request$ =
      this.kind === 'categories'
        ? this.api.seedCategories()
        : this.kind === 'types'
          ? this.api.seedTypes()
          : this.api.seedPositions();

    request$.subscribe({
      next: (response) => {
        this.seeding = false;
        this.toastService.success(
          response.message || `Default ${this.listTitle.toLowerCase()} added.`,
          'Success',
        );
        this.load();
        this.cdr.markForCheck();
      },
      error: (err) => {
        this.seeding = false;
        this.toastService.error(this.parseError(err), 'Could not add defaults');
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
