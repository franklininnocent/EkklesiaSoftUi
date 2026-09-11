import {
  buildZoomSteps,
  clampScale,
  fitScale,
  formatZoomLabel,
  isAtFitScale,
  nextZoomStep,
} from './image-viewer.zoom';

describe('image-viewer.zoom', () => {
  describe('fitScale', () => {
    it('fits large images down to the stage', () => {
      expect(fitScale(2000, 3000, 800, 600)).toBeCloseTo(0.2);
    });

    it('never upscales small images', () => {
      expect(fitScale(100, 100, 800, 600)).toBe(1);
    });

    it('returns 1 for invalid dimensions', () => {
      expect(fitScale(0, 100, 800, 600)).toBe(1);
    });
  });

  describe('clampScale', () => {
    it('clamps below fit back to fit', () => {
      expect(clampScale(0.1, 0.2)).toBe(0.2);
    });

    it('clamps above max down to max', () => {
      expect(clampScale(4, 0.5)).toBe(3);
    });
  });

  describe('buildZoomSteps', () => {
    it('includes fit and natural-relative steps', () => {
      expect(buildZoomSteps(0.4)).toEqual([0.4, 1, 1.25, 1.5, 2, 3]);
    });

    it('deduplicates when fit equals 1', () => {
      expect(buildZoomSteps(1)).toEqual([1, 1.25, 1.5, 2, 3]);
    });
  });

  describe('nextZoomStep', () => {
    it('steps up through discrete zoom levels', () => {
      const fit = 0.4;
      expect(nextZoomStep(fit, fit, 'in')).toBe(1);
      expect(nextZoomStep(1, fit, 'in')).toBe(1.25);
    });

    it('steps down to fit', () => {
      const fit = 0.4;
      expect(nextZoomStep(1, fit, 'out')).toBe(fit);
    });
  });

  describe('formatZoomLabel', () => {
    it('shows Fit at fit scale', () => {
      expect(formatZoomLabel(0.4, 0.4)).toBe('Fit');
      expect(isAtFitScale(0.4, 0.4)).toBe(true);
    });

    it('shows percent for zoomed scales', () => {
      expect(formatZoomLabel(1.25, 0.4)).toBe('125%');
    });
  });
});
