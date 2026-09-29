import { CommonModule } from '@angular/common';
import { Component, inject } from '@angular/core';
import { NavigationEnd, Router, RouterModule } from '@angular/router';
import { AuthService } from '@core/services/auth.service';
import { toSignal } from '@angular/core/rxjs-interop';
import { filter, map, startWith } from 'rxjs/operators';
import {
  MASS_INTENTIONS_WORKSPACES,
  MassIntentionsWorkspaceId,
  resolveMassIntentionsWorkspace,
} from '../config/mass-intentions-workspaces.config';
import { canConfigureMassIntentions, canExportMassRegister } from '../utils/mass-intentions-auth.util';

@Component({
  selector: 'app-mass-intentions-workspace-shell',
  standalone: true,
  imports: [CommonModule, RouterModule],
  template: `
    <div class="mass-intentions-shell">
      <div class="mass-intentions-shell__chrome cf-nav-cluster">
      @if (tabs.length > 1) {
        <nav class="cf-workspace-nav mass-intentions-shell__tabs" aria-label="Mass intentions">
          <button
            type="button"
            *ngFor="let tab of tabs"
            class="cf-workspace-nav__tab"
            [class.cf-workspace-nav__tab--active]="activeTab() === tab.id"
            [attr.aria-current]="activeTab() === tab.id ? 'page' : null"
            (click)="go(tab.path)"
          >
            <strong>{{ tab.label }}</strong>
            <span>{{ tab.hint }}</span>
          </button>
        </nav>
      }
      <nav class="mass-intentions-shell__more" aria-label="More">
        @if (canRegister()) {
          <a routerLink="/mass-intentions/reports" routerLinkActive="mass-intentions-shell__more-link--active" class="mass-intentions-shell__more-link">Reports</a>
        }
        @if (canConfigure()) {
          <a routerLink="/mass-intentions/settings" routerLinkActive="mass-intentions-shell__more-link--active" class="mass-intentions-shell__more-link">Settings</a>
          <a routerLink="/mass-intentions/audit" routerLinkActive="mass-intentions-shell__more-link--active" class="mass-intentions-shell__more-link">Audit</a>
        }
      </nav>
      </div>
      <div class="mass-intentions-shell__content">
        <router-outlet></router-outlet>
      </div>
    </div>
  `,
  styles: [
    `
      .mass-intentions-shell {
        display: grid;
        gap: var(--cf-space-3);
      }
      .mass-intentions-shell__tabs {
        grid-template-columns: repeat(auto-fit, minmax(0, 1fr));
      }
      .mass-intentions-shell__tabs .cf-workspace-nav__tab {
        min-height: var(--cf-touch-target);
      }
      .mass-intentions-shell__chrome {
        display: grid;
        gap: var(--cf-space-2);
      }
      .mass-intentions-shell__more {
        display: flex;
        gap: var(--cf-space-3);
        flex-wrap: wrap;
      }
      .mass-intentions-shell__more-link {
        font-size: var(--cf-text-sm);
        text-decoration: none;
        color: var(--cf-color-text-muted);
        padding: var(--cf-space-1) 0;
      }
      .mass-intentions-shell__more-link--active {
        color: inherit;
        font-weight: 600;
      }
      .mass-intentions-shell__content ::ng-deep .cf-page {
        padding-top: 0;
      }
    `,
  ],
})
export class MassIntentionsWorkspaceShellComponent {
  private readonly router = inject(Router);
  private readonly auth = inject(AuthService);

  readonly tabs = MASS_INTENTIONS_WORKSPACES;

  private readonly url = toSignal(
    this.router.events.pipe(
      filter((event): event is NavigationEnd => event instanceof NavigationEnd),
      map((event) => event.urlAfterRedirects),
      startWith(this.router.url)
    ),
    { initialValue: this.router.url }
  );

  activeTab(): MassIntentionsWorkspaceId {
    return resolveMassIntentionsWorkspace(this.url());
  }

  go(path: string): void {
    void this.router.navigateByUrl(path);
  }

  canRegister(): boolean {
    return canExportMassRegister(this.auth);
  }

  canConfigure(): boolean {
    return canConfigureMassIntentions(this.auth);
  }
}
