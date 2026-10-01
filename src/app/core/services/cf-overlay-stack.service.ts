import { Injectable } from '@angular/core';
import { BehaviorSubject } from 'rxjs';

/**
 * Overlay stacking tokens — keep in sync with `_church-financial-os-tokens.scss`.
 * Nested overlays are assigned from the token ladder plus a small step so that
 * Page → Modal → Drawer → Confirmation always stacks predictably without
 * one-off z-index values.
 */
export const CF_OVERLAY_Z = {
  dropdown: 1000,
  drawer: 1100,
  modal: 1200,
  nested: 1300,
  commandPalette: 1350,
  toast: 1400,
  step: 10,
} as const;

export type CfOverlayKind = 'modal' | 'drawer' | 'confirm' | 'palette';

export interface CfOverlayHandle {
  readonly id: string;
  readonly kind: CfOverlayKind;
  readonly zIndex: number;
  isTop(): boolean;
  release(): void;
}

interface CfOverlayEntry {
  id: string;
  kind: CfOverlayKind;
  zIndex: number;
  close: () => void;
  canClose?: () => boolean;
}

@Injectable({ providedIn: 'root' })
export class CfOverlayStackService {
  private nextId = 0;
  private readonly stack: CfOverlayEntry[] = [];
  private previousBodyOverflow = '';
  private readonly topIdSubject = new BehaviorSubject<string | null>(null);

  readonly topId$ = this.topIdSubject.asObservable();

  get depth(): number {
    return this.stack.length;
  }

  get top(): CfOverlayEntry | null {
    return this.stack.length ? this.stack[this.stack.length - 1] : null;
  }

  push(
    kind: CfOverlayKind,
    close: () => void,
    options?: { nested?: boolean; canClose?: () => boolean }
  ): CfOverlayHandle {
    const id = `cf-overlay-${++this.nextId}`;
    const zIndex = this.nextZIndex(kind, options?.nested === true);
    const entry: CfOverlayEntry = {
      id,
      kind,
      zIndex,
      close,
      canClose: options?.canClose,
    };
    this.stack.push(entry);
    this.lockBody();
    this.topIdSubject.next(id);

    return {
      id,
      kind,
      zIndex,
      isTop: () => this.top?.id === id,
      release: () => this.pop(id),
    };
  }

  pop(id: string): void {
    const index = this.stack.findIndex((entry) => entry.id === id);
    if (index < 0) {
      return;
    }
    this.stack.splice(index, 1);
    this.unlockBody();
    this.topIdSubject.next(this.top?.id ?? null);
  }

  /** Test-only: drop leftover layers so specs do not share stack state. */
  reset(): void {
    this.stack.splice(0, this.stack.length);
    this.unlockBody();
    this.topIdSubject.next(null);
  }

  isTop(id: string): boolean {
    return this.top?.id === id;
  }

  zIndexOf(id: string): number | null {
    return this.stack.find((entry) => entry.id === id)?.zIndex ?? null;
  }

  private nextZIndex(kind: CfOverlayKind, nestedHint: boolean): number {
    const previous = this.top?.zIndex ?? 0;
    const base = this.baseZIndex(kind, nestedHint);
    if (this.stack.length === 0) {
      return base;
    }
    return Math.max(CF_OVERLAY_Z.nested, base, previous + CF_OVERLAY_Z.step);
  }

  private baseZIndex(kind: CfOverlayKind, nestedHint: boolean): number {
    if (kind === 'drawer') {
      return CF_OVERLAY_Z.drawer;
    }
    if (kind === 'palette') {
      return CF_OVERLAY_Z.commandPalette;
    }
    if (kind === 'confirm' || nestedHint) {
      return CF_OVERLAY_Z.nested;
    }
    return CF_OVERLAY_Z.modal;
  }

  private lockBody(): void {
    if (this.stack.length === 1) {
      this.previousBodyOverflow = document.body.style.overflow;
      document.body.style.overflow = 'hidden';
    }
  }

  private unlockBody(): void {
    if (this.stack.length === 0) {
      document.body.style.overflow = this.previousBodyOverflow;
    }
  }
}
