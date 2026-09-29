const MONTHS = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'] as const;

const DATE_ONLY_PATTERN = /^(\d{4})-(\d{2})-(\d{2})$/;

/** Compact payment label: `24 Sep 2026, 04:00 PM`. Prefer `created_at`; date-only fallback has no clock. */
export function formatPaymentDateTime(value?: string | null): string {
  const raw = (value ?? '').trim();
  if (!raw) {
    return '—';
  }

  const dateOnly = raw.match(DATE_ONLY_PATTERN);
  if (dateOnly) {
    return formatDateParts(Number(dateOnly[1]), Number(dateOnly[2]), Number(dateOnly[3]));
  }

  const parsed = new Date(raw);
  if (Number.isNaN(parsed.getTime())) {
    return '—';
  }

  return formatDateParts(
    parsed.getFullYear(),
    parsed.getMonth() + 1,
    parsed.getDate(),
    parsed.getHours(),
    parsed.getMinutes()
  );
}

function formatDateParts(year: number, month: number, day: number, hours?: number, minutes?: number): string {
  if (!year || month < 1 || month > 12 || day < 1 || day > 31) {
    return '—';
  }

  const dateLabel = `${day} ${MONTHS[month - 1]} ${year}`;
  if (hours === undefined || minutes === undefined) {
    return dateLabel;
  }

  const period = hours >= 12 ? 'PM' : 'AM';
  const hour12 = hours % 12 || 12;
  const minuteLabel = String(minutes).padStart(2, '0');

  return `${dateLabel}, ${String(hour12).padStart(2, '0')}:${minuteLabel} ${period}`;
}
