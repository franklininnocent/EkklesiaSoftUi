import { Routes } from '@angular/router';
import { entitlementGuard } from '@core/guards/entitlement.guard';
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
import { DonationsDownloadHistoryComponent } from './pages/donations-download-history.component';
import { DonationsExpensesComponent } from './pages/donations-expenses.component';
import { CollectionDayComponent } from './pages/collection-day.component';
import { TodaysCollectionsComponent } from './pages/today-collections.component';
import { DonationsApprovalsComponent } from './pages/donations-approvals.component';

export const DONATIONS_ROUTES: Routes = [
  {
    path: '',
    component: StewardshipWorkspaceShellComponent,
    children: [
      { path: '', component: DonationsDashboardComponent },
      { path: 'plans', component: DonationsPlansComponent, canActivate: [entitlementGuard], data: { feature: 'CONTRIBUTION_PLANS' } },
      { path: 'dues', component: DonationsDuesComponent },
      { path: 'projects', component: DonationsProjectsComponent },
      { path: 'projects/:id', component: DonationsProjectsComponent },
      { path: 'campaigns', component: DonationsCampaignsComponent },
      { path: 'project-installments', component: DonationsProjectInstallmentsComponent },
      { path: 'payments', component: DonationsPaymentsComponent },
      { path: 'collection-day', component: CollectionDayComponent },
      { path: 'today-collections', component: TodaysCollectionsComponent },
      { path: 'receipts', component: DonationsReceiptsComponent },
      { path: 'register', component: DonationsRegisterComponent },
      { path: 'donors', component: DonationsDonorsComponent },
      { path: 'categories', component: DonationsCategoriesComponent },
      { path: 'recurring', component: DonationsRecurringComponent },
      { path: 'approvals', component: DonationsApprovalsComponent },
      { path: 'history', component: DonationsHistoryComponent, canActivate: [entitlementGuard], data: { feature: 'AUDIT_LOG' } },
      { path: 'reports', component: DonationsReportsComponent },
      { path: 'expenses', component: DonationsExpensesComponent },
      { path: 'settings', component: DonationsSettingsComponent },
      { path: 'notifications', component: DonationsNotificationsComponent },
      { path: 'download-history', component: DonationsDownloadHistoryComponent }
    ]
  }
];
