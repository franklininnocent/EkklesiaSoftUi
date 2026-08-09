import { Directive, EventEmitter, Input, Output, HostListener, HostBinding, ElementRef, Renderer2, inject } from '@angular/core';

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
  @Input('appSortable') column = '';
  @Input() direction: SortDirection = null;
  @Output() sort = new EventEmitter<SortEvent>();
  private readonly el = inject(ElementRef);
  private readonly renderer = inject(Renderer2);

  @HostBinding('class.sortable') sortable = true;
  @HostBinding('class.asc') get isAsc() { return this.direction === 'asc'; }
  @HostBinding('class.desc') get isDesc() { return this.direction === 'desc'; }

  /** Additive a11y — does not change sort behavior when unset. */
  @HostBinding('attr.aria-sort')
  get ariaSort(): 'ascending' | 'descending' | 'none' {
    if (this.direction === 'asc') {
      return 'ascending';
    }
    if (this.direction === 'desc') {
      return 'descending';
    }
    return 'none';
  }

  constructor() {
    this.addSortIcon();
  }

  @HostListener('click')
  rotate() {
    this.direction = this.direction === 'asc' ? 'desc' : 'asc';
    this.sort.emit({ column: this.column, direction: this.direction });
    this.updateSortIcon();
  }

  @HostListener('keydown.enter', ['$event'])
  @HostListener('keydown.space', ['$event'])
  onKeyActivate(event: Event): void {
    event.preventDefault();
    this.rotate();
  }

  private addSortIcon() {
    const icon = this.renderer.createElement('span');
    this.renderer.addClass(icon, 'sort-icon');
    this.renderer.setAttribute(icon, 'aria-hidden', 'true');
    this.renderer.appendChild(this.el.nativeElement, icon);
    // Make keyboard-focusable for a11y without changing mouse behavior.
    if (!this.el.nativeElement.hasAttribute('tabindex')) {
      this.renderer.setAttribute(this.el.nativeElement, 'tabindex', '0');
    }
  }

  private updateSortIcon() {
    // Icon update is handled by CSS classes
  }
}

