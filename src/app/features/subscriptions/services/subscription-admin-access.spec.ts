import { AuthService } from '@core/services/auth.service';
import { subscriptionAdminCapabilities } from './subscription-admin-access';

function authWith(superAdmin: boolean, permissions: string[]): AuthService {
  return {
    isSuperAdmin: () => superAdmin,
    hasPermission: (p: string) => permissions.includes(p),
  } as unknown as AuthService;
}

describe('subscriptionAdminCapabilities', () => {
  it('gives Super Admin every capability', () => {
    const can = subscriptionAdminCapabilities(authWith(true, []));
    expect(Object.values(can).every(Boolean)).toBe(true);
  });

  it('keeps an operate-only Ekklesia Admin out of catalog editing', () => {
    const can = subscriptionAdminCapabilities(
      authWith(false, [
        'subscriptions.plans.view',
        'subscriptions.tenants.manage',
        'subscriptions.overrides.manage',
        'subscriptions.usage.view',
        'subscriptions.audit.view',
        'subscriptions.requests.review',
      ]),
    );
    expect(can.view).toBe(true);
    expect(can.tenants).toBe(true);
    expect(can.audit).toBe(true);
    expect(can.usage).toBe(true);
    expect(can.requests).toBe(true);
    expect(can.revenue).toBe(false);
    expect(can.manage).toBe(false);
    expect(can.publish).toBe(false);
    expect(can.features).toBe(false);
    expect(can.policies).toBe(false);
  });
});
