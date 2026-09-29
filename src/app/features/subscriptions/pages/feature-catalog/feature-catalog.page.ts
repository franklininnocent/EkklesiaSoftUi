import { ChangeDetectionStrategy, ChangeDetectorRef, Component, OnDestroy, OnInit, inject } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { Subject, switchMap, of, takeUntil } from 'rxjs';
import { AuthService } from '@core/services/auth.service';
import { ToastService } from '@core/services/toast.service';
import { DataTableComponent } from '@shared/components/data-table/data-table.component';
import { LoadingSkeletonComponent } from '@shared/components/loading-skeleton/loading-skeleton.component';
import { ModalShellComponent } from '@shared/components/modal-shell/modal-shell.component';
import { StatusBadgeComponent } from '@shared/components/status-badge/status-badge.component';
import { CatalogFeature, FeatureFormValue, FeatureType } from '../../models/subscription-admin.models';
import { SubscriptionAdminService, subscriptionErrorMessage } from '../../services/subscription-admin.service';
import { subscriptionAdminCapabilities } from '../../services/subscription-admin-access';

const CODE_PATTERN = /^[A-Z][A-Z0-9_]{1,63}$/;
const SLUG_PATTERN = /^[a-z][a-z0-9_]*$/;

interface FeatureForm {
  code: string;
  name: string;
  description: string;
  category: string;
  module_key: string;
  feature_type: FeatureType;
  unit: string;
  tier_options: string;
  is_public: boolean;
  is_active: boolean;
  display_order: number | null;
  requires: Set<string>;
}

