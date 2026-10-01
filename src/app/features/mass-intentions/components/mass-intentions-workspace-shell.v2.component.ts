import { CommonModule } from '@angular/common';
import { Component } from '@angular/core';
import { RouterModule } from '@angular/router';
import { MassIntentionsWorkspaceShellBase } from './mass-intentions-workspace-shell.base';

/** Version 2 compact workspace chrome. */
@Component({
  selector: 'app-mass-intentions-workspace-shell-v2',
  standalone: true,
  imports: [CommonModule, RouterModule],
  template: `
    <div class="mass-intentions-shell__chrome mass-intentions-shell--v2">
      <div
        class="mass-intentions-shell__nav-row"
        role="navigation"
        aria-label="Mass intentions navigation"
      >
        <div class="mass-intentions-shell__primary-group" aria-label="Workspaces">
          <button
            type="button"
            *ngFor="let workspace of workspaces"
            class="mass-intentions-shell__primary-tab"
            [class.mass-intentions-shell__primary-tab--active]="activeWorkspace() === workspace.id"
            [attr.aria-current]="activeWorkspace() === workspace.id ? 'page' : null"
            [attr.aria-label]="workspaceAriaLabel(workspace)"
            (click)="goToWorkspace(workspace)"
          >
            {{ workspace.label }}
          </button>
        </div>

        @if (currentWorkspaceLinks().length > 1) {
          <span class="mass-intentions-shell__nav-separator" aria-hidden="true"></span>
          <div
            class="mass-intentions-shell__secondary-group"
            [attr.aria-label]="activeWorkspaceLabel() + ' sections'"
          >
            <a
              *ngFor="let link of currentWorkspaceLinks()"
              [routerLink]="link.path"
              routerLinkActive="mass-intentions-shell__secondary-link--active"
              [routerLinkActiveOptions]="{ exact: link.exact ?? false }"
              class="mass-intentions-shell__secondary-link"
            >
              {{ link.label }}
            </a>
          </div>
        }
      </div>
    </div>
  `,
  styles: [
    `
      .mass-intentions-shell--v2 {
        min-width: 0;
        border-bottom: 1px solid var(--cf-panel-border);
        padding-bottom: var(--cf-space-1);
      }

      .mass-intentions-shell__nav-row {
        display: flex;
        flex-wrap: nowrap;
        align-items: center;
        gap: 0;
        overflow-x: auto;
        -webkit-overflow-scrolling: touch;
        scrollbar-width: thin;
        min-width: 0;
        padding: var(--cf-space-1) 0;
      }

      .mass-intentions-shell__primary-group {
        display: flex;
        flex-wrap: nowrap;
        align-items: center;
        gap: var(--cf-space-2);
        flex-shrink: 0;
        padding-right: var(--cf-space-2);
      }

      .mass-intentions-shell__nav-separator {
        flex-shrink: 0;
        align-self: stretch;
        width: 1px;
        min-height: 1.75rem;
        margin: 0 var(--cf-space-4);
        background: var(--cf-panel-border);
      }

      .mass-intentions-shell__secondary-group {
        display: flex;
        flex-wrap: nowrap;
        align-items: center;
        gap: var(--cf-space-1);
        flex-shrink: 0;
        padding-left: var(--cf-space-1);
      }

      .mass-intentions-shell__primary-tab {
        flex-shrink: 0;
        appearance: none;
        border: 0;
        background: transparent;
        cursor: pointer;
        min-height: var(--cf-touch-target);
        padding: var(--cf-space-1) var(--cf-space-2);
        margin-bottom: -1px;
        font-size: var(--cf-text-base);
        font-weight: 500;
        color: var(--cf-slate-700);
        line-height: 1.3;
        border-bottom: 2px solid transparent;
        border-radius: 0;
      }

      .mass-intentions-shell__primary-tab:hover {
        color: var(--cf-slate-900);
      }

      .mass-intentions-shell__primary-tab:focus-visible {
        outline: 2px solid var(--cf-primary);
        outline-offset: 2px;
      }

      .mass-intentions-shell__primary-tab--active {
        color: var(--cf-slate-900);
        font-weight: 600;
        border-bottom-color: var(--cf-primary);
      }

      .mass-intentions-shell__secondary-link {
        flex-shrink: 0;
        min-height: 2.25rem;
        display: inline-flex;
        align-items: center;
        padding: var(--cf-space-1) var(--cf-space-2);
        font-size: var(--cf-text-sm);
        font-weight: 500;
        color: var(--cf-muted);
        text-decoration: none;
        border-radius: var(--cf-radius-pill);
        border: 1px solid var(--cf-panel-border);
        background: var(--cf-color-surface, #fff);
      }

      .mass-intentions-shell__secondary-link:hover {
        color: var(--cf-slate-900);
        border-color: var(--cf-slate-300);
        background: var(--cf-slate-50);
      }

      .mass-intentions-shell__secondary-link:focus-visible {
        outline: 2px solid var(--cf-primary);
        outline-offset: 2px;
      }

      .mass-intentions-shell__secondary-link--active {
        color: var(--cf-slate-900);
        font-weight: 600;
        border-color: var(--cf-primary);
        background: color-mix(in srgb, var(--cf-primary) 8%, var(--cf-color-surface, #fff));
      }
    `,
  ],
})
export class MassIntentionsWorkspaceShellV2Component extends MassIntentionsWorkspaceShellBase {}
