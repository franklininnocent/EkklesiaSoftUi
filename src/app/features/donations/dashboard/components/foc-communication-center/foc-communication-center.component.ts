import { CommonModule } from '@angular/common';
import { ChangeDetectionStrategy, Component, Input } from '@angular/core';
import { RouterModule } from '@angular/router';
import { FinancialCommandCenterPayload } from '../../../models/donation.model';

@Component({
  selector: 'app-foc-communication-center',
  standalone: true,
  imports: [CommonModule, RouterModule],
  changeDetection: ChangeDetectionStrategy.OnPush,
  templateUrl: './foc-communication-center.component.html',
  styleUrl: '../../styles/financial-command-center.scss'
})
export class FocCommunicationCenterComponent {
  @Input({ required: true }) communication!: FinancialCommandCenterPayload['communication_center'];
}
