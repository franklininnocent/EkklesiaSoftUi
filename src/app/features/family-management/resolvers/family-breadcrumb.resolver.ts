import { inject } from '@angular/core';
import { ResolveFn, ActivatedRouteSnapshot } from '@angular/router';
import { FamilyService } from '@core/services/family.service';
import { map, catchError, of } from 'rxjs';

export const FamilyBreadcrumbResolver: ResolveFn<string> = (route: ActivatedRouteSnapshot) => {
  const familyService = inject(FamilyService);
  const id = route.paramMap.get('id') as string;
  if (!id) {
    return of('Family');
  }
  return familyService.getFamily(id).pipe(
    map(res => (res?.success && res?.data?.family_code) ? res.data.family_code : 'Family'),
    catchError(() => of('Family'))
  );
};


