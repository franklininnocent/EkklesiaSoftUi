import { formatCertificateDate } from './models/certificate';
import { CATHOLIC_THEME } from './themes/catholic.theme';
import { CSI_THEME } from './themes/csi.theme';
import { GENERIC_THEME } from './themes/generic.theme';
import { resolveTheme, themeTokensToCssVars } from './themes/theme-resolver';
import { resolveTemplate } from './templates/template-resolver';
import { canIssueWithTextFit, fitCertificateText } from './text-fit/text-fit';
import { mapProjectionToCertificateData, omitEmptyOptionalFields } from './mappers/certificate-view.mapper';
import { MOCK_CATHOLIC_BAPTISM } from './testing/mock-certificates';

describe('formatCertificateDate', () => {
  it('formats ISO dates in English locale without hard-coding month names in callers', () => {
    expect(formatCertificateDate('2018-04-15')).toBe('15 April 2018');
    expect(formatCertificateDate(null)).toBe('');
    expect(formatCertificateDate('')).toBe('');
    expect(formatCertificateDate('2026-09-03T10:00:00Z')).toBe('3 September 2026');
  });
});

describe('theme tokens', () => {
  it('exposes --cert-* variables without redefining --cf-*', () => {
    const vars = themeTokensToCssVars(CATHOLIC_THEME);
    expect(vars['--cert-accent']).toBe(CATHOLIC_THEME.accent);
    expect(Object.keys(vars).every((key) => key.startsWith('--cert-'))).toBe(true);
    expect(resolveTheme('csi')).toEqual(CSI_THEME);
    expect(resolveTheme('generic')).toEqual(GENERIC_THEME);
  });
});

describe('resolveTemplate', () => {
  it('returns published v1 configs with canonical Chi-Rho emblem for all sacraments', () => {
    const baptism = resolveTemplate({ themeId: 'catholic', sacramentType: 'BAPTISM' });
    expect(baptism.status).toBe('PUBLISHED');
    expect(baptism.emblem).toBe('CHI_RHO');
    expect(baptism.version).toBe('1.0.0');

    const communion = resolveTemplate({ themeId: 'catholic', sacramentType: 'FIRST_HOLY_COMMUNION' });
    expect(communion.emblem).toBe('CHI_RHO');

    const confirmation = resolveTemplate({ themeId: 'generic', sacramentType: 'CONFIRMATION' });
    expect(confirmation.emblem).toBe('CHI_RHO');
  });
});

describe('text fit WRAP_THEN_SCALE', () => {
  const measure = (text: string, fontSizePx: number) => text.length * fontSizePx * 0.5;

  it('wraps then scales and never clips', () => {
    const ok = fitCertificateText({
      text: 'Maria Teresa Joseph',
      maxWidthPx: 400,
      maxLines: 2,
      fontSizePx: 28,
      measureWidth: measure,
    });
    expect(ok.status).toBe('OK');
    expect(ok.overflow).toBe(false);
  });

  it('blocks issue when a name still overflows at min scale', () => {
    const result = fitCertificateText({
      text: 'A'.repeat(200),
      maxWidthPx: 80,
      maxLines: 1,
      fontSizePx: 32,
      measureWidth: measure,
    });
    expect(result.status).toBe('ERROR');
    expect(result.overflow).toBe(true);
    expect(canIssueWithTextFit([result])).toBe(false);
  });
});

