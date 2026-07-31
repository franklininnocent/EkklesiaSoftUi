import { ChangeDetectorRef, DestroyRef } from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { NavigationEnd, Router } from '@angular/router';
import { filter } from 'rxjs/operators';

/** Force view refresh after async loads under OnPush ancestors (main layout). */
export function refreshStewardshipView(cdr: ChangeDetectorRef): void {
  cdr.detectChanges();
}

/** Reload data when navigating back to a stewardship route (skip initial NavigationEnd). */
export function setupStewardshipRouteReload(
  router: Router,
  destroyRef: DestroyRef,
  pathIncludes: string,
  reload: () => void
): void {
  let skipNext = true;
  router.events.pipe(
    filter((e): e is NavigationEnd => e instanceof NavigationEnd),
    filter((e) => e.urlAfterRedirects.includes(pathIncludes)),
    takeUntilDestroyed(destroyRef)
  ).subscribe(() => {
    if (skipNext) {
      skipNext = false;
      return;
    }
    reload();
  });
}
