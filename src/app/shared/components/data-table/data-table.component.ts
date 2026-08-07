import { CommonModule } from '@angular/common';
import { ChangeDetectionStrategy, Component, Input } from '@angular/core';

/**
 * DataTable
 *
 * Thin wrapper around the existing `.cf-table` markup — not a new grid
 * engine. Owns table chrome only: the responsive horizontal-scroll
 * container (`.cf-table-responsive`) and the clickable-row hover
 * treatment. Consumers project their own `<thead>`/`<tbody>` exactly as
 * before; `<th>`/`<td>` styling and the fixed-width actions column
 * (`.cf-table__actions-col`) continue to come from the global tokens.
 */
@Component({
  selector: 'app-data-table',
  standalone: true,
  imports: [CommonModule],
  templateUrl: './data-table.component.html',
  styleUrl: './data-table.component.scss',
  changeDetection: ChangeDetectionStrategy.Eager,
})
export class DataTableComponent {
  /** Adds a pointer cursor + hover background to body rows. */
  @Input() clickableRows = false;
  /** Reflected as `aria-busy` on the `<table>` while data is refreshing. */
  @Input() ariaBusy = false;
}
