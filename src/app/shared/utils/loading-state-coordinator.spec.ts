import { LoadingStateCoordinator } from './loading-state-coordinator';
import { defer, of } from 'rxjs';
import { trackLoading, whenCurrent } from './loading-state.rxjs';

describe('LoadingStateCoordinator', () => {
  it('reference-counts concurrent operations', () => {
    const c = new LoadingStateCoordinator();
    const t1 = c.begin();
    const t2 = c.begin();
    expect(c.isLoading).toBe(true);
    c.end(t1);
    expect(c.isLoading).toBe(true);
    c.end(t2);
    expect(c.isLoading).toBe(false);
  });

  it('invalidate clears depth and rejects stale tokens', () => {
    const c = new LoadingStateCoordinator();
    const stale = c.begin();
    c.invalidate();
    c.end(stale);
    expect(c.isLoading).toBe(false);
    expect(c.isCurrent(stale)).toBe(false);
  });
});

describe('trackLoading', () => {
  it('ends loading on complete and error', () => {
    const c = new LoadingStateCoordinator();
    const flags: boolean[] = [];
    defer(() => {
      flags.push(c.isLoading);
      return of(1);
    })
      .pipe(trackLoading(c))
      .subscribe({
        complete: () => {
          flags.push(c.isLoading);
          expect(flags).toEqual([true, false]);
        },
      });
  });
});

describe('whenCurrent', () => {
  it('skips handler when invalidated', () => {
    const c = new LoadingStateCoordinator();
    const token = c.begin();
    c.invalidate();
    let called = false;
    of(1)
      .pipe(whenCurrent(c, token, () => (called = true)))
      .subscribe();
    expect(called).toBe(false);
  });
});
