import { CommonModule } from '@angular/common';
import {
  ChangeDetectionStrategy,
  ChangeDetectorRef,
  Component,
  HostBinding,
  Input,
  OnDestroy,
  forwardRef,
  inject,
} from '@angular/core';
import {
  ControlValueAccessor,
  FormsModule,
  NG_VALUE_ACCESSOR,
} from '@angular/forms';
import {
  Subject,
  debounceTime,
  distinctUntilChanged,
  switchMap,
  of,
  takeUntil,
} from 'rxjs';
import { ParishPerson, ParishPersonService } from '@features/settings/sacraments/services/person.service';

export interface ParentPersonValue {
  person_id: string | null;
  name: string | null;
  linked: boolean;
}

@Component({
  selector: 'app-parent-person-autocomplete',
  standalone: true,
  imports: [CommonModule, FormsModule],
  templateUrl: './parent-person-autocomplete.component.html',
  styleUrl: './parent-person-autocomplete.component.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
  host: {
    class: 'cf-split-field',
  },
  providers: [
    {
      provide: NG_VALUE_ACCESSOR,
      useExisting: forwardRef(() => ParentPersonAutocompleteComponent),
      multi: true,
    },
  ],
})
export class ParentPersonAutocompleteComponent implements ControlValueAccessor, OnDestroy {
  private readonly destroy$ = new Subject<void>();
  private readonly search$ = new Subject<string>();
  private readonly personService = inject(ParishPersonService);
  private readonly cdr = inject(ChangeDetectorRef);

  @Input({ required: true }) mode: 'father' | 'mother' = 'father';
  @Input() excludePersonId: string | null = null;

  @HostBinding('class.is-disabled')
  disabled = false;

  readonly fieldId = `parent_${Math.random().toString(36).slice(2, 9)}`;
  readonly listboxId = `${this.fieldId}_listbox`;

  query = '';
  results: ParishPerson[] = [];
  searching = false;
  searchError: string | null = null;
  showResults = false;
  linked = false;
  linkedPerson: ParishPerson | null = null;
  editing = true;

  private value: ParentPersonValue = { person_id: null, name: null, linked: false };
  private onChange: (value: ParentPersonValue) => void = () => {};
  private onTouched: () => void = () => {};

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

          return this.personService.searchForParent(search, this.excludePersonId);
        }),
        takeUntil(this.destroy$),
      )
      .subscribe({
        next: (response) => {
          if (!response) {
            return;
          }
          this.results = response.data ?? [];
          this.searching = false;
          this.showResults = true;
          this.cdr.markForCheck();
        },
        error: () => {
          this.searching = false;
          this.searchError = 'Could not search parish records.';
          this.cdr.markForCheck();
        },
      });
  }

  ngOnDestroy(): void {
    this.destroy$.next();
    this.destroy$.complete();
  }

  get label(): string {
    return this.mode === 'father' ? 'Father' : 'Mother';
  }

  writeValue(value: ParentPersonValue | null): void {
    this.value = value ?? { person_id: null, name: null, linked: false };
    this.linked = !!this.value.linked && !!this.value.person_id;
    this.query = this.value.name ?? '';
    this.editing = !this.linked;
    this.linkedPerson = null;
    this.cdr.markForCheck();
  }

  registerOnChange(fn: (value: ParentPersonValue) => void): void {
    this.onChange = fn;
  }

  registerOnTouched(fn: () => void): void {
    this.onTouched = fn;
  }

  setDisabledState(isDisabled: boolean): void {
    this.disabled = isDisabled;
    this.cdr.markForCheck();
  }

  onQueryChange(value: string): void {
    if (this.linked && !this.editing) {
      return;
    }
    this.query = value;
    this.linked = false;
    this.linkedPerson = null;
    this.emitValue({ person_id: null, name: value.trim() || null, linked: false });
    this.search$.next(value);
  }

  selectPerson(person: ParishPerson): void {
    const name = this.personDisplayName(person);
    this.linked = true;
    this.linkedPerson = person;
    this.query = name;
    this.showResults = false;
    this.results = [];
    this.editing = false;
    this.emitValue({ person_id: person.id, name, linked: true });
    this.onTouched();
    this.cdr.markForCheck();
  }

  startChange(): void {
    this.editing = true;
    this.showResults = false;
    this.cdr.markForCheck();
  }

  unlink(): void {
    this.linked = false;
    this.linkedPerson = null;
    this.editing = true;
    this.emitValue({
      person_id: null,
      name: this.query.trim() || this.value.name,
      linked: false,
    });
    this.onTouched();
    this.cdr.markForCheck();
  }

  clear(): void {
    this.query = '';
    this.linked = false;
    this.linkedPerson = null;
    this.editing = true;
    this.results = [];
    this.showResults = false;
    this.emitValue({ person_id: null, name: null, linked: false });
    this.onTouched();
    this.cdr.markForCheck();
  }

  onFocus(): void {
    if (this.results.length > 0) {
      this.showResults = true;
      this.cdr.markForCheck();
    }
  }

  onBlur(): void {
    this.onTouched();
    window.setTimeout(() => {
      this.showResults = false;
      this.cdr.markForCheck();
    }, 150);
  }

  personDisplayName(person: ParishPerson): string {
    return (
      person.full_name_display ||
      [person.first_name, person.middle_name, person.last_name].filter(Boolean).join(' ')
    );
  }

  familyLabel(person: ParishPerson): string | null {
    const family = person.active_family_member?.family;
    if (!family) {
      return null;
    }
    const parts = [family.family_name, family.family_code].filter(Boolean);
    return parts.length ? parts.join(' · ') : null;
  }

  bccLabel(person: ParishPerson): string | null {
    return person.active_family_member?.family?.bcc?.name ?? null;
  }

  private emitValue(next: ParentPersonValue): void {
    this.value = next;
    this.onChange(next);
  }
}
