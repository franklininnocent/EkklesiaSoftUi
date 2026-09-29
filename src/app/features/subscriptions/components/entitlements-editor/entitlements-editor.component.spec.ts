import { ComponentFixture, TestBed } from '@angular/core/testing';
import { HttpErrorResponse } from '@angular/common/http';
import { of, throwError } from 'rxjs';
import { ToastService } from '@core/services/toast.service';
import { CatalogFeature, PlanVersion } from '../../models/subscription-admin.models';
import { SubscriptionAdminService } from '../../services/subscription-admin.service';
import { EntitlementsEditorComponent } from './entitlements-editor.component';

function feature(partial: Partial<CatalogFeature>): CatalogFeature {
  return {
    id: 1,
    code: 'X',
    name: 'X',
    description: null,
    category: 'core',
    module_key: null,
    feature_type: 'MODULE',
    unit: null,
    legacy_key: null,
    is_core: false,
    is_public: true,
    is_active: true,
    display_order: 0,
    tier_options: null,
    dependencies: [],
    ...partial,
  };
}

const features: CatalogFeature[] = [
  feature({
    id: 1,
    code: 'FAMILIES',
    name: 'Family Records',
    category: 'people',
    display_order: 10,
    is_core: true,
    description: 'Create and manage family households.',
  }),
  feature({ id: 2, code: 'DONATIONS', name: 'Donations', category: 'finance', display_order: 20 }),
  feature({
    id: 3,
    code: 'CONTRIBUTION_PLANS',
    name: 'Contribution Plans',
    category: 'finance',
    display_order: 30,
    dependencies: ['DONATIONS'],
  }),
  feature({
    id: 4,
    code: 'PEOPLE_LIMIT',
    name: 'People',
    feature_type: 'LIMIT',
    category: 'limits',
    unit: 'people',
    display_order: 5,
  }),
  feature({
    id: 6,
    code: 'STORAGE_MB',
    name: 'Storage',
    feature_type: 'QUOTA',
    category: 'limits',
    unit: 'MB',
    display_order: 6,
  }),
  feature({ id: 5, code: 'OLD_MODULE', name: 'Old', is_active: false }),
];

const version = {
  id: 9,
  plan_id: 3,
  version_number: 2,
  status: 'DRAFT',
  is_editable: true,
  entitlements: [
    { feature_code: 'FAMILIES', is_enabled: true, numeric_value: null },
    { feature_code: 'PEOPLE_LIMIT', is_enabled: true, numeric_value: 250 },
    { feature_code: 'STORAGE_MB', is_enabled: true, numeric_value: 10240 },
    { feature_code: 'CONTRIBUTION_PLANS', is_enabled: true, numeric_value: null },
  ],
} as unknown as PlanVersion;

