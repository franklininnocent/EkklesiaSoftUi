import { Routes } from '@angular/router';
import { MemberListComponent } from './components/member-list/member-list.component';

export const MEMBERS_ROUTES: Routes = [
  {
    path: '',
    pathMatch: 'full',
    redirectTo: 'list',
  },
  {
    path: 'list',
    component: MemberListComponent,
  },
  {
    path: 'celebrations',
    loadComponent: () =>
      import('./pages/member-celebrations.page').then((m) => m.MemberCelebrationsPageComponent),
  },
];
