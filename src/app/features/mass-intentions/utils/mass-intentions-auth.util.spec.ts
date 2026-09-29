import { AuthService } from '@core/services/auth.service';
import { canCreateMassIntention } from './mass-intentions-auth.util';

describe('mass-intentions-auth.util', () => {
  it('uses tenant permission helper for create (admins without explicit grant)', () => {
    const auth = {
      hasTenantPermission: jest.fn((name: string) => name === 'mass.intentions.create'),
      hasPermission: jest.fn(() => false),
    } as unknown as AuthService;

    expect(canCreateMassIntention(auth)).toBe(true);
    expect(auth.hasPermission).not.toHaveBeenCalled();
  });
});
