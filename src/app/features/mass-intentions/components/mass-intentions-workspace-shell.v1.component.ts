import { CommonModule } from '@angular/common';
import { Component } from '@angular/core';
import { RouterModule } from '@angular/router';
import { MassIntentionsWorkspaceShellBase } from './mass-intentions-workspace-shell.base';

/** Frozen Version 1 workspace chrome (card tabs + hint lines + pill subnav). */
@Component({
  selector: 'app-mass-intentions-workspace-shell-v1',
  standalone: true,
  imports: [CommonModule, RouterModule],
  template: `
    <div class="mass-intentions-shell__chrome cf-nav-cluster mass-intentions-shell--v1">
        <nav class="cf-workspace-nav mass-intentions-shell__workspaces" aria-label="Mass intentions workspaces">
          <button
            type="button"
            *ngFor="let workspace of workspaces"
            class="cf-workspace-nav__tab"
            [class.cf-workspace-nav__tab--active]="activeWorkspace() === workspace.id"
            [attr.aria-current]="activeWorkspace() === workspace.id ? 'page' : null"
            (click)="goToWorkspace(workspace)"
          >
            <strong>{{ workspace.label }}</strong>
            <span>{{ workspace.hint }}</span>
          </button>
        </nav>

        <nav
          class="cf-workspace-subnav mass-intentions-shell__tasks"
          *ngIf="currentWorkspaceLinks().length"
          [attr.aria-label]="activeWorkspaceLabel() + ' tasks'"
        >
          <a
            *ngFor="let link of currentWorkspaceLinks()"
            [routerLink]="link.path"
            routerLinkActive="cf-workspace-subnav__link--active"
            [routerLinkActiveOptions]="{ exact: link.exact ?? false }"
            class="cf-workspace-subnav__link"
          >
            {{ link.label }}
          </a>
        </nav>
    </div>
  `,
  styles: [
    `
      .mass-intentions-shell--v1 {
        min-width: 0;
      }

      .mass-intentions-shell__workspaces {
        grid-template-columns: repeat(3, minmax(0, 1fr));
      }

      .mass-intentions-shell__workspaces .cf-workspace-nav__tab {
        min-height: var(--cf-touch-target);
        padding: 0.4rem 0.5rem;
      }

      .mass-intentions-shell__workspaces .cf-workspace-nav__tab span {
        overflow: hidden;
        text-overflow: ellipsis;
        white-space: nowrap;
      }

      .mass-intentions-shell__tasks {
        flex-wrap: nowrap;
        overflow-x: auto;
        -webkit-overflow-scrolling: touch;
        scrollbar-width: thin;
        padding-bottom: 0.1rem;
      }

      .mass-intentions-shell__tasks .cf-workspace-subnav__link {
        flex-shrink: 0;
      }

      @media (max-width: 768px) {
        .mass-intentions-shell__workspaces {
          grid-template-columns: 1fr;
        }
      }
    `,
  ],
})
export class MassIntentionsWorkspaceShellV1Component extends MassIntentionsWorkspaceShellBase {}
