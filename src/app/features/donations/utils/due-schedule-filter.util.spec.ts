import { dueScheduleFilterLabel, isDueScheduleFilter } from './due-schedule-filter.util';

describe('due-schedule-filter.util', () => {
  it('validates schedule keys', () => {
    expect(isDueScheduleFilter('overdue')).toBe(true);
    expect(isDueScheduleFilter('next_14_days')).toBe(true);
    expect(isDueScheduleFilter('later')).toBe(true);
    expect(isDueScheduleFilter('invalid')).toBe(false);
  });

  it('returns display labels', () => {
    expect(dueScheduleFilterLabel('next_14_days')).toBe('Next 14 days');
  });
});
