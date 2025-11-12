import { CommonModule } from '@angular/common';
import { Component, EventEmitter, Input, OnDestroy, OnInit, Output, inject } from '@angular/core';
import { FormBuilder, FormGroup, ReactiveFormsModule, Validators } from '@angular/forms';
import { Subject, takeUntil } from 'rxjs';
import { FamilyMember } from '@core/models/family.model';
import { FamilyService } from '../../../../core/services/family.service';

export type SacramentFormType = 'baptism' | 'first_communion' | 'confirmation' | 'marriage';

@Component({
  selector: 'app-sacrament-edit-modal',
  standalone: true,
  imports: [CommonModule, ReactiveFormsModule],
  templateUrl: './sacrament-edit-modal.component.html',
  styleUrls: ['./sacrament-edit-modal.component.scss']
})
export class SacramentEditModalComponent implements OnInit, OnDestroy {
  @Input({ required: true }) familyId!: string;
  @Input({ required: true }) member!: FamilyMember;
  @Input({ required: true }) sacrament: SacramentFormType = 'baptism';

  private _homeParishName: string | null = null;
  private _homeParishAddress: string | null = null;
  private _homeParishPriest: string | null = null;

  @Input()
  set homeParishName(value: string | null) {
    if (this._homeParishName === value) {
      return;
    }
    this._homeParishName = value;
    this.applyHomeParishBindingUpdates();
  }
  get homeParishName(): string | null {
    return this._homeParishName;
  }

  @Input()
  set homeParishAddress(value: string | null) {
    if (this._homeParishAddress === value) {
      return;
    }
    this._homeParishAddress = value;
    this.applyHomeParishBindingUpdates();
  }
  get homeParishAddress(): string | null {
    return this._homeParishAddress;
  }

  @Input()
  set homeParishPriest(value: string | null) {
    if (this._homeParishPriest === value) {
      return;
    }
    this._homeParishPriest = value;
    this.applyHomeParishBindingUpdates();
  }
  get homeParishPriest(): string | null {
    return this._homeParishPriest;
  }

  @Output() close = new EventEmitter<void>();
  @Output() saved = new EventEmitter<FamilyMember>();

  private readonly fb = inject(FormBuilder);
  private readonly familyService = inject(FamilyService);
  private readonly destroy$ = new Subject<void>();

  form!: FormGroup;
  loading = false;
  error: string | null = null;

  get isBaptism(): boolean {
    return this.sacrament === 'baptism';
  }

  get isMarriage(): boolean {
    return this.sacrament === 'marriage';
  }

  get isFirstCommunion(): boolean {
    return this.sacrament === 'first_communion';
  }

  get sacramentDisplayName(): string {
    const normalized = this.sacrament.replace(/_/g, ' ');
    return normalized.replace(/\b\w/g, (char) => char.toUpperCase());
  }

  ngOnInit(): void {
    this.buildForm();
    if (this.isBaptism) {
      this.handleBaptismReactions();
    }
    if (this.isMarriage) {
      this.handleMarriageReactions();
    }
    this.applyHomeParishBindingUpdates();
  }

  ngOnDestroy(): void {
    this.destroy$.next();
    this.destroy$.complete();
  }

