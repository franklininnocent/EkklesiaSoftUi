import { ChangeDetectionStrategy, Component, Input } from '@angular/core';
import { CommonModule } from '@angular/common';

export type CfBrandLoaderSize = 'page' | 'section' | 'inline' | 'button';

/**
 * Brand mark loader — navy disc, gold dove, orbiting sparks.
 * Use for page, section, inline, and button-busy states.
 * Prefer skeletons for tables and dense cards; use this mark for waits without a known layout.
 */
@Component({
  selector: 'app-cf-brand-loader',
  standalone: true,
  imports: [CommonModule],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <div
      class="cf-brand-loader"
      [class.cf-brand-loader--page]="size === 'page'"
      [class.cf-brand-loader--section]="size === 'section'"
      [class.cf-brand-loader--inline]="size === 'inline'"
      [class.cf-brand-loader--button]="size === 'button'"
      [class.cf-brand-loader--overlay]="overlay"
      role="status"
      aria-live="polite"
      [attr.aria-label]="label"
    >
      <span class="cf-brand-loader__mark" aria-hidden="true">
        <span class="cf-brand-loader__orbit"></span>
        <img
          class="cf-brand-loader__badge"
          src="/brand/ekklesia-circular-badge.png"
          alt=""
          width="256"
          height="256"
        />
      </span>
      <span class="cf-brand-loader__label" *ngIf="showLabel">{{ label }}</span>
    </div>
  `,
  styles: [
    `
      :host {
        display: contents;
      }

      .cf-brand-loader {
        --cf-loader-navy: #1d4e89;
        --cf-loader-gold: #f0c14a;
        display: inline-flex;
        flex-direction: column;
        align-items: center;
        justify-content: center;
        gap: 0.75rem;
        color: var(--cf-slate-700, #334155);
      }

      .cf-brand-loader--overlay {
        position: absolute;
        inset: 0;
        background: color-mix(in srgb, #fff 82%, transparent);
        z-index: 2;
      }

      .cf-brand-loader__mark {
        position: relative;
        width: var(--cf-loader-size, 4.5rem);
        height: var(--cf-loader-size, 4.5rem);
        flex-shrink: 0;
        display: grid;
        place-items: center;
        overflow: visible;
      }

      .cf-brand-loader__badge {
        position: relative;
        z-index: 1;
        display: block;
        width: 88%;
        height: 88%;
        max-width: 88%;
        max-height: 88%;
        object-fit: contain;
        object-position: center;
        animation: cf-loader-breathe 1.6s ease-in-out infinite;
      }

      .cf-brand-loader__orbit {
        position: absolute;
        inset: 0;
        border-radius: 50%;
        background:
          radial-gradient(circle at 50% 0, var(--cf-loader-gold) 0 5px, transparent 6px);
        animation: cf-loader-spin 1.1s linear infinite;
      }

      .cf-brand-loader__orbit::before,
      .cf-brand-loader__orbit::after {
        content: '';
        position: absolute;
        inset: 0;
        border-radius: inherit;
        background: radial-gradient(circle at 50% 0, var(--cf-loader-gold) 0 3px, transparent 4px);
      }

      .cf-brand-loader__orbit::before {
        transform: rotate(120deg);
        opacity: 0.85;
      }

      .cf-brand-loader__orbit::after {
        transform: rotate(240deg);
        opacity: 0.65;
      }

      .cf-brand-loader__label {
        font-size: 0.875rem;
        font-weight: 600;
        letter-spacing: 0.01em;
      }

      .cf-brand-loader--page {
        --cf-loader-size: 5.5rem;
        min-height: 40vh;
        width: 100%;
      }

      .cf-brand-loader--section {
        --cf-loader-size: 3.5rem;
        min-height: 8rem;
        width: 100%;
      }

      .cf-brand-loader--inline {
        --cf-loader-size: 1.5rem;
        flex-direction: row;
        gap: 0.5rem;
      }

      .cf-brand-loader--inline .cf-brand-loader__label {
        font-size: 0.8rem;
        font-weight: 500;
      }

      .cf-brand-loader--button {
        --cf-loader-size: 1.15rem;
        flex-direction: row;
        gap: 0.4rem;
      }

      .cf-brand-loader--button .cf-brand-loader__label {
        font-size: 0.8rem;
      }

      @keyframes cf-loader-spin {
        to {
          transform: rotate(1turn);
        }
      }

      @keyframes cf-loader-breathe {
        0%,
        100% {
          transform: scale(1);
        }
        50% {
          transform: scale(0.94);
        }
      }

      @media (prefers-reduced-motion: reduce) {
        .cf-brand-loader__badge,
        .cf-brand-loader__orbit {
          animation: none;
        }
      }
    `,
  ],
})
export class CfBrandLoaderComponent {
  @Input() size: CfBrandLoaderSize = 'section';
  @Input() label = 'Loading';
  @Input() showLabel = true;
  @Input() overlay = false;
}
