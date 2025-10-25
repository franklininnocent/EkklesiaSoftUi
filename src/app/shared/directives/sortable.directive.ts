import { Directive, EventEmitter, Input, Output, HostListener, HostBinding, ElementRef, Renderer2 } from '@angular/core';

export type SortDirection = 'asc' | 'desc' | null;

export interface SortEvent {
  column: string;
  direction: SortDirection;
}

@Directive({
  selector: '[appSortable]',
  standalone: true
})
export class SortableDirective {
  @Input('appSortable') column: string = '';
  @Input() direction: SortDirection = null;
  @Output() sort = new EventEmitter<SortEvent>();

  @HostBinding('class.sortable') sortable = true;
  @HostBinding('class.asc') get isAsc() { return this.direction === 'asc'; }
  @HostBinding('class.desc') get isDesc() { return this.direction === 'desc'; }

  constructor(private el: ElementRef, private renderer: Renderer2) {
    this.addSortIcon();
  }

  @HostListener('click')
  rotate() {
    this.direction = this.direction === 'asc' ? 'desc' : 'asc';
    this.sort.emit({ column: this.column, direction: this.direction });
    this.updateSortIcon();
  }

  private addSortIcon() {
    const icon = this.renderer.createElement('span');
    this.renderer.addClass(icon, 'sort-icon');
    this.renderer.appendChild(this.el.nativeElement, icon);
  }

  private updateSortIcon() {
    // Icon update is handled by CSS classes
  }
}

