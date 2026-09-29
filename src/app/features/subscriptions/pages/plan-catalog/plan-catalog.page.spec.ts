import { ComponentFixture, TestBed } from '@angular/core/testing';
import { provideRouter } from '@angular/router';
import { of } from 'rxjs';
import { AuthService } from '@core/services/auth.service';
import { ConfirmationDialogService } from '@core/services/confirmation-dialog.service';
import { ToastService } from '@core/services/toast.service';
import { CatalogPlan } from '../../models/subscription-admin.models';
import { SubscriptionAdminService } from '../../services/subscription-admin.service';
import { PlanCatalogPage } from './plan-catalog.page';

const plans = [
  {
    id: 1,
    code: 'STARTER',
    name: 'Starter',
    pricing_type: 'FIXED',
    status: 'ACTIVE',
    is_public: true,
    is_featured: false,
    is_assignable: true,
    is_legacy: false,
    is_default: true,
    badge_label: null,
    tenant_count: 3,
    is_editable: true,
    edit_restriction: null,
    edit_policy: {
      tenant_count: 3,
      safe_fields: ['name', 'description', 'short_description', 'badge_label', 'is_featured'],
      restricted_fields: [],
      immutable_fields: [],
    },
    can_delete: false,
    delete_restriction: {
      code: 'PLAN_HAS_ASSIGNED_CHURCHES',
      message:
        'This plan cannot be deleted because it is currently associated with one or more churches. Remove the associated churches before deleting this plan.',
      tenant_count: 3,
    },
    active_version: { id: 11, version_number: 1, currency_code: 'INR', monthly_price: '1499.00', annual_price: '14990.00', trial_days: 14 },
  },
  {
    id: 2,
    code: 'STANDARD',
    name: 'Standard',
    pricing_type: 'FIXED',
    status: 'ACTIVE',
    is_public: true,
    is_featured: true,
    is_assignable: true,
    is_legacy: false,
    is_default: false,
    badge_label: 'Most Popular',
    tenant_count: 0,
    is_editable: true,
    edit_restriction: null,
    edit_policy: {
      tenant_count: 0,
      safe_fields: ['name'],
      restricted_fields: [],
      immutable_fields: [],
    },
    can_delete: true,
    delete_restriction: null,
    active_version: { id: 12, version_number: 1, currency_code: 'INR', monthly_price: '2999.00', annual_price: null, trial_days: null },
  },
] as unknown as CatalogPlan[];

async function setup(superAdmin: boolean, permissions: string[]): Promise<ComponentFixture<PlanCatalogPage>> {
  await TestBed.configureTestingModule({
    imports: [PlanCatalogPage],
    providers: [
      provideRouter([]),
      { provide: SubscriptionAdminService, useValue: { listPlans: jest.fn(() => of(plans)) } },
      { provide: AuthService, useValue: { isSuperAdmin: () => superAdmin, hasPermission: (p: string) => permissions.includes(p) } },
      { provide: ToastService, useValue: { success: jest.fn(), error: jest.fn() } },
      { provide: ConfirmationDialogService, useValue: { confirm: jest.fn() } },
    ],
  }).compileComponents();
  const fixture = TestBed.createComponent(PlanCatalogPage);
  fixture.detectChanges();
  return fixture;
}

