import { ComponentFixture, TestBed } from '@angular/core/testing';
import { of } from 'rxjs';
import { BccAuditTabComponent } from './bcc-audit-tab.component';
import { BCCService } from '@core/services/bcc.service';

class BCCServiceMock {
  getAuditLogs = jest.fn(() =>
    of({
      data: [
        {
          id: 1,
          event: 'membership.assigned',
          target_type: 'membership',
          target_id: 'membership-1',
          created_at: '2026-09-01T10:00:00Z',
        },
      ],
      meta: { total: 1, current_page: 1, last_page: 1, per_page: 15 },
    })
  );
}

describe('BccAuditTabComponent', () => {
  let component: BccAuditTabComponent;
  let fixture: ComponentFixture<BccAuditTabComponent>;
  let api: BCCServiceMock;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [BccAuditTabComponent],
      providers: [{ provide: BCCService, useClass: BCCServiceMock }],
    }).compileComponents();

    fixture = TestBed.createComponent(BccAuditTabComponent);
    component = fixture.componentInstance;
    api = TestBed.inject(BCCService) as unknown as BCCServiceMock;
    component.bccId = 'bcc-1';
    fixture.detectChanges();
  });

  it('loads per-BCC audit entries', () => {
    expect(api.getAuditLogs).toHaveBeenCalledWith({ page: 1, per_page: 15 }, 'bcc-1');
    expect(component.rows.length).toBe(1);
    expect(component.total).toBe(1);
    expect(component.loading).toBe(false);
  });

  it('reloads when bccId changes', () => {
    api.getAuditLogs.mockClear();
    component.bccId = 'bcc-2';
    component.ngOnChanges({
      bccId: {
        previousValue: 'bcc-1',
        currentValue: 'bcc-2',
        firstChange: false,
        isFirstChange: () => false,
      },
    });
    expect(api.getAuditLogs).toHaveBeenCalledWith({ page: 1, per_page: 15 }, 'bcc-2');
  });
});
