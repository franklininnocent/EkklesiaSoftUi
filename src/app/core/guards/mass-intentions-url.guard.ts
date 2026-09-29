import { inject } from '@angular/core';
import { CanActivateFn, Router, UrlTree } from '@angular/router';

const UUID_SEGMENT = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

/**
 * Keeps Mass intentions URLs lowercase (kebab-case segments). UUID ids are normalized to lowercase.
 */
export const massIntentionsUrlGuard: CanActivateFn = (_route, state): boolean | UrlTree => {
  const router = inject(Router);
  const [path, query = ''] = state.url.split('?');
  if (!path.toLowerCase().startsWith('/mass-intentions')) {
    return true;
  }

  const normalized = path
    .split('/')
    .map((segment) => {
      if (!segment) {
        return segment;
      }
      if (UUID_SEGMENT.test(segment)) {
        return segment.toLowerCase();
      }
      if (/^\d+$/.test(segment)) {
        return segment;
      }
      return segment.toLowerCase();
    })
    .join('/');

  if (normalized === path) {
    return true;
  }

  const suffix = query ? `?${query}` : '';
  return router.parseUrl(`${normalized}${suffix}`);
};
