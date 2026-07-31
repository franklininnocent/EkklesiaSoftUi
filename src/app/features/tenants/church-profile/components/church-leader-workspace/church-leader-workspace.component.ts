import { CommonModule } from '@angular/common';
import {
  ChangeDetectionStrategy,
  ChangeDetectorRef,
  Component,
  EventEmitter,
  HostListener,
  Input,
  OnChanges,
  Output,
  SimpleChanges,
  inject
} from '@angular/core';
import { AbstractControl, FormBuilder, FormGroup, ReactiveFormsModule, ValidationErrors, Validators } from '@angular/forms';
import { NgSelectModule } from '@ng-select/ng-select';
import { of } from 'rxjs';
import { catchError, map, switchMap } from 'rxjs/operators';
import { ChurchLeadership, CreateChurchLeadershipRequest } from '@core/models/church';
import { ChurchLeadershipService } from '@core/services/church/church-leadership.service';
import { ToastService } from '@core/services/toast.service';
import { PhoneInputComponent } from '@shared/components/phone-input/phone-input.component';
import { ChurchLeaderRoleSelectorComponent } from '../church-leader-role-selector/church-leader-role-selector.component';
import {
  findLeadershipRole,
  LEADERSHIP_STATUS_OPTIONS,
  LEADERSHIP_TITLE_OPTIONS,
  LeadershipStatusOption
} from './church-leader-role.config';

@Component({
  selector: 'app-church-leader-workspace',
  standalone: true,
  imports: [CommonModule, ReactiveFormsModule, NgSelectModule, PhoneInputComponent, ChurchLeaderRoleSelectorComponent],
  templateUrl: './church-leader-workspace.component.html',
  styleUrl: './church-leader-workspace.component.scss',
  changeDetection: ChangeDetectionStrategy.OnPush
})
export class ChurchLeaderWorkspaceComponent implements OnChanges {
  private readonly fb = inject(FormBuilder);
  private readonly leadershipService = inject(ChurchLeadershipService);
  private readonly toast = inject(ToastService);
  private readonly cdr = inject(ChangeDetectorRef);

  @Input() open = false;
  @Input() leader: ChurchLeadership | null = null;
  @Input() canManage = true;

  @Output() closed = new EventEmitter<void>();
  @Output() saved = new EventEmitter<ChurchLeadership>();

  readonly titleOptions = LEADERSHIP_TITLE_OPTIONS;
  readonly statusOptions = LEADERSHIP_STATUS_OPTIONS;

  form: FormGroup = this.buildForm();
  saving = false;
  photoPreview: string | null = null;
  photoFile: File | null = null;
  dragOver = false;
  private photoRemoved = false;

  private readonly draftKey = 'church-leader-draft';

  private workspaceLeader: ChurchLeadership | null = null;

  ngOnChanges(changes: SimpleChanges): void {
    if (changes['open']?.currentValue) {
      this.workspaceLeader = this.leader;
      this.resetFormForMode();
    }
    if (changes['leader'] && this.open) {
      this.workspaceLeader = this.leader;
      this.resetFormForMode();
    }
  }

  get isEditMode(): boolean {
    return !!this.workspaceLeader;
  }

  get pageTitle(): string {
    return this.isEditMode ? 'Edit Church Leader' : 'Add Church Leader';
  }

  get displayName(): string {
    const title = this.form.get('title')?.value;
    const name = this.form.get('full_name')?.value;
    if (!name) {
      return 'New Leader Profile';
    }
    return `${title ? `${title} ` : ''}${name}`.trim();
  }

  get selectedRoleLabel(): string {
    return findLeadershipRole(this.form.get('role')?.value)?.label || this.form.get('role')?.value || 'Role not selected';
  }

  get selectedStatus(): LeadershipStatusOption | undefined {
    const id = this.form.get('leadership_status')?.value;
    return this.statusOptions.find((option) => option.id === id);
  }

  get hasDraftContent(): boolean {
    return this.hasMeaningfulLeaderData(this.form.getRawValue(), this.photoPreview);
  }

