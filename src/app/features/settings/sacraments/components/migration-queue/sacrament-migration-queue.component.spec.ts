import { ComponentFixture, TestBed } from '@angular/core/testing';
import { provideRouter } from '@angular/router';
import { of, throwError } from 'rxjs';
import { AuthService } from '@core/services/auth.service';
import { ToastService } from '@core/services/toast.service';
import { SacramentMigrationService } from '../../services/sacrament-migration.service';
import { SacramentMigrationQueueComponent } from './sacrament-migration-queue.component';

describe('SacramentMigrationQueueComponent', () => {
  let component: SacramentMigrationQueueComponent;
  let fixture: ComponentFixture<SacramentMigrationQueueComponent>;
  let migration: jest.Mocked<Pick<SacramentMigrationService, 'getReport' | 'list' | 'backfill' | 'resolve'>>;
  let auth: { hasPermission: jest.Mock };
  let toast: { success: jest.Mock; error: jest.Mock };

  const report = {
    total_resolutions: 4,
    linked: 1,
    unresolved: 2,
    external: 1,
    affiliation_incomplete: 0,
    failed: 0,
    sacraments_without_participants: 0,
    unresolved_participants: 2,
    participants_v1: true,
  };

  const listResponse = {
    success: true,
    data: {
      data: [
        {
          id: 9,
          tenant_id: 1,
          legacy_sacrament_id: 3,
          participant_role: 'father',
          legacy_name: 'John Father',
          legacy_dob: null,
          confidence: 'none' as const,
          resolution: 'unresolved' as const,
          migration_key: '1:3:father:0',
        },
      ],
      current_page: 1,
      last_page: 1,
      per_page: 20,
      total: 1,
    },
  };

  beforeEach(async () => {
    migration = {
      getReport: jest.fn().mockReturnValue(of({ success: true, data: report })),
      list: jest.fn().mockReturnValue(of(listResponse)),
      backfill: jest.fn().mockReturnValue(
        of({
          success: true,
          data: {
            totals: { processed: 3, linked: 1, unresolved: 2, skipped: 0, failed: 0 },
            report,
          },
        })
      ),
      resolve: jest.fn().mockReturnValue(of({ success: true, data: {} })),
    };
    auth = { hasPermission: jest.fn().mockReturnValue(true) };
    toast = { success: jest.fn(), error: jest.fn() };

    await TestBed.configureTestingModule({
      imports: [SacramentMigrationQueueComponent],
      providers: [
        provideRouter([]),
        { provide: SacramentMigrationService, useValue: migration },
        { provide: AuthService, useValue: auth },
        { provide: ToastService, useValue: toast },
      ],
    }).compileComponents();

    fixture = TestBed.createComponent(SacramentMigrationQueueComponent);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  it('creates and loads report and queue', () => {
    expect(component).toBeTruthy();
    expect(migration.getReport).toHaveBeenCalled();
    expect(migration.list).toHaveBeenCalled();
    expect(component.rows.length).toBe(1);
  });

  it('maps role and status labels to plain language', () => {
    expect(component.roleLabel('father')).toBe('Father');
    expect(component.resolutionLabel('unresolved')).toBe('Needs a decision');
    expect(component.confidenceLabel('exact')).toBe('Exact match');
  });

  it('runs preview scan without opening confirmation', () => {
    component.requestScanRecords = jest.fn();
    component.requestPreviewScan();
    expect(component.requestScanRecords).not.toHaveBeenCalled();
    expect(migration.backfill).toHaveBeenCalledWith(true);
    expect(component.showScanConfirm).toBe(false);
  });

  it('opens confirmation before a real scan', () => {
    component.requestScanRecords();
    expect(component.showScanConfirm).toBe(true);
    expect(migration.backfill).not.toHaveBeenCalled();
  });

  it('runs scan after confirmation', () => {
    component.requestScanRecords();
    component.confirmScan();
    expect(migration.backfill).toHaveBeenCalledWith(false);
  });

  it('hides scan and decide actions without resolve permission', () => {
    auth.hasPermission.mockReturnValue(false);
    fixture.detectChanges();
    expect(component.canResolve).toBe(false);
    const buttons = fixture.nativeElement.querySelectorAll('button');
    const labels = Array.from(buttons as NodeListOf<HTMLButtonElement>).map((btn) =>
      btn.textContent?.trim()
    );
    expect(labels).not.toContain('Preview scan');
    expect(labels).not.toContain('Scan records');
    expect(labels).not.toContain('Decide');
  });

  it('shows empty copy when no resolutions exist yet', () => {
    component.report = { ...report, total_resolutions: 0, unresolved: 0 };
    component.filterResolution = 'unresolved';
    component.search = '';
    expect(component.emptyTitle).toBe('No names to link yet');
  });

  it('validates member selection before resolve', () => {
    component.openResolve(listResponse.data.data[0]);
    component.onResolveDraftChange({
      role: 'father',
      source: 'member',
    });
    component.confirmResolve();
    expect(migration.resolve).not.toHaveBeenCalled();
    expect(component.resolveError).toContain('parish member');
  });

  it('surfaces queue load errors inline', () => {
    migration.list.mockReturnValueOnce(throwError(() => new Error('Forbidden')));
    component.loadQueue();
    expect(component.queueError).toBe('Forbidden');
  });
});
