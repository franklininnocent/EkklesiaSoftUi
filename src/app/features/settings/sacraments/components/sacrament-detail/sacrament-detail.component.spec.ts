import { ComponentFixture, TestBed } from '@angular/core/testing';
import { provideMockStore, MockStore } from '@ngrx/store/testing';
import { of } from 'rxjs';
import { NO_ERRORS_SCHEMA } from '@angular/core';
import { ActivatedRoute, Router, convertToParamMap } from '@angular/router';
import { SacramentDetailComponent } from './sacrament-detail.component';
import { SacramentService } from '../../services/sacrament.service';
import { selectCurrentTenant } from '@core/store/tenant/tenant.selectors';
import { ToastService } from '@core/services/toast.service';
import { TenantService } from '@core/services/tenant.service';
import { SacramentCertificate } from '../../models/sacrament.model';

describe('SacramentDetailComponent (SacramentView)', () => {
  let component: SacramentDetailComponent;
  let fixture: ComponentFixture<SacramentDetailComponent>;
  let store: MockStore;

  const sacrament = {
    id: 25,
    recipient_name: 'Maria Joseph',
    sacrament_type: { id: 1, code: 'BAPTISM', name: 'Baptism' },
    date_administered: '2020-06-15',
    status: 'registered',
    book_number: '12',
    page_number: '45',
    registry_entry: 'B-102',
    minister_name: 'Fr. Thomas',
    notes: 'Baptized at Sunday Mass.',
    participants: [],
  };

  const projection = {
    sacrament: {
      type_code: 'BAPTISM',
      type_name: 'Baptism',
      date_administered: '2020-06-15',
      certificate_number: 'BAP-2020-001',
      recipient_name: 'Maria Joseph',
    },
    participants: [
      { role: 'recipient', display_name: 'Maria Joseph' },
    ],
    church: {
      name: 'St. Mary Parish',
    },
  };

  const issuedCert = (version: number): SacramentCertificate => ({
    id: 100 + version,
    sacrament_id: 25,
    status: 'issued',
    version,
    template_version: '1.1.0',
    has_file: true,
    projection,
  });

  const sacramentServiceStub = {
    getSacrament: jest.fn().mockReturnValue(of({ success: true, data: sacrament })),
    getCertificateViewDetails: jest.fn().mockReturnValue(
      of({
        success: true,
        data: {
          latest_certificate: issuedCert(2),
          download_history: [],
        },
      })
    ),
    downloadLatestCertificate: jest.fn().mockReturnValue(of(new Blob(['pdf'], { type: 'application/pdf' }))),
    generateCertificate: jest.fn().mockReturnValue(of({ success: true, data: issuedCert(1) })),
    previewCertificate: jest.fn(),
    downloadCertificate: jest.fn(),
    reissueCertificate: jest.fn(),
    printCertificate: jest.fn(),
    createCanonicalAnnotation: jest.fn(),
    deleteCanonicalAnnotation: jest.fn(),
  } as unknown as SacramentService;

  const toastStub = {
    success: jest.fn(),
    error: jest.fn(),
  };

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [SacramentDetailComponent],
      providers: [
        { provide: SacramentService, useValue: sacramentServiceStub },
        { provide: Router, useValue: { navigate: jest.fn() } },
        {
          provide: ActivatedRoute,
          useValue: {
            snapshot: { paramMap: convertToParamMap({ id: '25' }) },
          },
        },
        { provide: ToastService, useValue: toastStub },
        {
          provide: TenantService,
          useValue: {
            getChurchProfile: jest.fn().mockReturnValue(of({ success: false })),
          },
        },
        provideMockStore({ initialState: {} }),
      ],
      schemas: [NO_ERRORS_SCHEMA],
    }).compileComponents();

    store = TestBed.inject(MockStore);
    store.overrideSelector(selectCurrentTenant, { id: 10, name: 'Test Parish' } as any);

    fixture = TestBed.createComponent(SacramentDetailComponent);
    component = fixture.componentInstance;

    jest.spyOn(document, 'getElementById').mockReturnValue({
      scrollIntoView: jest.fn(),
    } as unknown as HTMLElement);
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  it('should create', () => {
    fixture.detectChanges();
    expect(component).toBeTruthy();
  });

  it('auto-loads latest issued projection on init', () => {
    fixture.detectChanges();

    expect(sacramentServiceStub.getCertificateViewDetails).toHaveBeenCalledWith(25);
    expect(component.previewProjection).toEqual(projection);
    expect(component.previewVersionLabel).toBe('v1.1.0');
    expect(component.isPreviewVisible).toBe(true);
    expect(component.certView).toBeTruthy();
  });

  it('onPreviewCertificate keeps certificate visible and scrolls to preview', () => {
    fixture.detectChanges();
    expect(component.isPreviewVisible).toBe(true);

    component.onPreviewCertificate();
    expect(component.isPreviewVisible).toBe(true);
    expect(document.getElementById).toHaveBeenCalledWith('certificate-preview');

    component.onPreviewCertificate();
    expect(component.isPreviewVisible).toBe(true);
  });

  it('builds live preview when no issued certificate exists', () => {
    (sacramentServiceStub.getCertificateViewDetails as jest.Mock).mockReturnValue(
      of({
        success: true,
        data: { latest_certificate: null, live_projection: null, download_history: [] },
      })
    );
    fixture.detectChanges();

    expect(component.certView).toBeTruthy();
    expect(component.previewVersionLabel).toBe('Live preview');
    expect(component.isPreviewVisible).toBe(true);
  });

  it('onDownloadCertificate calls downloadLatestCertificate and refreshes history', () => {
    fixture.detectChanges();
    component.sacramentId = 25;
    component.latestCertificateRecord = issuedCert(2);
    window.URL.createObjectURL = jest.fn().mockReturnValue('blob:mock') as typeof window.URL.createObjectURL;
    window.URL.revokeObjectURL = jest.fn() as typeof window.URL.revokeObjectURL;
    const anchor = { click: jest.fn(), href: '', download: '' };
    const createElementSpy = jest.spyOn(document, 'createElement').mockReturnValue(anchor as unknown as HTMLAnchorElement);

    component.onDownloadCertificate();

    expect(sacramentServiceStub.downloadLatestCertificate).toHaveBeenCalledWith(25);
    expect(sacramentServiceStub.getCertificateViewDetails).toHaveBeenCalledTimes(2);

    createElementSpy.mockRestore();
  });

  it('does not render Generate, Reissue, or legacy print/export controls', () => {
    fixture.detectChanges();
    const buttons = Array.from(fixture.nativeElement.querySelectorAll('button') as NodeListOf<HTMLButtonElement>)
      .map((btn) => btn.textContent?.trim());
    expect(buttons).not.toContain('Generate');
    expect(buttons).not.toContain('Reissue');
    expect(buttons).not.toContain('A4');
    expect(buttons).not.toContain('Letter');
    expect(buttons).not.toContain('Print');
    expect(buttons).not.toContain('Export PDF');
    expect(buttons).toContain('Preview');
    expect(buttons).toContain('Download');
  });

  it('renders download history empty state when no history exists', () => {
    fixture.detectChanges();
    const empty = fixture.nativeElement.querySelector('app-cf-empty-state');
    expect(empty).toBeTruthy();
  });

  it('renders register metadata for non-matrimony certificates without marriage form', () => {
    fixture.detectChanges();
    const html = fixture.nativeElement.innerHTML;
    expect(html).toContain('Book No.');
    expect(html).toContain('12');
    expect(html).not.toContain('Add note');
  });

  it('uses unified bottom grid layout', () => {
    fixture.detectChanges();
    expect(fixture.nativeElement.querySelector('.certificate-bottom-grid')).toBeTruthy();
    expect(fixture.nativeElement.querySelector('.certificate-engine')).toBeTruthy();
  });

  it('does not render a historical version list in the template', () => {
    fixture.detectChanges();
    const list = fixture.nativeElement.querySelector('.official-certificate-panel__list');
    expect(list).toBeNull();
  });
});
