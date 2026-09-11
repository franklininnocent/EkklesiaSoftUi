import { ChangeDetectionStrategy, Component, inject } from '@angular/core';
import { CommonModule } from '@angular/common';
import { SectionCardComponent } from '@shared/components/section-card/section-card.component';
import { CfEmptyStateComponent } from '@shared/components/cf-empty-state/cf-empty-state.component';
import { ApplicationAccessStreamService } from '../../services/application-access-stream.service';
import { liveTelemetryLabel } from '../../utils/application-access-live-labels.util';

@Component({
  selector: 'app-application-access-live-feed',
  standalone: true,
  imports: [CommonModule, SectionCardComponent, CfEmptyStateComponent],
  templateUrl: './application-access-live-feed.component.html',
  styleUrl: './application-access-live-feed.component.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class ApplicationAccessLiveFeedComponent {
  readonly stream = inject(ApplicationAccessStreamService);

  liveTelemetryLabel = liveTelemetryLabel;

  connectionLabel(): string {
    switch (this.stream.connectionState()) {
      case 'live':
        return 'Live';
      case 'connecting':
        return 'Connecting';
      case 'reconnecting':
        return 'Reconnecting';
      case 'polling':
        return 'Polling';
      default:
        return 'Stopped';
    }
  }
}
