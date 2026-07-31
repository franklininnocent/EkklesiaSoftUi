import { Component, Input, ChangeDetectionStrategy } from '@angular/core';
import { CommonModule } from '@angular/common';

@Component({
  selector: 'app-card',
  standalone: true,
  imports: [CommonModule],
  templateUrl: './card.component.html',
  changeDetection: ChangeDetectionStrategy.Eager,
  styleUrl: './card.component.scss'
})
export class CardComponent {
  @Input() title?: string;
  @Input() padding: 'none' | 'sm' | 'md' | 'lg' = 'md';
  @Input() shadow = true;
}

