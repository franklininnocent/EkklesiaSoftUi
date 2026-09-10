import {
  ChangeDetectionStrategy,
  ChangeDetectorRef,
  Component,
  EventEmitter,
  Input,
  OnChanges,
  Output,
  SimpleChanges,
} from '@angular/core';
import { CommonModule } from '@angular/common';
import { BishopPhotoSource, validateBishopPhotoFile } from '@core/utils/bishop-photo.util';
import { BishopAvatarComponent } from '../bishop-avatar/bishop-avatar.component';

export interface BishopPhotoControlState {
  pendingFile: File | null;
  removeExisting: boolean;
  previewUrl: string | null;
}

@Component({
  selector: 'app-bishop-photo-control',
  standalone: true,
  imports: [CommonModule, BishopAvatarComponent],
  templateUrl: './bishop-photo-control.component.html',
  styleUrl: './bishop-photo-control.component.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class BishopPhotoControlComponent implements OnChanges {
  @Input() name = '';
  @Input() source: BishopPhotoSource | null = null;
  @Input() disabled = false;
  @Input() uploading = false;
  @Input() canManage = true;

  @Output() stateChange = new EventEmitter<BishopPhotoControlState>();
  @Output() error = new EventEmitter<string>();

  pendingFile: File | null = null;
  removeExisting = false;
  previewUrl: string | null = null;
  validationError: string | null = null;

  constructor(private readonly cdr: ChangeDetectorRef) {}

  ngOnChanges(changes: SimpleChanges): void {
    if (changes['source'] && !this.pendingFile) {
      this.previewUrl = null;
      this.removeExisting = false;
      this.emitState();
    }
  }

  onFileSelected(event: Event): void {
    if (!this.canManage || this.disabled || this.uploading) {
      return;
    }

    const input = event.target as HTMLInputElement;
    const file = input.files?.[0];
    input.value = '';

    if (!file) {
      return;
    }

    const validationMessage = validateBishopPhotoFile(file);
    if (validationMessage) {
      this.validationError = validationMessage;
      this.error.emit(validationMessage);
      this.cdr.markForCheck();
      return;
    }

    this.validationError = null;
    this.pendingFile = file;
    this.removeExisting = false;

    if (this.previewUrl?.startsWith('blob:')) {
      URL.revokeObjectURL(this.previewUrl);
    }
    this.previewUrl = URL.createObjectURL(file);
    this.emitState();
    this.cdr.markForCheck();
  }

  removePhoto(): void {
    if (!this.canManage || this.disabled || this.uploading) {
      return;
    }

    if (this.previewUrl?.startsWith('blob:')) {
      URL.revokeObjectURL(this.previewUrl);
    }

    this.pendingFile = null;
    this.previewUrl = null;
    this.removeExisting = true;
    this.validationError = null;
    this.emitState();
    this.cdr.markForCheck();
  }

  reset(): void {
    if (this.previewUrl?.startsWith('blob:')) {
      URL.revokeObjectURL(this.previewUrl);
    }

    this.pendingFile = null;
    this.previewUrl = null;
    this.removeExisting = false;
    this.validationError = null;
    this.emitState();
    this.cdr.markForCheck();
  }

  get displaySource(): BishopPhotoSource | null {
    if (this.removeExisting) {
      return null;
    }

    if (this.previewUrl) {
      return { photo_public_url: this.previewUrl, has_photo: true };
    }

    return this.source;
  }

  get hasDisplayPhoto(): boolean {
    return !!this.displaySource && !this.removeExisting;
  }

  private emitState(): void {
    this.stateChange.emit({
      pendingFile: this.pendingFile,
      removeExisting: this.removeExisting,
      previewUrl: this.previewUrl,
    });
  }
}