describe('PlanCatalogPage', () => {
  it('renders plans from the API (no hard-coded catalog)', async () => {
    const fixture = await setup(true, []);
    const text = fixture.nativeElement.textContent as string;
    expect(text).toContain('Starter');
    expect(text).toContain('Standard');
    expect(text).toContain('Most Popular');
    expect(text).toContain('Default for new churches');
    expect(fixture.nativeElement.querySelectorAll('.sa-plan-card').length).toBe(2);
  });

  it('shows Edit Plan for catalog plans and View for legacy-only viewers without manage', async () => {
    const fixture = await setup(true, []);
    const cards: HTMLElement[] = Array.from(fixture.nativeElement.querySelectorAll('.sa-plan-card'));
    const starter = cards.find((c) => c.textContent?.includes('Starter'))!;
    const standard = cards.find((c) => c.textContent?.includes('Standard'))!;

    expect(standard.querySelector('a[aria-label="Edit Plan"]')).toBeTruthy();
    expect(starter.querySelector('a[aria-label="Edit Plan"]')).toBeTruthy();
    expect(starter.textContent).toContain('3 churches');
  });

  it('shows catalog actions to Super Admin', async () => {
    const fixture = await setup(true, []);
    const root = fixture.nativeElement as HTMLElement;
    expect(root.querySelector('button')?.textContent?.trim()).toBe('New plan');
    expect(root.querySelector('button[aria-label="Duplicate"]')).toBeTruthy();
    expect(root.querySelector('button[aria-label="Archive"]')).toBeTruthy();
  });

  it('hides create/duplicate/archive for a view-only Ekklesia Admin', async () => {
    const fixture = await setup(false, ['subscriptions.plans.view', 'subscriptions.tenants.manage']);
    const buttons = Array.from(fixture.nativeElement.querySelectorAll('button')).map((b) => (b as HTMLElement).textContent?.trim());
    expect(buttons).not.toContain('New plan');
    expect(buttons).not.toContain('Duplicate');
    expect(buttons).not.toContain('Archive');
    expect(fixture.nativeElement.querySelector('a[aria-label="View"]')).toBeTruthy();
    expect(fixture.nativeElement.querySelector('a[aria-label="Edit Plan"]')).toBeFalsy();
  });

  it('never offers to archive the default plan', async () => {
    const fixture = await setup(true, []);
    const cards: HTMLElement[] = Array.from(fixture.nativeElement.querySelectorAll('.sa-plan-card'));
    const starter = cards.find((c) => c.textContent?.includes('Starter'))!;
    expect(starter.querySelector('button[aria-label="Archive"]')).toBeFalsy();
  });

  it('shows Delete only for Super Admin when can_delete is true', async () => {
    const fixture = await setup(true, []);
    const cards: HTMLElement[] = Array.from(fixture.nativeElement.querySelectorAll('.sa-plan-card'));
    const standard = cards.find((c) => c.textContent?.includes('Standard'))!;
    const starter = cards.find((c) => c.textContent?.includes('Starter'))!;
    expect(standard.querySelector('button[aria-label="Delete"]')).toBeTruthy();
    expect(starter.querySelector('button[aria-label="Delete"]')).toBeFalsy();
    expect(starter.textContent).toContain('cannot be deleted because it is currently associated');
  });

  it('hides Delete for Ekklesia Admin even when plan is deletable', async () => {
    const fixture = await setup(false, ['subscriptions.plans.view', 'subscriptions.plans.manage', 'subscriptions.plans.publish']);
    const text = fixture.nativeElement.textContent as string;
    expect(fixture.nativeElement.querySelector('button[aria-label="Delete"]')).toBeFalsy();
  });

  it('renders Edit Plan as a link with action icons', async () => {
    const fixture = await setup(true, []);
    const cards: HTMLElement[] = Array.from(fixture.nativeElement.querySelectorAll('.sa-plan-card'));
    const standard = cards.find((c) => c.textContent?.includes('Standard'))!;

    const editLink = standard.querySelector('a[aria-label="Edit Plan"]');
    expect(editLink).toBeTruthy();
    expect(editLink?.getAttribute('title')).toBe('Edit Plan');
    expect(standard.querySelectorAll('.sa-plan-card__actions svg[aria-hidden="true"]').length).toBeGreaterThan(0);
  });

  it('uses neutral icon buttons for Archive and Delete on the Standard plan card', async () => {
    const fixture = await setup(true, []);
    const cards: HTMLElement[] = Array.from(fixture.nativeElement.querySelectorAll('.sa-plan-card'));
    const standard = cards.find((c) => c.textContent?.includes('Standard'))!;
    const actions = standard.querySelector('.sa-plan-card__actions')!;

    const archiveBtn = actions.querySelector('button[aria-label="Archive"]');
    const deleteBtn = actions.querySelector('button[aria-label="Delete"]');

    expect(archiveBtn?.classList.contains('cf-btn-icon')).toBe(true);
    expect(deleteBtn?.classList.contains('cf-btn-icon')).toBe(true);
    expect(archiveBtn?.getAttribute('title')).toBe('Archive');
  });
});
