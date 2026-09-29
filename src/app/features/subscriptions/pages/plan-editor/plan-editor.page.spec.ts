import { TestBed } from '@angular/core/testing';
import { ActivatedRoute, convertToParamMap } from '@angular/router';
import { of, throwError } from 'rxjs';
import { AuthService } from '@core/services/auth.service';
import { ConfirmationDialogService } from '@core/services/confirmation-dialog.service';
import { ToastService } from '@core/services/toast.service';
import { CatalogPlan, PlanVersion, VersionTermsValue } from '../../models/subscription-admin.models';
import { SubscriptionAdminService } from '../../services/subscription-admin.service';
import { PlanEditorPage } from './plan-editor.page';

function version(overrides: Partial<PlanVersion>): PlanVersion {
  return {
    id: 1,
    plan_id: 10,
    version_number: 1,
    status: 'ACTIVE',
    currency_code: 'INR',
    monthly_price: '1499.00',
    annual_price: '14990.00',
    setup_fee: null,
    tax_inclusive: false,
    tax_rate_percent: '18.00',
    tax_label: 'GST',
    trial_days: 30,
    billing_intervals: ['MONTHLY', 'ANNUAL'],
    effective_from: null,
    published_at: '2026-09-01T00:00:00Z',
    retired_at: null,
    change_notes: null,
    is_editable: false,
    ...overrides,
  };
}

const defaultEditPolicy = {
  tenant_count: 3,
  safe_fields: ['name', 'description', 'short_description', 'badge_label', 'is_featured'],
  restricted_fields: [
    { field: 'is_public', reason: 'Hiding a public plan removes it from the public catalog.' },
    { field: 'is_assignable', reason: 'Stopping assignment prevents new churches from choosing this plan.' },
    { field: 'display_order', reason: 'Display order affects upgrade and downgrade comparisons.' },
  ],
  immutable_fields: [{ field: 'code', reason: 'Plan code is permanent.' }],
};

function plan(overrides: Partial<CatalogPlan> = {}): CatalogPlan {
  return {
    id: 10,
    code: 'STARTER',
    key: 'starter',
    slug: 'starter',
    name: 'Starter',
    short_description: null,
    description: null,
    pricing_type: 'FIXED',
    status: 'ACTIVE',
    is_public: true,
    is_featured: false,
    is_assignable: true,
    is_legacy: false,
    is_default: true,
    badge_label: null,
    display_order: 1,
    archived_at: null,
    tenant_count: 3,
    is_editable: true,
    edit_restriction: null,
    edit_policy: defaultEditPolicy,
    can_delete: false,
    delete_restriction: {
      code: 'PLAN_HAS_ASSIGNED_CHURCHES',
      message:
        'This plan cannot be deleted because it is currently associated with one or more churches. Remove the associated churches before deleting this plan.',
      tenant_count: 3,
    },
    active_version: null,
    versions: [version({}), version({ id: 2, version_number: 2, status: 'DRAFT', is_editable: true, published_at: null })],
    ...overrides,
  } as CatalogPlan;
}

function setup(
  catalogPlan: CatalogPlan,
  permissions = ['subscriptions.plans.manage'],
  query: Record<string, string> = {},
) {
  const api = {
    getPlan: jest.fn().mockReturnValue(of(catalogPlan)),
    listFeatures: jest.fn().mockReturnValue(of([])),
    updateVersionTerms: jest.fn((_p: number, id: number, payload: object) =>
      of({ ...version({ id, status: 'DRAFT', is_editable: true }), ...payload }),
    ),
    updatePlan: jest.fn().mockReturnValue(of(catalogPlan)),
  };
  const toast = { success: jest.fn(), error: jest.fn() };

  TestBed.overrideComponent(PlanEditorPage, { set: { template: '', imports: [] } });
  TestBed.configureTestingModule({
    imports: [PlanEditorPage],
    providers: [
      { provide: SubscriptionAdminService, useValue: api },
      { provide: ToastService, useValue: toast },
      { provide: ConfirmationDialogService, useValue: { confirm: jest.fn() } },
      {
        provide: ActivatedRoute,
        useValue: {
          paramMap: of(convertToParamMap({ planId: '10' })),
          queryParamMap: of(convertToParamMap(query)),
        },
      },
      { provide: AuthService, useValue: { isSuperAdmin: () => false, hasPermission: (p: string) => permissions.includes(p) } },
    ],
  });
  const fixture = TestBed.createComponent(PlanEditorPage);
  fixture.detectChanges();
  return { page: fixture.componentInstance, api, toast };
}

