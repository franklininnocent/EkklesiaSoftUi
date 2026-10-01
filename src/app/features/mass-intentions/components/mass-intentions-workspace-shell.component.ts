import { Component } from '@angular/core';
import { RouterModule } from '@angular/router';
import { isMassIntentionsChromeV2 } from '../config/mass-intentions-chrome.version';
import { MassIntentionsWorkspaceShellV1Component } from './mass-intentions-workspace-shell.v1.component';
import { MassIntentionsWorkspaceShellV2Component } from './mass-intentions-workspace-shell.v2.component';

@Component({
  selector: 'app-mass-intentions-workspace-shell',
  standalone: true,
  imports: [
    RouterModule,
    MassIntentionsWorkspaceShellV1Component,
    MassIntentionsWorkspaceShellV2Component,
  ],
  template: `
    <div class="mass-intentions-shell-host">
      @if (useV2) {
        <app-mass-intentions-workspace-shell-v2 />
      } @else {
        <app-mass-intentions-workspace-shell-v1 />
      }
      <div class="mass-intentions-shell-host__content">
        <router-outlet />
      </div>
    </div>
  `,
  styles: [
    `
      .mass-intentions-shell-host {
        display: grid;
        gap: var(--cf-space-2);
        margin-top: var(--cf-space-1);
        min-height: 0;
      }

      .mass-intentions-shell-host__content {
        min-height: 0;
      }

      .mass-intentions-shell-host__content ::ng-deep .cf-page {
        padding-top: 0;
      }
    `,
  ],
})
export class MassIntentionsWorkspaceShellComponent {
  readonly useV2 = isMassIntentionsChromeV2();
}
