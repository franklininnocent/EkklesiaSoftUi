import { Component, EventEmitter, Input, Output, OnChanges, SimpleChanges } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';

export interface SearchField {
  key: string;
  label: string;
  type: 'text' | 'select' | 'date' | 'number' | 'boolean';
  options?: Array<{ value: any; label: string }>;
  placeholder?: string;
  value?: any;
}

export interface ActiveFilter {
  key: string;
  label: string;
  value: any;
  displayValue: string;
}

@Component({
  selector: 'app-advanced-search-panel',
  standalone: true,
  imports: [CommonModule, FormsModule],
  templateUrl: './advanced-search-panel.component.html',
  styleUrl: './advanced-search-panel.component.scss'
})
export class AdvancedSearchPanelComponent implements OnChanges {
  @Input() fields: SearchField[] = [];
  @Input() isExpanded = false;
  @Input() mode: 'inline' | 'sidepanel' = 'sidepanel'; // Default to side panel
  @Output() search = new EventEmitter<{ [key: string]: any }>();
  @Output() clear = new EventEmitter<void>();
  @Output() toggleExpanded = new EventEmitter<boolean>();
  @Output() close = new EventEmitter<void>();

  searchValues: { [key: string]: any } = {};

  ngOnChanges(changes: SimpleChanges): void {
    // Initialize searchValues from field values when fields change or panel opens
    if (changes['fields'] || (changes['isExpanded'] && this.isExpanded)) {
      this.initializeSearchValues();
    }
  }

  /**
   * Initialize searchValues from field values
   */
  initializeSearchValues(): void {
    this.searchValues = {};
    this.fields.forEach(field => {
      if (field.value !== undefined && field.value !== null && field.value !== '') {
        this.searchValues[field.key] = field.value;
      }
    });
  }

  onFieldChange(field: SearchField, value: any): void {
    if (value === '' || value === null || value === undefined) {
      delete this.searchValues[field.key];
    } else {
      this.searchValues[field.key] = value;
    }
  }

  onSearch(): void {
    // Filter out empty values
    const filteredValues = Object.keys(this.searchValues).reduce((acc, key) => {
      const value = this.searchValues[key];
      if (value !== '' && value !== null && value !== undefined) {
        acc[key] = value;
      }
      return acc;
    }, {} as { [key: string]: any });

    this.search.emit(filteredValues);
  }

  onClear(): void {
    this.searchValues = {};
    this.fields.forEach(field => {
      field.value = undefined;
    });
    this.clear.emit();
  }

  toggle(): void {
    this.isExpanded = !this.isExpanded;
    this.toggleExpanded.emit(this.isExpanded);
  }

  onClose(): void {
    this.isExpanded = false;
    this.close.emit();
    this.toggleExpanded.emit(false);
  }

  getActiveFilters(): ActiveFilter[] {
    return Object.keys(this.searchValues)
      .filter(key => {
        const value = this.searchValues[key];
        return value !== '' && value !== null && value !== undefined;
      })
      .map(key => {
        const field = this.fields.find(f => f.key === key);
        const value = this.searchValues[key];
        let displayValue = value;

        if (field?.type === 'select' && field.options) {
          const option = field.options.find(opt => opt.value === value);
          displayValue = option?.label || value;
        } else if (field?.type === 'boolean') {
          displayValue = value ? 'Yes' : 'No';
        } else if (field?.type === 'date') {
          displayValue = new Date(value).toLocaleDateString();
        }

        return {
          key,
          label: field?.label || key,
          value,
          displayValue: String(displayValue)
        };
      });
  }

  removeFilter(filter: ActiveFilter): void {
    delete this.searchValues[filter.key];
    const field = this.fields.find(f => f.key === filter.key);
    if (field) {
      field.value = undefined;
    }
    this.onSearch();
  }

  hasActiveFilters(): boolean {
    return this.getActiveFilters().length > 0;
  }
}

