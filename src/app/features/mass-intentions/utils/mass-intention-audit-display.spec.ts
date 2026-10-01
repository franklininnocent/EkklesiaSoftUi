import {
  auditEventLabel,
  auditRelatedLink,
  formatAuditWhen,
} from './mass-intention-audit-display';

describe('mass-intention-audit-display', () => {
  it('maps schedule events to plain labels', () => {
    expect(auditEventLabel('schedule.draft_saved')).toBe('Schedule draft saved');
    expect(auditEventLabel('schedule.applied')).toBe('Schedule published to calendar');
  });

  it('formats audit timestamps into date and time parts', () => {
    const parts = formatAuditWhen('2026-09-29T15:39:23+00:00');
    expect(parts).not.toBeNull();
    expect(parts!.date).toBeTruthy();
    expect(parts!.time).toBeTruthy();
  });

  it('builds intention view link from request id', () => {
    const link = auditRelatedLink({
      id: '1',
      event_type: 'request.updated',
      request_id: 'req-1',
    });
    expect(link?.label).toBe('View intention');
    expect(link?.queryParams).toEqual({ view: 'req-1' });
  });

  it('builds temporary schedule link from payload', () => {
    const link = auditRelatedLink({
      id: '1',
      event_type: 'schedule.applied',
      payload: { schedule_id: 'sched-1', kind: 'temporary' },
    });
    expect(link?.routerLink).toEqual(['/mass-intentions/masses/temporaries', 'sched-1']);
  });
});
