import { CommonModule } from '@angular/common';
import {
  ChangeDetectionStrategy,
  Component,
  EventEmitter,
  Input,
  Output,
} from '@angular/core';
import { BCC } from '../../../../core/models/family.model';
import { ModalShellComponent } from '@shared/components/modal-shell/modal-shell.component';
import { StatusBadgeComponent, StatusBadgeTone } from '@shared/components/status-badge/status-badge.component';

@Component({
  selector: 'app-bcc-detail-modal',
  standalone: true,
  imports: [CommonModule, ModalShellComponent, StatusBadgeComponent],
  templateUrl: './bcc-detail-modal.component.html',
  styleUrl: './bcc-detail-modal.component.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class BccDetailModalComponent {
  @Input() bcc: BCC | null = null;
  @Input() loading = false;

  @Output() close = new EventEmitter<void>();
  @Output() edit = new EventEmitter<BCC>();

  get title(): string {
    return this.bcc?.name?.trim() || 'BCC details';
  }

  familyCount(): number {
    if (!this.bcc) {
      return 0;
    }
    return this.bcc.current_family_count ?? this.bcc.families_count ?? 0;
  }

  familyCountLabel(): string {
    const count = this.familyCount();
    return count === 1 ? '1 family' : `${count} families`;
  }

  statusTone(status: string | undefined): StatusBadgeTone {
    switch (status) {
      case 'active':
        return 'success';
      case 'suspended':
        return 'warning';
      case 'inactive':
      default:
        return 'neutral';
    }
  }

  statusLabel(status: string | undefined): string {
    if (!status) {
      return 'Unknown';
    }
    return status.charAt(0).toUpperCase() + status.slice(1);
  }

  formatMeetingTime(raw: string | undefined): string {
    if (!raw?.trim()) {
      return '';
    }
    const trimmed = raw.trim();
    const match = trimmed.match(/^(\d{1,2}):(\d{2})(?::(\d{2}))?\s*(am|pm)?$/i);
    if (!match) {
      return trimmed;
    }

    let hours = parseInt(match[1], 10);
    const minutes = match[2];
    const meridiem = match[4]?.toLowerCase();

    if (meridiem) {
      const label = meridiem.toUpperCase();
      return `${hours}:${minutes} ${label}`;
    }

    if (hours < 0 || hours > 23) {
      return trimmed;
    }

    const period = hours >= 12 ? 'PM' : 'AM';
    const displayHour = hours % 12 || 12;
    return `${displayHour}:${minutes} ${period}`;
  }

  meetingSummaryParts(): string[] {
    if (!this.bcc) {
      return [];
    }
    const parts: string[] = [];
    if (this.bcc.meeting_day) {
      parts.push(this.titleCase(this.bcc.meeting_day));
    }
    const time = this.formatMeetingTime(this.bcc.meeting_time);
    if (time) {
      parts.push(time);
    }
    if (this.bcc.meeting_frequency?.trim()) {
      parts.push(this.bcc.meeting_frequency.trim());
    }
    return parts;
  }

  hasMeetingInfo(): boolean {
    if (!this.bcc) {
      return false;
    }
    return !!(
      this.bcc.meeting_day ||
      this.bcc.meeting_time ||
      this.bcc.meeting_place ||
      this.bcc.meeting_frequency
    );
  }

  hasKvRows(): boolean {
    if (!this.bcc) {
      return false;
    }
    return !!(
      this.bcc.description ||
      this.bcc.location ||
      this.bcc.established_date ||
      this.bcc.notes
    );
  }

  onClose(): void {
    this.close.emit();
  }

  onEdit(): void {
    if (this.bcc) {
      this.edit.emit(this.bcc);
    }
  }

  private titleCase(value: string): string {
    return value.charAt(0).toUpperCase() + value.slice(1).toLowerCase();
  }
}
