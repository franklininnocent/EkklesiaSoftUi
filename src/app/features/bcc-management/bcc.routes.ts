import { Routes, UrlMatchResult, UrlSegment } from '@angular/router';

/** Only treat UUID segments as BCC detail ids so paths like `audit` never collide. */
function bccDetailMatcher(segments: UrlSegment[]): UrlMatchResult | null {
  if (segments.length !== 1) {
    return null;
  }
  const id = segments[0].path;
  if (!/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(id)) {
    return null;
  }
  return { consumed: segments, posParams: { id: segments[0] } };
}

export const BCC_ROUTES: Routes = [
  {
    path: '',
    loadComponent: () =>
      import('./pages/bcc-dashboard.page').then((m) => m.BccDashboardPageComponent),
  },
  {
    path: 'list',
    loadComponent: () =>
      import('./components/bcc-list/bcc-list').then((m) => m.BCCListComponent),
  },
  {
    path: 'audit',
    loadComponent: () =>
      import('./pages/bcc-audit.page').then((m) => m.BccAuditPageComponent),
  },
  {
    matcher: bccDetailMatcher,
    loadComponent: () =>
      import('./pages/bcc-detail.page').then((m) => m.BccDetailPageComponent),
  },
];
