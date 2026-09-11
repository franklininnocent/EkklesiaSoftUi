/** Maximum zoom relative to natural image size (300%). */
export const MAX_ZOOM_SCALE = 3;

/** Discrete zoom steps relative to natural image dimensions. */
export const ZOOM_STEPS = [1, 1.25, 1.5, 2, MAX_ZOOM_SCALE] as const;

const FIT_EPSILON = 0.001;

/**
 * Scale that fits the entire image inside the stage without upscaling.
 */
export function fitScale(
  naturalWidth: number,
  naturalHeight: number,
  stageWidth: number,
  stageHeight: number,
): number {
  if (naturalWidth <= 0 || naturalHeight <= 0 || stageWidth <= 0 || stageHeight <= 0) {
    return 1;
  }

  return Math.min(1, stageWidth / naturalWidth, stageHeight / naturalHeight);
}

export function clampScale(scale: number, fit: number, max = MAX_ZOOM_SCALE): number {
  return Math.max(fit, Math.min(max, scale));
}

export function buildZoomSteps(fit: number, max = MAX_ZOOM_SCALE): number[] {
  const steps = new Set<number>([fit, ...ZOOM_STEPS]);
  return [...steps]
    .filter((step) => step >= fit - FIT_EPSILON && step <= max + FIT_EPSILON)
    .sort((a, b) => a - b);
}

export function nextZoomStep(
  current: number,
  fit: number,
  direction: 'in' | 'out',
  max = MAX_ZOOM_SCALE,
): number {
  const steps = buildZoomSteps(fit, max);
  const currentIndex = findNearestStepIndex(steps, current);

  if (direction === 'in') {
    return steps[Math.min(currentIndex + 1, steps.length - 1)];
  }

  return steps[Math.max(currentIndex - 1, 0)];
}

export function isAtFitScale(current: number, fit: number): boolean {
  return Math.abs(current - fit) <= FIT_EPSILON;
}

export function formatZoomLabel(current: number, fit: number): string {
  if (isAtFitScale(current, fit)) {
    return 'Fit';
  }

  return `${Math.round(current * 100)}%`;
}

function findNearestStepIndex(steps: number[], current: number): number {
  let nearestIndex = 0;
  let nearestDistance = Number.POSITIVE_INFINITY;

  steps.forEach((step, index) => {
    const distance = Math.abs(step - current);
    if (distance < nearestDistance) {
      nearestDistance = distance;
      nearestIndex = index;
    }
  });

  return nearestIndex;
}