  buildForm(): void {
    switch (this.sacrament) {
      case 'baptism':
        const baptismLocation = this.member.baptism_location_type ?? 'home_parish';
        const isHomeParishBaptism = baptismLocation === 'home_parish';
        const initialBaptismChurchName = isHomeParishBaptism
          ? this.resolveHomeParishName(this.member.baptism_church_name ?? null)
          : this.member.baptism_church_name ?? null;
        const initialBaptismChurchAddress = isHomeParishBaptism
          ? this.resolveHomeParishAddress(this.member.baptism_church_address ?? null)
          : this.member.baptism_church_address ?? null;
        this.form = this.fb.group({
          baptism_date: [this.normalizeDate(this.member.baptism_date)],
          baptism_place: [this.member.baptism_place ?? this.resolveHomeParishName(null) ?? null],
          baptism_godparent_primary: [this.member.baptism_godparent_primary ?? null],
          baptism_godparent_secondary: [this.member.baptism_godparent_secondary ?? null],
          baptism_location_type: [this.member.baptism_location_type ?? 'home_parish', Validators.required],
          baptism_church_name: [initialBaptismChurchName],
          baptism_church_address: [initialBaptismChurchAddress],
          baptism_priest_name: [this.member.baptism_priest_name ?? this.resolveHomeParishPriest(null) ?? null],
          baptism_priest_is_home: [this.member.baptism_priest_is_home ?? true]
        });
        this.applyBaptismHomeDefaults();
        break;
      case 'first_communion': {
        const firstCommunionLocation = this.member.first_communion_location_type ?? 'home_parish';
        const isHomeParishFirstCommunion = firstCommunionLocation === 'home_parish';
        const initialFirstCommunionChurchName = isHomeParishFirstCommunion
          ? this.resolveHomeParishName(null)
          : (this.member.first_communion_church_name ?? null);
        const initialFirstCommunionChurchAddress = isHomeParishFirstCommunion
          ? this.resolveHomeParishAddress(null)
          : (this.member.first_communion_church_address ?? null);
        const initialFirstCommunionPlace = isHomeParishFirstCommunion
          ? this.resolveHomeParishName(this.member.first_communion_place ?? null)
          : (this.member.first_communion_place ?? null);
        const initialFirstCommunionPriestIsHome = this.member.first_communion_priest_is_home ?? isHomeParishFirstCommunion;
        const initialFirstCommunionPriestName = initialFirstCommunionPriestIsHome
          ? this.resolveHomeParishPriest(null)
          : (this.member.first_communion_priest_name ?? null);
        this.form = this.fb.group({
          first_communion_date: [this.normalizeDate(this.member.first_communion_date)],
          first_communion_location_type: [firstCommunionLocation, Validators.required],
          first_communion_church_name: [initialFirstCommunionChurchName ?? ''],
          first_communion_church_address: [initialFirstCommunionChurchAddress ?? ''],
          first_communion_priest_is_home: [initialFirstCommunionPriestIsHome],
          first_communion_priest_name: [initialFirstCommunionPriestName ?? ''],
          first_communion_place: [initialFirstCommunionPlace ?? ''],
          first_communion_description: [this.member.first_communion_description ?? null]
        });
        this.applyFirstCommunionHomeDefaults();
        this.handleFirstCommunionReactions();
        break;
      }
      case 'confirmation':
        this.form = this.fb.group({
          confirmation_date: [this.normalizeDate(this.member.confirmation_date)],
          confirmation_place: [this.member.confirmation_place ?? null]
        });
        break;
      case 'marriage':
        this.form = this.fb.group({
          marriage_date: [this.normalizeDate(this.member.marriage_date)],
          marriage_place: [this.member.marriage_place ?? null],
          marriage_spouse_name: [this.member.marriage_spouse_name ?? null],
          marriage_bride_full_name: [this.member.marriage_bride_full_name ?? null],
          marriage_bride_address: [this.member.marriage_bride_address ?? null],
          marriage_bride_church_type: [this.member.marriage_bride_church_type ?? 'home_parish', Validators.required],
          marriage_bride_church_name: [this.member.marriage_bride_church_name ?? this.resolveHomeParishName(null) ?? null],
          marriage_bride_church_address: [this.member.marriage_bride_church_address ?? this.resolveHomeParishAddress(null) ?? null],
          marriage_groom_full_name: [this.member.marriage_groom_full_name ?? null],
          marriage_groom_address: [this.member.marriage_groom_address ?? null],
          marriage_groom_church_type: [this.member.marriage_groom_church_type ?? 'home_parish', Validators.required],
          marriage_groom_church_name: [this.member.marriage_groom_church_name ?? this.resolveHomeParishName(null) ?? null],
          marriage_groom_church_address: [this.member.marriage_groom_church_address ?? this.resolveHomeParishAddress(null) ?? null]
        });
        this.applyMarriageHomeDefaults('marriage_bride');
        this.applyMarriageHomeDefaults('marriage_groom');
        break;
    }
  }

