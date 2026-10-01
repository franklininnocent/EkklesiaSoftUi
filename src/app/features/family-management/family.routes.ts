import { Routes } from '@angular/router';
import { FamilyDashboardPageComponent } from './pages/family-dashboard.page';
import { FamilyListComponent } from './components/family-list/family-list';
import { FamilyDetail } from './components/family-detail/family-detail';
import { FamilyBreadcrumbResolver } from './resolvers/family-breadcrumb.resolver';
import { FamilyWorkspaceShellComponent } from './components/family-workspace-shell/family-workspace-shell.component';

export const FAMILY_ROUTES: Routes = [
  {
    path: '',
    component: FamilyWorkspaceShellComponent,
    children: [
      {
        path: '',
        component: FamilyDashboardPageComponent,
      },
      {
        path: 'list',
        component: FamilyListComponent,
      },
      {
        path: ':id',
        component: FamilyDetail,
        resolve: { breadcrumbLabel: FamilyBreadcrumbResolver },
      },
    ],
  },
];
