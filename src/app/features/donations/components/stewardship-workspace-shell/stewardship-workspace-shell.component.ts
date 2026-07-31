import { CommonModule } from '@angular/common';
import { Component, inject } from '@angular/core';
import { NavigationEnd, Router, RouterModule } from '@angular/router';
import { filter, map, startWith } from 'rxjs/operators';
import { toSignal } from '@angular/core/rxjs-interop';
import { QuickCollectService } from '../../services/quick-collect.service';
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
      <header class="stewardship-shell__header cf-panel" *ngIf="!isCollectionDay()">
        <div class="stewardship-shell__intro">
          <h2 class="stewardship-shell__title">Stewardship</h2>
          <p class="stewardship-shell__subtitle">Manage collections, families, and parish financial health.</p>
        </div>
        <button type="button" class="cf-btn cf-btn-primary" (click)="openQuickCollect()">+ Collect Payment</button>
      </header>

      <nav class="cf-workspace-nav" aria-label="Stewardship workspaces" *ngIf="!isCollectionDay()">
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
        class="cf-workspace-subnav"
        *ngIf="!isCollectionDay() && currentWorkspaceLinks().length"
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

      <div class="stewardship-shell__content">
        <router-outlet></router-outlet>
      </div>
    </div>
  `,
  styles: [`
    .stewardship-shell { display: grid; gap: 0.75rem; }
    .stewardship-shell__header {
      display: flex;
      justify-content: space-between;
      align-items: center;
      gap: 1rem;
      flex-wrap: wrap;
      padding: 0.85rem 1rem;
    }
    .stewardship-shell__title { margin: 0; font-size: 1.05rem; color: var(--cf-slate-900); }
    .stewardship-shell__subtitle { margin: 0.15rem 0 0; color: var(--cf-muted); font-size: 0.88rem; }
    .stewardship-shell__content { min-height: 0; }
    .stewardship-shell__content ::ng-deep .cf-page { padding-top: 0; }
  `]
})
export class StewardshipWorkspaceShellComponent {
  private readonly router = inject(Router);
  private readonly quickCollectService = inject(QuickCollectService);

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
    return this.workspaces.find((workspace) => workspace.id === this.activeWorkspace())?.links ?? [];
  }

  activeWorkspaceLabel(): string {
    return this.workspaces.find((workspace) => workspace.id === this.activeWorkspace())?.label ?? 'Stewardship';
  }

  goToWorkspace(workspace: StewardshipWorkspace): void {
    const target = workspace.links[0]?.path ?? '/donations';
    if (this.router.url !== target) {
      void this.router.navigateByUrl(target);
    }
  }

  openQuickCollect(): void {
    this.quickCollectService.open();
  }

  isCollectionDay(): boolean {
    return this.url().includes('/donations/collection-day');
  }
}