  get checklist() {
    return [
      { label: 'Name Entered', done: !!this.form.get('full_name')?.value?.trim() },
      { label: 'Role Selected', done: !!this.form.get('role')?.value },
      { label: 'Appointment Date Selected', done: !!this.form.get('appointed_date')?.value },
      { label: 'Contact Information Added', done: !!(this.form.get('email')?.value || this.form.get('phone')?.value || this.form.get('whatsapp_number')?.value) },
      { label: 'Biography Added', done: !!this.form.get('biography')?.value?.trim() }
    ];
  }

  get completionPct(): number {
    const done = this.checklist.filter((item) => item.done).length;
    return Math.round((done / this.checklist.length) * 100);
  }

  get emailValid(): boolean {
    const control = this.form.get('email');
    return !!control?.value && control.valid;
  }

  get showRelievedDate(): boolean {
    const status = this.form.get('leadership_status')?.value;
    return status !== 'active' && status !== 'on_leave';
  }

  get saveButtonLabel(): string {
    if (this.saving) {
      return 'Saving…';
    }
    return this.isEditMode ? 'Save Changes' : 'Save Leader';
  }

  get missingRequiredFields(): string[] {
    const missing: string[] = [];
    const fullName = this.form.get('full_name')?.value?.trim();
    const role = this.form.get('role')?.value;
    const appointedDate = this.form.get('appointed_date')?.value;

    if (!fullName) {
      missing.push('Full Name');
    }
    if (!role) {
      missing.push('Leadership Role');
    }
    if (!appointedDate) {
      missing.push('Appointed Date');
    }

    const emailControl = this.form.get('email');
    if (emailControl?.value?.trim() && emailControl.invalid) {
      missing.push('Valid Email Address');
    }

    return missing;
  }

  get showValidationBanner(): boolean {
    return this.form.touched && this.missingRequiredFields.length > 0;
  }

  @HostListener('document:keydown.escape')
  onEscape(): void {
    if (this.open && !this.saving) {
      this.requestClose();
    }
  }

  selectStatus(statusId: string): void {
    const status = this.statusOptions.find((option) => option.id === statusId);
    if (!status) {
      return;
    }
    this.form.patchValue({
      leadership_status: statusId,
      active: status.active
    });
    this.cdr.markForCheck();
  }

  setAppointedDatePreset(preset: 'today' | 'month_start' | 'custom'): void {
    if (preset === 'custom') {
      return;
    }
    const date = new Date();
    if (preset === 'month_start') {
      date.setDate(1);
    }
    this.form.patchValue({ appointed_date: this.toInputDate(date.toISOString()) });
    this.cdr.markForCheck();
  }

  onPhotoSelected(event: Event): void {
    const input = event.target as HTMLInputElement;
    const file = input.files?.[0];
    if (file) {
      this.applyPhotoFile(file);
    }
  }

  onPhotoDrop(event: DragEvent): void {
    event.preventDefault();
    this.dragOver = false;
    const file = event.dataTransfer?.files?.[0];
    if (file?.type.startsWith('image/')) {
      this.applyPhotoFile(file);
    }
  }

  onDragOver(event: DragEvent): void {
    event.preventDefault();
    this.dragOver = true;
  }

  onDragLeave(): void {
    this.dragOver = false;
  }

  removePhoto(): void {
    this.photoFile = null;
    this.photoPreview = null;
    this.photoRemoved = true;
    this.form.patchValue({ photo_url: '' });
    this.cdr.markForCheck();
  }

  saveDraft(): void {
    if (!this.hasDraftContent) {
      this.toast.warning('Enter leadership details before saving a draft.', 'Nothing to Save');
      return;
    }
    const payload = { ...this.form.getRawValue(), photoPreview: this.photoPreview };
    localStorage.setItem(this.draftKey, JSON.stringify(payload));
    this.toast.success(
      'Draft saved on this device only. Click Save Leader to add them to the directory.',
      'Draft Saved Locally'
    );
  }

