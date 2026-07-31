import { ChangeDetectionStrategy, Component, EventEmitter, Input, Output } from '@angular/core';

@Component({
  selector: 'app-section-collapse-toggle',
  standalone: true,
  templateUrl: './section-collapse-toggle.component.html',
  styleUrls: ['./section-collapse-toggle.component.scss'],
  changeDetection: ChangeDetectionStrategy.OnPush
})
export class SectionCollapseToggleComponent {
  @Input() expanded = false;
  @Input() expandLabel = 'Expand section';
  @Input() collapseLabel = 'Collapse section';

  @Output() toggled = new EventEmitter<void>();

  get ariaLabel(): string {
    return this.expanded ? this.collapseLabel : this.expandLabel;
  }

  onClick(): void {
    this.toggled.emit();
  }
}
