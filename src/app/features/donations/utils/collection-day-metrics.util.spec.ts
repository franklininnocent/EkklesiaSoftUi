import {
  averageCollection,
  collectionRemaining,
  collectionTarget,
  completionLabel,
  completionPercent
} from './collection-day-metrics.util';

describe('collection-day-metrics.util', () => {
  const april10_2026 = new Date(2026, 3, 10);

  it('computes average collection', () => {
    expect(averageCollection(125, 7)).toBeCloseTo(125 / 7);
    expect(averageCollection(100, 0)).toBe(0);
  });

  it('computes completion target and percent for month with collections', () => {
    const target = collectionTarget(3000, 100, april10_2026);
    expect(target).toBe(1350);
    const percent = completionPercent(100, target);
    expect(completionLabel(percent)).toBe('7%');
    expect(collectionRemaining(target, 100)).toBe(1250);
  });

  it('uses fallback target when month collected is zero and session is zero', () => {
    const target = collectionTarget(0, 0, april10_2026);
    expect(target).toBe(1000);
    expect(completionLabel(completionPercent(0, target))).toBe('0%');
    expect(collectionRemaining(target, 0)).toBe(1000);
  });

  it('uses session-based target when month collected is zero but session has value', () => {
    const target = collectionTarget(0, 2000, april10_2026);
    expect(target).toBe(2500);
    expect(completionLabel(completionPercent(2000, target))).toBe('80%');
    expect(collectionRemaining(target, 2000)).toBe(500);
  });

  it('caps completion at 100% when session meets target', () => {
    const target = collectionTarget(100, 500, new Date(2026, 3, 15));
    expect(target).toBe(500);
    expect(completionLabel(completionPercent(500, target))).toBe('100%');
    expect(collectionRemaining(target, 500)).toBe(0);
  });
});