  private applyBaptismHomeDefaults(): void {
    if (!this.isBaptism || !this.form) return;

    const locationType = this.form.get('baptism_location_type');
    const churchName = this.form.get('baptism_church_name');
    const churchAddress = this.form.get('baptism_church_address');
    const priestName = this.form.get('baptism_priest_name');
    const priestIsHome = this.form.get('baptism_priest_is_home');
    const placeControl = this.form.get('baptism_place');

    if (locationType?.value === 'home_parish') {
      const resolvedChurchName = this.resolveHomeParishName(this.member.baptism_church_name ?? null);
      const resolvedChurchAddress = this.resolveHomeParishAddress(this.member.baptism_church_address ?? null);
      const resolvedPlace = this.resolveHomeParishName(this.member.baptism_place ?? null);
      churchName?.setValue(resolvedChurchName);
      churchAddress?.setValue(resolvedChurchAddress);
      placeControl?.setValue(resolvedPlace);
      churchName?.disable({ emitEvent: false });
      churchAddress?.disable({ emitEvent: false });
    } else {
      churchName?.enable({ emitEvent: false });
      churchAddress?.enable({ emitEvent: false });
      if (!this.member.baptism_church_name) {
        churchName?.setValue('', { emitEvent: false });
      }
      if (!this.member.baptism_church_address) {
        churchAddress?.setValue('', { emitEvent: false });
      }
    }

    if (priestIsHome?.value === true) {
      priestName?.setValue(this.resolveHomeParishPriest(this.member.baptism_priest_name ?? null));
      priestName?.disable({ emitEvent: false });
    } else {
      priestName?.enable({ emitEvent: false });
      if (!this.member.baptism_priest_name) {
        priestName?.setValue('', { emitEvent: false });
      }
    }
  }

  private handleBaptismReactions(): void {
    const locationType = this.form.get('baptism_location_type');
    const churchName = this.form.get('baptism_church_name');
    const churchAddress = this.form.get('baptism_church_address');
    const priestIsHome = this.form.get('baptism_priest_is_home');
    const priestName = this.form.get('baptism_priest_name');
    const placeControl = this.form.get('baptism_place');

    locationType?.valueChanges.pipe(takeUntil(this.destroy$)).subscribe((value: 'home_parish' | 'other') => {
      if (value === 'home_parish') {
        const resolvedChurchName = this.resolveHomeParishName(this.member.baptism_church_name ?? null);
        const resolvedChurchAddress = this.resolveHomeParishAddress(this.member.baptism_church_address ?? null);
        const resolvedPlace = this.resolveHomeParishName(this.member.baptism_place ?? null);
        churchName?.disable({ emitEvent: false });
        churchAddress?.disable({ emitEvent: false });
        churchName?.setValue(resolvedChurchName);
        churchAddress?.setValue(resolvedChurchAddress);
        placeControl?.setValue(resolvedPlace);
      } else {
        churchName?.enable({ emitEvent: false });
        churchAddress?.enable({ emitEvent: false });
        if (!this.member.baptism_church_name) {
          churchName?.setValue('');
        }
        if (!this.member.baptism_church_address) {
          churchAddress?.setValue('');
        }
        if (!this.member.baptism_place) {
          placeControl?.setValue('');
        }
      }
    });

    priestIsHome?.valueChanges.pipe(takeUntil(this.destroy$)).subscribe((isHome: boolean) => {
      if (isHome) {
        priestName?.disable({ emitEvent: false });
        priestName?.setValue(this.resolveHomeParishPriest(this.member.baptism_priest_name ?? null));
      } else {
        priestName?.enable({ emitEvent: false });
        if (!this.member.baptism_priest_name) {
          priestName?.setValue('');
        }
      }
    });
  }

