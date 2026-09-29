import {
  ChangeDetectionStrategy,
  ChangeDetectorRef,
  Component,
  EventEmitter,
  Input,
  OnChanges,
  OnDestroy,
  Output,
  inject,
} from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { HttpErrorResponse } from '@angular/common/http';
import { Subject, takeUntil } from 'rxjs';
import { ToastService } from '@core/services/toast.service';
import {
  AdvancedSearchPanelComponent,
  SearchField,
} from '@shared/components/advanced-search-panel/advanced-search-panel.component';
import { ListToolbarComponent } from '@shared/components/list-toolbar/list-toolbar.component';
import { CatalogFeature, EntitlementInput, PlanVersion } from '../../models/subscription-admin.models';
import { SubscriptionAdminService, subscriptionErrorMessage } from '../../services/subscription-admin.service';

const NUMERIC_TYPES = new Set(['LIMIT', 'QUOTA', 'USAGE']);
const MAX_LIMIT = 100_000_000;

const CATEGORY_LABELS: Record<string, string> = {
  people: 'People & families',
  finance: 'Finance & stewardship',
  reporting: 'Reports',
  ministries: 'Ministries',
  pastoral: 'Pastoral care',
  governance: 'Church leadership',
  administration: 'Administration',
  communication: 'Communication',
  support: 'Support',
  enterprise: 'Organisation',
  legacy: 'Earlier features',
};

type StatusFilter = 'all' | 'included' | 'excluded';

interface EntitlementRow {
  feature: CatalogFeature;
  numeric: boolean;
  enabled: boolean;
  unlimited: boolean;
  value: number | null;
  tier: string | null;
}

interface CapabilityGroup {
  category: string;
  label: string;
  rows: EntitlementRow[];
}

interface CapacityFact {
  label: string;
  value: string;
}

interface OverviewStats {
  includedCount: number;
  excludedCount: number;
  capacityFacts: CapacityFact[];
}

interface LimitViewModel {
  row: EntitlementRow;
  phrase: string;
  figure: string | null;
  unitLabel: string | null;
  storageHint: string | null;
}

interface CapabilityViewModel {
  row: EntitlementRow;
  included: boolean;
  description: string | null;
  dependencyLabel: string | null;
  inactiveLabel: boolean;
}

interface CapabilityGroupViewModel {
  category: string;
  label: string;
  includedCount: number;
  excludedCount: number;
  includedRows: CapabilityViewModel[];
  excludedRows: CapabilityViewModel[];
}

