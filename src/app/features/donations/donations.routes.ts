import { Routes } from '@angular/router';
import { StewardshipWorkspaceShellComponent } from './components/stewardship-workspace-shell/stewardship-workspace-shell.component';
import { DonationsCampaignsComponent } from './pages/donations-campaigns.component';
import { DonationsCategoriesComponent } from './pages/donations-categories.component';
import { DonationsDashboardComponent } from './pages/donations-dashboard.component';
import { DonationsDonorsComponent } from './pages/donations-donors.component';
import { DonationsDuesComponent } from './pages/donations-dues.component';
import { DonationsHistoryComponent } from './pages/donations-history.component';
import { DonationsPaymentsComponent } from './pages/donations-payments.component';
import { DonationsPlansComponent } from './pages/donations-plans.component';
import { DonationsProjectInstallmentsComponent } from './pages/donations-project-installments.component';
import { DonationsProjectsComponent } from './pages/donations-projects.component';
import { DonationsRecurringComponent } from './pages/donations-recurring.component';
import { DonationsReportsComponent } from './pages/donations-reports.component';
import { DonationsRegisterComponent } from './pages/donations-register.component';
import { DonationsReceiptsComponent } from './pages/donations-receipts.component';
import { DonationsSettingsComponent } from './pages/donations-settings.component';
import { DonationsNotificationsComponent } from './pages/donations-notifications.component';
import { DonationsExpensesComponent } from './pages/donations-expenses.component';
import { CollectionHealthCenterPageComponent } from './pages/collection-health-center.page';
import { CollectionDayComponent } from './pages/collection-day.component';

export const DONATIONS_ROUTES: Routes = [
  {
    path: '',
    component: StewardshipWorkspaceShellComponent,
    children: [
      { path: '', component: DonationsDashboardComponent },
      { path: 'plans', component: DonationsPlansComponent },
      { path: 'dues', component: DonationsDuesComponent },
      { path: 'projects', component: DonationsProjectsComponent },
      { path: 'campaigns', component: DonationsCampaignsComponent },
      { path: 'project-installments', component: DonationsProjectInstallmentsComponent },
      { path: 'payments', component: DonationsPaymentsComponent },
      { path: 'collection-day', component: CollectionDayComponent },
      { path: 'collection-health', component: CollectionHealthCenterPageComponent },
      { path: 'receipts', component: DonationsReceiptsComponent },
      { path: 'register', component: DonationsRegisterComponent },
      { path: 'donors', component: DonationsDonorsComponent },
      { path: 'categories', component: DonationsCategoriesComponent },
      { path: 'recurring', component: DonationsRecurringComponent },
      { path: 'history', component: DonationsHistoryComponent },
      { path: 'reports', component: DonationsReportsComponent },
      { path: 'expenses', component: DonationsExpensesComponent },
      { path: 'settings', component: DonationsSettingsComponent },
      { path: 'notifications', component: DonationsNotificationsComponent }
    ]
  }
];