  private applyMarriageHomeDefaults(prefix: 'marriage_bride' | 'marriage_groom'): void {
    const typeControl = this.form.get(`${prefix}_church_type`);
    const nameControl = this.form.get(`${prefix}_church_name`);
    const addressControl = this.form.get(`${prefix}_church_address`);

    if (typeControl?.value === 'home_parish') {
      nameControl?.setValue(this.resolveHomeParishName(this.member[`${prefix}_church_name` as keyof FamilyMember] as string | null));
      addressControl?.setValue(this.resolveHomeParishAddress(this.member[`${prefix}_church_address` as keyof FamilyMember] as string | null));
      nameControl?.disable({ emitEvent: false });
      addressControl?.disable({ emitEvent: false });
    } else {
      nameControl?.enable({ emitEvent: false });
      addressControl?.enable({ emitEvent: false });
    }
  }

  private handleMarriageReactions(): void {
    this.configureMarriageChurchAutofill('marriage_bride');
    this.configureMarriageChurchAutofill('marriage_groom');
  }

  private applyFirstCommunionHomeDefaults(): void {
    if (!this.isFirstCommunion || !this.form) return;

    const locationType = this.form.get('first_communion_location_type');
    const churchName = this.form.get('first_communion_church_name');
    const churchAddress = this.form.get('first_communion_church_address');
    const priestName = this.form.get('first_communion_priest_name');
    const priestIsHome = this.form.get('first_communion_priest_is_home');
    const placeControl = this.form.get('first_communion_place');

    if (locationType?.value === 'home_parish') {
      const resolvedChurchName = this.resolveHomeParishName(this.member.first_communion_church_name ?? null);
      const resolvedChurchAddress = this.resolveHomeParishAddress(this.member.first_communion_church_address ?? null);
      const resolvedPlace = this.resolveHomeParishName(this.member.first_communion_place ?? null);
      churchName?.setValue(resolvedChurchName);
      churchAddress?.setValue(resolvedChurchAddress);
      placeControl?.setValue(resolvedPlace);
      churchName?.disable({ emitEvent: false });
      churchAddress?.disable({ emitEvent: false });
    } else {
      churchName?.enable({ emitEvent: false });
      churchAddress?.enable({ emitEvent: false });
    }

    if (priestIsHome?.value === true) {
      const resolvedPriest = this.resolveHomeParishPriest(this.member.first_communion_priest_name ?? null);
      priestName?.setValue(resolvedPriest);
      priestName?.disable({ emitEvent: false });
    } else {
      priestName?.enable({ emitEvent: false });
    }
  }

  private handleFirstCommunionReactions(): void {
    if (!this.isFirstCommunion || !this.form) return;

    const locationType = this.form.get('first_communion_location_type');
    const churchName = this.form.get('first_communion_church_name');
    const churchAddress = this.form.get('first_communion_church_address');
    const priestIsHome = this.form.get('first_communion_priest_is_home');
    const priestName = this.form.get('first_communion_priest_name');
    const placeControl = this.form.get('first_communion_place');

    locationType?.valueChanges.pipe(takeUntil(this.destroy$)).subscribe((value: 'home_parish' | 'other') => {
      if (value === 'home_parish') {
        const resolvedChurchName = this.resolveHomeParishName(this.member.first_communion_church_name ?? null);
        const resolvedChurchAddress = this.resolveHomeParishAddress(this.member.first_communion_church_address ?? null);
        const resolvedPlace = this.resolveHomeParishName(this.member.first_communion_place ?? null);
        churchName?.disable({ emitEvent: false });
        churchAddress?.disable({ emitEvent: false });
        churchName?.setValue(resolvedChurchName);
        churchAddress?.setValue(resolvedChurchAddress);
        placeControl?.setValue(resolvedPlace);
      } else {
        churchName?.enable({ emitEvent: false });
        churchAddress?.enable({ emitEvent: false });
        if (!this.member.first_communion_church_name) {
          churchName?.setValue('');
        }
        if (!this.member.first_communion_church_address) {
          churchAddress?.setValue('');
        }
        if (!this.member.first_communion_place) {
          placeControl?.setValue('');
        }
      }
    });

    priestIsHome?.valueChanges.pipe(takeUntil(this.destroy$)).subscribe((isHome: boolean) => {
      if (isHome) {
        priestName?.disable({ emitEvent: false });
        priestName?.setValue(this.resolveHomeParishPriest(this.member.first_communion_priest_name ?? null));
      } else {
        priestName?.enable({ emitEvent: false });
        if (!this.member.first_communion_priest_name) {
          priestName?.setValue('');
        }
      }
    });
  }

