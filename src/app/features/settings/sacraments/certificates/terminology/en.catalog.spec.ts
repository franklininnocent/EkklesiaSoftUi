import { liturgicalTerminology } from './en.catalog';

describe('liturgicalTerminology', () => {
  it('uses Godparents and Parish Priest for Catholic baptism', () => {
    const terms = liturgicalTerminology('ROMAN_CATHOLIC', 'BAPTISM');
    expect(terms.sponsorsLabel).toBe('Godparents');
    expect(terms.ministerLabel).toBe('Parish Priest');
  });

  it('uses Sponsors and Presbyter for CSI baptism', () => {
    const terms = liturgicalTerminology('CSI', 'BAPTISM');
    expect(terms.sponsorsLabel).toBe('Sponsors');
    expect(terms.ministerLabel).toBe('Presbyter');
  });

  it('uses Spouse labels for non-denominational matrimony', () => {
    const terms = liturgicalTerminology('NON_DENOM', 'HOLY_MATRIMONY');
    expect(terms.brideLabel).toBe('Spouse');
    expect(terms.groomLabel).toBe('Spouse');
  });

  it('uses Chrismation title for Eastern confirmation mapping', () => {
    expect(liturgicalTerminology('EASTERN_RITE', 'CHRISMATION').sacramentTitle).toContain(
      'Chrismation'
    );
  });
});