  submit(): void {
    if (!this.canManage) {
      this.toast.warning('You do not have permission to manage leaders.', 'Permission Denied');
      return;
    }
    if (this.form.invalid || this.missingRequiredFields.length > 0) {
      this.form.markAllAsTouched();
      const fields = this.missingRequiredFields.join(', ');
      this.toast.warning(
        fields
          ? `Complete required fields: ${fields}.`
          : 'Complete required leadership fields before saving.',
        'Incomplete Profile'
      );
      this.cdr.markForCheck();
      return;
    }

    const payload = this.buildPayload();
    this.saving = true;
    this.cdr.markForCheck();

    const saveRequest = this.isEditMode && this.workspaceLeader
      ? this.leadershipService.updateLeader(this.workspaceLeader.id, payload)
      : this.leadershipService.createLeader(payload);

    saveRequest.pipe(
      switchMap((response) => {
        if (!response.success || !this.photoFile) {
          return of(response);
        }

        return this.leadershipService.uploadLeaderPhoto(response.data.id, this.photoFile).pipe(
          map((uploadResponse) => (uploadResponse.success ? { ...response, data: uploadResponse.data } : response)),
          catchError(() => {
            this.toast.warning('Leader saved, but the profile photo could not be uploaded.', 'Photo Upload');
            return of(response);
          })
        );
      })
    ).subscribe({
      next: (response) => {
        this.saving = false;
        if (response.success) {
          localStorage.removeItem(this.draftKey);
          if (this.isEditMode) {
            this.toast.success('Leader profile updated successfully.', 'Profile Updated');
          } else {
            this.toast.success(
              `${response.data.full_name} has been added to Church Leadership.`,
              'Leader Saved'
            );
          }
          this.saved.emit(response.data);
          this.closed.emit();
        }
        this.cdr.markForCheck();
      },
      error: (err) => {
        this.saving = false;
        this.toast.error(err.message || 'Failed to save leader profile.', 'Save Failed');
        this.cdr.markForCheck();
      }
    });
  }

  requestClose(): void {
    if (this.saving) {
      return;
    }
    this.closed.emit();
  }

  formatDisplayDate(value?: string | null): string {
    if (!value) {
      return 'Not set';
    }
    try {
      return new Intl.DateTimeFormat(undefined, { year: 'numeric', month: 'short', day: 'numeric' }).format(new Date(value));
    } catch {
      return value;
    }
  }

  insertBiographyToken(token: 'bullet' | 'paragraph'): void {
    const control = this.form.get('biography');
    const current = (control?.value as string) || '';
    const addition = token === 'bullet' ? '\n• ' : '\n\n';
    control?.setValue(`${current}${addition}`);
    this.cdr.markForCheck();
  }

  private buildForm(): FormGroup {
    return this.fb.group({
      full_name: ['', [Validators.required, Validators.maxLength(255)]],
      role: ['', [Validators.required, Validators.maxLength(100)]],
      title: ['', Validators.maxLength(100)],
      email: ['', [Validators.maxLength(255), optionalEmailValidator]],
      phone: ['', [Validators.maxLength(15), Validators.pattern(/^[0-9]*$/)]],
      whatsapp_number: ['', [Validators.maxLength(15), Validators.pattern(/^[0-9]*$/)]],
      alternate_contact: ['', Validators.maxLength(255)],
      appointed_date: ['', Validators.required],
      relieved_date: [''],
      leadership_status: ['active'],
      biography: ['', Validators.maxLength(2000)],
      photo_url: [''],
      is_primary: [0],
      active: [1],
      display_order: [0]
    });
  }