  private configureMarriageChurchAutofill(prefix: 'marriage_bride' | 'marriage_groom'): void {
    const typeControl = this.form.get(`${prefix}_church_type`);
    const nameControl = this.form.get(`${prefix}_church_name`);
    const addressControl = this.form.get(`${prefix}_church_address`);

    typeControl?.valueChanges.pipe(takeUntil(this.destroy$)).subscribe((value: 'home_parish' | 'other') => {
      if (value === 'home_parish') {
        const resolvedName = this.resolveHomeParishName(this.member[`${prefix}_church_name` as keyof FamilyMember] as string | null);
        const resolvedAddress = this.resolveHomeParishAddress(this.member[`${prefix}_church_address` as keyof FamilyMember] as string | null);
        nameControl?.disable({ emitEvent: false });
        addressControl?.disable({ emitEvent: false });
        nameControl?.setValue(resolvedName);
        addressControl?.setValue(resolvedAddress);
      } else {
        nameControl?.enable({ emitEvent: false });
        addressControl?.enable({ emitEvent: false });
        if (!this.member[`${prefix}_church_name` as keyof FamilyMember]) {
          nameControl?.setValue('');
        }
        if (!this.member[`${prefix}_church_address` as keyof FamilyMember]) {
          addressControl?.setValue('');
        }
      }
    });

    if (typeControl?.value === 'home_parish') {
      const resolvedName = this.resolveHomeParishName(this.member[`${prefix}_church_name` as keyof FamilyMember] as string | null);
      const resolvedAddress = this.resolveHomeParishAddress(this.member[`${prefix}_church_address` as keyof FamilyMember] as string | null);
      nameControl?.disable({ emitEvent: false });
      addressControl?.disable({ emitEvent: false });
      nameControl?.setValue(resolvedName);
      addressControl?.setValue(resolvedAddress);
    }
  }
  
  private syncBaptismHomeParishDefaults(): void {
    const locationType = this.form.get('baptism_location_type')?.value;
    if (locationType !== 'home_parish') {
      return;
    }

    const churchName = this.form.get('baptism_church_name');
    const churchAddress = this.form.get('baptism_church_address');
    const placeControl = this.form.get('baptism_place');

    const resolvedChurchName = this.resolveHomeParishName(this.member.baptism_church_name ?? null);
    const resolvedChurchAddress = this.resolveHomeParishAddress(this.member.baptism_church_address ?? null);
    const resolvedPlace = this.resolveHomeParishName(this.member.baptism_place ?? null);

    churchName?.setValue(resolvedChurchName, { emitEvent: false });
    churchAddress?.setValue(resolvedChurchAddress, { emitEvent: false });
    placeControl?.setValue(resolvedPlace, { emitEvent: false });
    churchName?.disable({ emitEvent: false });
    churchAddress?.disable({ emitEvent: false });
  }

  private syncMarriageHomeParishDefaults(prefix: 'marriage_bride' | 'marriage_groom'): void {
    const typeControl = this.form.get(`${prefix}_church_type`);
    if (typeControl?.value !== 'home_parish') {
      return;
    }

    const nameControl = this.form.get(`${prefix}_church_name`);
    const addressControl = this.form.get(`${prefix}_church_address`);

    const resolvedName = this.resolveHomeParishName(this.member[`${prefix}_church_name` as keyof FamilyMember] as string | null);
    const resolvedAddress = this.resolveHomeParishAddress(this.member[`${prefix}_church_address` as keyof FamilyMember] as string | null);

    nameControl?.setValue(resolvedName, { emitEvent: false });
    addressControl?.setValue(resolvedAddress, { emitEvent: false });
    nameControl?.disable({ emitEvent: false });
    addressControl?.disable({ emitEvent: false });
  }

