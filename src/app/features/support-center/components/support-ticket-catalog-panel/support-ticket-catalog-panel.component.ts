import { CommonModule } from '@angular/common';
import { Component, OnInit, inject } from '@angular/core';
import { FormBuilder, ReactiveFormsModule, Validators } from '@angular/forms';
import { ModalShellComponent } from '@shared/components/modal-shell/modal-shell.component';
import { DataTableComponent } from '@shared/components/data-table/data-table.component';
import { CfEmptyStateComponent } from '@shared/components/cf-empty-state/cf-empty-state.component';
import { LoadingSkeletonComponent } from '@shared/components/loading-skeleton/loading-skeleton.component';
import { StatusBadgeComponent } from '@shared/components/status-badge/status-badge.component';
import {
  SupportCatalogCategory,
  SupportCatalogRequestType,
  SupportTicketCatalogService,
} from '../../services/support-ticket-catalog.service';

@Component({
  selector: 'app-support-ticket-catalog-panel',
  standalone: true,
  imports: [
    CommonModule,
    ReactiveFormsModule,
    ModalShellComponent,
    DataTableComponent,
    CfEmptyStateComponent,
    LoadingSkeletonComponent,
    StatusBadgeComponent,
  ],
  templateUrl: './support-ticket-catalog-panel.component.html',
  styleUrl: './support-ticket-catalog-panel.component.scss',
})
export class SupportTicketCatalogPanelComponent implements OnInit {
  private readonly catalog = inject(SupportTicketCatalogService);
  private readonly fb = inject(FormBuilder);

  loading = true;
  saving = false;
  error: string | null = null;
  rows: SupportCatalogRequestType[] = [];

  showTypeModal = false;
  editingType: SupportCatalogRequestType | null = null;

  showCategoryModal = false;
  categoryParentType: SupportCatalogRequestType | null = null;
  editingCategory: SupportCatalogCategory | null = null;

  typeForm = this.fb.group({
    name: ['', [Validators.required, Validators.maxLength(128)]],
    sort_order: [0, [Validators.min(0)]],
    active: [true],
    requires_bug_fields: [false],
  });

  categoryForm = this.fb.group({
    name: ['', [Validators.required, Validators.maxLength(128)]],
    sort_order: [0, [Validators.min(0)]],
    active: [true],
  });

  ngOnInit(): void {
    this.load();
  }

  load(): void {
    this.loading = true;
    this.error = null;
    this.catalog.list().subscribe({
      next: (rows) => {
        this.rows = rows;
        this.loading = false;
      },
      error: () => {
        this.error = 'Could not load ticket request types.';
        this.loading = false;
      },
    });
  }

  openCreateType(): void {
    this.editingType = null;
    this.typeForm.reset({
      name: '',
      sort_order: this.rows.length + 1,
      active: true,
      requires_bug_fields: false,
    });
    this.showTypeModal = true;
  }

  openEditType(row: SupportCatalogRequestType): void {
    this.editingType = row;
    this.typeForm.reset({
      name: row.name,
      sort_order: row.sort_order,
      active: row.active,
      requires_bug_fields: row.requires_bug_fields,
    });
    this.showTypeModal = true;
  }

  closeTypeModal(): void {
    if (this.saving) {
      return;
    }
    this.showTypeModal = false;
    this.editingType = null;
  }

  saveType(): void {
    if (this.typeForm.invalid) {
      this.typeForm.markAllAsTouched();
      return;
    }

    const raw = this.typeForm.getRawValue();
    const payload = {
      name: raw.name!,
      sort_order: raw.sort_order ?? 0,
      active: raw.active ?? true,
      requires_bug_fields: raw.requires_bug_fields ?? false,
    };
    this.saving = true;
    const request = this.editingType
      ? this.catalog.updateType(this.editingType.id, payload)
      : this.catalog.createType(payload);

    request.subscribe({
      next: () => {
        this.saving = false;
        this.showTypeModal = false;
        this.editingType = null;
        this.load();
      },
      error: (err) => {
        this.error = err?.error?.message || 'Could not save request type.';
        this.saving = false;
      },
    });
  }

  toggleTypeActive(row: SupportCatalogRequestType): void {
    this.catalog
      .updateType(row.id, {
        name: row.name,
        sort_order: row.sort_order,
        active: !row.active,
        requires_bug_fields: row.requires_bug_fields,
      })
      .subscribe({
        next: () => this.load(),
        error: (err) => {
          this.error = err?.error?.message || 'Could not update request type.';
        },
      });
  }

  openCreateCategory(row: SupportCatalogRequestType): void {
    this.categoryParentType = row;
    this.editingCategory = null;
    this.categoryForm.reset({
      name: '',
      sort_order: (row.categories?.length || 0) + 1,
      active: true,
    });
    this.showCategoryModal = true;
  }

  openEditCategory(type: SupportCatalogRequestType, category: SupportCatalogCategory): void {
    this.categoryParentType = type;
    this.editingCategory = category;
    this.categoryForm.reset({
      name: category.name,
      sort_order: category.sort_order,
      active: category.active,
    });
    this.showCategoryModal = true;
  }

  closeCategoryModal(): void {
    if (this.saving) {
      return;
    }
    this.showCategoryModal = false;
    this.categoryParentType = null;
    this.editingCategory = null;
  }

  saveCategory(): void {
    if (!this.categoryParentType || this.categoryForm.invalid) {
      this.categoryForm.markAllAsTouched();
      return;
    }

    const raw = this.categoryForm.getRawValue();
    const payload = {
      name: raw.name!,
      sort_order: raw.sort_order ?? 0,
      active: raw.active ?? true,
    };
    this.saving = true;
    const typeId = this.categoryParentType.id;
    const request = this.editingCategory
      ? this.catalog.updateCategory(typeId, this.editingCategory.id, payload)
      : this.catalog.createCategory(typeId, payload);

    request.subscribe({
      next: () => {
        this.saving = false;
        this.showCategoryModal = false;
        this.categoryParentType = null;
        this.editingCategory = null;
        this.load();
      },
      error: (err) => {
        this.error = err?.error?.message || 'Could not save category.';
        this.saving = false;
      },
    });
  }
}
