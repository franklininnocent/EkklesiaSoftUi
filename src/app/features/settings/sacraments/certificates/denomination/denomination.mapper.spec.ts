import { mapChurchDenominationCode, themeIdForDenomination } from './denomination.mapper';

describe('mapChurchDenominationCode', () => {
  it('maps Catholic to ROMAN_CATHOLIC', () => {
    expect(mapChurchDenominationCode('CATHOLIC')).toBe('ROMAN_CATHOLIC');
  });

  it('maps Eastern churches to EASTERN_RITE', () => {
    expect(mapChurchDenominationCode('SYRO_MALABAR')).toBe('EASTERN_RITE');
    expect(mapChurchDenominationCode('ORTHODOX')).toBe('EASTERN_RITE');
  });

  it('maps CSI, Anglican, Lutheran, and non-denom', () => {
    expect(mapChurchDenominationCode('CSI')).toBe('CSI');
    expect(mapChurchDenominationCode('ANGLICAN')).toBe('ANGLICAN');
    expect(mapChurchDenominationCode('LUTHERAN')).toBe('LUTHERAN');
    expect(mapChurchDenominationCode('NON_DENOM')).toBe('NON_DENOM');
  });

  it('falls back to GENERIC', () => {
    expect(mapChurchDenominationCode('BAPTIST')).toBe('GENERIC');
    expect(mapChurchDenominationCode(null)).toBe('GENERIC');
  });
});

describe('themeIdForDenomination', () => {
  it('aliases Anglican to the CSI visual theme', () => {
    expect(themeIdForDenomination('CSI')).toBe('csi');
    expect(themeIdForDenomination('ANGLICAN')).toBe('csi');
  });

  it('aliases Lutheran and non-denom to generic', () => {
    expect(themeIdForDenomination('LUTHERAN')).toBe('generic');
    expect(themeIdForDenomination('NON_DENOM')).toBe('generic');
  });

  it('uses catholic theme for Latin and Eastern Catholic mapping', () => {
    expect(themeIdForDenomination('ROMAN_CATHOLIC')).toBe('catholic');
    expect(themeIdForDenomination('EASTERN_RITE')).toBe('catholic');
  });
});