describe('PlanEditorPage pricing form', () => {
  it('opens the draft version and fills the form with string amounts', () => {
    const { page } = setup(plan());

    expect(page.selectedVersion?.status).toBe('DRAFT');
    expect(page.versionReadonly).toBe(false);
    expect(page.termsForm.monthly_price).toBe('1499.00');
    expect(page.termsForm.intervals).toEqual({ MONTHLY: true, ANNUAL: true, CUSTOM: false });
  });

  it('sends prices as exact strings, never as floating point numbers', () => {
    const { page, api } = setup(plan());
    page.termsForm.monthly_price = '2999.5';
    page.termsForm.annual_price = ' 29990 ';
    page.termsForm.currency_code = 'inr';

    page.saveTerms();

    const payload = api.updateVersionTerms.mock.calls[0][2] as VersionTermsValue;
    expect(api.updateVersionTerms).toHaveBeenCalledWith(10, 2, expect.any(Object));
    expect(payload.monthly_price).toBe('2999.5');
    expect(payload.annual_price).toBe('29990');
    expect(payload.currency_code).toBe('INR');
    expect(payload.billing_intervals).toEqual(['MONTHLY', 'ANNUAL']);
  });

  it.each([
    ['1,499', 'Monthly price: use numbers only, up to 2 decimals.'],
    ['-5', 'Monthly price: use numbers only, up to 2 decimals.'],
    ['12.345', 'Monthly price: use numbers only, up to 2 decimals.'],
  ])('rejects the amount %s with a plain message', (amount, message) => {
    const { page, api, toast } = setup(plan());
    page.termsForm.monthly_price = amount;

    page.saveTerms();

    expect(api.updateVersionTerms).not.toHaveBeenCalled();
    expect(toast.error).toHaveBeenCalledWith(message, 'Check your entries');
  });

  it('requires a billing option and a sensible tax rate', () => {
    const { page, api, toast } = setup(plan());
    page.termsForm.intervals = { MONTHLY: false, ANNUAL: false, CUSTOM: false };
    page.saveTerms();
    expect(toast.error).toHaveBeenCalledWith('Choose at least one billing option.', 'Check your entries');

    page.termsForm.intervals = { MONTHLY: true, ANNUAL: false, CUSTOM: false };
    page.termsForm.tax_mode = 'override';
    page.termsForm.tax_rate_percent = '120';
    page.saveTerms();
    expect(toast.error).toHaveBeenCalledWith('Tax rate must be between 0 and 100.', 'Check your entries');
    expect(api.updateVersionTerms).not.toHaveBeenCalled();
  });

  it('never saves a live version; changes need a new draft', () => {
    const { page, api } = setup(plan({ versions: [version({})] }));

    expect(page.selectedVersion?.status).toBe('ACTIVE');
    expect(page.versionReadonly).toBe(true);
    page.saveTerms();
    expect(api.updateVersionTerms).not.toHaveBeenCalled();
  });

  it('keeps legacy plans read-only even for plan managers', () => {
    const { page, api } = setup(
      plan({
        is_legacy: true,
        code: 'LEGACY_FREE',
        is_editable: false,
        edit_restriction: { code: 'PLAN_CHANGE_NOT_ALLOWED', message: 'Grandfathered legacy plans cannot be edited.', tenant_count: 0 },
      }),
    );

    expect(page.canManageVersions).toBe(false);
    expect(page.canEditDetails).toBe(false);
    page.saveTerms();
    expect(api.updateVersionTerms).not.toHaveBeenCalled();
  });

  it('is read-only without the manage permission', () => {
    const { page } = setup(plan(), ['subscriptions.plans.view']);

    expect(page.canManageVersions).toBe(false);
    expect(page.canEditDetails).toBe(false);
    expect(page.versionReadonly).toBe(true);
  });

  it('allows safe plan details when churches are assigned and still allows version drafts', () => {
    const { page, api } = setup(plan());

    expect(page.canEditDetails).toBe(true);
    expect(page.canManageVersions).toBe(true);
    expect(page.versionReadonly).toBe(false);
    page.detailsForm.name = 'Starter Updated';
    page.saveDetails();
    expect(api.updatePlan).toHaveBeenCalledWith(10, expect.objectContaining({ name: 'Starter Updated' }));
  });

  it('saves plan details for an unlinked plan', () => {
    const unlinked = plan({
      tenant_count: 0,
      is_editable: true,
      edit_restriction: null,
      edit_policy: { ...defaultEditPolicy, tenant_count: 0 },
      versions: [version({ id: 2, version_number: 1, status: 'DRAFT', is_editable: true, published_at: null })],
    });
    const { page, api, toast } = setup(unlinked);
    page.detailsForm.name = 'Parish Plus';
    page.detailsForm.pricing_type = 'FREE';

    page.saveDetails();

    expect(api.updatePlan).toHaveBeenCalledWith(
      10,
      expect.objectContaining({ name: 'Parish Plus', pricing_type: 'FREE' }),
    );
    expect(toast.success).toHaveBeenCalled();
  });

  it('prompts again when save needs assignment confirmation after a race', () => {
    const confirmSpy = jest.fn().mockReturnValue(of({ confirmed: true }));
    const catalogPlan = plan();
    const api = {
      getPlan: jest.fn().mockReturnValue(of(catalogPlan)),
      listFeatures: jest.fn().mockReturnValue(of([])),
      updatePlan: jest
        .fn()
        .mockReturnValueOnce(
          throwError(() => ({
            status: 409,
            code: 'PLAN_EDIT_REQUIRES_CONFIRMATION',
            message: 'Confirm to continue.',
          })),
        )
        .mockReturnValueOnce(of(plan({ name: 'Starter Renamed' }))),
    };
    TestBed.overrideComponent(PlanEditorPage, { set: { template: '', imports: [] } });
    TestBed.configureTestingModule({
      imports: [PlanEditorPage],
      providers: [
        { provide: SubscriptionAdminService, useValue: api },
        { provide: ToastService, useValue: { success: jest.fn(), error: jest.fn() } },
        { provide: ConfirmationDialogService, useValue: { confirm: confirmSpy } },
        {
          provide: ActivatedRoute,
          useValue: {
            paramMap: of(convertToParamMap({ planId: '10' })),
            queryParamMap: of(convertToParamMap({})),
          },
        },
        {
          provide: AuthService,
          useValue: { isSuperAdmin: () => false, hasPermission: (p: string) => p === 'subscriptions.plans.manage' },
        },
      ],
    });
    const fixture = TestBed.createComponent(PlanEditorPage);
    fixture.detectChanges();
    const page = fixture.componentInstance;
    page.detailsForm.name = 'Starter Renamed';
    page.saveDetails();

    expect(confirmSpy).toHaveBeenCalled();
    expect(api.updatePlan).toHaveBeenCalledTimes(2);
    expect(api.updatePlan.mock.calls[1][1]).toMatchObject({ confirm_assignment_impact: true });
  });

  it('opens the details tab when requested via query param', () => {
    const { page } = setup(
      plan({
        tenant_count: 0,
        is_editable: true,
        edit_restriction: null,
        edit_policy: { ...defaultEditPolicy, tenant_count: 0 },
        versions: [version({ id: 2, version_number: 1, status: 'DRAFT', is_editable: true, published_at: null })],
      }),
      ['subscriptions.plans.manage'],
      { tab: 'details' },
    );

    expect(page.activeTab).toBe('details');
  });
});