describe('EntitlementsEditorComponent', () => {
  let fixture: ComponentFixture<EntitlementsEditorComponent>;
  let component: EntitlementsEditorComponent;
  const api = { setEntitlements: jest.fn(() => of(version)) };

  beforeEach(async () => {
    api.setEntitlements.mockClear();
    await TestBed.configureTestingModule({
      imports: [EntitlementsEditorComponent],
      providers: [
        { provide: SubscriptionAdminService, useValue: api },
        { provide: ToastService, useValue: { success: jest.fn(), error: jest.fn(), warning: jest.fn() } },
      ],
    }).compileComponents();
    fixture = TestBed.createComponent(EntitlementsEditorComponent);
    component = fixture.componentInstance;
    component.planId = 3;
    component.version = version;
    component.features = features;
    component.readonly = false;
    component.ngOnChanges();
    fixture.detectChanges();
  });

  it('renders compact toolbar and summary in the features chrome', () => {
    expect(fixture.nativeElement.querySelector('.sa-entitlements-chrome')).not.toBeNull();
    expect(fixture.nativeElement.querySelector('.sa-entitlements-chrome__toolbar')).not.toBeNull();
    expect(fixture.nativeElement.querySelector('.sa-entitlements-chrome__summary')).not.toBeNull();
    expect(fixture.nativeElement.querySelector('.sa-entitlements-chrome__version')).not.toBeNull();
    expect(fixture.nativeElement.querySelector('.sa-entitlements-chrome__toolbar app-list-toolbar')).not.toBeNull();
    expect(fixture.nativeElement.querySelector('.sa-entitlements-chrome__codes')).not.toBeNull();
    expect(fixture.nativeElement.querySelector('.sa-entitlements-chrome__summary')?.textContent).toContain('2 included');
  });

  it('hides unused inactive features and splits limits from capabilities', () => {
    const rowCodes = component.rows.map((r) => r.feature.code);
    expect(rowCodes).toEqual(['FAMILIES', 'DONATIONS', 'CONTRIBUTION_PLANS', 'PEOPLE_LIMIT', 'STORAGE_MB']);
    expect(component.limitRows.map((r) => r.feature.code)).toEqual(['PEOPLE_LIMIT', 'STORAGE_MB']);
    expect(component.capabilityGroups.flatMap((g) => g.rows.map((r) => r.feature.code))).toEqual([
      'FAMILIES',
      'DONATIONS',
      'CONTRIBUTION_PLANS',
    ]);
  });

  it('uses business area labels for capability groups', () => {
    expect(component.capabilityGroups.map((g) => g.label)).toEqual(['People & families', 'Finance & stewardship']);
  });

  it('builds discrete capacity facts in the overview', () => {
    expect(component.overview.includedCount).toBe(2);
    expect(component.overview.excludedCount).toBe(1);
    expect(component.overview.capacityFacts).toEqual([
      { label: 'People', value: '250' },
      { label: 'Storage', value: '10 GB' },
    ]);
    expect(component.overviewSummary).toBe('2 included · 1 not included · People 250 · Storage 10 GB');
  });

  it('formats allowance phrases for finite, zero, unlimited, and excluded limits', () => {
    const people = component.rows.find((r) => r.feature.code === 'PEOPLE_LIMIT')!;
    expect(component.allowancePhrase(people)).toBe('Up to 250 people');

    people.value = 0;
    expect(component.allowancePhrase(people)).toBe('Up to 0 people');

    people.unlimited = true;
    expect(component.allowancePhrase(people)).toBe('Unlimited');

    people.enabled = false;
    people.unlimited = false;
    expect(component.allowancePhrase(people)).toBe('Not included');
  });

  it('formats storage limits in GB when at least 1024 MB', () => {
    const storage = component.rows.find((r) => r.feature.code === 'STORAGE_MB')!;
    expect(component.allowancePhrase(storage)).toBe('Up to 10 GB');
  });

  it('searches feature descriptions from the list toolbar', () => {
    component.onSearchFromToolbar('households');
    expect(component.visibleCapabilityGroups.flatMap((g) => g.includedRows.map((v) => v.row.feature.code))).toEqual([
      'FAMILIES',
    ]);
  });

  it('applies status filters from the filter drawer', () => {
    const donations = component.rows.find((r) => r.feature.code === 'DONATIONS')!;
    donations.enabled = false;
    component.onFiltersApplied({ status: 'excluded', area: 'all' });
    expect(component.activeFilterCount).toBe(1);
    expect(component.visibleCapabilityGroups.flatMap((g) => g.excludedRows.map((v) => v.row.feature.code))).toContain(
      'DONATIONS',
    );
    expect(component.visibleLimitViews.length).toBe(0);
  });

  it('clears drawer filters on reset', () => {
    component.onFiltersApplied({ status: 'included', area: 'finance' });
    expect(component.activeFilterCount).toBe(2);
    component.onFiltersCleared();
    expect(component.statusFilter).toBe('all');
    expect(component.areaFilter).toBe('all');
    expect(component.activeFilterCount).toBe(0);
  });

  it('does not show feature codes by default in the template', () => {
    expect(fixture.nativeElement.querySelector('.sa-code')).toBeNull();
    component.showCodes = true;
    component.onShowCodesChange();
    fixture.detectChanges();
    expect(fixture.nativeElement.querySelector('.sa-code')).not.toBeNull();
  });

  it('always sends core features as enabled and sends null for unlimited limits', () => {
    const people = component.rows.find((r) => r.feature.code === 'PEOPLE_LIMIT')!;
    people.unlimited = true;
    const families = component.rows.find((r) => r.feature.code === 'FAMILIES')!;
    families.enabled = false;
    const plans = component.rows.find((r) => r.feature.code === 'CONTRIBUTION_PLANS')!;
    plans.enabled = false;
    component.markDirty();
    component.save();

    expect(api.setEntitlements).toHaveBeenCalledWith(3, 9, [
      { feature_code: 'FAMILIES', is_enabled: true, numeric_value: null, tier_value: null },
      { feature_code: 'DONATIONS', is_enabled: false, numeric_value: null, tier_value: null },
      { feature_code: 'CONTRIBUTION_PLANS', is_enabled: false, numeric_value: null, tier_value: null },
      { feature_code: 'PEOPLE_LIMIT', is_enabled: true, numeric_value: null, tier_value: null },
      { feature_code: 'STORAGE_MB', is_enabled: true, numeric_value: 10240, tier_value: null },
    ]);
  });

  it('still saves every row when search filters the visible list', () => {
    const donations = component.rows.find((r) => r.feature.code === 'DONATIONS')!;
    donations.enabled = true;
    component.onSearchFromToolbar('PEOPLE_LIMIT');
    fixture.detectChanges();
    expect(component.visibleLimitViews.length).toBe(1);
    expect(component.visibleCapabilityGroups.length).toBe(0);
    component.markDirty();
    component.save();
    expect(api.setEntitlements).toHaveBeenCalledWith(
      3,
      9,
      expect.arrayContaining([
        expect.objectContaining({ feature_code: 'FAMILIES' }),
        expect.objectContaining({ feature_code: 'DONATIONS' }),
        expect.objectContaining({ feature_code: 'CONTRIBUTION_PLANS' }),
        expect.objectContaining({ feature_code: 'PEOPLE_LIMIT' }),
        expect.objectContaining({ feature_code: 'STORAGE_MB' }),
      ]),
    );
  });

  it('blocks saving an invalid limit', () => {
    const people = component.rows.find((r) => r.feature.code === 'PEOPLE_LIMIT')!;
    people.value = -5;
    component.save();
    expect(api.setEntitlements).not.toHaveBeenCalled();
    expect(component.errors[0]).toContain('People');
  });

  it('blocks saving when a direct dependency is missing', () => {
    const plans = component.rows.find((r) => r.feature.code === 'CONTRIBUTION_PLANS')!;
    const donations = component.rows.find((r) => r.feature.code === 'DONATIONS')!;
    plans.enabled = true;
    donations.enabled = false;
    component.save();
    expect(api.setEntitlements).not.toHaveBeenCalled();
    expect(component.errors[0]).toContain('Contribution Plans requires Donations');
  });

  it('surfaces API validation errors in the alert list', () => {
    const donations = component.rows.find((r) => r.feature.code === 'DONATIONS')!;
    donations.enabled = true;
    api.setEntitlements.mockReturnValueOnce(
      throwError(
        () =>
          new HttpErrorResponse({
            status: 422,
            error: { message: 'Some entitlements are invalid.', errors: { 'dependencies.X': ['X requires Y.'] } },
          }),
      ),
    );
    component.markDirty();
    component.save();
    expect(component.errors).toContain('X requires Y.');
  });

  it('does nothing when read-only', () => {
    component.readonly = true;
    component.save();
    expect(api.setEntitlements).not.toHaveBeenCalled();
  });

  it('shows phrase status instead of toggles when read-only', () => {
    component.readonly = true;
    fixture.detectChanges();
    expect(fixture.nativeElement.querySelector('.sa-entitlements-chrome__notice')).not.toBeNull();
    expect(fixture.nativeElement.querySelector('.sa-entitlements-main .sa-entitlements-capacity__switch')).toBeNull();
    expect(fixture.nativeElement.querySelector('.sa-entitlements-main .sa-entitlements-capacity__phrase')).not.toBeNull();
  });
});
