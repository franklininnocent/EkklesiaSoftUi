import { ComponentFixture, TestBed } from '@angular/core/testing';
import { of } from 'rxjs';
import { AuthService } from '@core/services/auth.service';
import { ConfirmationDialogService } from '@core/services/confirmation-dialog.service';
import { ToastService } from '@core/services/toast.service';
import { AdminTenantSubscription } from '../../models/subscription-admin.models';
import { SubscriptionAdminService } from '../../services/subscription-admin.service';
import { TenantPlanPanelComponent } from './tenant-plan-panel.component';

const future = new Date(Date.now() + 86_400_000).toISOString();
const past = new Date(Date.now() - 86_400_000).toISOString();

const subscription = {
  tenant: { id: 7, name: 'St. Mary', plan_key: 'starter' },
  plan: { code: 'STARTER', key: 'starter', name: 'Starter', pricing_type: 'FIXED', is_legacy: false, version_number: 2 },
  lifecycle: { status: 'ACTIVE', trial_ends_at: null, subscription_suspended_at: null },
  terms: { billing_interval: 'ANNUAL', currency_code: 'INR', contracted_price: '14990.00', tax_label: 'GST', version_number: 2, starts_at: null },
  pending_change: null,
  entitlements: [],
  usage: [
    { code: 'PEOPLE', name: 'People', unit: 'people', usage: 249, limit: 250, unlimited: false, remaining: 1, percent_used: 99.6, level: 'critical' },
  ],
  engine_mode: 'enforce',
  history: [],
  overrides: [
    { id: 1, feature_code: 'PEOPLE', feature_name: 'People', mode: 'SET_LIMIT', numeric_value: 400, tier_value: null, reason: 'Pilot', effective_from: null, effective_until: future, revoked_at: null, revoke_reason: null, created_by: 1, created_at: null },
    { id: 2, feature_code: 'SMS', feature_name: 'SMS', mode: 'ENABLE', numeric_value: null, tier_value: null, reason: 'Trial', effective_from: null, effective_until: past, revoked_at: null, revoke_reason: null, created_by: 1, created_at: null },
  ],
} as unknown as AdminTenantSubscription;

async function setup(superAdmin: boolean, permissions: string[]) {
  const api = {
    tenantSubscription: jest.fn(() => of(subscription)),
    listFeatures: jest.fn(() => of([])),
    grantOverride: jest.fn(() => of({})),
    revokeOverride: jest.fn(() => of({})),
    cancelPendingChange: jest.fn(() => of({})),
  };
  const toast = { success: jest.fn(), error: jest.fn(), warning: jest.fn() };
  await TestBed.configureTestingModule({
    imports: [TenantPlanPanelComponent],
    providers: [
      { provide: SubscriptionAdminService, useValue: api },
      { provide: AuthService, useValue: { isSuperAdmin: () => superAdmin, hasPermission: (p: string) => permissions.includes(p) } },
      { provide: ToastService, useValue: toast },
      { provide: ConfirmationDialogService, useValue: { confirm: jest.fn(() => of({ confirmed: true, description: 'Done' })) } },
    ],
  }).compileComponents();
  const fixture: ComponentFixture<TenantPlanPanelComponent> = TestBed.createComponent(TenantPlanPanelComponent);
  fixture.componentRef.setInput('tenantId', 7);
  fixture.detectChanges();
  return { fixture, api, toast };
}

function buttonLabels(fixture: ComponentFixture<unknown>): string[] {
  return Array.from(fixture.nativeElement.querySelectorAll('button')).map((b) => (b as HTMLElement).textContent?.trim() ?? '');
}

describe('TenantPlanPanelComponent', () => {
  it('shows the plan, usage and exceptions loaded for the routed tenant', async () => {
    const { fixture, api } = await setup(true, []);
    expect(api.tenantSubscription).toHaveBeenCalledWith(7);
    const text = fixture.nativeElement.textContent as string;
    expect(text).toContain('Starter');
    expect(text).toContain('249 of 250 people');
    expect(fixture.componentInstance.activeOverrides.map((o) => o.id)).toEqual([1]);
    expect(fixture.componentInstance.pastOverrides.map((o) => o.id)).toEqual([2]);
    expect(buttonLabels(fixture)).toEqual(expect.arrayContaining(['Change plan', 'Add exception', 'End']));
  });

  it('hides change and exception actions for staff who can only view usage', async () => {
    const { fixture } = await setup(false, ['subscriptions.usage.view']);
    const labels = buttonLabels(fixture);
    expect(labels).not.toContain('Change plan');
    expect(labels).not.toContain('Add exception');
    expect(labels).not.toContain('End');
  });

  it('does not call the API without usage access', async () => {
    const { fixture, api } = await setup(false, []);
    expect(api.tenantSubscription).not.toHaveBeenCalled();
    expect(fixture.nativeElement.textContent.trim()).toBe('');
  });

  it('requires a reason before granting an exception', async () => {
    const { fixture, api, toast } = await setup(true, []);
    const panel = fixture.componentInstance;
    panel.openGrant();
    panel.grant = { feature_code: 'PEOPLE', mode: 'SET_LIMIT', numeric_value: 500, tier_value: null, effective_until: '', reason: ' ' };
    panel.submitGrant();
    expect(api.grantOverride).not.toHaveBeenCalled();
    expect(toast.error).toHaveBeenCalled();

    panel.grant.reason = 'Diocese pilot';
    panel.submitGrant();
    expect(api.grantOverride).toHaveBeenCalledWith(7, expect.objectContaining({ feature_code: 'PEOPLE', mode: 'SET_LIMIT', numeric_value: 500, reason: 'Diocese pilot' }));
  });

  it('revokes an exception with the confirmed reason and reloads', async () => {
    const { fixture, api } = await setup(true, []);
    fixture.componentInstance.revoke(subscription.overrides[0]);
    expect(api.revokeOverride).toHaveBeenCalledWith(7, 1, 'Done');
    expect(api.tenantSubscription).toHaveBeenCalledTimes(2);
  });
});
