import {
  AfterViewInit,
  Directive,
  ElementRef,
  NgZone,
  OnDestroy,
  inject
} from '@angular/core';
import { sacramentMasonryRowSpan } from '../utils/sacrament-masonry.util';

/**
 * Packs sacrament cards into the shortest CSS grid column.
 *
 * Cards stay in source order. Each card spans only as many 1px rows as its
 * content needs, so auto-placement drops the next card into the column with
 * the least accumulated height. Resize observation recomputes spans when
 * card content or the section width changes.
 */
@Directive({
  selector: '[appSacramentMasonry]',
  standalone: true
})
export class SacramentMasonryDirective implements AfterViewInit, OnDestroy {
  private readonly host = inject(ElementRef<HTMLElement>);
  private readonly zone = inject(NgZone);

  private resizeObserver?: ResizeObserver;
  private mutationObserver?: MutationObserver;
  private frame = 0;
  private onWindowResize = (): void => this.schedule();

  ngAfterViewInit(): void {
    const grid = this.host.nativeElement;
    grid.classList.add('sacrament-grid--masonry');

    this.zone.runOutsideAngular(() => {
      if (typeof ResizeObserver !== 'undefined') {
        this.resizeObserver = new ResizeObserver(() => this.schedule());
        this.resizeObserver.observe(grid);
        this.observeCards();
      } else {
        window.addEventListener('resize', this.onWindowResize);
      }

      this.mutationObserver = new MutationObserver((records) => {
        for (const record of records) {
          for (const node of Array.from(record.removedNodes)) {
            if (node instanceof HTMLElement) {
              this.resizeObserver?.unobserve(node);
            }
          }
        }
        this.observeCards();
        this.schedule();
      });
      this.mutationObserver.observe(grid, { childList: true });

      this.layout();
      this.frame = requestAnimationFrame(() => this.layout());
    });
  }

  ngOnDestroy(): void {
    cancelAnimationFrame(this.frame);
    this.resizeObserver?.disconnect();
    this.mutationObserver?.disconnect();
    window.removeEventListener('resize', this.onWindowResize);
  }

  private observeCards(): void {
    if (!this.resizeObserver) {
      return;
    }
    for (const card of this.cards()) {
      this.resizeObserver.observe(card);
    }
  }

  private schedule(): void {
    cancelAnimationFrame(this.frame);
    this.frame = requestAnimationFrame(() => this.layout());
  }

  private layout(): void {
    const grid = this.host.nativeElement;
    if (!grid.isConnected || grid.getBoundingClientRect().width <= 0) {
      return;
    }

    const rowHeight = parseFloat(getComputedStyle(grid).getPropertyValue('grid-auto-rows'));
    for (const card of this.cards()) {
      const content = card.querySelector<HTMLElement>('.sacrament-tile') ?? card;
      const height = content.getBoundingClientRect().height;
      if (height <= 0) {
        continue;
      }
      const marginBottom = parseFloat(getComputedStyle(card).marginBottom) || 0;
      const span = sacramentMasonryRowSpan(height, marginBottom, rowHeight);
      const next = `span ${span}`;
      if (card.style.gridRowEnd !== next) {
        card.style.gridRowEnd = next;
      }
    }
  }

  private cards(): HTMLElement[] {
    return Array.from(this.host.nativeElement.children).filter(
      (node): node is HTMLElement => node instanceof HTMLElement
    );
  }
}
