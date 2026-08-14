import { CommonModule } from '@angular/common';
import {
  ChangeDetectionStrategy,
  ChangeDetectorRef,
  Component,
  EventEmitter,
  Input,
  OnChanges,
  OnDestroy,
  Output,
  SimpleChanges,
  inject,
} from '@angular/core';
import { FormsModule } from '@angular/forms';
import { Subject, debounceTime, distinctUntilChanged, of, switchMap, takeUntil } from 'rxjs';
import { FamilyMember } from '@core/models/family.model';
import { MemberService } from '@features/members/services/member.service';
import {
  ParticipantSourceKind,
  SacramentParticipantDraft,
} from '../../../models/sacrament-definition.model';

@Component({
  selector: 'app-participant-source-control',
  standalone: true,
  imports: [CommonModule, FormsModule],
  templateUrl: './participant-source-control.component.html',
  styleUrl: './participant-source-control.component.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class ParticipantSourceControlComponent implements OnChanges, OnDestroy {
  private readonly destroy$ = new Subject<void>();
  private readonly search$ = new Subject<string>();
  private readonly members = inject(MemberService);
  private readonly cdr = inject(ChangeDetectorRef);

  @Input() label = 'Person';
  @Input() role = 'recipient';
  /** Unique suffix for input ids when the same role is repeated (e.g. witnesses). */
  @Input() controlId = '';
  /** Allowed sources from definition (member / external). */
  @Input() allowedSources: string[] = ['member', 'external'];
  @Input() value: SacramentParticipantDraft | null = null;
  /** When true, date of birth and gender are required (Marriage bride/groom). */
  @Input() requireIdentityFields = false;
  /** Marriage witnesses do not collect date of birth. */
  @Input() showDateOfBirth = true;
  @Input() requireGender = false;
  @Input() requireAddress = false;
  @Input() requireContactNumber = false;
  @Output() valueChange = new EventEmitter<SacramentParticipantDraft>();

  source: ParticipantSourceKind = 'external';
  query = '';
  results: FamilyMember[] = [];
  searching = false;
  showResults = false;
  selectedMember: FamilyMember | null = null;

  externalName = '';
  externalDob = '';
  externalGender: '' | 'male' | 'female' | 'other' = '';
  externalAddress = '';
  externalContactNumber = '';
  activeIndex = -1;

  get activeDescendantId(): string | null {
    if (this.activeIndex < 0 || !this.results[this.activeIndex]) {
      return null;
    }
    return `member_opt_${this.fieldId}_${this.activeIndex}`;
  }

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
            this.cdr.markForCheck();
            return of(null);
          }
          this.searching = true;
          this.cdr.markForCheck();
          return this.members.getMembers({ search, status: 'active', per_page: 12 });
        }),
        takeUntil(this.destroy$)
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
          this.results = [];
          this.cdr.markForCheck();
        },
      });
  }

  ngOnChanges(changes: SimpleChanges): void {
    if (changes['value'] && this.value) {
      this.source = this.value.source === 'member' ? 'member' : 'external';
      this.externalName = this.value.external_full_name || '';
      this.externalDob = this.value.external_date_of_birth || '';
      this.externalGender = (this.value.external_gender as typeof this.externalGender) || '';
      this.externalAddress = this.value.external_address || '';
      this.externalContactNumber = this.value.external_contact_number || '';
      if (this.value.source === 'member' && this.value.display_name) {
        this.selectedMember = {
          id: this.value.family_member_id || '',
          family_id: '',
          first_name: this.value.display_name,
          last_name: '',
          full_name: this.value.display_name,
        } as FamilyMember;
      }
    }
    if (changes['allowedSources'] && this.allowedSources.length) {
      if (!this.allowedSources.includes(this.source)) {
        this.source = this.allowedSources.includes('member') ? 'member' : 'external';
      }
    }
  }

  ngOnDestroy(): void {
    this.destroy$.next();
    this.destroy$.complete();
  }

  get canUseMember(): boolean {
    return this.allowedSources.includes('member');
  }

  get canUseExternal(): boolean {
    return this.allowedSources.includes('external');
  }

  get fieldId(): string {
    return this.controlId || this.role;
  }

  get showSourceToggle(): boolean {
    return this.canUseMember && this.canUseExternal;
  }

  get genderRequired(): boolean {
    return this.requireIdentityFields || this.requireGender;
  }

  onSourceChange(next: ParticipantSourceKind): void {
    this.source = next;
    if (next === 'external') {
      this.selectedMember = null;
      this.query = '';
      this.results = [];
    }
    this.emit();
  }

  onQueryInput(): void {
    this.activeIndex = -1;
    this.search$.next(this.query);
  }

  onSearchBlur(): void {
    setTimeout(() => {
      this.showResults = false;
      this.activeIndex = -1;
      this.cdr.markForCheck();
    }, 150);
  }

  onSearchKeydown(event: KeyboardEvent): void {
    if (!this.showResults || !this.results.length) {
      if (event.key === 'Escape') {
        this.showResults = false;
      }
      return;
    }
    if (event.key === 'ArrowDown') {
      event.preventDefault();
      this.activeIndex = Math.min(this.activeIndex + 1, this.results.length - 1);
      this.cdr.markForCheck();
    } else if (event.key === 'ArrowUp') {
      event.preventDefault();
      this.activeIndex = Math.max(this.activeIndex - 1, 0);
      this.cdr.markForCheck();
    } else if (event.key === 'Enter' && this.activeIndex >= 0) {
      event.preventDefault();
      this.selectMember(this.results[this.activeIndex]);
    } else if (event.key === 'Escape') {
      event.preventDefault();
      this.showResults = false;
      this.activeIndex = -1;
      this.cdr.markForCheck();
    }
  }

  selectMember(member: FamilyMember): void {
    this.selectedMember = member;
    this.externalDob = member.date_of_birth || '';
    this.externalGender = (member.gender as typeof this.externalGender) || '';
    this.query = '';
    this.results = [];
    this.showResults = false;
    this.activeIndex = -1;
    this.emit();
  }

  clearMember(): void {
    this.selectedMember = null;
    this.emit();
  }

  onExternalChange(): void {
    this.emit();
  }

  memberDisplayName(member: FamilyMember): string {
    return member.full_name
      || [member.first_name, member.middle_name, member.last_name].filter(Boolean).join(' ');
  }

  private emit(): void {
    const draft: SacramentParticipantDraft = {
      role: this.role,
      source: this.source,
      sort_order: 0,
    };

    if (this.source === 'member' && this.selectedMember) {
      draft.family_member_id = this.selectedMember.id;
      draft.display_name = this.memberDisplayName(this.selectedMember);
      if (this.showDateOfBirth) {
        draft.external_date_of_birth = this.externalDob || this.selectedMember.date_of_birth || undefined;
      }
      draft.external_gender = (this.externalGender
        || this.selectedMember.gender
        || undefined) as SacramentParticipantDraft['external_gender'];
    } else {
      draft.external_full_name = this.externalName.trim();
      draft.display_name = draft.external_full_name;
      if (this.showDateOfBirth) {
        draft.external_date_of_birth = this.externalDob || undefined;
      }
      draft.external_gender = this.externalGender || undefined;
      if (this.requireAddress || this.externalAddress.trim()) {
        draft.external_address = this.externalAddress.trim() || undefined;
      }
      if (this.requireContactNumber || this.externalContactNumber.trim()) {
        draft.external_contact_number = this.externalContactNumber.trim() || undefined;
      }
    }

    this.valueChange.emit(draft);
  }
}