  private applyHomeParishBindingUpdates(): void {
    if (!this.form) {
      return;
    }

    if (this.isBaptism) {
      this.syncBaptismHomeParishDefaults();
    }

    if (this.isFirstCommunion) {
      this.syncFirstCommunionHomeParishDefaults();
    }

    if (this.isMarriage) {
      this.syncMarriageHomeParishDefaults('marriage_bride');
      this.syncMarriageHomeParishDefaults('marriage_groom');
    }
  }

  private syncFirstCommunionHomeParishDefaults(): void {
    const locationType = this.form.get('first_communion_location_type')?.value;
    if (locationType !== 'home_parish') {
      return;
    }

    const churchName = this.form.get('first_communion_church_name');
    const churchAddress = this.form.get('first_communion_church_address');
    const placeControl = this.form.get('first_communion_place');
    const priestName = this.form.get('first_communion_priest_name');
    const priestIsHome = this.form.get('first_communion_priest_is_home');

    const resolvedChurchName = this.resolveHomeParishName(this.member.first_communion_church_name ?? null);
    const resolvedChurchAddress = this.resolveHomeParishAddress(this.member.first_communion_church_address ?? null);
    const resolvedPlace = this.resolveHomeParishName(this.member.first_communion_place ?? null);
    const resolvedPriest = this.resolveHomeParishPriest(this.member.first_communion_priest_name ?? null);

    churchName?.setValue(resolvedChurchName, { emitEvent: false });
    churchAddress?.setValue(resolvedChurchAddress, { emitEvent: false });
    placeControl?.setValue(resolvedPlace, { emitEvent: false });
    churchName?.disable({ emitEvent: false });
    churchAddress?.disable({ emitEvent: false });

    if (priestIsHome?.value) {
      priestName?.setValue(resolvedPriest, { emitEvent: false });
      priestName?.disable({ emitEvent: false });
    }
  }

  copyBrideChurchToGroom(): void {
    const brideType = this.form.get('marriage_bride_church_type')?.value ?? 'home_parish';
    const brideName = this.form.get('marriage_bride_church_name')?.value ?? '';
    const brideAddress = this.form.get('marriage_bride_church_address')?.value ?? '';

    this.form.get('marriage_groom_church_type')?.setValue(brideType);
    this.form.get('marriage_groom_church_name')?.setValue(brideName);
    this.form.get('marriage_groom_church_address')?.setValue(brideAddress);

    if (brideType === 'home_parish') {
      this.form.get('marriage_groom_church_name')?.disable({ emitEvent: false });
      this.form.get('marriage_groom_church_address')?.disable({ emitEvent: false });
    } else {
      this.form.get('marriage_groom_church_name')?.enable({ emitEvent: false });
      this.form.get('marriage_groom_church_address')?.enable({ emitEvent: false });
    }
  }

  private resolveHomeParishName(existing: string | null): string {
    const trimmedHome = typeof this.homeParishName === 'string' ? this.homeParishName.trim() : '';
    if (trimmedHome.length > 0) {
      return trimmedHome;
    }
    if (existing && existing.trim().length > 0) {
      return existing.trim();
    }
    return '';
  }

  private resolveHomeParishAddress(existing: string | null): string {
    const trimmedHome = typeof this.homeParishAddress === 'string' ? this.homeParishAddress.trim() : '';
    if (trimmedHome.length > 0) {
      return trimmedHome;
    }
    if (existing && existing.trim().length > 0) {
      return existing.trim();
    }
    return '';
  }

