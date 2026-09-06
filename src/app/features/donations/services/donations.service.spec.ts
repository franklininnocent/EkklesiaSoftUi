import { TestBed } from '@angular/core/testing';
import { HttpClientTestingModule, HttpTestingController } from '@angular/common/http/testing';
import { DonationsService } from './donations.service';
import { environment } from '@environments/environment';

describe('DonationsService', () => {
  let service: DonationsService;
  let httpMock: HttpTestingController;

  beforeEach(() => {
    TestBed.configureTestingModule({
      imports: [HttpClientTestingModule]
    });
    service = TestBed.inject(DonationsService);
    httpMock = TestBed.inject(HttpTestingController);
  });

  afterEach(() => {
    httpMock.verify();
  });

  it('loads donations dashboard summary', () => {
    service.getDashboardSummary().subscribe((response) => {
      expect(response.success).toBe(true);
      expect(response.data.totals.collected).toBe(1200);
    });

    const req = httpMock.expectOne(`${environment.apiUrl}/tenant/donations/dashboard/summary`);
    expect(req.request.method).toBe('GET');
    req.flush({
      success: true,
      data: {
        totals: {
          collected: 1200,
          refunded: 0,
          net: 1200,
          pending_dues: 300,
          active_projects: 2
        },
        collections_by_method: { cash: 1200 }
      }
    });
  });

  it('loads donation settings', () => {
    service.getSettings().subscribe((response) => {
      expect(response.success).toBe(true);
      expect(response.data?.default_currency).toBe('INR');
    });

    const req = httpMock.expectOne(`${environment.apiUrl}/tenant/donations/settings`);
    expect(req.request.method).toBe('GET');
    req.flush({
      success: true,
      data: {
        id: 'settings-id',
        default_currency: 'INR',
        receipt_prefix: 'RCPT',
        receipt_prefix_enabled: true
      }
    });
  });

  it('maps family financial profile into summary shape', () => {
    service.getFamilySummary('family-1').subscribe((response) => {
      expect(response.success).toBe(true);
      expect(response.data.family_id).toBe('family-1');
      expect(response.data.total_paid).toBe(500);
      expect(response.data.pending_due).toBe(300);
      expect(response.data.overdue_count).toBe(2);
    });

    const req = httpMock.expectOne(`${environment.apiUrl}/tenant/donations/families/family-1/financial-profile`);
    expect(req.request.method).toBe('GET');
    req.flush({
      success: true,
      data: {
        family_id: 'family-1',
        totals: { total_paid: 500, pending_due: 300, net: 200 },
        outstanding_dues: [{ id: 'd1' }, { id: 'd2' }]
      }
    });
  });

  it('loads payment batches', () => {
    service.getPaymentBatches().subscribe((response) => {
      expect(response.success).toBe(true);
      expect(response.data.data.length).toBe(1);
      expect(response.data.data[0].batch_number).toBe('BATCH-1');
    });

    const req = httpMock.expectOne(`${environment.apiUrl}/tenant/donations/payment-batches`);
    expect(req.request.method).toBe('GET');
    req.flush({
      success: true,
      data: {
        data: [
          { id: 'b1', batch_number: 'BATCH-1', batch_date: '2026-06-12', status: 'draft', payments_count: 0, total_amount: 0 }
        ]
      }
    });
  });

    it('runs due recurring schedules', () => {
      service.runDueRecurringSchedules().subscribe((response) => {
        expect(response.success).toBe(true);
        expect(response.data.processed).toBe(2);
      });

      const req = httpMock.expectOne(`${environment.apiUrl}/tenant/donations/recurring-schedules/run-due`);
      expect(req.request.method).toBe('POST');
      req.flush({
        success: true,
        message: 'ok',
        data: { processed: 2, succeeded: 2, failed: 0 }
      });
    });

    it('sends Idempotency-Key when recording a payment', () => {
      service.createPayment({ amount: 10, method: 'cash' }).subscribe((response) => {
        expect(response.success).toBe(true);
      });

      const req = httpMock.expectOne(`${environment.apiUrl}/tenant/donations/payments`);
      expect(req.request.method).toBe('POST');
      expect(req.request.headers.get('Idempotency-Key')).toBeTruthy();
      req.flush({ success: true, message: 'ok', data: { id: 'pay-1' } });
    });

    it('reverses a payment with an idempotency key', () => {
      service.reversePayment('pay-1', 'Entered twice').subscribe((response) => {
        expect(response.success).toBe(true);
      });

      const req = httpMock.expectOne(`${environment.apiUrl}/tenant/donations/payments/pay-1/reverse`);
      expect(req.request.method).toBe('POST');
      expect(req.request.body).toEqual({ reason: 'Entered twice' });
      expect(req.request.headers.get('Idempotency-Key')).toBeTruthy();
      req.flush({ success: true, message: 'reversed' });
    });
  });
