import { Component } from '@angular/core';
import { ComponentFixture, TestBed } from '@angular/core/testing';
import { ModalShellComponent } from './modal-shell.component';

@Component({
  standalone: true,
  imports: [ModalShellComponent],
  template: `
    <app-modal-shell title="Bottom" (closeRequested)="bottomClosed = true">
      <p>Bottom modal</p>
    </app-modal-shell>
    <app-modal-shell title="Top" (closeRequested)="topClosed = true">
      <p>Top modal</p>
    </app-modal-shell>
  `,
})
class StackedModalHostComponent {
  bottomClosed = false;
  topClosed = false;
}

describe('ModalShellComponent', () => {
  it('only closes the topmost dialog on Escape', () => {
    const fixture = TestBed.createComponent(StackedModalHostComponent);
    const host = fixture.componentInstance;
    fixture.detectChanges();

    document.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape', bubbles: true }));

    expect(host.topClosed).toBe(true);
    expect(host.bottomClosed).toBe(false);
  });

  it('renders the close control with a visible action icon', () => {
    const fixture = TestBed.createComponent(ModalShellComponent);
    fixture.componentInstance.title = 'Test';
    fixture.componentInstance.headerVariant = 'compact';
    fixture.detectChanges();

    const close = fixture.nativeElement.querySelector('.cf-modal-shell__close--compact');
    expect(close).toBeTruthy();
    expect(close.querySelector('app-cf-action-icon')).toBeTruthy();
  });

  it('emits closeRequested on Escape when it is the only dialog', () => {
    const fixture = TestBed.createComponent(ModalShellComponent);
    const component = fixture.componentInstance;
    const closeSpy = jest.fn();
    component.closeRequested.subscribe(closeSpy);
    fixture.detectChanges();

    document.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape', bubbles: true }));

    expect(closeSpy).toHaveBeenCalledTimes(1);
  });

  it('assigns a nested overlay a higher z-index than the parent modal', () => {
    const fixture = TestBed.createComponent(StackedModalHostComponent);
    fixture.detectChanges();

    const overlays = fixture.nativeElement.querySelectorAll('.cf-modal-shell__overlay') as NodeListOf<HTMLElement>;
    expect(overlays.length).toBe(2);
    const bottomZ = Number(overlays[0].style.zIndex);
    const topZ = Number(overlays[1].style.zIndex);
    expect(topZ).toBeGreaterThan(bottomZ);
  });

  it('does not close a covered parent modal from backdrop click', () => {
    const fixture = TestBed.createComponent(StackedModalHostComponent);
    const host = fixture.componentInstance;
    fixture.detectChanges();

    const overlays = fixture.nativeElement.querySelectorAll('.cf-modal-shell__overlay') as NodeListOf<HTMLElement>;
    expect(overlays[0].classList.contains('cf-modal-shell__overlay--covered')).toBe(true);
    overlays[0].click();

    expect(host.bottomClosed).toBe(false);
    expect(host.topClosed).toBe(false);
  });
});
