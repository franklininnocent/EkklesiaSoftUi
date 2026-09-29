import {
  authorizationResultLabel,
  authorizationResultTone,
  contextLabel,
  identityLabel,
  riskTone,
  sessionStatusLabel,
  sessionStatusTone,
} from './application-access-labels.util';

describe('application-access-labels.util', () => {
  it('maps identity and context codes to plain language', () => {
    expect(identityLabel('AUTHENTICATED_TENANT_USER')).toBe('Parish user');
    expect(contextLabel('TENANT')).toBe('Parish');
    expect(sessionStatusLabel('ACTIVE')).toBe('Signed in');
  });

  it('maps authorization results for grid display', () => {
    expect(authorizationResultLabel('denied')).toBe('Blocked');
    expect(authorizationResultLabel('allowed')).toBe('Allowed');
    expect(authorizationResultTone('denied')).toBe('critical');
    expect(authorizationResultTone('allowed')).toBe('success');
  });

  it('maps risk and session status to badge tones', () => {
    expect(riskTone('HIGH')).toBe('critical');
    expect(riskTone('LOW')).toBe('success');
    expect(sessionStatusTone('REVOKED')).toBe('critical');
    expect(sessionStatusTone('ACTIVE')).toBe('success');
  });
});
