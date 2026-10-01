import { Observable, finalize, tap } from 'rxjs';
import { LoadingStateCoordinator } from './loading-state-coordinator';

/**
 * Tracks loading on a coordinator for the lifetime of the observable.
 * Pass `getToken()` from the subscriber to ignore stale results.
 */
export function trackLoading<T>(
  coordinator: LoadingStateCoordinator,
  onToken?: (token: number) => void
): (source: Observable<T>) => Observable<T> {
  return (source) => {
    const token = coordinator.begin();
    onToken?.(token);
    return source.pipe(
      finalize(() => coordinator.end(token))
    );
  };
}

/** Runs side effects only when the response token is still current. */
export function whenCurrent<T>(
  coordinator: LoadingStateCoordinator,
  token: number,
  fn: (value: T) => void
): (source: Observable<T>) => Observable<T> {
  return (source) =>
    source.pipe(
      tap((value) => {
        if (coordinator.isCurrent(token)) {
          fn(value);
        }
      })
    );
}
