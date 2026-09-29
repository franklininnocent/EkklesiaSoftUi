import { CommonModule } from '@angular/common';
import {
  ChangeDetectionStrategy,
  Component,
  EventEmitter,
  Input,
  Output,
} from '@angular/core';
import { ModalShellComponent } from '@shared/components/modal-shell/modal-shell.component';
import { StatusBadgeComponent, StatusBadgeTone } from '@shared/components/status-badge/status-badge.component';
import {
  MemberSource,
  MemberType,
  MembershipStatus,
  OrganizationMembership,
} from '../../models/ministries.model';

@Component({
  selector: 'app-member-history-detail-modal',
  standalone: true,
  imports: [CommonModule, ModalShellComponent, StatusBadgeComponent],
  templateUrl: './member-history-detail-modal.component.html',
  styleUrl: './member-history-detail-modal.component.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class MemberHistoryDetailModalComponent {
  @Input({ required: true }) membership!: OrganizationMembership;
  @Output() cancel = new EventEmitter<void>();

  onClose(): void {
    this.cancel.emit();
  }

  sourceLabel(source: MemberSource): string {
    return source === 'parish' ? 'Parish' : 'Guest';
  }

  typeLabel(type: MemberType): string {
    switch (type) {
      case 'regular':
        return 'Regular';
      case 'honorary':
        return 'Honorary';
      case 'life':
        return 'Life';
      case 'junior':
        return 'Junior';
      default:
        return type;
    }
  }

  statusLabel(status: MembershipStatus): string {
    switch (status) {
      case 'active':
        return 'Active';
      case 'inactive':
        return 'Inactive';
      case 'suspended':
        return 'Suspended';
      case 'resigned':
        return 'Resigned';
      case 'exited':
        return 'Exited';
      case 'deceased':
        return 'Deceased';
      default:
        return status;
    }
  }

  statusTone(status: MembershipStatus): StatusBadgeTone {
    return status === 'active' ? 'success' : 'neutral';
  }

  familyDisplay(): string {
    if (this.membership.member_source !== 'parish') {
      return '—';
    }
    const name = this.membership.family_name?.trim();
    return name ? name : '—';
  }

  formatDate(value: string | null | undefined): string {
    if (!value) {
      return '—';
    }

    const datePart = value.includes('T') ? value.slice(0, 10) : value;
    const match = /^(\d{4})-(\d{2})-(\d{2})$/.exec(datePart);
    if (!match) {
      const parsed = new Date(value);
      if (Number.isNaN(parsed.getTime())) {
        return '—';
      }
      return this.formatDisplayDate(parsed);
    }

    const year = Number(match[1]);
    const monthIndex = Number(match[2]) - 1;
    const day = Number(match[3]);
    const date = new Date(year, monthIndex, day);
    if (
      Number.isNaN(date.getTime()) ||
      date.getFullYear() !== year ||
      date.getMonth() !== monthIndex ||
      date.getDate() !== day
    ) {
      return '—';
    }

    return this.formatDisplayDate(date);
  }

  formatDuration(): string {
    const start = this.parseDateOnly(this.membership.joined_date);
    const end = this.parseDateOnly(this.membership.exit_date);
    if (!start || !end) {
      return '—';
    }

    if (end.getTime() < start.getTime()) {
      return '—';
    }

    let years = end.getFullYear() - start.getFullYear();
    let months = end.getMonth() - start.getMonth();
    let days = end.getDate() - start.getDate();

    if (days < 0) {
      months -= 1;
      const previousMonth = new Date(end.getFullYear(), end.getMonth(), 0);
      days += previousMonth.getDate();
    }
    if (months < 0) {
      years -= 1;
      months += 12;
    }

    if (years === 0 && months === 0) {
      if (days === 0) {
        return 'Less than a day';
      }
      return days === 1 ? '1 day' : `${days} days`;
    }

    const parts: string[] = [];
    if (years > 0) {
      parts.push(years === 1 ? '1 year' : `${years} years`);
    }
    if (months > 0) {
      parts.push(months === 1 ? '1 month' : `${months} months`);
    }
    return parts.join(' ');
  }

  textOrDash(value: string | null | undefined): string {
    const trimmed = value?.trim();
    return trimmed ? trimmed : '—';
  }

  private formatDisplayDate(date: Date): string {
    const day = String(date.getDate()).padStart(2, '0');
    const month = date.toLocaleDateString('en-GB', { month: 'short' });
    const year = date.getFullYear();
    return `${day} ${month} ${year}`;
  }

  private parseDateOnly(value: string | null | undefined): Date | null {
    if (!value) {
      return null;
    }
    const datePart = value.includes('T') ? value.slice(0, 10) : value;
    const match = /^(\d{4})-(\d{2})-(\d{2})$/.exec(datePart);
    if (!match) {
      return null;
    }
    const year = Number(match[1]);
    const monthIndex = Number(match[2]) - 1;
    const day = Number(match[3]);
    const date = new Date(year, monthIndex, day);
    if (
      Number.isNaN(date.getTime()) ||
      date.getFullYear() !== year ||
      date.getMonth() !== monthIndex ||
      date.getDate() !== day
    ) {
      return null;
    }
    return date;
  }
}
