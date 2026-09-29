import { CommonModule } from '@angular/common';
import {
  ChangeDetectionStrategy,
  Component,
  EventEmitter,
  Input,
  OnDestroy,
  OnInit,
  Output,
} from '@angular/core';
import { FormsModule } from '@angular/forms';
import { Subject, debounceTime, distinctUntilChanged, takeUntil } from 'rxjs';

/**
 * ListToolbar
 *
 * Single search + "Filters" trigger (with active-filter-count badge) +
 * primary-CTA row, replacing the byte-for-byte duplicated toolbar markup
 * found across list pages (organization list, guest member list, audit
 * log). The filter drawer itself stays `app-advanced-search-panel` —
 * this component only owns the trigger button/badge and search input.
 */
@Component({
  selector: 'app-list-toolbar',
  standalone: true,
  imports: [CommonModule, FormsModule],
  templateUrl: './list-toolbar.component.html',
  styleUrl: './list-toolbar.component.scss',
  changeDetection: ChangeDetectionStrategy.Eager,
})
export class ListToolbarComponent implements OnInit, OnDestroy {
  @Input() showSearch = true;
  @Input() searchPlaceholder = 'Search';
  @Input() searchValue = '';
  @Input() debounceMs = 300;
  @Input() filterCount = 0;
  @Input() showFilters = true;

  @Output() searchChange = new EventEmitter<string>();
  @Output() filtersOpened = new EventEmitter<void>();

  private readonly searchInput$ = new Subject<string>();
  private readonly destroyed$ = new Subject<void>();

  ngOnInit(): void {
    this.searchInput$
      .pipe(debounceTime(this.debounceMs), distinctUntilChanged(), takeUntil(this.destroyed$))
      .subscribe((value) => this.searchChange.emit(value));
  }

  ngOnDestroy(): void {
    this.destroyed$.next();
    this.destroyed$.complete();
  }

  onSearchInput(value: string): void {
    this.searchValue = value;
    this.searchInput$.next(value);
  }
}
