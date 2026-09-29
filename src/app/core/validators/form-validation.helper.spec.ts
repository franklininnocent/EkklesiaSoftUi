import { FormControl, FormGroup } from '@angular/forms';
import { dateWindowValidator } from './form-validation.helper';

describe('dateWindowValidator', () => {
  const buildForm = (starts: string, ends: string) =>
    new FormGroup(
      {
        starts_at: new FormControl(starts),
        ends_at: new FormControl(ends),
      },
      { validators: [dateWindowValidator('starts_at', 'ends_at')] }
    );

  it('accepts when end is after start', () => {
    const form = buildForm('2026-09-10T10:00', '2026-09-10T11:00');
    expect(form.valid).toBe(true);
  });

  it('rejects when end equals start', () => {
    const form = buildForm('2026-09-10T10:00', '2026-09-10T10:00');
    expect(form.hasError('startsAfterEnds')).toBe(true);
  });

  it('rejects when end is before start', () => {
    const form = buildForm('2026-09-10T10:00', '2026-09-10T09:00');
    expect(form.hasError('startsAfterEnds')).toBe(true);
  });

  it('skips validation when either side is empty', () => {
    const form = buildForm('', '2026-09-10T11:00');
    expect(form.hasError('startsAfterEnds')).toBe(false);
  });
});
