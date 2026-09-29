import { Directive, ElementRef, inject, OnDestroy, OnInit, Renderer2 } from '@angular/core';
import { SubscriptionAccessService } from '@core/services/subscription-access.service';
import { effect } from '@angular/core';

/**
 * Disables interactive elements when parish subscription is read-only.
 * Does not duplicate expiry logic — uses SubscriptionAccessService only.
 */
@Directive({
  selector: '[cfDisableWhenReadOnly]',
  standalone: true,
})
export class DisableWhenReadOnlyDirective implements OnInit, OnDestroy {
  private readonly access = inject(SubscriptionAccessService);
  private readonly el = inject(ElementRef<HTMLElement>);
  private readonly renderer = inject(Renderer2);
  private titleBackup: string | null = null;

  private readonly readOnlyEffect = effect(() => {
    this.apply(this.access.isReadOnly());
  });

  ngOnInit(): void {
    this.apply(this.access.isReadOnly());
  }

  ngOnDestroy(): void {
    this.readOnlyEffect.destroy();
  }

  private apply(readOnly: boolean): void {
    const node = this.el.nativeElement;

    if (readOnly) {
      this.renderer.setAttribute(node, 'disabled', 'true');
      this.renderer.setAttribute(node, 'aria-disabled', 'true');
      this.renderer.addClass(node, 'cf-read-only-disabled');
      if (!this.titleBackup) {
        this.titleBackup = node.getAttribute('title');
      }
      if (!node.getAttribute('title')) {
        this.renderer.setAttribute(node, 'title', 'Read-only: renew subscription to save changes');
      }
    } else {
      this.renderer.removeAttribute(node, 'disabled');
      this.renderer.removeAttribute(node, 'aria-disabled');
      this.renderer.removeClass(node, 'cf-read-only-disabled');
      if (this.titleBackup !== null) {
        if (this.titleBackup) {
          this.renderer.setAttribute(node, 'title', this.titleBackup);
        } else {
          this.renderer.removeAttribute(node, 'title');
        }
        this.titleBackup = null;
      }
    }
  }
}
