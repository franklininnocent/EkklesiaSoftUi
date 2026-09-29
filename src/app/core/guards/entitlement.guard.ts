import { inject } from '@angular/core';
import { ActivatedRouteSnapshot, CanActivateFn, Router, UrlTree } from '@angular/router';
import { Observable, of } from 'rxjs';
import { map } from 'rxjs/operators';
import { EntitlementService } from '@core/services/entitlement.service';

export const FEATURE_UNAVAILABLE_PATH = '/feature-unavailable';

export function routeFeatureCodes(route: ActivatedRouteSnapshot): string[] {
  const raw = route.data?.['feature'] as string | string[] | undefined;
  const codes = Array.isArray(raw) ? raw : raw ? [raw] : [];
  return codes.map((c) => c.trim().toUpperCase()).filter(Boolean);
}

/**
 * Route gate for plan features declared as `data: { feature: 'CODE' | ['CODE', ...] }`.
 * UX only: sends the user to a plain explanation instead of a page full of errors.
 * The API independently rejects the same features (FEATURE_NOT_AVAILABLE).
 */
export const entitlementGuard: CanActivateFn = (route): Observable<boolean | UrlTree> => {
  const entitlements = inject(EntitlementService);
  const router = inject(Router);
  const codes = routeFeatureCodes(route);

  if (!codes.length || !entitlements.appliesToCurrentUser()) {
    return of(true);
  }

  return entitlements.load().pipe(
    map(() => {
      const missing = codes.find((code) => !entitlements.hasFeature(code));
      return missing ? router.createUrlTree([FEATURE_UNAVAILABLE_PATH], { queryParams: { feature: missing } }) : true;
    }),
  );
};
