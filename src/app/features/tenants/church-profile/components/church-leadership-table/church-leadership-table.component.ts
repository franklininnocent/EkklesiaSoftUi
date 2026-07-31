import { CommonModule } from '@angular/common';
import {
  ChangeDetectionStrategy,
  ChangeDetectorRef,
  Component,
  EventEmitter,
  Input,
  OnChanges,
  Output,
  SimpleChanges,
  inject
} from '@angular/core';
import { FormsModule } from '@angular/forms';
import { ChurchLeadership } from '@core/models/church';
import { PaginationComponent } from '@shared/components/pagination/pagination.component';
import { SortableDirective, SortDirection, SortEvent } from '@shared/directives/sortable.directive';
import { LEADERSHIP_ROLE_OPTIONS } from '../church-leader-workspace/church-leader-role.config';

type LeaderStatusFilter = '' | 'active' | 'inactive';
type LeaderPrimaryFilter = '' | 'primary' | 'non_primary';
type LeaderSortColumn = 'full_name' | 'role' | 'title' | 'appointed_date' | 'active' | 'is_primary';

interface ActiveFilterChip {
  key: string;
  label: string;
  value: string;
}

@Component({
  selector: 'app-church-leadership-table',
  standalone: true,
  imports: [CommonModule, FormsModule, PaginationComponent, SortableDirective],
  templateUrl: './church-leadership-table.component.html',
  styleUrl: './church-leadership-table.component.scss',
  changeDetection: ChangeDetectionStrategy.OnPush
})
export class ChurchLeadershipTableComponent implements OnChanges {
  private readonly cdr = inject(ChangeDetectorRef);

  @Input() leaders: ChurchLeadership[] = [];
  @Input() loading = false;
  @Input() canEdit = false;

  @Output() viewLeader = new EventEmitter<ChurchLeadership>();
  @Output() editLeader = new EventEmitter<ChurchLeadership>();
  @Output() addLeader = new EventEmitter<void>();

  searchTerm = '';
  statusFilter: LeaderStatusFilter = '';
  roleFilter = '';
  primaryFilter: LeaderPrimaryFilter = '';
  showFilters = false;

  sortColumn: LeaderSortColumn = 'full_name';
  sortDirection: SortDirection = 'asc';

  currentPage = 1;
  pageSize = 10;
  pageSizeOptions = [5, 10, 20, 50];

  filteredLeaders: ChurchLeadership[] = [];
  paginatedLeaders: ChurchLeadership[] = [];
  totalFiltered = 0;

  ngOnChanges(changes: SimpleChanges): void {
    if (changes['leaders']) {
      this.currentPage = 1;
      this.applyTableState();
    }
  }

  get roleFilterOptions(): string[] {
    const fromData = this.leaders.map((leader) => leader.role).filter(Boolean);
    const fromConfig = LEADERSHIP_ROLE_OPTIONS.map((option) => option.value);
    return [...new Set([...fromConfig, ...fromData])].sort((a, b) => a.localeCompare(b));
  }

  get hasLeaders(): boolean {
    return this.leaders.length > 0;
  }

  get hasFilteredResults(): boolean {
    return this.filteredLeaders.length > 0;
  }

  get activeFilterCount(): number {
    let count = 0;
    if (this.searchTerm.trim()) count++;
    if (this.statusFilter) count++;
    if (this.roleFilter) count++;
    if (this.primaryFilter) count++;
    return count;
  }

  get activeFilterChips(): ActiveFilterChip[] {
    const chips: ActiveFilterChip[] = [];
    if (this.searchTerm.trim()) {
      chips.push({ key: 'search', label: 'Search', value: this.searchTerm.trim() });
    }
    if (this.statusFilter) {
      chips.push({
        key: 'status',
        label: 'Status',
        value: this.statusFilter === 'active' ? 'Active' : 'Inactive'
      });
    }
    if (this.roleFilter) {
      chips.push({ key: 'role', label: 'Role', value: this.roleFilter });
    }
    if (this.primaryFilter) {
      chips.push({
        key: 'primary',
        label: 'Primary',
        value: this.primaryFilter === 'primary' ? 'Primary only' : 'Non-primary'
      });
    }
    return chips;
  }

  get summaryLabel(): string {
    if (!this.hasLeaders) {
      return 'No leaders configured';
    }
    if (!this.hasFilteredResults) {
      return 'No leaders match the current filters';
    }
    const start = (this.currentPage - 1) * this.pageSize + 1;
    const end = Math.min(this.currentPage * this.pageSize, this.totalFiltered);
    return `Showing ${start}-${end} of ${this.totalFiltered} leader${this.totalFiltered === 1 ? '' : 's'}`;
  }

