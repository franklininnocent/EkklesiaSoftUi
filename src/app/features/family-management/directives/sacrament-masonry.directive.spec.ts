import { Component } from '@angular/core';
import { ComponentFixture, TestBed } from '@angular/core/testing';
import { SacramentMasonryDirective } from './sacrament-masonry.directive';

@Component({
  standalone: true,
  imports: [SacramentMasonryDirective],
  template: `
    <div appSacramentMasonry class="sacrament-grid" style="grid-auto-rows: 1px">
      <article class="card" data-height="280" style="margin-bottom: 10px"><div class="sacrament-tile"></div></article>
      <article class="card" data-height="90" style="margin-bottom: 10px"><div class="sacrament-tile"></div></article>
      <article class="card" data-height="48" style="margin-bottom: 10px"><div class="sacrament-tile"></div></article>
    </div>
  `
})
class MasonryHostComponent {}

describe('SacramentMasonryDirective', () => {
  let fixture: ComponentFixture<MasonryHostComponent>;
  let rectSpy: jest.SpyInstance;
  let notifyResize: () => void;

  beforeEach(async () => {
    notifyResize = () => undefined;
    (window as unknown as { ResizeObserver: typeof ResizeObserver }).ResizeObserver = class {
      constructor(callback: ResizeObserverCallback) {
        notifyResize = () => callback([], this as unknown as ResizeObserver);
      }
      observe(): void {}
      unobserve(): void {}
      disconnect(): void {}
    } as unknown as typeof ResizeObserver;

    jest.spyOn(window, 'requestAnimationFrame').mockImplementation((callback) => {
      callback(0);
      return 1;
    });
    jest.spyOn(window, 'cancelAnimationFrame').mockImplementation(() => undefined);

    rectSpy = jest.spyOn(HTMLElement.prototype, 'getBoundingClientRect').mockImplementation(function (
      this: HTMLElement
    ) {
      const height = Number(
        this.getAttribute('data-height') || this.parentElement?.getAttribute('data-height') || 0
      );
      const width = this.hasAttribute('appSacramentMasonry') ? 960 : 100;
      return {
        x: 0,
        y: 0,
        top: 0,
        left: 0,
        right: width,
        bottom: height,
        width,
        height,
        toJSON: () => ({})
      } as DOMRect;
    });

    await TestBed.configureTestingModule({
      imports: [MasonryHostComponent]
    }).compileComponents();

    fixture = TestBed.createComponent(MasonryHostComponent);
    fixture.detectChanges();
  });

  afterEach(() => {
    rectSpy.mockRestore();
    jest.restoreAllMocks();
  });

  it('spans each card from its own content height', () => {
    const cards = fixture.nativeElement.querySelectorAll('.card');

    expect(cards[0].style.gridRowEnd).toBe('span 290');
    expect(cards[1].style.gridRowEnd).toBe('span 100');
    expect(cards[2].style.gridRowEnd).toBe('span 58');
  });

  it('recomputes spans when card content changes size', () => {
    const baptism = fixture.nativeElement.querySelector('.card') as HTMLElement;
    baptism.setAttribute('data-height', '360');
    notifyResize();

    expect(baptism.style.gridRowEnd).toBe('span 370');
  });
});
