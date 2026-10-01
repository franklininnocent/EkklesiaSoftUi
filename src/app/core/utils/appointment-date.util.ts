import { cfFormatDate } from '@shared/utils/cf-intl.util';

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
  return cfFormatDate(value) || '—';
}