  onSearchChange(): void {
    this.currentPage = 1;
    this.applyTableState();
  }

  clearSearch(): void {
    this.searchTerm = '';
    this.onSearchChange();
  }

  onFilterChange(): void {
    this.currentPage = 1;
    this.applyTableState();
  }

  toggleFilters(): void {
    this.showFilters = !this.showFilters;
    this.cdr.markForCheck();
  }

  clearAllFilters(): void {
    this.searchTerm = '';
    this.statusFilter = '';
    this.roleFilter = '';
    this.primaryFilter = '';
    this.currentPage = 1;
    this.applyTableState();
  }

  removeFilterChip(key: string): void {
    switch (key) {
      case 'search':
        this.searchTerm = '';
        break;
      case 'status':
        this.statusFilter = '';
        break;
      case 'role':
        this.roleFilter = '';
        break;
      case 'primary':
        this.primaryFilter = '';
        break;
    }
    this.onFilterChange();
  }

  onSort(event: SortEvent): void {
    if (!event.column || !event.direction) {
      return;
    }
    this.sortColumn = event.column as LeaderSortColumn;
    this.sortDirection = event.direction;
    this.currentPage = 1;
    this.applyTableState();
  }

  onPageChange(page: number): void {
    this.currentPage = page;
    this.applyTableState(false);
  }

  onPageSizeChange(size: number): void {
    this.pageSize = size;
    this.currentPage = 1;
    this.applyTableState();
  }

  requestView(leader: ChurchLeadership): void {
    this.viewLeader.emit(leader);
  }

  requestEdit(leader: ChurchLeadership): void {
    this.editLeader.emit(leader);
  }

  requestAdd(): void {
    this.addLeader.emit();
  }

  isActive(leader: ChurchLeadership): boolean {
    return Number(leader.active) === 1;
  }

  isPrimary(leader: ChurchLeadership): boolean {
    return Number(leader.is_primary) === 1;
  }

  private applyTableState(resetPageBounds = true): void {
    let results = [...this.leaders];
    const query = this.searchTerm.trim().toLowerCase();

    if (query) {
      results = results.filter((leader) => this.matchesSearch(leader, query));
    }

    if (this.statusFilter === 'active') {
      results = results.filter((leader) => this.isActive(leader));
    } else if (this.statusFilter === 'inactive') {
      results = results.filter((leader) => !this.isActive(leader));
    }

    if (this.roleFilter) {
      results = results.filter((leader) => leader.role === this.roleFilter);
    }

    if (this.primaryFilter === 'primary') {
      results = results.filter((leader) => this.isPrimary(leader));
    } else if (this.primaryFilter === 'non_primary') {
      results = results.filter((leader) => !this.isPrimary(leader));
    }

    results.sort((a, b) => this.compareLeaders(a, b));

    this.totalFiltered = results.length;

    if (resetPageBounds) {
      const totalPages = Math.max(1, Math.ceil(this.totalFiltered / this.pageSize) || 1);
      if (this.currentPage > totalPages) {
        this.currentPage = totalPages;
      }
    }

    const start = (this.currentPage - 1) * this.pageSize;
    this.filteredLeaders = results;
    this.paginatedLeaders = results.slice(start, start + this.pageSize);
    this.cdr.markForCheck();
  }

  private matchesSearch(leader: ChurchLeadership, query: string): boolean {
    const fields = [
      leader.full_name,
      leader.role,
      leader.title,
      leader.email,
      leader.phone,
      leader.biography
    ];
    return fields.some((value) => (value || '').toLowerCase().includes(query));
  }

  private compareLeaders(a: ChurchLeadership, b: ChurchLeadership): number {
    const direction = this.sortDirection === 'desc' ? -1 : 1;

    switch (this.sortColumn) {
      case 'role':
        return direction * (a.role || '').localeCompare(b.role || '');
      case 'title':
        return direction * (a.title || '').localeCompare(b.title || '');
      case 'appointed_date':
        return direction * this.compareDates(a.appointed_date, b.appointed_date);
      case 'active':
        return direction * (Number(a.active) - Number(b.active));
      case 'is_primary':
        return direction * (Number(a.is_primary) - Number(b.is_primary));
      case 'full_name':
      default:
        return direction * (a.full_name || '').localeCompare(b.full_name || '');
    }
  }

  private compareDates(left?: string, right?: string): number {
    const leftTime = left ? new Date(left).getTime() : 0;
    const rightTime = right ? new Date(right).getTime() : 0;
    return leftTime - rightTime;
  }
}
