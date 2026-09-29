import { CommonModule } from '@angular/common';
import { ChangeDetectionStrategy, Component, Input } from '@angular/core';
import { SacramentContextField } from '../../../models/sacrament-context.model';

@Component({
  selector: 'app-cf-field-provenance',
  standalone: true,
  imports: [CommonModule],
  templateUrl: './cf-field-provenance.component.html',
  styleUrl: './cf-field-provenance.component.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class CfFieldProvenanceComponent {
  @Input() label = '';
  @Input() field: SacramentContextField | null = null;

  get sourceLabel(): string | null {
    return this.field?.provenance?.source_label ?? null;
  }
}
