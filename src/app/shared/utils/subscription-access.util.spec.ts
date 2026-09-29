import { canViewMySubscription } from './subscription-access.util';
import { User } from '@core/models';

function user(partial: Partial<User> & Pick<User, 'id'>): User {
  return {
    email: 't@example.com',
    name: 'Test',
    ...partial,
  } as User;
}

describe('canViewMySubscription', () => {
  it('denies anonymous users', () => {
    expect(canViewMySubscription(null)).toBe(false);
  });

  it('allows platform admin only when tenant-scoped', () => {
    expect(canViewMySubscription(user({ id: 1, role_name: 'SuperAdmin' }))).toBe(false);
    expect(canViewMySubscription(user({ id: 1, role_name: 'SuperAdmin', tenant_id: 9 }))).toBe(true);
    expect(canViewMySubscription(user({ id: 1, role_name: 'EkklesiaAdmin', tenant_id: 9 }))).toBe(true);
  });

  it('allows primary admin and tenant admin roles', () => {
    expect(canViewMySubscription(user({ id: 2, tenant_id: 3, is_primary_admin: true } as any))).toBe(true);
    expect(canViewMySubscription(user({ id: 2, tenant_id: 3, role_name: 'Administrator' }))).toBe(true);
    expect(canViewMySubscription(user({ id: 2, tenant_id: 3, role_name: 'Church Administrator' }))).toBe(true);
  });

  it('allows users with subscription.view', () => {
    expect(
      canViewMySubscription(
        user({
          id: 3,
          tenant_id: 4,
          permissions: [{ id: 1, name: 'subscription.view' } as any],
        })
      )
    ).toBe(true);
  });

  it('denies ordinary tenant users without permission', () => {
    expect(
      canViewMySubscription(
        user({
          id: 4,
          tenant_id: 5,
          role_name: 'Volunteer',
          permissions: [],
        })
      )
    ).toBe(false);
  });
});
