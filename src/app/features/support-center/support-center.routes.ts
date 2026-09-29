import { Routes } from '@angular/router';
import { SupportCenterPage } from './pages/support-center.page';

export const SUPPORT_CENTER_ROUTES: Routes = [
  {
    path: '',
    component: SupportCenterPage,
  },
  {
    path: 'tickets/:id',
    loadComponent: () =>
      import('./pages/support-ops-ticket-detail.page').then((m) => m.SupportOpsTicketDetailPage),
  },
];
