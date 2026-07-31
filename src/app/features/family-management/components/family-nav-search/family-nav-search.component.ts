import {
  ChangeDetectionStrategy,
  Component,
  EventEmitter,
  Input,
  Output
} from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { NavigatorFilterKey } from '../../models/family-navigator.model';

@Component({
  selector: 'app-family-nav-search',
  standalone: true,
  imports: [CommonModule, FormsModule],
  templateUrl: './family-nav-search.component.html',
  styleUrls: ['./family-nav-search.component.scss'],
  changeDetection: ChangeDetectionStrategy.OnPush
})
export class FamilyNavSearchComponent {
  @Input() searchQuery = '';
  @Input() activeFilters: NavigatorFilterKey[] = [];

  @Output() searchQueryChange = new EventEmitter<string>();
  @Output() filterToggle = new EventEmitter<NavigatorFilterKey>();

  readonly filterOptions: { key: NavigatorFilterKey; label: string }[] = [
    { key: 'active', label: 'Active' },
    { key: 'incomplete', label: 'Incomplete' }
  ];

  onSearchInput(value: string): void {
    this.searchQueryChange.emit(value);
  }

  isFilterActive(key: NavigatorFilterKey): boolean {
    return this.activeFilters.includes(key);
  }

  toggleFilter(key: NavigatorFilterKey): void {
    this.filterToggle.emit(key);
  }
}
