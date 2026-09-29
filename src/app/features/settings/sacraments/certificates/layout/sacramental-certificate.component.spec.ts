import { ComponentFixture, TestBed } from '@angular/core/testing';
import { SacramentalCertificateComponent } from './sacramental-certificate.component';
import {
  MOCK_CATHOLIC_BAPTISM,
  MOCK_CATHOLIC_MARRIAGE,
  MOCK_CSI_BAPTISM,
  MOCK_CSI_MARRIAGE,
  MOCK_GENERIC_BAPTISM,
  MOCK_GENERIC_MARRIAGE,
  MOCK_LONG_NAME_BAPTISM,
} from '../testing/mock-certificates';
import { ConfirmationCertificateData, FirstCommunionCertificateData, SacramentCertificateData } from '../models/certificate';

describe('SacramentalCertificateComponent', () => {
  let fixture: ComponentFixture<SacramentalCertificateComponent>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [SacramentalCertificateComponent],
    }).compileComponents();
    fixture = TestBed.createComponent(SacramentalCertificateComponent);
  });

  function render(data: SacramentCertificateData, paper: 'A4' | 'LETTER' = 'A4'): HTMLElement {
    fixture.componentRef.setInput('data', data);
    fixture.componentRef.setInput('paper', paper);
    fixture.detectChanges();
    return fixture.nativeElement as HTMLElement;
  }

  it('renders Catholic baptism', () => {
    const el = render(MOCK_CATHOLIC_BAPTISM);
    expect(el.textContent).toContain('Certificate of Baptism');
    expect(el.textContent).toContain('Maria Teresa Joseph');
    expect(el.textContent).toContain('Godparents');
    expect(el.querySelector('.cert-registry--footer')).toBeTruthy();
    expect(el.querySelector('.cert-registry:not(.cert-registry--footer)')).toBeFalsy();
  });

  it('renders CSI baptism with Presbyter terminology', () => {
    const el = render(MOCK_CSI_BAPTISM);
    expect(el.textContent).toContain('Church of South India');
    expect(el.textContent).toContain('Presbyter');
    expect(el.textContent).toContain('Sponsors');
  });

  it('renders generic baptism', () => {
    const el = render(MOCK_GENERIC_BAPTISM);
    expect(el.textContent).toContain('Hannah Grace Miller');
    expect(el.textContent).toContain('Minister');
  });

  it('renders Catholic and CSI marriage', () => {
    expect(render(MOCK_CATHOLIC_MARRIAGE).textContent).toContain('Holy Matrimony');
    expect(render(MOCK_CSI_MARRIAGE).textContent).toContain('Meera Jacob');
    expect(render(MOCK_GENERIC_MARRIAGE).textContent).toContain('Emily Rose Carter');
  });

  it('renders matrimony spouse cards, numbered witnesses, diocese line, and registry footer', () => {
    const el = render(MOCK_CATHOLIC_MARRIAGE);
    const text = el.textContent || '';
    expect(text).toContain('Sacred Heart Church');
    expect(text).toContain('Diocese of Kuzhithurai');
    expect(text).toContain('Baptized Catholic');
    expect(text).toContain('Joseph Francis');
    expect(text).toContain('Witness 1');
    expect(text).toContain('Peter D’Souza');
    expect(text).toContain('Witness 2');
    expect(text).toContain('Certificate No.');
    expect(text).toContain('Date of Issuance');
    expect(text).toContain("Father's Name");
    expect(text).toContain("Mother's Name");
    expect(text).not.toContain('Maiden');
    const celebrantMatches = text.match(/Celebrant/g) || [];
    expect(celebrantMatches.length).toBe(1);
    expect(el.querySelector('.cert-recipient--matrimony')).toBeTruthy();
    expect(el.querySelector('.cert-spouse-field__label')).toBeTruthy();
    expect(el.querySelector('.cert-registry--footer')).toBeTruthy();
    expect(el.querySelector('.cert-registry__issued')).toBeTruthy();
    expect(el.querySelector('.cert-registry:not(.cert-registry--footer)')).toBeFalsy();
  });

  it('renders confirmation and first communion shells', () => {
    const confirmation: ConfirmationCertificateData = {
      ...MOCK_CATHOLIC_BAPTISM,
      sacramentType: 'CONFIRMATION',
      certificateTitle: 'Certificate of Confirmation',
      recipientName: 'John Confirmand',
      sponsors: ['Peter Sponsor'],
    };
    fixture.componentRef.setInput('data', confirmation);
    fixture.detectChanges();
    expect(fixture.nativeElement.textContent).toContain('John Confirmand');
    expect(fixture.nativeElement.querySelector('.cert-registry--footer')).toBeTruthy();

    const communion: FirstCommunionCertificateData = {
      church: MOCK_CATHOLIC_BAPTISM.church,
      sacramentType: 'FIRST_HOLY_COMMUNION',
      dateOfEvent: '2020-05-01',
      registry: {},
      locale: 'en',
      paper: 'A4',
      themeId: 'catholic',
      emblem: 'SACRED_HEART',
      certificateTitle: 'Certificate of First Holy Communion',
      subtitle: 'Sacramental Register',
      recipientName: 'Lucy Communicant',
    };
    fixture.componentRef.setInput('data', communion);
    fixture.detectChanges();
    expect(fixture.nativeElement.textContent).toContain('Lucy Communicant');
  });

  it('does not clip a long recipient name', () => {
    const el = render(MOCK_LONG_NAME_BAPTISM);
    const name = el.querySelector('.cert-recipient__name') as HTMLElement;
    expect(name.textContent).toContain('Maria Teresa Josephine Alexandra');
    expect(window.getComputedStyle(name).overflow).not.toBe('hidden');
  });

  it('applies A4 vs Letter canvas class', () => {
    const a4 = render(MOCK_CATHOLIC_BAPTISM, 'A4').querySelector('.cert-page');
    expect(a4?.classList.contains('cert-page--letter')).toBe(false);
    const letter = render(MOCK_CATHOLIC_BAPTISM, 'LETTER').querySelector('.cert-page');
    expect(letter?.classList.contains('cert-page--letter')).toBe(true);
  });

  it('wraps the millimetre canvas in a scaled preview frame', () => {
    const el = render(MOCK_CATHOLIC_BAPTISM);
    expect(el.querySelector('.cert-preview-frame')).toBeTruthy();
    expect(el.querySelector('.cert-stage')).toBeTruthy();
    expect(el.querySelector('.cert-ornament--outer')).toBeTruthy();
    expect(el.querySelector('.cert-theme-catholic')).toBeTruthy();
    expect(el.querySelector('.cert-lower')).toBeTruthy();
    expect(el.querySelector('.cert-lower__spacer')).toBeTruthy();
  });

  it('renders marriage names in bride and groom columns', () => {
    const el = render(MOCK_CATHOLIC_MARRIAGE);
    expect(el.querySelector('.cert-recipient--matrimony')).toBeTruthy();
    const cards = el.querySelectorAll('.cert-spouse-card');
    expect(cards.length).toBe(2);
    expect(cards[0].textContent).toContain('Anna Maria D’Souza');
    expect(cards[1].textContent).toContain('Rohan Francis');
  });

  it('wraps long matrimony parish residence without clipping', () => {
    const longResidence =
      'Parish / residence of Letraset sheets containing Lorem Ipsum passages, popularised in the 1960s with the release';
    const el = render({
      ...MOCK_CATHOLIC_MARRIAGE,
      bride: {
        ...MOCK_CATHOLIC_MARRIAGE.bride!,
        parishResidence: longResidence,
      },
    });
    const values = Array.from(el.querySelectorAll('.cert-spouse-field__value'));
    const parishValue = values.find((node: Element) => (node.textContent || '').includes('Letraset')) as HTMLElement;
    expect(parishValue).toBeTruthy();
    expect(parishValue.classList.contains('cert-spouse-field__value')).toBe(true);
  });

  it('reserves a seal box when seal is missing', () => {
    const el = render({ ...MOCK_CATHOLIC_BAPTISM, church: { ...MOCK_CATHOLIC_BAPTISM.church, logoUrl: null, sealUrl: null } });
    expect(el.querySelector('.cert-signs__seal')).toBeTruthy();
    expect(el.querySelector('.cert-header__logo img')).toBeFalsy();
  });

  it('never renders the parish logo even when a logo URL is present', () => {
    const el = render({
      ...MOCK_CATHOLIC_BAPTISM,
      church: {
        ...MOCK_CATHOLIC_BAPTISM.church,
        logoUrl: 'http://127.0.0.1:8000/storage/tenants/47/logos/logo.jpg',
      },
    });
    expect(el.querySelector('.cert-header__logo img')).toBeFalsy();
    expect(el.querySelector('.cert-header img')).toBeFalsy();
  });

  it('renders anointing and holy orders detail rows without crashing', () => {
    const anointing = {
      ...MOCK_CATHOLIC_BAPTISM,
      sacramentType: 'ANOINTING_OF_THE_SICK' as const,
      certificateTitle: 'Certificate of Anointing of the Sick',
      recipientName: 'James Patient',
      placeClassification: 'Home',
    };
    expect(render(anointing as SacramentCertificateData).textContent).toContain('James Patient');

    const holyOrders = {
      ...MOCK_CATHOLIC_BAPTISM,
      sacramentType: 'HOLY_ORDERS' as const,
      certificateTitle: 'Certificate of Holy Orders',
      recipientName: 'Fr. Candidate',
      ordinationType: 'Priesthood',
      dioceseName: 'Sample Diocese',
      coConsecrators: ['Bishop A'],
    };
    const ordersText = render(holyOrders as SacramentCertificateData).textContent || '';
    expect(ordersText).toContain('Fr. Candidate');
    expect(ordersText).toContain('Priesthood');
  });

  it('does not throw when sponsors and witnesses are missing', () => {
    const baptism = {
      ...MOCK_CATHOLIC_BAPTISM,
      sponsors: undefined as unknown as string[],
    };
    expect(() => render(baptism as SacramentCertificateData)).not.toThrow();
  });

  it('always renders canonical Chi-Rho emblem regardless of stored emblem value', () => {
    const communion = {
      ...MOCK_CATHOLIC_BAPTISM,
      sacramentType: 'FIRST_HOLY_COMMUNION' as const,
      certificateTitle: 'Certificate of First Holy Communion',
      recipientName: 'Lucy Communicant',
      emblem: 'SACRED_HEART' as const,
    };
    const el = render(communion as SacramentCertificateData);
    expect(el.querySelectorAll('.cert-emblem svg').length).toBe(1);
    expect(el.querySelector('.cert-emblem')?.innerHTML).toContain('M32 10v44');
    expect(el.querySelector('.cert-emblem')?.innerHTML).not.toContain('M32 54s-16-10');
  });
});
