/**
 * Date/time helpers for native date + time inputs.
 *
 * Form controls use `YYYY-MM-DDTHH:mm` (datetime-local wire format) so API
 * payloads stay compatible with existing Support Access endpoints.
 */

export interface DateTimeParts {
  date: string;
  time: string;
}

/** Split a datetime-local or ISO string into date (`YYYY-MM-DD`) and time (`HH:mm`). */
export function splitDateTime(value: string | null | undefined): DateTimeParts {
  if (!value) {
    return { date: '', time: '' };
  }

  const trimmed = value.trim();
  const match = trimmed.match(/^(\d{4}-\d{2}-\d{2})[T ](\d{2}:\d{2})/);
  if (match) {
    return { date: match[1], time: match[2] };
  }

  const parsed = new Date(trimmed);
  if (Number.isNaN(parsed.getTime())) {
    return { date: '', time: '' };
  }

  const date = [
    parsed.getFullYear(),
    String(parsed.getMonth() + 1).padStart(2, '0'),
    String(parsed.getDate()).padStart(2, '0'),
  ].join('-');
  const time = [
    String(parsed.getHours()).padStart(2, '0'),
    String(parsed.getMinutes()).padStart(2, '0'),
  ].join(':');

  return { date, time };
}

/** Combine date and time into `YYYY-MM-DDTHH:mm`, or empty when incomplete. */
export function combineDateTime(date: string, time: string): string {
  if (!date || !time) {
    return '';
  }
  return `${date}T${time}`;
}

/** Parse a combined datetime value to epoch milliseconds in local time. */
export function dateTimeToMs(value: string | null | undefined): number | null {
  if (!value) {
    return null;
  }
  const { date, time } = splitDateTime(value);
  if (!date || !time) {
    return null;
  }
  const ms = new Date(`${date}T${time}`).getTime();
  return Number.isNaN(ms) ? null : ms;
}

/** Minimum time (`HH:mm`) when `candidateDate` equals `minDateTime`'s date; otherwise null. */
export function minTimeForDate(candidateDate: string, minDateTime: string | null | undefined): string | null {
  if (!candidateDate || !minDateTime) {
    return null;
  }
  const minParts = splitDateTime(minDateTime);
  if (!minParts.date || !minParts.time || candidateDate !== minParts.date) {
    return null;
  }
  return minParts.time;
}

/** Minimum date (`YYYY-MM-DD`) derived from a datetime value. */
export function minDateFromDateTime(value: string | null | undefined): string | null {
  const { date } = splitDateTime(value);
  return date || null;
}

/** Friendly display for screen readers and summaries. */
export function formatDateTimeDisplay(value: string | null | undefined): string {
  const { date, time } = splitDateTime(value);
  if (!date && !time) {
    return '';
  }
  if (!date) {
    return time;
  }
  if (!time) {
    return formatDateDisplay(date);
  }
  const parsed = new Date(`${date}T${time}`);
  if (Number.isNaN(parsed.getTime())) {
    return `${date} ${time}`;
  }
  return parsed.toLocaleString(undefined, {
    year: 'numeric',
    month: 'short',
    day: 'numeric',
    hour: 'numeric',
    minute: '2-digit',
  });
}

function formatDateDisplay(date: string): string {
  const parsed = new Date(`${date}T00:00`);
  if (Number.isNaN(parsed.getTime())) {
    return date;
  }
  return parsed.toLocaleDateString(undefined, {
    year: 'numeric',
    month: 'short',
    day: 'numeric',
  });
}
