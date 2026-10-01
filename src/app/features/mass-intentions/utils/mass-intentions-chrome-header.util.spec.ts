import {
  massIntentionsDashboardBackLink,
  massIntentionsHomePeriodSubtitle,
} from './mass-intentions-chrome-header.util';

describe('mass-intentions-chrome-header.util', () => {
  it('uses middot period separator in Version 2', () => {
    expect(massIntentionsHomePeriodSubtitle('September 2026')).toContain('· September 2026');
  });

  it('omits dashboard back link in Version 2', () => {
    expect(massIntentionsDashboardBackLink()).toBeUndefined();
  });
});