describe('mapProjectionToCertificateData', () => {
  it('maps a v1 baptism projection without mixing live member data', () => {
    const data = mapProjectionToCertificateData({
      sacrament: {
        type_code: 'BAPTISM',
        date_administered: '2018-04-15',
        place_administered: 'St. Mary',
        recipient_name: 'Anna Recipient',
        certificate_number: 'B-1',
      },
      participants: [{ role: 'recipient', display_name: 'Anna Recipient' }],
      church: {
        name: 'St. Mary’s',
        denomination_code: 'CATHOLIC',
        denomination_type: 'ROMAN_CATHOLIC',
      },
    });
    expect(data?.sacramentType).toBe('BAPTISM');
    if (data?.sacramentType === 'BAPTISM') {
      expect(data.recipientName).toBe('Anna Recipient');
    }
  });

  it('omits empty optional church fields', () => {
    const omitted = omitEmptyOptionalFields(MOCK_CATHOLIC_BAPTISM);
    expect(omitted.church.logoUrl).toBeUndefined();
  });

  it('drops parish logos from certificate_view so the canvas never loads them', () => {
    const data = mapProjectionToCertificateData({
      certificate_view: {
        sacramentType: 'BAPTISM',
        recipientName: 'Anna Recipient',
        church: {
          name: 'St. Mary',
          logoUrl: 'http://127.0.0.1:8000/storage/tenants/47/logos/logo.jpg',
          logoDataUri: 'data:image/jpeg;base64,/9j/4AAQ',
        },
      },
    });
    expect(data?.church.logoUrl).toBeNull();
    expect((data?.church as unknown as Record<string, unknown>)['logoDataUri']).toBeUndefined();
  });

  it('maps matrimony spouse cards without register-only classification', () => {
    const data = mapProjectionToCertificateData({
      sacrament: {
        type_code: 'MATRIMONY',
        date_administered: '2026-08-10',
        registry_entry: 'LM-12',
        marriage_canonical_classification: 'mixed_marriage',
      },
      issued_at: '2026-09-03T10:00:00Z',
      participants: [
        {
          role: 'groom',
          display_name: 'Joseph Francis',
          snapshot: { full_name: 'Joseph Francis', baptismal_status_label: 'Baptized Catholic' },
        },
        {
          role: 'bride',
          display_name: 'Maria Teresa',
          snapshot: { full_name: 'Maria Teresa', baptismal_status_label: 'Baptized Catholic' },
        },
        { role: 'witness', display_name: 'Peter D’Souza' },
        { role: 'witness', display_name: 'Agnes Fernandez' },
      ],
      church: {
        name: 'Sacred Heart Church',
        diocese: 'Diocese of Kuzhithurai',
        denomination_code: 'CATHOLIC',
        denomination_type: 'ROMAN_CATHOLIC',
      },
    });
    expect(data?.sacramentType).toBe('HOLY_MATRIMONY');
    if (data?.sacramentType === 'HOLY_MATRIMONY') {
      expect(data.groom?.fullName).toBe('Joseph Francis');
      expect(data.bride?.baptismalStatusLabel).toBe('Baptized Catholic');
      expect(data.witnesses).toEqual(['Peter D’Souza', 'Agnes Fernandez']);
      expect(data.registry.registryEntry).toBe('LM-12');
      expect(data.issuedAt).toBe('2026-09-03T10:00:00Z');
    }
    expect(JSON.stringify(data)).not.toContain('mixed_marriage');
    expect((data as unknown as Record<string, unknown>)['canonical_annotations']).toBeUndefined();
  });

  it('builds matrimony parish residence from church_address fallback', () => {
    const data = mapProjectionToCertificateData({
      sacrament: {
        type_code: 'MATRIMONY',
        date_administered: '2026-08-10',
        marriage_groom_full_name: 'Rohan Francis',
        marriage_groom_church_name: 'Sacred Heart Church',
        marriage_groom_church_address: 'Kadayal',
      },
      participants: [],
      church: {
        name: 'Sacred Heart Church',
        diocese: 'Diocese of Kuzhithurai',
        denomination_code: 'CATHOLIC',
        denomination_type: 'ROMAN_CATHOLIC',
      },
    });
    expect(data?.sacramentType).toBe('HOLY_MATRIMONY');
    if (data?.sacramentType === 'HOLY_MATRIMONY') {
      expect(data.groom?.parishResidence).toBe('Sacred Heart Church, Kadayal');
      expect(data.church.diocese).toBe('Diocese of Kuzhithurai');
    }
  });
});
