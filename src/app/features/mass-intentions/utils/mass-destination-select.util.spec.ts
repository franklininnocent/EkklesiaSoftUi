import { toMassDestinationSelectOptions } from './mass-destination-select.util';

describe('toMassDestinationSelectOptions', () => {
  it('groups label by day and shows time in option label', () => {
    const options = toMassDestinationSelectOptions([
      {
        id: '1',
        celebrated_on: '2026-10-04',
        celebrated_at: '08:30:00',
        place: 'Main Church',
      },
    ]);
    expect(options[0].optionLabel).toMatch(/Sunday.*2026-10-04/i);
    expect(options[0].optionLabel).toMatch(/8:30.*AM/i);
    expect(options[0].optionLabel).toContain('Main Church');
  });
});
