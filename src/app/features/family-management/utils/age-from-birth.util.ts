export interface AgeParts {
  years: number;
  months: number;
  days: number;
}

function parseLocalDate(date: string): Date | null {
  const trimmed = date.trim();
  const iso = /^(\d{4})-(\d{2})-(\d{2})/.exec(trimmed);
  if (iso) {
    const parsed = new Date(Number(iso[1]), Number(iso[2]) - 1, Number(iso[3]));
    return isNaN(parsed.getTime()) ? null : parsed;
  }
  const parsed = new Date(trimmed);
  return isNaN(parsed.getTime()) ? null : parsed;
}

function startOfLocalDay(date: Date): Date {
  return new Date(date.getFullYear(), date.getMonth(), date.getDate());
}

export function computeAgeParts(
  dateOfBirth: string,
  asOf: Date = new Date()
): AgeParts | null {
  const birth = parseLocalDate(dateOfBirth);
  if (!birth) {
    return null;
  }

  const birthDay = startOfLocalDay(birth);
  const referenceDay = startOfLocalDay(asOf);
  if (referenceDay.getTime() < birthDay.getTime()) {
    return null;
  }

  let years = referenceDay.getFullYear() - birthDay.getFullYear();
  let months = referenceDay.getMonth() - birthDay.getMonth();
  let days = referenceDay.getDate() - birthDay.getDate();

  if (days < 0) {
    months -= 1;
    const daysInPreviousMonth = new Date(
      referenceDay.getFullYear(),
      referenceDay.getMonth(),
      0
    ).getDate();
    days += daysInPreviousMonth;
  }

  if (months < 0) {
    years -= 1;
    months += 12;
  }

  return { years, months, days };
}

export function formatCompletedAge(
  dateOfBirth: string | null | undefined,
  asOf: Date = new Date()
): string {
  if (!dateOfBirth?.trim()) {
    return '—';
  }

  const parts = computeAgeParts(dateOfBirth, asOf);
  if (!parts) {
    return '—';
  }

  return `${parts.years}y, ${parts.months}m, ${parts.days}d`;
}
