import { TestBed } from '@angular/core/testing';
import { CF_OVERLAY_Z, CfOverlayStackService } from './cf-overlay-stack.service';

describe('CfOverlayStackService', () => {
  let service: CfOverlayStackService;

  beforeEach(() => {
    TestBed.configureTestingModule({});
    service = TestBed.inject(CfOverlayStackService);
    document.body.style.overflow = '';
  });

  afterEach(() => {
    service.reset();
    document.body.style.overflow = '';
  });

  it('assigns drawer below modal on the first layer, then elevates nested overlays', () => {
    const modal = service.push('modal', () => undefined);
    const drawer = service.push('drawer', () => undefined);
    const confirm = service.push('confirm', () => undefined);

    expect(modal.zIndex).toBe(CF_OVERLAY_Z.modal);
    expect(drawer.zIndex).toBe(CF_OVERLAY_Z.nested);
    expect(drawer.zIndex).toBeGreaterThan(modal.zIndex);
    expect(confirm.zIndex).toBeGreaterThan(drawer.zIndex);
    expect(confirm.zIndex).toBeLessThan(CF_OVERLAY_Z.toast);
  });

  it('only treats the last pushed overlay as top and restores the parent on release', () => {
    const modal = service.push('modal', () => undefined);
    const drawer = service.push('drawer', () => undefined);

    expect(drawer.isTop()).toBe(true);
    expect(modal.isTop()).toBe(false);

    drawer.release();

    expect(modal.isTop()).toBe(true);
    expect(service.depth).toBe(1);
  });

  it('locks body scroll on the first overlay and restores it after the last close', () => {
    document.body.style.overflow = 'auto';
    const modal = service.push('modal', () => undefined);
    const drawer = service.push('drawer', () => undefined);

    expect(document.body.style.overflow).toBe('hidden');

    drawer.release();
    expect(document.body.style.overflow).toBe('hidden');

    modal.release();
    expect(document.body.style.overflow).toBe('auto');
  });

  it('keeps a page-level drawer on the drawer token when no modal is open', () => {
    const drawer = service.push('drawer', () => undefined);
    expect(drawer.zIndex).toBe(CF_OVERLAY_Z.drawer);
    drawer.release();
  });

  it('places the command palette above an open modal without reaching toast', () => {
    const modal = service.push('modal', () => undefined);
    const palette = service.push('palette', () => undefined);

    expect(palette.zIndex).toBeGreaterThan(modal.zIndex);
    expect(palette.zIndex).toBeLessThan(CF_OVERLAY_Z.toast);
    expect(palette.isTop()).toBe(true);
    expect(modal.isTop()).toBe(false);

    palette.release();
    expect(modal.isTop()).toBe(true);
  });
});