  private resolveHomeParishPriest(existing: string | null): string {
    const trimmedHome = typeof this.homeParishPriest === 'string' ? this.homeParishPriest.trim() : '';
    if (trimmedHome.length > 0) {
      return trimmedHome;
    }
    if (existing && existing.trim().length > 0) {
      return existing.trim();
    }
    return '';
  }

  cancel(): void {
    this.close.emit();
  }

  save(): void {
    if (!this.form || !this.member || !this.familyId) {
      return;
    }

    if (this.form.invalid) {
      this.form.markAllAsTouched();
      return;
    }

    const payload: Partial<FamilyMember> = this.buildPayload();

    if (!this.validateDependencies(payload)) {
      return;
    }

    if (!payload || Object.keys(payload).length === 0) {
      this.close.emit();
      return;
    }

    this.loading = true;
    this.error = null;

    this.familyService.updateFamilyMember(this.familyId, this.member.id, payload).pipe(takeUntil(this.destroy$)).subscribe({
      next: (response) => {
        const mergedMember = response?.success && response?.data
          ? response.data
          : this.mergeMemberState(payload);
        this.loading = false;
        if (response.success) {
          this.saved.emit(mergedMember);
        } else {
          this.error = response.message || 'Failed to save sacramental details.';
        }
      },
      error: (err) => {
        this.loading = false;
        const message = err?.error?.message || err?.message || 'Failed to save sacramental details.';
        this.error = message;
      }
    });
  }

  private buildPayload(): Partial<FamilyMember> {
    const raw = this.form.getRawValue();
    const normalizeString = (value: any): string | undefined => {
      if (value === null || value === undefined) {
        return undefined;
      }
      const str = String(value).trim();
      return str.length ? str : undefined;
    };

    switch (this.sacrament) {
      case 'baptism':
        const locationType = raw['baptism_location_type'] as 'home_parish' | 'other';
        const placeValue = locationType === 'home_parish'
          ? this.homeParishName ?? normalizeString(raw['baptism_place'])
          : normalizeString(raw['baptism_place']);

        return {
          baptism_date: normalizeString(raw['baptism_date']),
          baptism_place: placeValue,
          baptism_godparent_primary: normalizeString(raw['baptism_godparent_primary']),
          baptism_godparent_secondary: normalizeString(raw['baptism_godparent_secondary']),
          baptism_location_type: locationType,
          baptism_church_name: locationType === 'home_parish'
            ? (this.homeParishName ?? undefined)
            : normalizeString(raw['baptism_church_name']),
          baptism_church_address: locationType === 'home_parish'
            ? (this.homeParishAddress ?? undefined)
            : normalizeString(raw['baptism_church_address']),
          baptism_priest_name: raw['baptism_priest_is_home']
            ? (this.homeParishPriest ?? normalizeString(raw['baptism_priest_name']))
            : normalizeString(raw['baptism_priest_name']),
          baptism_priest_is_home: !!raw['baptism_priest_is_home']
        };

      case 'first_communion': {
        const locationType = raw['first_communion_location_type'] as 'home_parish' | 'other';
        const placeValue = locationType === 'home_parish'
          ? (this.resolveHomeParishName(this.member.first_communion_place ?? null) || normalizeString(raw['first_communion_place']))
          : normalizeString(raw['first_communion_place']);
        const resolvedChurchName = this.resolveHomeParishName(this.member.first_communion_church_name ?? null);
        const resolvedChurchAddress = this.resolveHomeParishAddress(this.member.first_communion_church_address ?? null);
        const resolvedPriest = this.resolveHomeParishPriest(this.member.first_communion_priest_name ?? null);

        return {
          first_communion_date: normalizeString(raw['first_communion_date']),
          first_communion_place: placeValue,
          first_communion_location_type: locationType,
          first_communion_church_name: locationType === 'home_parish'
            ? (resolvedChurchName || undefined)
            : normalizeString(raw['first_communion_church_name']),
          first_communion_church_address: locationType === 'home_parish'
            ? (resolvedChurchAddress || undefined)
            : normalizeString(raw['first_communion_church_address']),
          first_communion_priest_name: raw['first_communion_priest_is_home']
            ? (this.resolveHomeParishPriest(null) || resolvedPriest || normalizeString(raw['first_communion_priest_name']))
            : normalizeString(raw['first_communion_priest_name']),
          first_communion_priest_is_home: !!raw['first_communion_priest_is_home'],
          first_communion_description: normalizeString(raw['first_communion_description'])
        };
      }

      case 'confirmation':
        return {
          confirmation_date: normalizeString(raw['confirmation_date']),
          confirmation_place: normalizeString(raw['confirmation_place'])
        };

      case 'marriage':
        return {
          marriage_date: normalizeString(raw['marriage_date']),
          marriage_place: normalizeString(raw['marriage_place']),
          marriage_spouse_name: normalizeString(raw['marriage_spouse_name']),
          marriage_bride_full_name: normalizeString(raw['marriage_bride_full_name']),
          marriage_bride_address: normalizeString(raw['marriage_bride_address']),
          marriage_bride_church_type: raw['marriage_bride_church_type'] ?? 'home_parish',
          marriage_bride_church_name: raw['marriage_bride_church_type'] === 'home_parish'
            ? (this.homeParishName ?? undefined)
            : normalizeString(raw['marriage_bride_church_name']),
          marriage_bride_church_address: raw['marriage_bride_church_type'] === 'home_parish'
            ? (this.homeParishAddress ?? undefined)
            : normalizeString(raw['marriage_bride_church_address']),
          marriage_groom_full_name: normalizeString(raw['marriage_groom_full_name']),
          marriage_groom_address: normalizeString(raw['marriage_groom_address']),
          marriage_groom_church_type: raw['marriage_groom_church_type'] ?? 'home_parish',
          marriage_groom_church_name: raw['marriage_groom_church_type'] === 'home_parish'
            ? (this.homeParishName ?? undefined)
            : normalizeString(raw['marriage_groom_church_name']),
          marriage_groom_church_address: raw['marriage_groom_church_type'] === 'home_parish'
            ? (this.homeParishAddress ?? undefined)
            : normalizeString(raw['marriage_groom_church_address'])
        };
    }
  }

