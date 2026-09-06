import { inject } from '@angular/core';
import { ResolveFn, ActivatedRouteSnapshot } from '@angular/router';
import { catchError, map, of } from 'rxjs';
import { MinistriesApiService } from '../services/ministries-api.service';

const FALLBACK_LABEL = 'Organization';

export const OrganizationBreadcrumbResolver: ResolveFn<string> = (route: ActivatedRouteSnapshot) => {
  const api = inject(MinistriesApiService);
  const id = route.paramMap.get('id');
  if (!id) {
    return of(FALLBACK_LABEL);
  }

  return api.getOrganization(id).pipe(
    map((res) => {
      const name = res?.data?.name?.trim();
      return name || FALLBACK_LABEL;
    }),
    catchError(() => of(FALLBACK_LABEL)),
  );
};
