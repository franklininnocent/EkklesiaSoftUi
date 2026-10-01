import {
  isMemberAgeBandKey,
  memberAgeChartSlices,
  memberAgeGroupDisplayLabel,
  memberAgeRangeLabel,
} from './member-age-groups.util';

describe('memberAgeChartSlices', () => {
  it('returns only bands with counts, preserving order', () => {
    const slices = memberAgeChartSlices({
      babies: { label: 'Babies', min: 0, max: 2, count: 2, percent: 20 },
      adults: { label: 'Adults', min: 26, max: 59, count: 8, percent: 80 },
      children: { label: 'Children', min: 3, max: 12, count: 0, percent: 0 },
    });

    expect(slices.map((s) => s.key)).toEqual(['babies', 'adults']);
    expect(slices[0].percent).toBe(20);
    expect(slices[0].displayLabel).toBe('Babies (Age 0–2)');
    expect(slices[1].displayLabel).toBe('Adults (Age 26–59)');
  });
});

describe('memberAgeRangeLabel', () => {
  it('formats closed and open ranges', () => {
    expect(memberAgeRangeLabel(0, 2)).toBe('Age 0–2');
    expect(memberAgeRangeLabel(60, null)).toBe('Age 60+');
    expect(memberAgeRangeLabel(null, null)).toBeNull();
  });
});

describe('memberAgeGroupDisplayLabel', () => {
  it('leaves unknown without a range suffix', () => {
    expect(memberAgeGroupDisplayLabel('Unknown', null, null)).toBe('Unknown');
  });
});

describe('isMemberAgeBandKey', () => {
  it('accepts known band keys and rejects invalid values', () => {
    expect(isMemberAgeBandKey('adults')).toBe(true);
    expect(isMemberAgeBandKey('babies')).toBe(true);
    expect(isMemberAgeBandKey('')).toBe(false);
    expect(isMemberAgeBandKey(null)).toBe(false);
    expect(isMemberAgeBandKey('invalid')).toBe(false);
  });
});
