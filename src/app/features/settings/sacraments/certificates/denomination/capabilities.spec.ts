import {
  confirmationEngineType,
  isSacramentSupported,
  mapDbSacramentToEngineType,
} from './capabilities';

describe('DenominationSacramentCapability', () => {
  it('supports CSI Confirmation', () => {
    expect(isSacramentSupported('CSI', 'CONFIRMATION')).toBe(true);
    expect(isSacramentSupported('CSI', 'CHRISMATION')).toBe(false);
  });

  it('supports Chrismation only for Eastern mapping', () => {
    expect(isSacramentSupported('EASTERN_RITE', 'CHRISMATION')).toBe(true);
    expect(isSacramentSupported('EASTERN_RITE', 'CONFIRMATION')).toBe(false);
    expect(isSacramentSupported('ROMAN_CATHOLIC', 'CHRISMATION')).toBe(false);
  });

  it('treats First Communion as supported for all mapped denominations', () => {
    expect(isSacramentSupported('CSI', 'FIRST_HOLY_COMMUNION')).toBe(true);
    expect(isSacramentSupported('LUTHERAN', 'FIRST_HOLY_COMMUNION')).toBe(true);
    expect(isSacramentSupported('ROMAN_CATHOLIC', 'FIRST_HOLY_COMMUNION')).toBe(true);
  });

  it('maps DB CONFIRMATION to Chrismation for Eastern churches', () => {
    expect(confirmationEngineType('EASTERN_RITE')).toBe('CHRISMATION');
    expect(mapDbSacramentToEngineType('CONFIRMATION', 'EASTERN_RITE')).toBe('CHRISMATION');
    expect(mapDbSacramentToEngineType('EUCHARIST', 'CATHOLIC' as never)).toBe('FIRST_HOLY_COMMUNION');
    expect(mapDbSacramentToEngineType('MATRIMONY', 'CSI')).toBe('HOLY_MATRIMONY');
    expect(mapDbSacramentToEngineType('ANOINTING', 'ROMAN_CATHOLIC')).toBe('ANOINTING_OF_THE_SICK');
    expect(mapDbSacramentToEngineType('HOLY_ORDERS', 'ROMAN_CATHOLIC')).toBe('HOLY_ORDERS');
    expect(mapDbSacramentToEngineType('RECONCILIATION', 'ROMAN_CATHOLIC')).toBe('RECONCILIATION');
  });
});
