import { CommonModule } from '@angular/common';
import { ChangeDetectionStrategy, Component, Input } from '@angular/core';
import { FinancialCommandCenterPayload } from '../../../models/donation.model';
import { isFocLayerVisible } from '../../utils/foc-format.util';
import { FocAiAdvisorComponent } from '../foc-ai-advisor/foc-ai-advisor.component';
import { FocCollectionsCommandComponent } from '../foc-collections-command/foc-collections-command.component';
import { FocCommunicationCenterComponent } from '../foc-communication-center/foc-communication-center.component';
import { FocContributionLeaderboardComponent } from '../foc-contribution-leaderboard/foc-contribution-leaderboard.component';
import { FocIntelligenceStreamComponent } from '../foc-intelligence-stream/foc-intelligence-stream.component';
import { FocProjectsCommandComponent } from '../foc-projects-command/foc-projects-command.component';

@Component({
  selector: 'app-foc-satellites-grid',
  standalone: true,
  imports: [
    CommonModule,
    FocCollectionsCommandComponent,
    FocAiAdvisorComponent,
    FocContributionLeaderboardComponent,
    FocCommunicationCenterComponent,
    FocIntelligenceStreamComponent,
    FocProjectsCommandComponent
  ],
  changeDetection: ChangeDetectionStrategy.OnPush,
  templateUrl: './foc-satellites-grid.component.html',
  styleUrl: '../../styles/financial-command-center.scss'
})
export class FocSatellitesGridComponent {
  @Input({ required: true }) data!: FinancialCommandCenterPayload;
  @Input() sections: string[] | undefined;

  get currencyCode(): string {
    return this.data.meta?.currency_code || this.data.tenant_context?.currency_code || 'INR';
  }

  show(layer: string): boolean {
    return isFocLayerVisible(this.sections, layer);
  }
}
