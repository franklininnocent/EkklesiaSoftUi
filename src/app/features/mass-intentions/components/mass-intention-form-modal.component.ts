import { CommonModule } from '@angular/common';
import { Component, EventEmitter, Input, OnChanges, Output, SimpleChanges, inject, signal } from '@angular/core';
import { FormBuilder, ReactiveFormsModule, Validators } from '@angular/forms';
import { debounceTime, distinctUntilChanged, switchMap } from 'rxjs/operators';
import { Subject, of } from 'rxjs';
import { ModalShellComponent } from '@shared/components/modal-shell/modal-shell.component';
import { ParishPerson, ParishPersonService } from '@features/settings/sacraments/services/person.service';
import {
  MassIntentionCategory,
  MassIntentionRecord,
  MassIntentionsApiService,
} from '../services/mass-intentions-api.service';
import { canCreateMassIntention } from '../utils/mass-intentions-auth.util';
import { AuthService } from '@core/services/auth.service';

/** Sentinel select value for inline add-new flow (not persisted). */
export const MASS_INTENTION_ADD_CATEGORY = '__add_new__';

@Component({
  selector: 'app-mass-intention-form-modal',
  standalone: true,
  imports: [CommonModule, ReactiveFormsModule, ModalShellComponent],
  templateUrl: './mass-intention-form-modal.component.html',
  styleUrl: './mass-intention-form-modal.component.scss',
})
export class MassIntentionFormModalComponent implements OnChanges {
  private readonly fb = inject(FormBuilder);
  private readonly api = inject(MassIntentionsApiService);
  private readonly persons = inject(ParishPersonService);
  private readonly auth = inject(AuthService);
  private readonly beneficiarySearch$ = new Subject<string>();
  private beneficiaryPersonId: string | null = null;

  readonly addCategoryValue = MASS_INTENTION_ADD_CATEGORY;

  @Input() open = false;
  @Input() recordId: string | null = null;
  @Output() closed = new EventEmitter<void>();
  @Output() saved = new EventEmitter<MassIntentionRecord>();

  readonly saving = signal(false);
  readonly errorMessage = signal('');
  readonly personResults = signal<ParishPerson[]>([]);
  readonly categories = signal<MassIntentionCategory[]>([]);
  readonly showAddCategory = signal(false);
  readonly addingCategory = signal(false);
  readonly addCategoryError = signal('');
  /** Display-only BCC from linked member or loaded record. */
  readonly linkedBccName = signal<string | null>(null);

  readonly form = this.fb.nonNullable.group({
    beneficiary_name: ['', Validators.required],
    beneficiary_place: [''],
    mass_intention_category_id: ['', Validators.required],
    intention_description: [''],
    requested_date: ['', Validators.required],
    do_not_announce: [false],
    notes: [''],
    requester_name: [''],
    requester_phone: [''],
    new_category_name: [''],
  });

  constructor() {
    this.beneficiarySearch$
      .pipe(
        debounceTime(250),
        distinctUntilChanged(),
        switchMap((term) => (term.length < 2 ? of({ data: [] as ParishPerson[] }) : this.persons.search(term)))
      )
      .subscribe((res) => this.personResults.set(res.data ?? []));
  }

  ngOnChanges(changes: SimpleChanges): void {
    if (changes['open']?.currentValue) {
      this.reloadCategories();
    }
    if (changes['open']?.currentValue && this.recordId) {
      this.loadRecord(this.recordId);
    }
    if (changes['open']?.currentValue && !this.recordId) {
      this.resetFormForCreate();
    }
  }

  isLinkedMember(): boolean {
    return this.beneficiaryPersonId !== null;
  }

  canAddCategory(): boolean {
    return canCreateMassIntention(this.auth);
  }

  hasCategorySelected(): boolean {
    const id = this.form.controls.mass_intention_category_id.value;
    return !!id && id !== MASS_INTENTION_ADD_CATEGORY;
  }

  onCategoryChange(event: Event): void {
    const value = (event.target as HTMLSelectElement).value;
    if (value === MASS_INTENTION_ADD_CATEGORY) {
      this.showAddCategory.set(true);
      this.form.controls.mass_intention_category_id.setValue('');
      this.form.controls.new_category_name.setValidators([Validators.required, Validators.maxLength(128)]);
      this.form.controls.new_category_name.updateValueAndValidity();
      return;
    }
    this.showAddCategory.set(false);
    this.addCategoryError.set('');
    this.form.controls.new_category_name.clearValidators();
    this.form.controls.new_category_name.setValue('');
    this.form.controls.new_category_name.updateValueAndValidity();
  }

  saveNewCategory(): void {
    const name = this.form.controls.new_category_name.value.trim();
    if (!name) {
      this.addCategoryError.set('Enter an intention type.');
      return;
    }
    this.addingCategory.set(true);
    this.addCategoryError.set('');
    this.api.createCategory({ name }).subscribe({
      next: (res) => {
        this.addingCategory.set(false);
        const list = [...this.categories(), res.data];
        this.categories.set(list.sort((a, b) => a.sort_order - b.sort_order || a.name.localeCompare(b.name)));
        this.showAddCategory.set(false);
        this.form.controls.new_category_name.clearValidators();
        this.form.controls.new_category_name.setValue('');
        this.form.controls.new_category_name.updateValueAndValidity();
        this.form.patchValue({ mass_intention_category_id: res.data.id });
      },
      error: (err) => {
        this.addingCategory.set(false);
        this.addCategoryError.set(this.readError(err));
      },
    });
  }

