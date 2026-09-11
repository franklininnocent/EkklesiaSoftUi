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
import {
  MEDIA_IMAGE_ACCEPT,
  MEDIA_IMAGE_MAX_BYTES_DEFAULT,
  validateMediaImageFile,
} from '@core/utils/media-url.util';

@Component({
  selector: 'app-cf-media-upload',
  standalone: true,
  imports: [CommonModule],
  templateUrl: './cf-media-upload.component.html',
  styleUrl: './cf-media-upload.component.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class CfMediaUploadComponent implements OnChanges {
  @Input() label = 'Photo';
  @Input() hint = 'JPG, PNG, or WebP up to 3 MB.';
  @Input() accept = MEDIA_IMAGE_ACCEPT;
  @Input() maxBytes = MEDIA_IMAGE_MAX_BYTES_DEFAULT;
  @Input() disabled = false;
  @Input() uploading = false;
  @Input() canManage = true;
  @Input() previewUrl: string | null = null;
  @Input() previewClickable = false;
  @Input() inputId = 'cf-media-upload-input';

  @Output() fileSelected = new EventEmitter<File>();
  @Output() removeRequested = new EventEmitter<void>();
  @Output() validationError = new EventEmitter<string>();
  @Output() previewClick = new EventEmitter<void>();

  localPreviewUrl: string | null = null;
  validationMessage: string | null = null;

  constructor(private readonly cdr: ChangeDetectorRef) {}

  ngOnChanges(changes: SimpleChanges): void {
    if (changes['previewUrl'] && !this.localPreviewUrl) {
      this.cdr.markForCheck();
    }
  }

  get displayUrl(): string | null {
    return this.localPreviewUrl ?? this.previewUrl;
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

    const message = validateMediaImageFile(file, this.maxBytes);
    if (message) {
      this.validationMessage = message;
      this.validationError.emit(message);
      this.cdr.markForCheck();
      return;
    }

    this.validationMessage = null;
    if (this.localPreviewUrl?.startsWith('blob:')) {
      URL.revokeObjectURL(this.localPreviewUrl);
    }
    this.localPreviewUrl = URL.createObjectURL(file);
    this.fileSelected.emit(file);
    this.cdr.markForCheck();
  }

  onRemove(): void {
    if (!this.canManage || this.disabled || this.uploading) {
      return;
    }

    if (this.localPreviewUrl?.startsWith('blob:')) {
      URL.revokeObjectURL(this.localPreviewUrl);
    }
    this.localPreviewUrl = null;
    this.removeRequested.emit();
    this.cdr.markForCheck();
  }

  clearLocalPreview(): void {
    if (this.localPreviewUrl?.startsWith('blob:')) {
      URL.revokeObjectURL(this.localPreviewUrl);
    }
    this.localPreviewUrl = null;
    this.cdr.markForCheck();
  }
}
