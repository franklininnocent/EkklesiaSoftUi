import { Component, EventEmitter, Input, Output, OnChanges, OnDestroy, SimpleChanges, ChangeDetectionStrategy, ElementRef, ViewChild, HostListener } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { NgSelectModule } from '@ng-select/ng-select';
import { trapFocus, saveActiveElement, restoreActiveElement } from '@shared/utils/focus-trap.util';

export interface SearchField {
  key: string;
  label: string;
  type: 'text' | 'select' | 'date' | 'number' | 'boolean';
  options?: Array<{ value: any; label: string }>;
  placeholder?: string;
  value?: any;
  /**
   * Optional presentation-only grouping. Fields that share a `group` render
   * under one caption in the side panel, in first-appearance order. Fields
   * without a `group` render in a single unnamed group with no caption, so
   * consumers that omit this keep their existing flat layout.
   */
  group?: string;
}

export interface ActiveFilter {
  key: string;
  label: string;
  value: any;
  displayValue: string;
}

export interface FieldGroup {
  /** Caption to render, or null for the unnamed/default group. */
  name: string | null;
  fields: SearchField[];
}

@Component({
  selector: 'app-advanced-search-panel',
  standalone: true,
  imports: [CommonModule, FormsModule, NgSelectModule],
  templateUrl: './advanced-search-panel.component.html',
  changeDetection: ChangeDetectionStrategy.Eager,
  styleUrl: './advanced-search-panel.component.scss'
})
export class AdvancedSearchPanelComponent implements OnChanges, OnDestroy {
  @Input() fields: SearchField[] = [];
  @Input() isExpanded = false;
  @Input() mode: 'inline' | 'sidepanel' = 'sidepanel'; // Default to side panel
  @Output() search = new EventEmitter<{ [key: string]: any }>();
  @Output() clear = new EventEmitter<void>();
  @Output() toggleExpanded = new EventEmitter<boolean>();
  @Output() close = new EventEmitter<void>();

  @ViewChild('drawerRef') drawerRef?: ElementRef<HTMLElement>;

  searchValues: { [key: string]: any } = {};

  /** Presentation-only grouping of `fields`, holding the original references. */
  fieldGroups: FieldGroup[] = [];

  /** Stable id for aria-labelledby on the drawer title. */
  readonly titleId = 'asp-filter-title';

  private previousActiveElement: HTMLElement | null = null;
  private focusTrapCleanup: (() => void) | null = null;

  ngOnChanges(changes: SimpleChanges): void {
    // Initialize searchValues from field values when fields change or panel opens
    if (changes['fields'] || (changes['isExpanded'] && this.isExpanded)) {
      this.initializeSearchValues();
    }

    if (changes['fields']) {
      this.buildFieldGroups();
    }

    if (changes['isExpanded'] && this.mode === 'sidepanel') {
      if (this.isExpanded) {
        this.onDrawerOpened();
      } else {
        this.onDrawerClosed();
      }
    }
  }

  ngOnDestroy(): void {
    this.releaseFocusTrap();
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

  /**
   * Bucket fields into presentation groups. Preserves original field order
   * within a group and orders groups by first appearance. Keeps the original
   * SearchField references so async option mutations (e.g. BCC) still apply.
   */
  buildFieldGroups(): void {
    const groups: FieldGroup[] = [];
    const byName = new Map<string, FieldGroup>();

    this.fields.forEach(field => {
      const key = field.group && field.group.trim() !== '' ? field.group : '';
      let group = byName.get(key);
      if (!group) {
        group = { name: key === '' ? null : key, fields: [] };
        byName.set(key, group);
        groups.push(group);
      }
      group.fields.push(field);
    });

    this.fieldGroups = groups;
  }

  onFieldChange(field: SearchField, value: any): void {
    // Handle ng-select which may return null/undefined for cleared selection
    if (value === '' || value === null || value === undefined) {
      delete this.searchValues[field.key];
      field.value = undefined;
    } else {
      this.searchValues[field.key] = value;
      field.value = value;
    }
  }

  /**
   * Get options for select field, including "All" option
   */
  getSelectOptions(field: SearchField): Array<{ value: any; label: string }> {
    if (!field.options) {
      return [];
    }
    // Return options as-is (ng-select will handle the "All" via placeholder and clearable)
    return field.options;
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
    this.onDrawerClosed();
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

  /**
   * Read-only presentation helper — true when a field currently has an
   * applied value. Drives the subtle active-state indicator only; never
   * reorders fields.
   */
  isFieldActive(field: SearchField): boolean {
    const value = this.searchValues[field.key];
    return value !== '' && value !== null && value !== undefined;
  }

  @HostListener('document:keydown.escape')
  onEscape(): void {
    if (this.mode === 'sidepanel' && this.isExpanded) {
      this.onClose();
    }
  }

  private onDrawerOpened(): void {
    this.previousActiveElement = saveActiveElement();
    // Wait for the drawer to become visible before trapping focus.
    setTimeout(() => {
      if (this.isExpanded && this.drawerRef?.nativeElement) {
        this.releaseFocusTrap(false);
        this.focusTrapCleanup = trapFocus(this.drawerRef.nativeElement);
      }
    }, 0);
  }

  private onDrawerClosed(): void {
    this.releaseFocusTrap();
  }

  private releaseFocusTrap(restore: boolean = true): void {
    this.focusTrapCleanup?.();
    this.focusTrapCleanup = null;
    if (restore) {
      restoreActiveElement(this.previousActiveElement);
      this.previousActiveElement = null;
    }
  }
}