  private mergeMemberState(payload: Partial<FamilyMember>): FamilyMember {
    return {
      ...this.member,
      ...payload
    };
  }

  private hasValue(value: unknown): boolean {
    if (value instanceof Date) {
      return true;
    }
    if (typeof value === 'string') {
      return value.trim().length > 0;
    }
    return value !== undefined && value !== null && value !== '';
  }

  private validateDependencies(payload: Partial<FamilyMember>): boolean {
    const merged = this.mergeMemberState(payload);

    const hasBaptism = this.hasValue(merged.baptism_date);
    const hasConfirmation = this.hasValue(merged.confirmation_date);
    const hasFirstCommunion = this.hasValue(merged.first_communion_date);

    if ((this.sacrament === 'confirmation' || this.sacrament === 'first_communion' || this.sacrament === 'marriage') && !hasBaptism) {
      this.error = 'Please record the member\'s baptism before adding this sacrament.';
      this.loading = false;
      return false;
    }

    if (this.sacrament === 'confirmation' && !hasFirstCommunion) {
      this.error = 'First Communion must be recorded before Confirmation.';
      this.loading = false;
      return false;
    }

    return true;
  }

  private normalizeDate(value: string | null | undefined): string | null {
    if (!value) {
      return null;
    }

    const trimmed = String(value).trim();
    if (!trimmed) {
      return null;
    }

    // Handle ISO strings with time component (e.g., 2025-01-01T00:00:00Z)
    if (trimmed.includes('T')) {
      return trimmed.split('T')[0] || null;
    }

    // Handle date-time strings with space separator (e.g., 2025-01-01 00:00:00)
    if (trimmed.includes(' ')) {
      return trimmed.split(' ')[0] || null;
    }

    // Already in date-only format
    return trimmed;
  }
}

