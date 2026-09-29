import {
  formatAppointmentDate,
  resolveAppointmentEffectiveDate,
} from './appointment-date.util';

describe('appointment-date.util', () => {
  it('falls back to appointed_date when effective_date is missing', () => {
    expect(resolveAppointmentEffectiveDate({
      appointed_date: '2018-01-01',
    })).toBe('2018-01-01');
  });

  it('prefers effective_date when both are present', () => {
    expect(resolveAppointmentEffectiveDate({
      effective_date: '2020-01-01',
      appointed_date: '2018-01-01',
    })).toBe('2020-01-01');
  });

  it('formats readable dates and handles missing values', () => {
    expect(formatAppointmentDate('2018-01-01')).toBe('Jan 1, 2018');
    expect(formatAppointmentDate(null)).toBe('—');
  });
});
