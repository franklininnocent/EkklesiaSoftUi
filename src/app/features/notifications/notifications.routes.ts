import { Routes } from '@angular/router';

export const NOTIFICATIONS_ROUTES: Routes = [
  {
    path: '',
    loadComponent: () =>
      import('./pages/notification-center.page').then((m) => m.NotificationCenterPage),
  },
  {
    path: ':id',
    loadComponent: () =>
      import('./pages/notification-detail.page').then((m) => m.NotificationDetailPage),
  },
];
