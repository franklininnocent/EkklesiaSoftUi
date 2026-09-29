import { CommonModule } from '@angular/common';
import { Component, inject } from '@angular/core';
import { NavigationEnd, Router, RouterModule } from '@angular/router';
import { filter, map, startWith } from 'rxjs/operators';
import { toSignal } from '@angular/core/rxjs-interop';
import { NavMenuService } from '@core/services/nav-menu.service';
import { EntitlementService } from '@core/services/entitlement.service';
import {
  resolveStewardshipWorkspace,
  STEWARDSHIP_WORKSPACES,
  StewardshipNavLink,
  StewardshipWorkspace,
  StewardshipWorkspaceId
} from '../../config/stewardship-workspaces.config';

export type { StewardshipWorkspaceId };

@Component({
  selector: 'app-stewardship-workspace-shell',
  standalone: true,
  imports: [CommonModule, RouterModule],
  template: `
    <div class="stewardship-shell">
      <div class="stewardship-shell__chrome cf-nav-cluster">
        <nav class="cf-workspace-nav stewardship-shell__workspaces" aria-label="Stewardship workspaces">
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
          class="cf-workspace-subnav stewardship-shell__tasks"
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

      <div class="stewardship-shell__content">
        <router-outlet></router-outlet>
      </div>
    </div>
  `,
  styleUrls: ['../../styles/stewardship-action-icons.scss'],
  styles: [`
    .stewardship-shell {
      display: grid;
      gap: var(--cf-space-2);
      margin-top: var(--cf-space-2);
    }

    .stewardship-shell__chrome {
      min-width: 0;
    }

    .stewardship-shell__workspaces {
      grid-template-columns: repeat(4, minmax(0, 1fr));
    }

    .stewardship-shell__workspaces .cf-workspace-nav__tab {
      min-height: var(--cf-touch-target);
      padding: 0.4rem 0.5rem;
    }

    .stewardship-shell__workspaces .cf-workspace-nav__tab span {
      overflow: hidden;
      text-overflow: ellipsis;
      white-space: nowrap;
    }

    .stewardship-shell__tasks {
      flex-wrap: nowrap;
      overflow-x: auto;
      -webkit-overflow-scrolling: touch;
      scrollbar-width: thin;
      padding-bottom: 0.1rem;
    }

    .stewardship-shell__tasks .cf-workspace-subnav__link {
      flex-shrink: 0;
    }

    .stewardship-shell__content { min-height: 0; }
    .stewardship-shell__content ::ng-deep .cf-page { padding-top: 0; }
  `]
})
export class StewardshipWorkspaceShellComponent {
  private readonly router = inject(Router);
  private readonly navMenu = inject(NavMenuService);
  private readonly entitlements = inject(EntitlementService);

  readonly workspaces = STEWARDSHIP_WORKSPACES;

  private readonly url = toSignal(
    this.router.events.pipe(
      filter((event): event is NavigationEnd => event instanceof NavigationEnd),
      map((event) => event.urlAfterRedirects),
      startWith(this.router.url)
    ),
    { initialValue: this.router.url }
  );

  activeWorkspace(): StewardshipWorkspaceId {
    return resolveStewardshipWorkspace(this.url());
  }

  currentWorkspaceLinks(): StewardshipNavLink[] {
    this.entitlements.entitlements();
    const links = this.workspaces.find((workspace) => workspace.id === this.activeWorkspace())?.links ?? [];
    return links.filter((link) => this.navMenu.isRouteAllowed(link.path));
  }

  activeWorkspaceLabel(): string {
    return this.workspaces.find((workspace) => workspace.id === this.activeWorkspace())?.label ?? 'Stewardship';
  }

  goToWorkspace(workspace: StewardshipWorkspace): void {
    const target = workspace.links.find((link) => this.navMenu.isRouteAllowed(link.path))?.path ?? '/donations';
    if (this.router.url !== target) {
      void this.router.navigateByUrl(target);
    }
  }
}