/** Features & limits for one plan version. Only drafts are editable (enforced by the API too). */
@Component({
  selector: 'app-entitlements-editor',
  standalone: true,
  imports: [CommonModule, FormsModule, ListToolbarComponent, AdvancedSearchPanelComponent],
  templateUrl: './entitlements-editor.component.html',
  styleUrls: ['../../styles/subscription-admin.scss'],
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class EntitlementsEditorComponent implements OnChanges, OnDestroy {
  private readonly api = inject(SubscriptionAdminService);
  private readonly toast = inject(ToastService);
  private readonly cdr = inject(ChangeDetectorRef);
  private readonly destroy$ = new Subject<void>();

  @Input({ required: true }) planId!: number;
  @Input({ required: true }) version!: PlanVersion;
  @Input() features: CatalogFeature[] = [];
  @Input() readonly = true;
  @Output() saved = new EventEmitter<PlanVersion>();
  @Output() dirtyChange = new EventEmitter<boolean>();

  /** Full model — save always iterates every row. */
  rows: EntitlementRow[] = [];
  limitRows: EntitlementRow[] = [];
  capabilityGroups: CapabilityGroup[] = [];
  areaOptions: { category: string; label: string }[] = [];
  visibleLimitViews: LimitViewModel[] = [];
  visibleCapabilityGroups: CapabilityGroupViewModel[] = [];
  overview: OverviewStats = { includedCount: 0, excludedCount: 0, capacityFacts: [] };
  filterFields: SearchField[] = [];
  searchHasNoMatches = false;
  search = '';
  statusFilter: StatusFilter = 'all';
  areaFilter = 'all';
  showCodes = false;
  showFilters = false;
  saving = false;
  dirty = false;
  errors: string[] = [];

  ngOnChanges(): void {
    this.build();
  }

  ngOnDestroy(): void {
    this.destroy$.next();
    this.destroy$.complete();
  }

  get activeFilterCount(): number {
    let count = 0;
    if (this.statusFilter !== 'all') count++;
    if (this.areaFilter !== 'all') count++;
    return count;
  }

  get overviewSummary(): string {
    const parts = [
      `${this.overview.includedCount} included`,
      `${this.overview.excludedCount} not included`,
      ...this.overview.capacityFacts.map((fact) => `${fact.label} ${fact.value}`),
    ];
    return parts.join(' · ');
  }

  get overviewSummaryLabel(): string {
    return `Plan entitlement overview: ${this.overviewSummary}`;
  }

  onSearchFromToolbar(value: string): void {
    this.search = value;
    this.applyFilter();
    this.cdr.markForCheck();
  }

  onFiltersApplied(values: { [key: string]: unknown }): void {
    const status = (values['status'] as string) || 'all';
    this.statusFilter =
      status === 'included' || status === 'excluded' ? status : 'all';
    this.areaFilter = (values['area'] as string) || 'all';
    this.syncFilterFieldValues();
    this.applyFilter();
    this.showFilters = false;
    this.cdr.markForCheck();
  }

  onFiltersCleared(): void {
    this.statusFilter = 'all';
    this.areaFilter = 'all';
    this.syncFilterFieldValues();
    this.applyFilter();
    this.cdr.markForCheck();
  }

  onShowCodesChange(): void {
    this.cdr.markForCheck();
  }

  markDirty(): void {
    this.refreshOverview();
    this.applyFilter();
    if (!this.dirty) {
      this.dirty = true;
      this.dirtyChange.emit(true);
    }
  }

  toggleUnlimited(row: EntitlementRow): void {
    if (!row.unlimited && row.value === null) {
      row.value = 0;
    }
    this.markDirty();
  }

  reset(): void {
    this.build();
    this.cdr.markForCheck();
  }

  save(): void {
    if (this.readonly || this.saving) return;
    const payload: EntitlementInput[] = [];
    const errors: string[] = [];
    for (const row of this.rows) {
      const enabled = this.isIncluded(row);
      let numeric: number | null = null;
      if (row.numeric && enabled && !row.unlimited) {
        const v = Number(row.value);
        if (!Number.isInteger(v) || v < 0 || v > MAX_LIMIT) {
          errors.push(`${row.feature.name}: enter a whole number from 0 to ${MAX_LIMIT.toLocaleString()}, or choose Unlimited.`);
          continue;
        }
        numeric = v;
      }
      if (!row.numeric && row.feature.feature_type === 'TIER' && enabled && !row.tier) {
        errors.push(`${row.feature.name}: choose a level.`);
        continue;
      }
      payload.push({
        feature_code: row.feature.code,
        is_enabled: enabled,
        numeric_value: numeric,
        tier_value: row.feature.feature_type === 'TIER' && enabled ? row.tier : null,
      });
    }
    errors.push(...this.validateDependencies());
    this.errors = errors;
    if (errors.length) {
      this.cdr.markForCheck();
      return;
    }

    this.saving = true;
    this.cdr.markForCheck();
    this.api
      .setEntitlements(this.planId, this.version.id, payload)
      .pipe(takeUntil(this.destroy$))
      .subscribe({
        next: (version) => {
          this.saving = false;
          this.dirty = false;
          this.dirtyChange.emit(false);
          this.errors = [];
          this.toast.success('Features and limits saved.', 'Saved');
          this.saved.emit(version);
          this.cdr.markForCheck();
        },
        error: (err) => {
          this.saving = false;
          const apiErrors = this.extractApiErrors(err);
          this.errors = apiErrors.length ? apiErrors : [subscriptionErrorMessage(err, 'Unable to save features and limits.')];
          this.toast.error(subscriptionErrorMessage(err, 'Unable to save features and limits.'), 'Not saved');
          this.cdr.markForCheck();
        },
      });
  }

  isIncluded(row: EntitlementRow): boolean {
    return row.feature.is_core || row.enabled;
  }

  categoryLabel(category: string): string {
    return CATEGORY_LABELS[category] ?? category.replace(/_/g, ' ').replace(/\b\w/g, (c) => c.toUpperCase());
  }

  allowancePhrase(row: EntitlementRow): string {
    if (!this.isIncluded(row)) return 'Not included';
    if (row.unlimited) return 'Unlimited';
    const value = Number(row.value);
    if (!Number.isFinite(value)) return 'Not included';
    if (row.feature.unit === 'MB') {
      return `Up to ${this.formatStorage(value)}`;
    }
    const unit = row.feature.unit ?? '';
    return `Up to ${value.toLocaleString()}${unit ? ` ${unit}` : ''}`;
  }

  limitFigure(row: EntitlementRow): string | null {
    if (!this.isIncluded(row) || row.unlimited) return null;
    const value = Number(row.value);
    if (!Number.isFinite(value)) return null;
    if (row.feature.unit === 'MB') {
      return this.formatStorage(value).replace(/ (GB|MB)$/, '');
    }
    return value.toLocaleString();
  }

  limitUnitLabel(row: EntitlementRow): string | null {
    if (!this.isIncluded(row) || row.unlimited) return null;
    const value = Number(row.value);
    if (!Number.isFinite(value)) return null;
    if (row.feature.unit === 'MB') {
      const formatted = this.formatStorage(value);
      const match = formatted.match(/ (GB|MB)$/);
      return match ? match[1].toLowerCase() : null;
    }
    return row.feature.unit;
  }

  storageEditHint(row: EntitlementRow): string | null {
    if (row.feature.unit !== 'MB' || row.unlimited || !this.isIncluded(row)) return null;
    const value = Number(row.value);
    if (!Number.isFinite(value) || value < 1024) return null;
    return `≈ ${this.formatStorage(value)}`;
  }

  dependencyNames(row: EntitlementRow): string {
    return row.feature.dependencies
      .map((code) => this.features.find((f) => f.code === code)?.name ?? code)
      .join(', ');
  }

  groupCountLabel(group: CapabilityGroupViewModel): string {
    const parts: string[] = [];
    if (group.includedCount) parts.push(`${group.includedCount} included`);
    if (group.excludedCount) parts.push(`${group.excludedCount} not included`);
    return parts.join(' · ');
  }

  trackRow(_: number, view: LimitViewModel | CapabilityViewModel): string {
    return view.row.feature.code;
  }

  trackGroup(_: number, group: CapabilityGroupViewModel): string {
    return group.category;
  }

  private summaryCapacityValue(row: EntitlementRow): string {
    if (row.unlimited) return 'Unlimited';
    const value = Number(row.value);
    if (!Number.isFinite(value)) return '—';
    if (row.feature.unit === 'MB') return this.formatStorage(value);
    return value.toLocaleString();
  }

  private formatStorage(value: number): string {
    if (value >= 1024) {
      const gb = value / 1024;
      const rounded = gb >= 10 ? Math.round(gb) : Math.round(gb * 10) / 10;
      return `${rounded.toLocaleString()} GB`;
    }
    return `${value.toLocaleString()} MB`;
  }

  private matchesSearch(row: EntitlementRow): boolean {
    const q = this.search.trim().toLowerCase();
    if (!q) return true;
    const area = this.categoryLabel(row.feature.category).toLowerCase();
    const description = (row.feature.description ?? '').toLowerCase();
    const unit = (row.feature.unit ?? '').toLowerCase();
    return (
      row.feature.name.toLowerCase().includes(q) ||
      row.feature.code.toLowerCase().includes(q) ||
      area.includes(q) ||
      description.includes(q) ||
      unit.includes(q)
    );
  }

  private matchesStatus(row: EntitlementRow): boolean {
    if (this.statusFilter === 'all') return true;
    const included = this.isIncluded(row);
    return this.statusFilter === 'included' ? included : !included;
  }

  private buildLimitView(row: EntitlementRow): LimitViewModel {
    return {
      row,
      phrase: this.allowancePhrase(row),
      figure: this.limitFigure(row),
      unitLabel: this.limitUnitLabel(row),
      storageHint: this.storageEditHint(row),
    };
  }

  private buildCapabilityView(row: EntitlementRow): CapabilityViewModel {
    return {
      row,
      included: this.isIncluded(row),
      description: row.feature.description,
      dependencyLabel: row.feature.dependencies.length ? this.dependencyNames(row) : null,
      inactiveLabel: !row.feature.is_active,
    };
  }

  private buildFilterFields(): void {
    this.filterFields = [
      {
        key: 'status',
        label: 'Status',
        type: 'select',
        options: [
          { value: 'all', label: 'All' },
          { value: 'included', label: 'Included' },
          { value: 'excluded', label: 'Not included' },
        ],
        value: this.statusFilter,
      },
      {
        key: 'area',
        label: 'Area',
        type: 'select',
        options: [
          { value: 'all', label: 'All areas' },
          ...this.areaOptions.map((area) => ({ value: area.category, label: area.label })),
        ],
        value: this.areaFilter,
      },
    ];
  }

  private syncFilterFieldValues(): void {
    const statusField = this.filterFields.find((field) => field.key === 'status');
    const areaField = this.filterFields.find((field) => field.key === 'area');
    if (statusField) statusField.value = this.statusFilter;
    if (areaField) areaField.value = this.areaFilter;
  }

  private validateDependencies(): string[] {
    const enabled = new Set<string>();
    for (const row of this.rows) {
      if (this.isIncluded(row)) enabled.add(row.feature.code);
    }
    const errors: string[] = [];
    for (const row of this.rows) {
      if (!this.isIncluded(row)) continue;
      const missing = row.feature.dependencies.filter((code) => !enabled.has(code));
      if (missing.length) {
        const names = missing.map((code) => this.features.find((f) => f.code === code)?.name ?? code).join(', ');
        errors.push(`${row.feature.name} requires ${names}.`);
      }
    }
    return errors;
  }

  private extractApiErrors(err: unknown): string[] {
    if (err instanceof HttpErrorResponse && err.error && typeof err.error === 'object' && err.error.errors) {
      return Object.values(err.error.errors as Record<string, string[]>).flat();
    }
    if (err && typeof err === 'object' && 'errors' in err) {
      const errors = (err as { errors?: Record<string, string[]> }).errors;
      if (errors) return Object.values(errors).flat();
    }
    return [];
  }

  private build(): void {
    const byCode = new Map((this.version?.entitlements ?? []).map((e) => [e.feature_code, e]));
    const rows: EntitlementRow[] = [];
    for (const feature of this.features) {
      const existing = byCode.get(feature.code);
      if (!feature.is_active && !existing) continue;
      const numeric = NUMERIC_TYPES.has(feature.feature_type);
      const enabled = feature.is_core || !!existing?.is_enabled;
      rows.push({
        feature,
        numeric,
        enabled,
        unlimited: numeric && enabled && existing?.numeric_value == null && !!existing,
        value: existing?.numeric_value ?? (numeric ? 0 : null),
        tier: existing?.tier_value ?? null,
      });
    }

    this.rows = rows;
    this.limitRows = rows
      .filter((row) => row.numeric)
      .sort(
        (a, b) =>
          a.feature.display_order - b.feature.display_order || a.feature.name.localeCompare(b.feature.name),
      );

    const capMap = new Map<string, EntitlementRow[]>();
    for (const row of rows.filter((r) => !r.numeric)) {
      const list = capMap.get(row.feature.category) ?? [];
      list.push(row);
      capMap.set(row.feature.category, list);
    }
    this.capabilityGroups = Array.from(capMap.entries())
      .map(([category, groupRows]) => ({
        category,
        label: this.categoryLabel(category),
        rows: groupRows.sort(
          (a, b) =>
            a.feature.display_order - b.feature.display_order || a.feature.name.localeCompare(b.feature.name),
        ),
      }))
      .sort((a, b) => {
        const orderA = Math.min(...a.rows.map((r) => r.feature.display_order));
        const orderB = Math.min(...b.rows.map((r) => r.feature.display_order));
        return orderA - orderB || a.label.localeCompare(b.label);
      });

    this.areaOptions = this.capabilityGroups.map((g) => ({ category: g.category, label: g.label }));
    this.buildFilterFields();

    this.errors = [];
    this.refreshOverview();
    this.applyFilter();
    if (this.dirty) {
      this.dirty = false;
      this.dirtyChange.emit(false);
    }
  }

  private refreshOverview(): void {
    let includedCount = 0;
    let excludedCount = 0;
    const capacityFacts: CapacityFact[] = [];
    for (const row of this.rows) {
      if (row.numeric) {
        if (this.isIncluded(row)) {
          capacityFacts.push({
            label: row.feature.name,
            value: this.summaryCapacityValue(row),
          });
        }
        continue;
      }
      if (this.isIncluded(row)) includedCount++;
      else excludedCount++;
    }
    this.overview = { includedCount, excludedCount, capacityFacts };
  }

  private applyFilter(): void {
    this.visibleLimitViews = this.limitRows
      .filter((row) => this.matchesSearch(row) && this.matchesStatus(row))
      .map((row) => this.buildLimitView(row));

    this.visibleCapabilityGroups = this.capabilityGroups
      .filter((group) => this.areaFilter === 'all' || group.category === this.areaFilter)
      .map((group) => {
        const filtered = group.rows.filter((row) => this.matchesSearch(row) && this.matchesStatus(row));
        const includedRows = filtered.filter((row) => this.isIncluded(row)).map((row) => this.buildCapabilityView(row));
        const excludedRows = filtered.filter((row) => !this.isIncluded(row)).map((row) => this.buildCapabilityView(row));
        const includedCount = group.rows.filter((row) => this.isIncluded(row)).length;
        const excludedCount = group.rows.length - includedCount;
        return {
          category: group.category,
          label: group.label,
          includedCount,
          excludedCount,
          includedRows,
          excludedRows,
        };
      })
      .filter((group) => group.includedRows.length > 0 || group.excludedRows.length > 0);

    const hasSearch = this.search.trim() !== '';
    this.searchHasNoMatches =
      hasSearch && this.visibleLimitViews.length === 0 && this.visibleCapabilityGroups.length === 0;
  }
}
