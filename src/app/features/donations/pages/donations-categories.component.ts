import { CommonModule } from '@angular/common';
import { ChangeDetectorRef, Component, OnDestroy, OnInit } from '@angular/core';
import { FormBuilder, FormsModule, ReactiveFormsModule, Validators } from '@angular/forms';
import { NavigationEnd, Router, RouterModule } from '@angular/router';
import { filter, Subscription } from 'rxjs';
import { AuthService } from '@core/services/auth.service';
import { ToastService } from '@core/services/toast.service';
import { CfEmptyStateComponent } from '@shared/components/cf-empty-state/cf-empty-state.component';
import { EditIconButtonComponent } from '@shared/components/edit-icon-button/edit-icon-button.component';
import { LoadingSkeletonComponent } from '@shared/components/loading-skeleton/loading-skeleton.component';
import { DonationsService } from '../services/donations.service';
import { DonationCategory } from '../models/donation.model';

@Component({
  selector: 'app-donations-categories',
  standalone: true,
  imports: [CommonModule, FormsModule, ReactiveFormsModule, RouterModule, CfEmptyStateComponent, EditIconButtonComponent, LoadingSkeletonComponent],
  templateUrl: './donations-categories.component.html',
  styleUrl: './donations-categories.component.scss'
})
export class DonationsCategoriesComponent implements OnInit, OnDestroy {
  categories: DonationCategory[] = [];
  categoriesLoaded = false;
  categoriesLoadError: string | null = null;
  private loadCategoriesSeq = 0;
  private routerSub?: Subscription;
  private skipNextNavReload = true;
  tableSearch = '';
  showForm = false;
  editingCategoryId: string | null = null;
  saving = false;
  seeding = false;
  deletingId: string | null = null;
  canManage = false;

  form = this.fb.group({
    name: ['', Validators.required],
    code: ['', Validators.required],
    description: [''],
    is_tax_deductible: [false],
    active: [true]
  });

  constructor(
    private fb: FormBuilder,
    private donationsService: DonationsService,
    private authService: AuthService,
    private toastService: ToastService,
    private router: Router,
    private cdr: ChangeDetectorRef
  ) {}

  ngOnInit(): void {
    this.canManage = this.authService.hasPermission('donations.manage');
    this.load();
    this.routerSub = this.router.events.pipe(filter((e): e is NavigationEnd => e instanceof NavigationEnd)).subscribe((e) => {
      if (!e.urlAfterRedirects.includes('/donations/categories')) {
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

  get taxDeductibleCount(): number {
    return this.categories.filter((cat) => cat.is_tax_deductible).length;
  }

  get filteredCategories(): DonationCategory[] {
    const query = this.tableSearch.trim().toLowerCase();
    if (!query) {
      return this.categories;
    }
    return this.categories.filter((cat) =>
      [cat.name, cat.code, cat.description].filter(Boolean).join(' ').toLowerCase().includes(query)
    );
  }

  load(): void {
    const seq = ++this.loadCategoriesSeq;
    this.categoriesLoaded = false;
    this.categoriesLoadError = null;
    this.donationsService.getCategories().subscribe({
      next: (res) => {
        if (seq !== this.loadCategoriesSeq) {
          return;
        }
        this.categories = Array.isArray(res.data) ? res.data : [];
        this.categoriesLoaded = true;
        this.cdr.detectChanges();
      },
      error: () => {
        if (seq !== this.loadCategoriesSeq) {
          return;
        }
        this.categoriesLoaded = true;
        this.categoriesLoadError = 'Unable to load offering categories. Please try again.';
        this.cdr.detectChanges();
      }
    });
  }

  openCreateForm(): void {
    this.editingCategoryId = null;
    this.form.reset({ is_tax_deductible: false, active: true });
    this.showForm = true;
    this.cdr.detectChanges();
    setTimeout(() => {
      document.getElementById('category-form-card')?.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
      document.getElementById('category-name')?.focus();
    }, 0);
  }

  editCategory(category: DonationCategory): void {
    this.editingCategoryId = category.id;
    this.form.patchValue({
      name: category.name,
      code: category.code,
      description: category.description ?? '',
      is_tax_deductible: !!category.is_tax_deductible,
      active: category.active
    });
    this.showForm = true;
    this.cdr.detectChanges();
    setTimeout(() => document.getElementById('category-name')?.focus(), 0);
  }

  closeForm(): void {
    this.showForm = false;
    this.editingCategoryId = null;
    this.form.reset({ is_tax_deductible: false, active: true });
  }

  save(): void {
    if (this.form.invalid) {
      return;
    }
    this.saving = true;
    const payload = this.form.getRawValue();
    const request$ = this.editingCategoryId
      ? this.donationsService.updateCategory(this.editingCategoryId, payload)
      : this.donationsService.createCategory(payload);

    request$.subscribe({
      next: (res) => {
        this.saving = false;
        this.toastService.success(
          res.message || (this.editingCategoryId ? 'Category updated.' : 'Category created.'),
          'Success'
        );
        this.closeForm();
        this.load();
        this.cdr.detectChanges();
      },
      error: (err) => {
        this.saving = false;
        this.toastService.error(this.parseError(err), 'Could not save category');
      }
    });
  }

  deleteCategory(category: DonationCategory): void {
    const confirmed = window.confirm(
      `Delete "${category.name}"?\n\nThis only works if the category has never been used. Otherwise, edit it and set Active to off.`
    );
    if (!confirmed) {
      return;
    }

    this.deletingId = category.id;
    this.donationsService.deleteCategory(category.id).subscribe({
      next: (res) => {
        this.deletingId = null;
        this.toastService.success(res.message || 'Category deleted.', 'Success');
        if (this.editingCategoryId === category.id) {
          this.closeForm();
        }
        this.load();
      },
      error: (err) => {
        this.deletingId = null;
        this.toastService.error(this.parseError(err), 'Could not delete category');
      }
    });
  }

  seedDefaults(): void {
    this.seeding = true;
    this.donationsService.seedDefaultCategories().subscribe({
      next: () => {
        this.seeding = false;
        this.toastService.success('Default categories added.', 'Success');
        this.load();
      },
      error: (err) => {
        this.seeding = false;
        this.toastService.error(this.parseError(err), 'Could not add defaults');
      }
    });
  }

  private parseError(err: unknown): string {
    const body = (err as { error?: { message?: string } })?.error;
    return body?.message || 'Something went wrong. Please try again.';
  }
}
