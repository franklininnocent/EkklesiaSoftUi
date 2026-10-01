/**
 * Collection Day KPI formulas — shared with drill-down pages so displayed values reconcile.
 */
export function averageCollection(collectedGross: number, paymentCount: number): number {
  return paymentCount > 0 ? Number(collectedGross) / paymentCount : 0;
}

export function collectionTarget(monthCollected: number, sessionTotal: number, now: Date = new Date()): number {
  if (monthCollected > 0) {
    const dayOfMonth = now.getDate();
    const daysInMonth = new Date(now.getFullYear(), now.getMonth() + 1, 0).getDate();
    return Math.max((monthCollected / Math.max(dayOfMonth, 1)) * daysInMonth * 0.15, sessionTotal || 1);
  }
  return Math.max(sessionTotal * 1.25, 1000);
}

export function completionPercent(sessionTotal: number, target: number): number {
  if (target <= 0) {
    return 0;
  }
  return Math.min(100, (sessionTotal / target) * 100);
}

export function collectionRemaining(target: number, sessionTotal: number): number {
  return Math.max(target - sessionTotal, 0);
}

export function completionLabel(percent: number): string {
  return `${percent.toFixed(0)}%`;
}
