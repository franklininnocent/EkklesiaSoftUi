import { Component, ChangeDetectionStrategy } from '@angular/core';
import { CommonModule } from '@angular/common';

@Component({
  selector: 'app-bcc-detail',
  standalone: true,
  imports: [CommonModule],
  templateUrl: './bcc-detail.html',
  changeDetection: ChangeDetectionStrategy.Eager,
  styleUrl: './bcc-detail.scss',
})
export class BccDetail {

}
