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

  it('emits closeRequested on Escape when it is the only dialog', () => {
    const fixture = TestBed.createComponent(ModalShellComponent);
    const component = fixture.componentInstance;
    const closeSpy = jest.fn();
    component.closeRequested.subscribe(closeSpy);
    fixture.detectChanges();

    document.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape', bubbles: true }));

    expect(closeSpy).toHaveBeenCalledTimes(1);
  });
});
