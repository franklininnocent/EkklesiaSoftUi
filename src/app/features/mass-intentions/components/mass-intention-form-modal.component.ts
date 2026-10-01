import { CommonModule } from '@angular/common';
import { Component, EventEmitter, Input, OnChanges, Output, SimpleChanges, inject, signal } from '@angular/core';
import { FormBuilder, ReactiveFormsModule, Validators } from '@angular/forms';
import { debounceTime, distinctUntilChanged, switchMap } from 'rxjs/operators';
import { Subject, of } from 'rxjs';
import { ModalShellComponent } from '@shared/components/modal-shell/modal-shell.component';
import { ParishPerson, ParishPersonService } from '@features/settings/sacraments/services/person.service';
import {
  MassCelebrationSummary,
  MassIntentionCategory,
  MassIntentionRecord,
  MassIntentionsApiService,
} from '../services/mass-intentions-api.service';
import { formatMassDayTime } from '../utils/mass-celebration-display';
import { canCreateMassIntention, canScheduleMasses } from '../utils/mass-intentions-auth.util';
import { AuthService } from '@core/services/auth.service';
import { AddMassModalComponent } from './add-mass-modal.component';

/** Sentinel select value for inline add-new flow (not persisted). */
export const MASS_INTENTION_ADD_CATEGORY = '__add_new__';

