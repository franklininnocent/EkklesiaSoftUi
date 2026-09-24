import { ChangeDetectionStrategy, Component, EventEmitter, Input, Output } from '@angular/core';

export type CfIconAction = 'view' | 'print' | 'void' | 'reissue';

@Component({
  selector: 'app-cf-icon-action-button',
  standalone: true,
  template: `
    <button
      type="button"
      class="cf-icon-btn"
      [class.cf-icon-btn--view]="action === 'view'"
      [class.cf-icon-btn--print]="action === 'print'"
      [class.cf-icon-btn--void]="action === 'void'"
      [class.cf-icon-btn--reissue]="action === 'reissue'"
      [class.cf-icon-btn--sm]="size === 'sm'"
      [class.cf-icon-btn--labeled]="label"
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
        @case ('void') {
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
            <circle cx="12" cy="12" r="10"></circle>
            <line x1="4.93" y1="4.93" x2="19.07" y2="19.07"></line>
          </svg>
        }
        @case ('reissue') {
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
            <polyline points="23 4 23 10 17 10"></polyline>
            <path d="M20.49 15a9 9 0 1 1-2.12-9.36L23 10"></path>
          </svg>
        }
      }
      @if (label) {
        <span class="cf-icon-btn__label">{{ label }}</span>
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
  @Input() label = '';
  @Input() size: 'sm' | 'md' = 'md';
  @Input() disabled = false;

  @Output() clicked = new EventEmitter<void>();

  onClick(): void {
    if (!this.disabled) {
      this.clicked.emit();
    }
  }
}
