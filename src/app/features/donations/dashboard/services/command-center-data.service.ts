import { Injectable, inject } from '@angular/core';
import { Observable, map } from 'rxjs';
import { DonationsService } from '../../services/donations.service';
import {
  DioceseRollupDashboard,
  FinancialCommandCenterPayload,
  ParishExpenseRecord
} from '../../models/donation.model';

@Injectable({ providedIn: 'root' })
export class CommandCenterDataService {
  private readonly donationsService = inject(DonationsService);

  loadCommandCenter(period = 'month'): Observable<FinancialCommandCenterPayload | null> {
    return this.donationsService.getCommandCenter(period).pipe(
      map((response) => response.data ?? null)
    );
  }

  loadRollup(): Observable<DioceseRollupDashboard | null> {
    return this.donationsService.getDioceseRollup().pipe(
      map((response) => response.data ?? null)
    );
  }

  loadExpenses(): Observable<ParishExpenseRecord[]> {
    return this.donationsService.getParishExpenses().pipe(
      map((response) => response.data ?? [])
    );
  }

  createExpense(payload: Record<string, unknown>): Observable<ParishExpenseRecord> {
    return this.donationsService.createParishExpense(payload).pipe(
      map((response) => response.data as ParishExpenseRecord)
    );
  }
}