@Component({
  selector: 'app-mass-intention-form-modal',
  standalone: true,
  imports: [CommonModule, ReactiveFormsModule, ModalShellComponent, AddMassModalComponent],
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
  /** When creating from Mass detail, the parent Mass is fixed. */
  @Input() presetCelebrationId: string | null = null;
  @Output() closed = new EventEmitter<void>();
  @Output() saved = new EventEmitter<MassIntentionRecord>();
  @Output() moveRequested = new EventEmitter<MassIntentionRecord>();

  readonly saving = signal(false);
  readonly errorMessage = signal('');
  readonly personResults = signal<ParishPerson[]>([]);
  readonly categories = signal<MassIntentionCategory[]>([]);
  readonly showAddCategory = signal(false);
  readonly addingCategory = signal(false);
  readonly addCategoryError = signal('');
  /** Display-only BCC from linked member or loaded record. */
  readonly linkedBccName = signal<string | null>(null);
  readonly assignableMasses = signal<MassCelebrationSummary[]>([]);
  readonly massSearch = signal('');
  readonly massRangeDays = signal(14);
  readonly loadedMassCelebration = signal<MassIntentionRecord['mass_celebration'] | null>(null);
  readonly needsAMass = signal(false);
  readonly loadedRecord = signal<MassIntentionRecord | null>(null);
  readonly showCreateMass = signal(false);

  readonly form = this.fb.nonNullable.group({
    beneficiary_name: ['', Validators.required],
    beneficiary_place: [''],
    mass_intention_category_id: ['', Validators.required],
    intention_description: [''],
    celebration_id: ['', Validators.required],
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
      this.reloadAssignableMasses();
    }
    if (changes['open']?.currentValue && this.recordId) {
      this.loadRecord(this.recordId);
    }
    if (changes['open']?.currentValue && !this.recordId) {
      this.resetFormForCreate();
    }
  }

  massLabel(mass: MassCelebrationSummary): string {
    const when = formatMassDayTime(mass.celebrated_on, mass.celebrated_at ?? null);
    const place = mass.place ? ` · ${mass.place}` : '';
    return `${when}${place}`;
  }

  currentMassLabel(): string {
    const mass = this.loadedMassCelebration();
    if (!mass) {
      return '';
    }
    return formatMassDayTime(mass.celebrated_on ?? '', mass.celebrated_at ?? null);
  }

  isMassLocked(): boolean {
    return !!this.presetCelebrationId && !this.recordId;
  }

  canMoveFromEdit(): boolean {
    const r = this.loadedRecord();
    return (
      !!this.recordId &&
      canScheduleMasses(this.auth) &&
      !!r &&
      r.status === 'open' &&
      !r.needs_a_mass &&
      !!r.mass_celebration?.id
    );
  }

  requestMoveFromEdit(): void {
    const r = this.loadedRecord();
    if (r) {
      this.moveRequested.emit(r);
    }
  }

  onMassRangeChange(days: number): void {
    this.massRangeDays.set(days);
    this.reloadAssignableMasses();
  }

  onMassSearchInput(event: Event): void {
    const value = (event.target as HTMLInputElement).value;
    this.massSearch.set(value);
    this.reloadAssignableMasses();
  }

  isLinkedMember(): boolean {
    return this.beneficiaryPersonId !== null;
  }

  canAddCategory(): boolean {
    return canCreateMassIntention(this.auth);
  }

  canScheduleMass(): boolean {
    return canScheduleMasses(this.auth);
  }

  openCreateMass(): void {
    this.showCreateMass.set(true);
  }

  onMassCreated(celebration: MassCelebrationSummary): void {
    this.showCreateMass.set(false);
    this.form.controls.celebration_id.setValue(celebration.id);
    this.form.controls.celebration_id.markAsDirty();
    this.assignableMasses.update((rows) => {
      if (rows.some((r) => r.id === celebration.id)) {
        return rows;
      }
      return [...rows, celebration].sort((a, b) =>
        `${a.celebrated_on}${a.celebrated_at ?? ''}`.localeCompare(`${b.celebrated_on}${b.celebrated_at ?? ''}`)
      );
    });
    this.reloadAssignableMasses();
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

  private reloadAssignableMasses(): void {
    const from = new Date();
    const to = new Date();
    const days = this.massRangeDays();
    if (days > 0) {
      to.setDate(to.getDate() + days);
    }
    const params: Record<string, string | number> = {
      from: from.toISOString().slice(0, 10),
      to: to.toISOString().slice(0, 10),
      assignable_only: 1,
      per_page: 100,
    };
    const search = this.massSearch().trim();
    if (search) {
      params['search'] = search;
    }
    this.api.listCelebrations(params).subscribe({
      next: (res) => this.assignableMasses.set(res.data ?? []),
      error: () => this.assignableMasses.set([]),
    });
  }

  private resetFormForCreate(): void {
    this.form.reset({
      beneficiary_name: '',
      beneficiary_place: '',
      mass_intention_category_id: '',
      intention_description: '',
      celebration_id: this.presetCelebrationId ?? '',
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
    this.loadedMassCelebration.set(null);
    this.needsAMass.set(false);
    this.loadedRecord.set(null);
    if (this.presetCelebrationId) {
      this.form.controls.celebration_id.setValue(this.presetCelebrationId);
      this.form.controls.celebration_id.disable();
    }
  }

  private loadRecord(id: string): void {
    this.api.getRequest(id).subscribe({
      next: (res) => {
        const data = res.data;
        this.loadedRecord.set(data);
        this.beneficiaryPersonId = data.beneficiary_person_id ?? null;
        this.linkedBccName.set(data.beneficiary_bcc?.name ?? null);
        this.form.patchValue({
          beneficiary_name: data.beneficiary_name,
          beneficiary_place: data.beneficiary_place ?? '',
          mass_intention_category_id: data.mass_intention_category_id ?? '',
          intention_description: data.intention_description ?? '',
          do_not_announce: !data.announce_name,
          notes: data.notes ?? '',
          requester_name: data.requester_name ?? '',
          requester_phone: data.requester_phone ?? '',
        });
        this.loadedMassCelebration.set(data.mass_celebration ?? null);
        this.needsAMass.set(!!data.needs_a_mass);
        if (data.needs_a_mass) {
          this.form.controls.celebration_id.setValidators([Validators.required]);
          this.form.controls.celebration_id.enable();
        } else {
          this.form.controls.celebration_id.clearValidators();
          this.form.controls.celebration_id.setValue(data.mass_celebration?.id ?? '');
          this.form.controls.celebration_id.disable();
        }
        this.form.controls.celebration_id.updateValueAndValidity();
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
    const body: Record<string, unknown> = {
      beneficiary_name: v.beneficiary_name,
      beneficiary_person_id: this.beneficiaryPersonId,
      beneficiary_place: this.beneficiaryPersonId ? null : place || null,
      mass_intention_category_id: v.mass_intention_category_id,
      intention_description: v.intention_description.trim() || null,
      announce_name: !v.do_not_announce,
      notes: v.notes || null,
      requester_name: v.requester_name || null,
      requester_phone: v.requester_phone || null,
      mass_count: 1,
    };
    if (!this.recordId || this.needsAMass()) {
      body['celebration_id'] = v.celebration_id;
    }
    return body;
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
