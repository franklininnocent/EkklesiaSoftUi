import { ChangeDetectionStrategy, Component, EventEmitter, Input, Output } from '@angular/core';

export type CfIconAction = 'view' | 'print';

@Component({
  selector: 'app-cf-icon-action-button',
  standalone: true,
  template: `
    <button
      type="button"
      class="cf-icon-btn"
      [class.cf-icon-btn--view]="action === 'view'"
      [class.cf-icon-btn--print]="action === 'print'"
      [class.cf-icon-btn--sm]="size === 'sm'"
      [disabled]="disabled"
      [attr.aria-label]="ariaLabel"
      [attr.title]="title || ariaLabel"
      (click)="onClick()"
    >
      @switch (action) {
        @case ('view') {
          <svg
            class="cf-icon-btn__icon"
            xmlns="http://www.w3.org/2000/svg"
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            stroke-width="2"
            stroke-linecap="round"
            stroke-linejoin="round"
            aria-hidden="true"
          >
            <path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z"></path>
            <circle cx="12" cy="12" r="3"></circle>
          </svg>
        }
        @case ('print') {
          <svg
            class="cf-icon-btn__icon"
            xmlns="http://www.w3.org/2000/svg"
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            stroke-width="2"
            stroke-linecap="round"
            stroke-linejoin="round"
            aria-hidden="true"
          >
            <polyline points="6 9 6 2 18 2 18 9"></polyline>
            <path d="M6 18H4a2 2 0 0 1-2-2v-5a2 2 0 0 1 2-2h16a2 2 0 0 1 2 2v5a2 2 0 0 1-2 2h-2"></path>
            <rect x="6" y="14" width="12" height="8"></rect>
          </svg>
        }
      }
    </button>
  `,
  styleUrls: ['./cf-icon-action-button.component.scss'],
  changeDetection: ChangeDetectionStrategy.OnPush
})
export class CfIconActionButtonComponent {
  @Input({ required: true }) action!: CfIconAction;
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
