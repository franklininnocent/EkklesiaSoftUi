import { Router } from '@angular/router';
import { QuickCollectService } from '@features/donations/services/quick-collect.service';
import { ExecutiveStewardshipData } from '../models/executive-dashboard.model';

/** Same destinations as the Donations Dashboard financial snapshot cards. */
export type FinancialSnapshotLink =
  | 'donations.payments.month'
  | 'donations.payments.comparison'
  | 'donations.dues'
  | 'donations.dues.overdue'
  | 'donations.reports.participation';

const ROUTES: Record<string, string | string[]> = {
  'families.directory': '/families',
  'families.create': '/families',
  'members.directory': '/members/list',
  'members.home': '/members/list',
  'members.list': '/members/list',
  'members.celebrations': '/members/celebrations',
  'members.celebrations.birthdays': '/members/celebrations',
  'members.celebrations.anniversaries': '/members/celebrations',
  'bcc.home': '/bccs/list',
  'ministries.home': '/ministries',
  'sacraments.home': '/sacraments',
  'sacraments.register': '/sacraments/register',
  'donations.home': '/donations',
  'donations.dues': '/donations/dues',
  'donations.dues.overdue': '/donations/dues',
  'mass.home': '/mass-intentions',
  'mass.needs_a_mass': '/mass-intentions/intentions',
  'mass.needs_a_tick': '/mass-intentions',
  'mass.schedule': '/mass-intentions/masses/schedule',
  'dashboard.operations': '/dashboard',
};

export function navigateExecutiveDrilldown(
  router: Router,
  quickCollect: QuickCollectService,
  key: string,
  onOperationsTab?: () => void
): void {
  if (key === 'donations.collect') {
    quickCollect.open();
    return;
  }
  if (key === 'dashboard.operations') {
    onOperationsTab?.();
    return;
  }

  if (key === 'members.celebrations.birthdays') {
    void router.navigate(['/members/celebrations'], { queryParams: { tab: 'birthdays' } });
    return;
  }

  if (key === 'members.celebrations.anniversaries') {
    void router.navigate(['/members/celebrations'], { queryParams: { tab: 'anniversaries' } });
    return;
  }

  const target = ROUTES[key];
  if (!target) {
    return;
  }

  if (key === 'mass.needs_a_mass') {
    void router.navigate(['/mass-intentions/intentions'], {
      queryParams: { status: 'open', needs_a_mass: '1' },
    });
    return;
  }

  if (key === 'mass.needs_a_tick') {
    void router.navigate(['/mass-intentions/masses'], {
      queryParams: { needs_tick: '1' },
    });
    return;
  }

  if (key === 'donations.dues.overdue') {
    void router.navigate(['/donations/dues'], {
      queryParams: { overdue_only: '1' },
    });
    return;
  }

  void router.navigate([target as string]);
}

/**
 * Opens the Donations page section that owns this snapshot metric.
 * Month payment dates follow the default Donations Dashboard card: the first
 * of the snapshot month through the snapshot as-of date.
 */
export function navigateFinancialSnapshot(
  router: Router,
  link: FinancialSnapshotLink,
  data: Pick<ExecutiveStewardshipData, 'as_of' | 'comparison_start' | 'comparison_end'>
): void {
  switch (link) {
    case 'donations.payments.month':
      void router.navigate(['/donations/payments'], {
        queryParams: monthPaymentQuery(data.as_of),
      });
      return;
    case 'donations.payments.comparison':
      void router.navigate(['/donations/payments'], {
        queryParams: {
          paid_from: data.comparison_start,
          paid_to: data.comparison_end,
        },
      });
      return;
    case 'donations.dues':
      void router.navigate(['/donations/dues']);
      return;
    case 'donations.dues.overdue':
      void router.navigate(['/donations/dues'], {
        queryParams: { overdue_only: '1' },
      });
      return;
    case 'donations.reports.participation':
      void router.navigate(['/donations/reports'], {
        queryParams: { report: 'participation' },
      });
      return;
  }
}

function monthPaymentQuery(asOf: string): Record<string, string> | null {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(asOf)) {
    return null;
  }

  return {
    paid_from: `${asOf.slice(0, 8)}01`,
    paid_to: asOf,
  };
}

export function attentionLabel(key: string, count: number): string {
  const n = count.toLocaleString();
  switch (key) {
    case 'overdue_families':
      return `${n} families have overdue balances`;
    case 'needs_a_mass':
      return `${n} without a Mass`;
    case 'needs_a_tick':
      return `${n} need a tick`;
    case 'schedule_attention':
      return `Schedule preview (${n})`;
    case 'ministry_vacancies':
      return `${n} ministry positions are vacant`;
    case 'leadership_terms_expiring':
      return `${n} leadership terms end within 30 days`;
    case 'families_without_life_group':
      return `${n} families are not in a Life Group`;
    case 'pastoral_open':
      return `${n} open pastoral visits`;
    default:
      return `${n} items need review`;
  }
}

export function quickActionLabel(key: string): string {
  switch (key) {
    case 'families.create':
      return 'Add family';
    case 'donations.collect':
      return 'Record a gift';
    case 'mass.home':
      return 'Mass intentions';
    case 'sacraments.create':
      return 'Record sacrament';
    default:
      return 'Open';
  }
}
