import { ChangeDetectionStrategy, Component, EventEmitter, Input, Output } from '@angular/core';

@Component({
  selector: 'app-add-member-icon-button',
  standalone: true,
  templateUrl: './add-member-icon-button.component.html',
  styleUrls: ['./add-member-icon-button.component.scss'],
  changeDetection: ChangeDetectionStrategy.OnPush
})
export class AddMemberIconButtonComponent {
  @Input({ required: true }) ariaLabel!: string;
  @Input() title = '';
  @Input() size: 'sm' | 'md' = 'md';
  @Input() disabled = false;

  @Output() clicked = new EventEmitter<void>();

  onClick(): void {
    if (!this.disabled) {
      this.clicked.emit();
    }
  }
}
