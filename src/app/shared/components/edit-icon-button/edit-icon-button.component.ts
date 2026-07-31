import { ChangeDetectionStrategy, Component, EventEmitter, Input, Output } from '@angular/core';

@Component({
  selector: 'app-edit-icon-button',
  standalone: true,
  templateUrl: './edit-icon-button.component.html',
  styleUrls: ['./edit-icon-button.component.scss'],
  changeDetection: ChangeDetectionStrategy.OnPush
})
export class EditIconButtonComponent {
  @Input({ required: true }) ariaLabel!: string;
  @Input() title = '';
  @Input() size: 'sm' | 'md' = 'md';
  @Input() variant: 'default' | 'on-dark' = 'default';
  @Input() disabled = false;

  @Output() clicked = new EventEmitter<void>();

  onClick(): void {
    if (!this.disabled) {
      this.clicked.emit();
    }
  }
}
