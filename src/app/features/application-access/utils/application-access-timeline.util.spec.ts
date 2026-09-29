import { summarizeTimelineEvents } from './application-access-timeline.util';

describe('application-access-timeline.util', () => {
  it('summarizes allowed, blocked, and module codes from timeline rows', () => {
    const summary = summarizeTimelineEvents([
      {
        id: '1',
        event_type: 'VIEW',
        authorization_result: 'allowed',
        occurred_at: '2026-09-11T00:00:00Z',
        module_code: 'Donations',
      } as any,
      {
        id: '2',
        event_type: 'VIEW',
        authorization_result: 'denied',
        occurred_at: '2026-09-11T00:01:00Z',
        module_code: 'Family',
      } as any,
      {
        id: '3',
        event_type: 'VIEW',
        authorization_result: 'allowed',
        occurred_at: '2026-09-11T00:02:00Z',
        module_code: 'Donations',
      } as any,
    ]);

    expect(summary.allowed).toBe(2);
    expect(summary.blocked).toBe(1);
    expect(summary.modules).toEqual(['Donations', 'Family']);
  });
});
