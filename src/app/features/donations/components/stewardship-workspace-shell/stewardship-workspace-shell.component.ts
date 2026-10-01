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
      <div class="cf-panel stewardship-shell__chrome-panel cf-nav-cluster">
        <p class="stewardship-shell__zone" id="stewardship-workspace-zone">
          {{ activeWorkspaceZone() }}
        </p>

        <nav class="cf-workspace-nav stewardship-shell__workspaces" aria-labelledby="stewardship-workspace-zone">
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

        <div
          class="stewardship-shell__subnav-wrap"
          *ngIf="currentWorkspaceLinks().length"
        >
          <nav
            class="cf-workspace-subnav stewardship-shell__tasks"
            [attr.aria-label]="activeWorkspaceLabel() + ' navigation'"
          >
            <a
              *ngFor="let link of currentWorkspaceLinks()"
              [routerLink]="link.path"
              routerLinkActive="cf-workspace-subnav__link--active"
              [routerLinkActiveOptions]="{ exact: link.exact ?? false }"
              class="cf-workspace-subnav__link"
              [attr.title]="link.description || link.label"
            >
              {{ link.label }}
            </a>
          </nav>
        </div>
      </div>

      <div class="stewardship-shell__content">
        <router-outlet></router-outlet>
      </div>
    </div>
  `,
  styleUrls: [
    '../../styles/stewardship-action-icons.scss',
    '../../styles/stewardship-dashboard-shared.scss',
    '../../styles/stewardship-module-baseline.scss',
    '../../styles/stewardship-portfolio-shared.scss',
    './stewardship-workspace-shell.component.scss',
  ],
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

  activeWorkspaceZone(): string {
    return this.workspaces.find((workspace) => workspace.id === this.activeWorkspace())?.zone ?? 'Stewardship';
  }

  goToWorkspace(workspace: StewardshipWorkspace): void {
    const target = workspace.links.find((link) => this.navMenu.isRouteAllowed(link.path))?.path ?? '/donations';
    if (this.router.url !== target) {
      void this.router.navigateByUrl(target);
    }
  }
}
