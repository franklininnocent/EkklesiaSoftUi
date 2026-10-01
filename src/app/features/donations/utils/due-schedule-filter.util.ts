/** Disjoint due-schedule buckets (matches executive dashboard / snapshot). */
export type DueScheduleFilter = 'overdue' | 'next_14_days' | 'later';

const DUE_SCHEDULE_FILTERS: readonly DueScheduleFilter[] = ['overdue', 'next_14_days', 'later'];

export function isDueScheduleFilter(value: string | null | undefined): value is DueScheduleFilter {
  return value != null && (DUE_SCHEDULE_FILTERS as readonly string[]).includes(value);
}

export function dueScheduleFilterLabel(key: DueScheduleFilter): string {
  const labels: Record<DueScheduleFilter, string> = {
    overdue: 'Overdue',
    next_14_days: 'Next 14 days',
    later: 'Later',
  };
  return labels[key];
}

export function dueScheduleFilterQuery(key: DueScheduleFilter): Record<string, string> {
  return { due_schedule: key };
}