  private resetFormForMode(): void {
    this.photoFile = null;
    this.photoPreview = null;
    this.photoRemoved = false;
    this.form.reset({
      leadership_status: 'active',
      is_primary: 0,
      active: 1,
      display_order: 0
    });

    if (this.workspaceLeader) {
      this.form.patchValue({
        ...this.workspaceLeader,
        appointed_date: this.toInputDate(this.workspaceLeader.appointed_date),
        relieved_date: this.toInputDate(this.workspaceLeader.relieved_date),
        leadership_status: this.resolveStatusId(this.workspaceLeader)
      });
      if (this.workspaceLeader.photo_url) {
        this.photoPreview = this.leadershipService.resolveLeaderPhotoUrl(this.workspaceLeader.photo_url);
      }
    } else {
      const draft = this.readDraft();
      if (draft) {
        const { photoPreview, ...formDraft } = draft;
        this.form.patchValue(formDraft);
        this.photoPreview = typeof photoPreview === 'string' ? photoPreview : null;
      }
    }

    this.cdr.markForCheck();
  }

  private buildPayload(): CreateChurchLeadershipRequest {
    const raw = this.form.getRawValue();
    const status = this.statusOptions.find((option) => option.id === raw.leadership_status);
    let biography = (raw.biography || '').trim();
    const extras: string[] = [];
    if (raw.whatsapp_number) {
      extras.push(`WhatsApp: ${raw.whatsapp_number}`);
    }
    if (raw.alternate_contact) {
      extras.push(`Alternate contact: ${raw.alternate_contact}`);
    }
    if (extras.length) {
      biography = biography ? `${biography}\n\n${extras.join('\n')}` : extras.join('\n');
    }

    return {
      full_name: raw.full_name?.trim(),
      role: raw.role,
      title: raw.title || undefined,
      email: raw.email || undefined,
      phone: raw.phone || raw.whatsapp_number || undefined,
      appointed_date: raw.appointed_date || undefined,
      relieved_date: raw.relieved_date || undefined,
      biography: biography || undefined,
      photo_url: this.photoFile
        ? undefined
        : this.photoRemoved
          ? ''
          : raw.photo_url || undefined,
      is_primary: raw.is_primary ? 1 : 0,
      active: status?.active ?? (raw.relieved_date ? 0 : 1),
      display_order: raw.display_order ?? 0
    };
  }

  private resolveStatusId(leader: ChurchLeadership): string {
    if (leader.active === 1) {
      return 'active';
    }
    if (leader.relieved_date) {
      return 'former';
    }
    return 'retired';
  }

  private applyPhotoFile(file: File): void {
    if (file.size > 2 * 1024 * 1024) {
      this.toast.warning('Please choose an image under 2 MB.', 'Image Too Large');
      return;
    }
    this.photoFile = file;
    this.photoRemoved = false;
    const reader = new FileReader();
    reader.onload = () => {
      this.photoPreview = reader.result as string;
      this.cdr.markForCheck();
    };
    reader.readAsDataURL(file);
  }

  private readDraft(): Record<string, unknown> | null {
    try {
      const raw = localStorage.getItem(this.draftKey);
      if (!raw) {
        return null;
      }
      const parsed = JSON.parse(raw) as Record<string, unknown>;
      const photoPreview = typeof parsed['photoPreview'] === 'string' ? parsed['photoPreview'] : null;
      if (!this.hasMeaningfulLeaderData(parsed, photoPreview)) {
        localStorage.removeItem(this.draftKey);
        return null;
      }
      return parsed;
    } catch {
      localStorage.removeItem(this.draftKey);
      return null;
    }
  }

  private hasMeaningfulLeaderData(data: Record<string, unknown>, photoPreview?: string | null): boolean {
    const fields = [
      'full_name',
      'role',
      'title',
      'email',
      'phone',
      'whatsapp_number',
      'alternate_contact',
      'appointed_date',
      'relieved_date',
      'biography'
    ];
    const hasText = fields.some((key) => {
      const value = data[key];
      return typeof value === 'string' && value.trim().length > 0;
    });
    return hasText || !!photoPreview || data['is_primary'] === 1;
  }

  private toInputDate(value?: string | null): string {
    if (!value) {
      return '';
    }
    return value.split('T')[0];
  }
}

function optionalEmailValidator(control: AbstractControl): ValidationErrors | null {
  const value = (control.value ?? '').toString().trim();
  if (!value) {
    return null;
  }
  return Validators.email(control);
}
