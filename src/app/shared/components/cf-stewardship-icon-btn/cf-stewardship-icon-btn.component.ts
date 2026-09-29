import { ChangeDetectionStrategy, Component, EventEmitter, Input, Output } from '@angular/core';
import { CfActionIconComponent, CfActionIconName } from '../cf-action-icon/cf-action-icon.component';

@Component({
  selector: 'app-cf-stewardship-icon-btn',
  standalone: true,
  imports: [CfActionIconComponent],
  template: `
    <button
      [attr.type]="type"
      class="cf-btn cf-btn-icon"
      [class.cf-btn-primary]="variant === 'primary'"
      [class.cf-btn--sm]="size === 'sm'"
      [disabled]="disabled"
      [attr.aria-label]="label"
      [attr.title]="title || label"
      [attr.aria-busy]="ariaBusy === true ? true : null"
      [attr.form]="form || null"
      (click)="onClick($event)"
    >
      <app-cf-action-icon [name]="icon" />
    </button>
  `,
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class CfStewardshipIconBtnComponent {
  @Input({ required: true }) icon!: CfActionIconName;
  @Input({ required: true }) label!: string;
  @Input() title = '';
  @Input() variant: 'default' | 'primary' = 'default';
  @Input() size: 'md' | 'sm' = 'md';
  @Input() type: 'button' | 'submit' = 'button';
  @Input() disabled = false;
  @Input() ariaBusy: boolean | null = null;
  @Input() form?: string;

  @Output() action = new EventEmitter<void>();

  onClick(event: MouseEvent): void {
    if (!this.disabled) {
      this.action.emit();
    }
  }
}
