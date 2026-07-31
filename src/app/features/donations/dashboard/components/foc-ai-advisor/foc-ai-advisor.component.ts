import { CommonModule } from '@angular/common';
import { ChangeDetectionStrategy, Component, Input } from '@angular/core';
import { FinancialCommandCenterPayload } from '../../../models/donation.model';

@Component({
  selector: 'app-foc-ai-advisor',
  standalone: true,
  imports: [CommonModule],
  changeDetection: ChangeDetectionStrategy.OnPush,
  templateUrl: './foc-ai-advisor.component.html',
  styleUrl: '../../styles/financial-command-center.scss'
})
export class FocAiAdvisorComponent {
  @Input({ required: true }) advisor!: FinancialCommandCenterPayload['ai_advisor'];
}
