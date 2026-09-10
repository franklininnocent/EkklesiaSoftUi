export interface AppointmentDateSource {
  effective_date?: string | null;
  appointed_date?: string | null;
  installed_date?: string | null;
  announced_date?: string | null;
  ended_date?: string | null;
}

export function resolveAppointmentEffectiveDate(
  appointment?: AppointmentDateSource | null
): string | null {
  if (!appointment) {
    return null;
  }

  return (
    appointment.effective_date
    || appointment.appointed_date
    || appointment.installed_date
    || appointment.announced_date
    || null
  );
}

export function formatAppointmentDate(value?: string | null): string {
  if (!value) {
    return '—';
  }

  const parsed = new Date(value.includes('T') ? value : `${value}T00:00:00`);
  if (Number.isNaN(parsed.getTime())) {
    return '—';
  }

  return parsed.toLocaleDateString('en-US', {
    year: 'numeric',
    month: 'short',
    day: 'numeric',
  });
}