  cancelAddCategory(): void {
    this.showAddCategory.set(false);
    this.addCategoryError.set('');
    this.form.controls.new_category_name.clearValidators();
    this.form.controls.new_category_name.setValue('');
    this.form.controls.new_category_name.updateValueAndValidity();
  }

  onBeneficiaryInput(): void {
    this.beneficiaryPersonId = null;
    this.linkedBccName.set(null);
    this.applyBeneficiaryModeValidators();
    this.beneficiarySearch$.next(this.form.controls.beneficiary_name.value);
  }

  pickPerson(person: ParishPerson): void {
    this.beneficiaryPersonId = person.id;
    this.form.patchValue({ beneficiary_name: this.personDisplay(person), beneficiary_place: '' });
    this.linkedBccName.set(person.active_family_member?.family?.bcc?.name ?? null);
    this.personResults.set([]);
    this.applyBeneficiaryModeValidators();
  }

  personDisplay(person: ParishPerson): string {
    return person.full_name_display ?? `${person.first_name} ${person.last_name}`;
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

  submit(): void {
    if (this.form.invalid || this.saving() || this.showAddCategory()) {
      return;
    }
    this.saving.set(true);
    this.errorMessage.set('');
    const body = this.buildPayload();
    const req$ = this.recordId
      ? this.api.updateRequest(this.recordId, body)
      : this.api.createRequest(body);
    req$.subscribe({
      next: (res) => {
        this.saving.set(false);
        this.saved.emit(res.data);
        this.close();
      },
      error: (err) => {
        this.saving.set(false);
        this.errorMessage.set(this.readError(err));
      },
    });
  }

  close(): void {
    if (!this.saving()) {
      this.closed.emit();
    }
  }

  private reloadCategories(): void {
    this.api.listCategories().subscribe({
      next: (res) => this.categories.set(res.data ?? []),
      error: () => this.errorMessage.set('Could not load intention types.'),
    });
  }

  private resetFormForCreate(): void {
    this.form.reset({
      beneficiary_name: '',
      beneficiary_place: '',
      mass_intention_category_id: '',
      intention_description: '',
      requested_date: '',
      do_not_announce: false,
      notes: '',
      requester_name: '',
      requester_phone: '',
      new_category_name: '',
    });
    this.form.enable();
    this.beneficiaryPersonId = null;
    this.linkedBccName.set(null);
    this.personResults.set([]);
    this.errorMessage.set('');
    this.showAddCategory.set(false);
    this.addCategoryError.set('');
    this.applyBeneficiaryModeValidators();
  }

  private loadRecord(id: string): void {
    this.api.getRequest(id).subscribe({
      next: (res) => {
        const data = res.data;
        this.beneficiaryPersonId = data.beneficiary_person_id ?? null;
        this.linkedBccName.set(data.beneficiary_bcc?.name ?? null);
        this.form.patchValue({
          beneficiary_name: data.beneficiary_name,
          beneficiary_place: data.beneficiary_place ?? '',
          mass_intention_category_id: data.mass_intention_category_id ?? '',
          intention_description: data.intention_description ?? '',
          requested_date: data.requested_date ?? '',
          do_not_announce: !data.announce_name,
          notes: data.notes ?? '',
          requester_name: data.requester_name ?? '',
          requester_phone: data.requester_phone ?? '',
        });
        this.applyBeneficiaryModeValidators();
        if (data.status === 'closed') {
          this.form.disable();
        } else {
          this.form.enable();
        }
      },
      error: () => this.errorMessage.set('Could not load this intention.'),
    });
  }

  private applyBeneficiaryModeValidators(): void {
    const place = this.form.controls.beneficiary_place;
    if (this.beneficiaryPersonId) {
      place.clearValidators();
      place.setValue('');
    } else {
      place.setValidators([Validators.required, Validators.maxLength(255)]);
    }
    place.updateValueAndValidity();
  }

  private buildPayload(): Record<string, unknown> {
    const v = this.form.getRawValue();
    const place = v.beneficiary_place.trim();
    return {
      beneficiary_name: v.beneficiary_name,
      beneficiary_person_id: this.beneficiaryPersonId,
      beneficiary_place: this.beneficiaryPersonId ? null : place || null,
      mass_intention_category_id: v.mass_intention_category_id,
      intention_description: v.intention_description.trim() || null,
      requested_date: v.requested_date,
      announce_name: !v.do_not_announce,
      notes: v.notes || null,
      requester_name: v.requester_name || null,
      requester_phone: v.requester_phone || null,
      mass_count: 1,
    };
  }

  private readError(err: unknown): string {
    if (err && typeof err === 'object' && 'error' in err) {
      const body = (err as { error?: { message?: string; errors?: Record<string, string[]> } }).error;
      if (body?.message) {
        return body.message;
      }
      if (body?.errors) {
        return Object.values(body.errors).flat().join(' ');
      }
    }
    return 'Could not save. Check the form and try again.';
  }
}
