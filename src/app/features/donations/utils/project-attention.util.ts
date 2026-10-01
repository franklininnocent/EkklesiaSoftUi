import { DonationProject } from '../models/donation.model';

/** Mirrors API `needs_attention` when present; used for KPIs and card styling. */
export function projectNeedsAttention(project: DonationProject): boolean {
  if (project.needs_attention !== undefined) {
    return project.needs_attention;
  }

  if (project.status !== 'active') {
    return false;
  }

  const hasTarget = project.has_funding_target ?? (Number(project.overall_target ?? project.target_amount) > 0);
  const pct = project.collection_percentage;

  if (hasTarget && pct != null && pct < 50) {
    return true;
  }

  const days = daysUntilProjectEnd(project.end_date);
  if (days !== null && days >= 0 && days <= 14) {
    if (!hasTarget || pct == null || pct < 100) {
      return true;
    }
  }

  return false;
}

export function daysUntilProjectEnd(endDate?: string | null): number | null {
  if (!endDate) {
    return null;
  }
  const end = new Date(endDate);
  if (Number.isNaN(end.getTime())) {
    return null;
  }
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  end.setHours(0, 0, 0, 0);
  return Math.ceil((end.getTime() - today.getTime()) / (1000 * 60 * 60 * 24));
}
