import { Routes } from '@angular/router';
import { supportGuard } from '@core/guards/support.guard';

export const SUPPORT_ROUTES: Routes = [
  {
    path: '',
    canActivate: [supportGuard],
    loadComponent: () =>
      import('./pages/support-dashboard.page').then((m) => m.SupportDashboardPage),
  },
  {
    path: 'new',
    redirectTo: '',
    pathMatch: 'full',
  },
  {
    path: 'tickets/:id',
    canActivate: [supportGuard],
    loadComponent: () =>
      import('./pages/support-ticket-detail.page').then((m) => m.SupportTicketDetailPage),
  },
];
