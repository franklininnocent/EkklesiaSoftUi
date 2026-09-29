import { CommonModule } from '@angular/common';
import {
  ChangeDetectionStrategy,
  Component,
  EventEmitter,
  Input,
  Output,
} from '@angular/core';
import {
  getUserAvatarColorClass,
  getUserInitials,
  resolveUserProfileImageUrl,
} from '@core/utils/user-profile-image.util';

@Component({
  selector: 'app-user-avatar',
  standalone: true,
  imports: [CommonModule],
  templateUrl: './user-avatar.component.html',
  styleUrl: './user-avatar.component.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class UserAvatarComponent {
  @Input({ required: true }) name = '';
  @Input() imageUrl: string | null = null;
  @Input() size: 'sm' | 'md' | 'lg' = 'sm';
  @Input() clickable = true;

  @Output() photoClick = new EventEmitter<Event>();

  imageBroken = false;

  get displayUrl(): string | null {
    if (this.imageBroken) {
      return null;
    }

    return this.imageUrl || null;
  }

  get initials(): string {
    return getUserInitials(this.name);
  }

  get colorClass(): string {
    return getUserAvatarColorClass(this.name);
  }

  get ariaLabel(): string {
    return this.displayUrl ? `View photo of ${this.name}` : '';
  }

  onImageError(): void {
    this.imageBroken = true;
  }

  onPhotoClick(event: Event): void {
    if (!this.displayUrl || !this.clickable) {
      return;
    }

    event.stopPropagation();
    event.preventDefault();
    this.photoClick.emit(event);
  }

  /** Resolve URL from a user-like object. */
  static resolveUrl(source?: { profile_image_full_url?: string | null } | null): string | null {
    return resolveUserProfileImageUrl(source);
  }
}
