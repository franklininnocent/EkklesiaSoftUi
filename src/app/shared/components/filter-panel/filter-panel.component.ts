import { Component, Input, Output, EventEmitter, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';

export interface FilterPanelConfig {
  title: string;
  showSearch?: boolean;
  showStatusFilter?: boolean;
  showTypeFilter?: boolean;
  showModuleFilter?: boolean;
  showRoleFilter?: boolean;
  searchPlaceholder?: string;
  statusOptions?: { value: string; label: string }[];
  typeOptions?: { value: string; label: string }[];
  roleOptions?: { value: string; label: string }[];
  moduleOptions?: { value: string; label: string }[];
}

export interface FilterValues {
  search?: string;
  status?: string;
  type?: string;
  module?: string;
  role?: string;
}

@Component({
  selector: 'app-filter-panel',
  standalone: true,
  imports: [CommonModule, FormsModule],
  templateUrl: './filter-panel.component.html',
  styleUrl: './filter-panel.component.scss'
})
export class FilterPanelComponent implements OnInit {
  @Input() isOpen = false;
  @Input() config: FilterPanelConfig = {
    title: 'Filters',
    showSearch: true,
    showStatusFilter: true,
    showTypeFilter: true,
    showModuleFilter: false,
    searchPlaceholder: 'Search...'
  };
  @Input() initialValues: FilterValues = {};

  @Output() close = new EventEmitter<void>();
  @Output() apply = new EventEmitter<FilterValues>();
  @Output() reset = new EventEmitter<void>();

  // Filter values
  searchValue = '';
  statusValue = 'all';
  typeValue = 'all';
  moduleValue = '';
  roleValue = 'all';

  ngOnInit(): void {
    // Initialize with provided values
    if (this.initialValues) {
      this.searchValue = this.initialValues.search || '';
      this.statusValue = this.initialValues.status || 'all';
      this.typeValue = this.initialValues.type || 'all';
      this.moduleValue = this.initialValues.module || '';
      this.roleValue = this.initialValues.role || 'all';
    }
  }

  onClose(): void {
    this.close.emit();
  }

  onApply(): void {
    const filters: FilterValues = {
      search: this.searchValue,
      status: this.statusValue,
      type: this.typeValue,
      module: this.moduleValue,
      role: this.roleValue
    };
    this.apply.emit(filters);
    this.close.emit();
  }

  onReset(): void {
    this.searchValue = '';
    this.statusValue = 'all';
    this.typeValue = 'all';
    this.moduleValue = '';
    this.roleValue = 'all';
    this.reset.emit();
    this.close.emit();
  }

  hasActiveFilters(): boolean {
    return this.searchValue !== '' ||
           this.statusValue !== 'all' ||
           this.typeValue !== 'all' ||
           this.moduleValue !== '' ||
           this.roleValue !== 'all';
  }

  get statusOptions() {
    return this.config.statusOptions || [
      { value: 'all', label: 'All Status' },
      { value: 'active', label: 'Active' },
      { value: 'inactive', label: 'Inactive' }
    ];
  }

  get typeOptions() {
    return this.config.typeOptions || [
      { value: 'all', label: 'All Types' },
      { value: 'system', label: 'System' },
      { value: 'custom', label: 'Custom' }
    ];
  }

  get roleOptions() {
    return this.config.roleOptions || [
      { value: 'all', label: 'All Roles' }
    ];
  }

  get moduleOptions() {
    return this.config.moduleOptions || [
      { value: '', label: 'All Modules' }
    ];
  }
}

