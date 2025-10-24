import { Injectable, inject } from '@angular/core';
import { Actions, createEffect, ofType } from '@ngrx/effects';
import { of } from 'rxjs';
import { map, catchError, switchMap } from 'rxjs/operators';
import { TenantService } from '@core/services/tenant.service';
import * as TenantActions from './tenant.actions';

@Injectable()
export class TenantEffects {
  private actions$ = inject(Actions);
  private tenantService = inject(TenantService);

  loadTenants$ = createEffect(() =>
    this.actions$.pipe(
      ofType(TenantActions.loadTenants),
      switchMap(() =>
        this.tenantService.getUserTenants().pipe(
          map(tenants => TenantActions.loadTenantsSuccess({ tenants })),
          catchError(error => of(TenantActions.loadTenantsFailure({ error: error.message })))
        )
      )
    )
  );

  loadTenant$ = createEffect(() =>
    this.actions$.pipe(
      ofType(TenantActions.loadTenant),
      switchMap(({ tenantId }) =>
        this.tenantService.getTenant(tenantId).pipe(
          map(tenant => TenantActions.loadTenantSuccess({ tenant })),
          catchError(error => of(TenantActions.loadTenantFailure({ error: error.message })))
        )
      )
    )
  );
}