@Component({
  selector: 'app-feature-catalog-page',
  standalone: true,
  imports: [CommonModule, FormsModule, DataTableComponent, LoadingSkeletonComponent, ModalShellComponent, StatusBadgeComponent],
  templateUrl: './feature-catalog.page.html',
  styleUrls: ['../../styles/subscription-admin.scss'],
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class FeatureCatalogPage implements OnInit, OnDestroy {
  private readonly api = inject(SubscriptionAdminService);
  private readonly auth = inject(AuthService);
  private readonly toast = inject(ToastService);
  private readonly cdr = inject(ChangeDetectorRef);
  private readonly destroy$ = new Subject<void>();

  readonly can = subscriptionAdminCapabilities(this.auth);
  readonly featureTypes: { value: FeatureType; label: string }[] = [
    { value: 'MODULE', label: 'Module (area of the app)' },
    { value: 'BOOLEAN', label: 'On / off capability' },
    { value: 'LIMIT', label: 'Limit (count of records)' },
    { value: 'QUOTA', label: 'Quota (e.g. storage)' },
    { value: 'TIER', label: 'Level (choose from options)' },
  ];

  features: CatalogFeature[] = [];
  loading = false;
  error: string | null = null;
  search = '';

  editing: CatalogFeature | null = null;
  creating = false;
  form: FeatureForm = this.blankForm();
  saving = false;

  get filtered(): CatalogFeature[] {
    const q = this.search.trim().toLowerCase();
    if (!q) return this.features;
    return this.features.filter(
      (f) => f.name.toLowerCase().includes(q) || f.code.toLowerCase().includes(q) || f.category.toLowerCase().includes(q),
    );
  }

  get dependencyOptions(): CatalogFeature[] {
    const self = this.editing?.code;
    return this.features.filter((f) => f.code !== self && !['LIMIT', 'QUOTA', 'USAGE'].includes(f.feature_type));
  }

  get modalOpen(): boolean {
    return this.creating || this.editing !== null;
  }

  ngOnInit(): void {
    this.load();
  }

  ngOnDestroy(): void {
    this.destroy$.next();
    this.destroy$.complete();
  }

  load(): void {
    this.loading = true;
    this.error = null;
    this.cdr.markForCheck();
    this.api
      .listFeatures()
      .pipe(takeUntil(this.destroy$))
      .subscribe({
        next: (features) => {
          this.features = features;
          this.loading = false;
          this.cdr.markForCheck();
        },
        error: (err) => {
          this.error = subscriptionErrorMessage(err, 'Unable to load features.');
          this.loading = false;
          this.cdr.markForCheck();
        },
      });
  }

  typeLabel(type: FeatureType): string {
    return this.featureTypes.find((t) => t.value === type)?.label.split(' (')[0] ?? type;
  }

  openCreate(): void {
    this.form = this.blankForm();
    this.creating = true;
    this.editing = null;
    this.cdr.markForCheck();
  }

  openEdit(feature: CatalogFeature): void {
    this.editing = feature;
    this.creating = false;
    this.form = {
      code: feature.code,
      name: feature.name,
      description: feature.description ?? '',
      category: feature.category,
      module_key: feature.module_key ?? '',
      feature_type: feature.feature_type,
      unit: feature.unit ?? '',
      tier_options: (feature.tier_options ?? []).join(', '),
      is_public: feature.is_public,
      is_active: feature.is_active,
      display_order: feature.display_order,
      requires: new Set(feature.dependencies),
    };
    this.cdr.markForCheck();
  }

  close(): void {
    if (this.saving) return;
    this.creating = false;
    this.editing = null;
    this.cdr.markForCheck();
  }

  toggleRequires(code: string, checked: boolean): void {
    if (checked) this.form.requires.add(code);
    else this.form.requires.delete(code);
  }

  normalizeCode(value: string): string {
    return (value || '').toUpperCase().replace(/[^A-Z0-9_]/g, '_');
  }

  save(): void {
    if (!this.can.features || this.saving) return;
    const f = this.form;
    const name = f.name.trim();
    const category = f.category.trim().toLowerCase();
    const moduleKey = f.module_key.trim().toLowerCase();
    if (this.creating && !CODE_PATTERN.test(f.code)) {
      this.toast.error('Code must be capital letters, numbers or underscores, starting with a letter.', 'Check your entries');
      return;
    }
    if (name.length < 2) {
      this.toast.error('Enter a feature name.', 'Check your entries');
      return;
    }
    if (!SLUG_PATTERN.test(category) || (moduleKey && !SLUG_PATTERN.test(moduleKey))) {
      this.toast.error('Category and module key use lowercase letters, numbers and underscores.', 'Check your entries');
      return;
    }
    const tiers = f.tier_options
      .split(',')
      .map((t) => t.trim())
      .filter(Boolean);
    if (f.feature_type === 'TIER' && tiers.length === 0) {
      this.toast.error('List at least one level for this feature.', 'Check your entries');
      return;
    }

    const value: FeatureFormValue = {
      name,
      description: f.description.trim() || null,
      category,
      module_key: moduleKey || null,
      unit: f.unit.trim() || null,
      tier_options: f.feature_type === 'TIER' ? tiers : null,
      is_public: f.is_public,
      ...(f.display_order !== null && `${f.display_order}` !== '' ? { display_order: Number(f.display_order) } : {}),
    };
    const requires = Array.from(f.requires);
    const editing = this.editing;
    const dependenciesChanged =
      !editing || requires.length !== editing.dependencies.length || requires.some((c) => !editing.dependencies.includes(c));

    const save$ = editing
      ? this.api.updateFeature(editing.id, { ...value, is_active: f.is_active })
      : this.api.createFeature({ ...value, code: f.code, feature_type: f.feature_type });

    this.saving = true;
    this.cdr.markForCheck();
    save$
      .pipe(
        switchMap((saved) => (dependenciesChanged && (editing || requires.length) ? this.api.setFeatureDependencies(saved.id, requires) : of(saved))),
        takeUntil(this.destroy$),
      )
      .subscribe({
        next: (saved) => {
          this.saving = false;
          this.creating = false;
          this.editing = null;
          this.toast.success(`${saved.name} saved.`, 'Saved');
          this.load();
        },
        error: (err) => {
          this.saving = false;
          this.toast.error(subscriptionErrorMessage(err, 'Unable to save the feature.'), 'Not saved');
          this.load();
        },
      });
  }

  private blankForm(): FeatureForm {
    return {
      code: '',
      name: '',
      description: '',
      category: '',
      module_key: '',
      feature_type: 'MODULE',
      unit: '',
      tier_options: '',
      is_public: true,
      is_active: true,
      display_order: null,
      requires: new Set<string>(),
    };
  }
}
