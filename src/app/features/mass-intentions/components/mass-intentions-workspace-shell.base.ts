import { inject } from '@angular/core';
import { NavigationEnd, Router } from '@angular/router';
import { AuthService } from '@core/services/auth.service';
import { toSignal } from '@angular/core/rxjs-interop';
import { filter, map, startWith } from 'rxjs/operators';
import {
  MASS_INTENTIONS_WORKSPACES,
  MassIntentionsNavLink,
  MassIntentionsWorkspace,
  MassIntentionsWorkspaceId,
  resolveMassIntentionsWorkspace,
} from '../config/mass-intentions-workspaces.config';
import {
  canConfigureMassIntentions,
  canExportMassRegister,
  canScheduleMasses,
} from '../utils/mass-intentions-auth.util';

export class MassIntentionsWorkspaceShellBase {
  protected readonly router = inject(Router);
  protected readonly auth = inject(AuthService);

  readonly workspaces = MASS_INTENTIONS_WORKSPACES;

  protected readonly url = toSignal(
    this.router.events.pipe(
      filter((event): event is NavigationEnd => event instanceof NavigationEnd),
      map((event) => event.urlAfterRedirects),
      startWith(this.router.url)
    ),
    { initialValue: this.router.url }
  );

  activeWorkspace(): MassIntentionsWorkspaceId {
    return resolveMassIntentionsWorkspace(this.url());
  }

  activeWorkspaceLabel(): string {
    return this.workspaces.find((workspace) => workspace.id === this.activeWorkspace())?.label ?? 'Mass intentions';
  }

  currentWorkspaceLinks(): MassIntentionsNavLink[] {
    const links = this.workspaces.find((workspace) => workspace.id === this.activeWorkspace())?.links ?? [];
    return links.filter((link) => this.isLinkAllowed(link));
  }

  goToWorkspace(workspace: MassIntentionsWorkspace): void {
    const target =
      workspace.links.find((link) => this.isLinkAllowed(link))?.path ?? '/mass-intentions';
    if (this.router.url.split(/[?#]/)[0] !== target) {
      void this.router.navigateByUrl(target);
    }
  }

  workspaceAriaLabel(workspace: MassIntentionsWorkspace): string {
    return `${workspace.label}, ${workspace.hint}`;
  }

  protected isLinkAllowed(link: MassIntentionsNavLink): boolean {
    if (!link.access) {
      return true;
    }
    if (link.access === 'register') {
      return canExportMassRegister(this.auth);
    }
    if (link.access === 'configure') {
      return canConfigureMassIntentions(this.auth);
    }
    if (link.access === 'schedule') {
      return canScheduleMasses(this.auth);
    }
    return true;
  }
}
