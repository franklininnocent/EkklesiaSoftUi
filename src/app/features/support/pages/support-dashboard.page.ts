import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { Component, OnInit, inject } from '@angular/core';
import { Router, RouterModule } from '@angular/router';
import { PageHeaderComponent } from '@shared/components/page-header/page-header.component';
import { ListToolbarComponent } from '@shared/components/list-toolbar/list-toolbar.component';
import {
  AdvancedSearchPanelComponent,
  SearchField,
} from '@shared/components/advanced-search-panel/advanced-search-panel.component';
import { DataTableComponent } from '@shared/components/data-table/data-table.component';
import { PaginationComponent } from '@shared/components/pagination/pagination.component';
import { CfEmptyStateComponent } from '@shared/components/cf-empty-state/cf-empty-state.component';
import { LoadingSkeletonComponent } from '@shared/components/loading-skeleton/loading-skeleton.component';
import { SupportTicketCreateModalComponent } from '../components/support-ticket-create-modal/support-ticket-create-modal.component';
import { AuthService } from '@core/services/auth.service';
import { SupportTicketService } from '../services/support-ticket.service';
import { SupportTicketDashboard, SupportTicketListItem } from '../models/support-ticket.model';

@Component({
  selector: 'app-support-dashboard-page',
  standalone: true,
  imports: [
    CommonModule,
    FormsModule,
    RouterModule,
    PageHeaderComponent,
    ListToolbarComponent,
    AdvancedSearchPanelComponent,
    DataTableComponent,
    PaginationComponent,
    CfEmptyStateComponent,
    LoadingSkeletonComponent,
    SupportTicketCreateModalComponent,
  ],
  templateUrl: './support-dashboard.page.html',
  styleUrl: './support-dashboard.page.scss',
})
export class SupportDashboardPage implements OnInit {
  private readonly tickets = inject(SupportTicketService);
  private readonly auth = inject(AuthService);
  readonly router = inject(Router);

  metrics: SupportTicketDashboard | null = null;
  items: SupportTicketListItem[] = [];
  loading = true;
  error: string | null = null;
  searchTerm = '';
  showFilters = false;
  scope = 'mine';
  statusFilter = '';
  priorityFilter = '';
  page = 1;
  perPage = 20;
  total = 0;
  searchFields: SearchField[] = [];
  showCreateModal = false;

  ngOnInit(): void {
    this.initializeSearchFields();
    this.load();
  }

  get canCreateTicket(): boolean {
    return this.auth.hasTenantPermission('support.tickets.create');
  }

  get canViewAllParishTickets(): boolean {
    return this.auth.hasTenantPermission('support.tickets.view_all_tenant');
  }

  initializeSearchFields(): void {
    const scopeOptions = [{ value: 'mine', label: 'My tickets' }];
    if (this.canViewAllParishTickets) {
      scopeOptions.push({ value: 'all', label: 'All parish tickets' });
    }

    this.searchFields = [
      {
        key: 'scope',
        label: 'View',
        type: 'select',
        options: scopeOptions,
        value: this.scope,
      },
      {
        key: 'status',
        label: 'Status',
        type: 'select',
        options: [
          { value: 'new', label: 'New' },
          { value: 'in_progress', label: 'In progress' },
          { value: 'awaiting_you', label: 'Awaiting you' },
          { value: 'awaiting_ekklesia', label: 'Awaiting Ekklesia' },
          { value: 'resolved', label: 'Resolved' },
          { value: 'closed', label: 'Closed' },
        ],
        value: this.statusFilter || undefined,
      },
      {
        key: 'priority',
        label: 'Priority',
        type: 'select',
        options: [
          { value: 'low', label: 'Low' },
          { value: 'normal', label: 'Normal' },
          { value: 'high', label: 'High' },
          { value: 'urgent', label: 'Urgent' },
          { value: 'critical', label: 'Critical' },
        ],
        value: this.priorityFilter || undefined,
      },
    ];
  }

  openFilters(): void {
    this.syncSearchFieldsWithFilters();
    this.showFilters = true;
  }

  syncSearchFieldsWithFilters(): void {
    const scopeField = this.searchFields.find((field) => field.key === 'scope');
    if (scopeField) {
      scopeField.value = this.scope;
    }

    const statusField = this.searchFields.find((field) => field.key === 'status');
    if (statusField) {
      statusField.value = this.statusFilter || undefined;
    }

    const priorityField = this.searchFields.find((field) => field.key === 'priority');
    if (priorityField) {
      priorityField.value = this.priorityFilter || undefined;
    }
  }

  load(): void {
    this.loading = true;
    this.error = null;

    this.tickets.getDashboard().subscribe({
      next: (metrics) => {
        this.metrics = metrics;
      },
      error: () => {},
    });

    this.tickets
      .listTickets({
        q: this.searchTerm || undefined,
        scope: this.scope,
        status: this.statusFilter || undefined,
        priority: this.priorityFilter || undefined,
        page: this.page,
        per_page: this.perPage,
      })
      .subscribe({
        next: (res) => {
          this.items = res.data;
          this.total = res.total;
          this.page = res.current_page;
          this.loading = false;
        },
        error: () => {
          this.error = 'Could not load support tickets.';
          this.loading = false;
        },
      });
  }

  onSearchChange(term: string): void {
    this.searchTerm = term;
    this.page = 1;
    this.load();
  }

  onAdvancedSearch(searchValues: { [key: string]: unknown }): void {
    this.scope = (searchValues['scope'] as string) || 'mine';
    this.statusFilter = (searchValues['status'] as string) || '';
    this.priorityFilter = (searchValues['priority'] as string) || '';
    this.syncSearchFieldsWithFilters();
    this.showFilters = false;
    this.page = 1;
    this.load();
  }

  onClearAdvancedSearch(): void {
    this.scope = 'mine';
    this.statusFilter = '';
    this.priorityFilter = '';
    this.searchFields.forEach((field) => {
      field.value = field.key === 'scope' ? 'mine' : undefined;
    });
    this.page = 1;
    this.load();
  }

  onPageChange(page: number): void {
    this.page = page;
    this.load();
  }

  openTicket(ticket: SupportTicketListItem): void {
    this.router.navigate(['/support/tickets', ticket.ticket_number]);
  }

  openCreateModal(): void {
    this.showCreateModal = true;
  }

  closeCreateModal(): void {
    this.showCreateModal = false;
  }

  onTicketCreated(ticketNumber: string): void {
    this.showCreateModal = false;
    this.router.navigate(['/support/tickets', ticketNumber]);
  }

  get filterCount(): number {
    let count = 0;
    if (this.scope !== 'mine') count++;
    if (this.statusFilter) count++;
    if (this.priorityFilter) count++;
    return count;
  }
}
