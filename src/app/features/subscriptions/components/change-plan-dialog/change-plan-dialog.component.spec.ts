import { HttpErrorResponse } from '@angular/common/http';
import { ComponentFixture, TestBed } from '@angular/core/testing';
import { of, throwError } from 'rxjs';
import { ToastService } from '@core/services/toast.service';
import { AdminTenantSubscription, CatalogPlan, PlanChangePreview } from '../../models/subscription-admin.models';
import { SubscriptionAdminService } from '../../services/subscription-admin.service';
import { ChangePlanDialogComponent } from './change-plan-dialog.component';

const version = (id: number) => ({ id, version_number: 1, currency_code: 'INR', monthly_price: '1499.00', annual_price: '14990.00', trial_days: 14, billing_intervals: ['MONTHLY', 'ANNUAL'] });

const plans = [
  { id: 1, code: 'STARTER', name: 'Starter', pricing_type: 'FIXED', status: 'ACTIVE', is_assignable: true, is_public: true, active_version: version(11) },
  { id: 2, code: 'STANDARD', name: 'Standard', pricing_type: 'FIXED', status: 'ACTIVE', is_assignable: true, is_public: true, active_version: version(12) },
  { id: 3, code: 'OLD', name: 'Old', pricing_type: 'FIXED', status: 'ARCHIVED', is_assignable: true, is_public: false, active_version: version(13) },
  { id: 4, code: 'LEGACY_FREE', name: 'Free (legacy)', pricing_type: 'FREE', status: 'ACTIVE', is_assignable: false, is_public: false, active_version: version(14) },
  { id: 5, code: 'DRAFTY', name: 'Drafty', pricing_type: 'FIXED', status: 'DRAFT', is_assignable: true, is_public: false, active_version: null },
] as unknown as CatalogPlan[];

const current = {
  tenant: { id: 7, name: 'St. Mary', plan_key: 'standard' },
  plan: { code: 'STANDARD', key: 'standard', name: 'Standard', pricing_type: 'FIXED', is_legacy: false, version_number: 1 },
  terms: { billing_interval: 'ANNUAL', currency_code: 'INR', contracted_price: null, tax_label: 'GST', version_number: 1, starts_at: null },
} as unknown as AdminTenantSubscription;

const downgrade = {
  target_plan: { id: 1, code: 'STARTER', name: 'Starter', version_id: 11, version_number: 1 },
  features_gained: [],
  features_lost: [{ code: 'SMS', name: 'SMS' }],
  limit_changes: [],
  over_limit: [],
  is_downgrade: true,
  requires_confirmation: true,
  revoked_backfill_overrides: 0,
  data_preserved: true,
} as unknown as PlanChangePreview;

async function setup() {
  const api = {
    listPlans: jest.fn(() => of(plans)),
    previewPlanChange: jest.fn(() => of(downgrade)),
    assignPlan: jest.fn(() => of({ message: 'Plan changed.', data: current })),
  };
  const toast = { success: jest.fn(), error: jest.fn(), warning: jest.fn() };
  await TestBed.configureTestingModule({
    imports: [ChangePlanDialogComponent],
    providers: [
      { provide: SubscriptionAdminService, useValue: api },
      { provide: ToastService, useValue: toast },
    ],
  }).compileComponents();
  const fixture: ComponentFixture<ChangePlanDialogComponent> = TestBed.createComponent(ChangePlanDialogComponent);
  fixture.componentRef.setInput('tenantId', 7);
  fixture.componentRef.setInput('current', current);
  fixture.detectChanges();
  return { fixture, dialog: fixture.componentInstance, api, toast };
}

describe('ChangePlanDialogComponent', () => {
  it('offers only assignable, non-archived plans with a live version', async () => {
    const { dialog } = await setup();
    expect(dialog.plans.map((p) => p.code)).toEqual(['STARTER', 'STANDARD']);
  });

  it('previews the change for the routed tenant and keeps the current billing interval', async () => {
    const { dialog, api } = await setup();
    dialog.choose(plans[0]);
    expect(api.previewPlanChange).toHaveBeenCalledWith(7, 1);
    expect(dialog.interval).toBe('ANNUAL');
    expect(dialog.preview?.requires_confirmation).toBe(true);
  });

  it('blocks a downgrade until the impact is confirmed and a reason is given', async () => {
    const { dialog, api, toast } = await setup();
    dialog.choose(plans[0]);

    dialog.submit();
    expect(toast.error).toHaveBeenCalled();
    expect(api.assignPlan).not.toHaveBeenCalled();

    dialog.reason = 'Church asked to reduce cost';
    dialog.submit();
    expect(toast.warning).toHaveBeenCalled();
    expect(api.assignPlan).not.toHaveBeenCalled();

    dialog.confirmImpact = true;
    const changed = jest.fn();
    dialog.changed.subscribe(changed);
    dialog.submit();
    expect(api.assignPlan).toHaveBeenCalledWith(7, expect.objectContaining({
      plan_id: 1,
      billing_interval: 'ANNUAL',
      contracted_price: null,
      confirm_impact: true,
      reason: 'Church asked to reduce cost',
    }));
    expect(changed).toHaveBeenCalledWith(current);
  });

  it('rejects a malformed agreed price', async () => {
    const { dialog, api, toast } = await setup();
    dialog.choose(plans[0]);
    dialog.confirmImpact = true;
    dialog.reason = 'New agreement';
    dialog.contractedPrice = '12.345';
    dialog.submit();
    expect(api.assignPlan).not.toHaveBeenCalled();
    expect(toast.error).toHaveBeenCalledWith(expect.stringContaining('Agreed price'), expect.any(String));
  });

  it('reloads the preview when the server says usage changed since review', async () => {
    const { dialog, api } = await setup();
    api.assignPlan.mockReturnValueOnce(throwError(() => new HttpErrorResponse({
      status: 409,
      error: { success: false, code: 'PLAN_CHANGE_REQUIRES_CONFIRMATION', message: 'Confirm impact' },
    })));
    dialog.choose(plans[0]);
    dialog.confirmImpact = true;
    dialog.reason = 'Downgrade';
    dialog.submit();
    expect(api.previewPlanChange).toHaveBeenCalledTimes(2);
    expect(dialog.confirmImpact).toBe(false);
  });
});
