import { localDateOnly, requiresGatewayReference } from './local-date-only';

describe('localDateOnly', () => {
  it('uses local calendar fields instead of UTC ISO slicing', () => {
    const localEvening = new Date(2026, 8, 3, 20, 0, 0);
    expect(localDateOnly(localEvening)).toBe('2026-09-03');
  });

  it('keeps late local evening on the same calendar date', () => {
    const lateLocal = new Date(2026, 8, 3, 23, 30, 0);
    expect(localDateOnly(lateLocal)).toBe('2026-09-03');
  });
});

describe('requiresGatewayReference', () => {
  it('requires a cheque or bank transfer reference', () => {
    expect(requiresGatewayReference('cheque')).toBe(true);
    expect(requiresGatewayReference('bank_transfer')).toBe(true);
    expect(requiresGatewayReference('cash')).toBe(false);
  });
});
