import { CommonModule } from '@angular/common';
import {
  ChangeDetectionStrategy,
  ChangeDetectorRef,
  Component,
  EventEmitter,
  Input,
  OnDestroy,
  Output,
  inject,
} from '@angular/core';
import { FormsModule } from '@angular/forms';
import { Subject, debounceTime, distinctUntilChanged, switchMap, of, takeUntil } from 'rxjs';
import { ParishionerLookupResult } from '../../models/ministries.model';
import { MinistriesApiService } from '../../services/ministries-api.service';

@Component({
  selector: 'app-parishioner-lookup-typeahead',
  standalone: true,
  imports: [CommonModule, FormsModule],
  templateUrl: './parishioner-lookup-typeahead.component.html',
  styleUrl: './parishioner-lookup-typeahead.component.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class ParishionerLookupTypeaheadComponent implements OnDestroy {
  private readonly destroy$ = new Subject<void>();
  private readonly search$ = new Subject<string>();
  private readonly api = inject(MinistriesApiService);
  private readonly cdr = inject(ChangeDetectorRef);

  @Input({ required: true }) organizationId!: string;
  @Input() selected: ParishionerLookupResult | null = null;
  @Output() selectedChange = new EventEmitter<ParishionerLookupResult | null>();

  query = '';
  results: ParishionerLookupResult[] = [];
  searching = false;
  searchError: string | null = null;
  showResults = false;

  constructor() {
    this.search$
      .pipe(
        debounceTime(300),
        distinctUntilChanged(),
        switchMap((term) => {
          const search = term.trim();
          if (search.length < 2) {
            this.searching = false;
            this.results = [];
            this.searchError = null;
            this.cdr.markForCheck();
            return of(null);
          }

          this.searching = true;
          this.searchError = null;
          this.cdr.markForCheck();

          return this.api.lookupParishioners({
            search,
            exclude_organization_id: this.organizationId,
            per_page: 15,
          });
        }),
        takeUntil(this.destroy$),
      )
      .subscribe({
        next: (response) => {
          if (!response) {
            return;
          }
          this.results = response.data;
          this.searching = false;
          this.showResults = true;
          this.cdr.markForCheck();
        },
        error: () => {
          this.searching = false;
          this.searchError = 'Could not search parish records.';
          this.results = [];
          this.cdr.markForCheck();
        },
      });
  }

  ngOnDestroy(): void {
    this.destroy$.next();
    this.destroy$.complete();
  }

  onQueryInput(): void {
    if (this.selected) {
      this.clearSelection();
    }
    this.search$.next(this.query);
  }

  onFocus(): void {
    if (this.results.length) {
      this.showResults = true;
    }
  }

  onBlur(): void {
    // Delay so click on a result can register before the list hides.
    setTimeout(() => {
      this.showResults = false;
      this.cdr.markForCheck();
    }, 150);
  }

  selectResult(result: ParishionerLookupResult): void {
    if (!result.eligible) {
      return;
    }

    this.selected = result;
    this.query = result.full_name;
    this.showResults = false;
    this.results = [];
    this.selectedChange.emit(result);
    this.cdr.markForCheck();
  }

  clearSelection(): void {
    this.selected = null;
    this.query = '';
    this.results = [];
    this.selectedChange.emit(null);
    this.cdr.markForCheck();
  }

  censusLabel(status: string): string {
    if (!status) {
      return 'Unknown';
    }
    return status.charAt(0).toUpperCase() + status.slice(1).replace(/_/g, ' ');
  }
}
