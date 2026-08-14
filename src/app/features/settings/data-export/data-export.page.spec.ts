import { TestBed } from '@angular/core/testing';
import { By } from '@angular/platform-browser';
import { of } from 'rxjs';
import { provideHttpClient } from '@angular/common/http';
import { provideHttpClientTesting } from '@angular/common/http/testing';
import { DataExportPage } from './data-export.page';
import { TenantDataExportService } from './tenant-data-export.service';
import { AuthService } from '@core/services/auth.service';
import { TenantDataExport } from './tenant-data-export.model';

describe('DataExportPage progress modal (DOM)', () => {
  const completedExport = {
    id: 'export-1',
    status: 'completed',
    downloadable: true,
    modules: ['users'],
    progress: { modules: {}, approx_percent: 100 },
  } as TenantDataExport;

  beforeEach(() => {
    TestBed.configureTestingModule({
      imports: [DataExportPage],
      providers: [
        provideHttpClient(),
        provideHttpClientTesting(),
        {
          provide: TenantDataExportService,
          useValue: {
            listModules: () => of([]),
            listExports: () => of([completedExport]),
            getExport: () => of(completedExport),
            startExport: () => of(completedExport),
            cancel: () => of(completedExport),
            retry: () => of(completedExport),
            download: () =>
              of(new Blob([new Uint8Array([0x50, 0x4b, 0x03, 0x04])], { type: 'application/zip' })),
          },
        },
        { provide: AuthService, useValue: { hasPermission: () => true } },
      ],
    });

    (URL as any).createObjectURL = jest.fn(() => 'blob:mock');
    (URL as any).revokeObjectURL = jest.fn();
  });

  it('removes the Export processing modal from the DOM when Download is clicked', () => {
    const fixture = TestBed.createComponent(DataExportPage);
    const page = fixture.componentInstance;
    page.activeExport = completedExport;
    page.showProgressModal.set(true);
    fixture.detectChanges();

    expect(fixture.nativeElement.querySelector('.cf-modal-shell__overlay')).toBeTruthy();
    expect(fixture.nativeElement.textContent).toContain('Export processing');

    const downloadBtn = fixture.debugElement
      .queryAll(By.css('button'))
      .find((b) => (b.nativeElement as HTMLButtonElement).textContent?.includes('Download'));
    expect(downloadBtn).toBeTruthy();
    downloadBtn!.nativeElement.click();
    fixture.detectChanges();

    expect(page.showProgressModal()).toBe(false);
    expect(fixture.nativeElement.querySelector('.cf-modal-shell__overlay')).toBeFalsy();
  });
});
