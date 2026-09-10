import { ChangeDetectionStrategy, Component, Input } from '@angular/core';
import { CommonModule } from '@angular/common';
import {
  BishopPhotoSource,
  getBishopInitials,
  hasBishopPhoto,
  resolveBishopPhotoUrl,
} from '@core/utils/bishop-photo.util';

export type BishopAvatarSize = 'sm' | 'md' | 'lg' | 'xl';

@Component({
  selector: 'app-bishop-avatar',
  standalone: true,
  imports: [CommonModule],
  templateUrl: './bishop-avatar.component.html',
  styleUrl: './bishop-avatar.component.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class BishopAvatarComponent {
  @Input({ required: true }) name = '';
  @Input() source: BishopPhotoSource | null = null;
  @Input() size: BishopAvatarSize = 'md';
  @Input() alt?: string;

  get photoUrl(): string | null {
    return resolveBishopPhotoUrl(this.source);
  }

  get showPhoto(): boolean {
    return hasBishopPhoto(this.source);
  }

  get initials(): string {
    return getBishopInitials(this.name);
  }

  get imageAlt(): string {
    return this.alt || this.name || 'Bishop photo';
  }
}
