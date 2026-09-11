import { ComponentFixture, TestBed } from '@angular/core/testing';
import { ImageViewerComponent } from './image-viewer.component';

describe('ImageViewerComponent', () => {
  let fixture: ComponentFixture<ImageViewerComponent>;
  let component: ImageViewerComponent;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [ImageViewerComponent],
    }).compileComponents();

    fixture = TestBed.createComponent(ImageViewerComponent);
    component = fixture.componentInstance;
    component.src = 'https://example.com/photo.jpg';
    component.alt = 'Rev. Fr. John Doe';
    component.title = 'Rev. Fr. John Doe';
    component.subtitle = 'Parish Priest';
    fixture.detectChanges();
  });

  it('renders an accessible dialog with zoom controls', () => {
    expect(fixture.nativeElement.querySelector('[role="dialog"]')).toBeTruthy();
    expect(fixture.nativeElement.querySelector('[aria-label="Zoom out"]')).toBeTruthy();
    expect(fixture.nativeElement.querySelector('[aria-label="Zoom in"]')).toBeTruthy();
    expect(fixture.nativeElement.querySelector('[aria-label="Reset zoom to fit"]')).toBeTruthy();
    expect(fixture.nativeElement.querySelector('img')?.getAttribute('alt')).toBe('Rev. Fr. John Doe');
  });

  it('starts in fit mode after image load', () => {
    fixture.detectChanges();
    const stage = fixture.nativeElement.querySelector('.cf-image-viewer__stage') as HTMLElement;
    const img = fixture.nativeElement.querySelector('.cf-image-viewer__image') as HTMLImageElement;

    Object.defineProperty(stage, 'clientWidth', { configurable: true, value: 800 });
    Object.defineProperty(stage, 'clientHeight', { configurable: true, value: 600 });
    Object.defineProperty(img, 'naturalWidth', { configurable: true, value: 2000 });
    Object.defineProperty(img, 'naturalHeight', { configurable: true, value: 3000 });
    img.dispatchEvent(new Event('load'));
    fixture.detectChanges();

    expect(component.naturalWidth).toBe(2000);
    expect(component.naturalHeight).toBe(3000);
    expect(component.fit).toBeCloseTo(0.2);
    expect(component.currentScale).toBeCloseTo(0.2);
    expect(component.zoomLabel).toBe('Fit');
  });

  it('steps zoom in and resets', () => {
    const stage = fixture.nativeElement.querySelector('.cf-image-viewer__stage') as HTMLElement;
    Object.defineProperty(stage, 'clientWidth', { configurable: true, value: 800 });
    Object.defineProperty(stage, 'clientHeight', { configurable: true, value: 600 });
    component.naturalWidth = 2000;
    component.naturalHeight = 1500;

    component.fit = 0.4;
    component.currentScale = 0.4;

    component.zoomIn();
    expect(component.currentScale).toBe(1);
    expect(component.zoomLabel).toBe('100%');

    component.zoomIn();
    expect(component.currentScale).toBe(1.25);

    component.resetZoom();
    expect(component.currentScale).toBe(0.4);
    expect(component.zoomLabel).toBe('Fit');
  });

  it('shows an error state when the image fails to load', () => {
    component.onImageError();
    fixture.detectChanges();

    expect(component.loadError).toBe(true);
    expect(fixture.nativeElement.textContent).toContain('Photo unavailable');
  });

  it('emits closeRequested from the modal shell close action', () => {
    const closeSpy = jest.fn();
    component.closeRequested.subscribe(closeSpy);

    fixture.nativeElement.querySelector('[aria-label="Close image viewer"]')?.click();
    expect(closeSpy).toHaveBeenCalled();
  });

  it('does not start pan capture when pressing toolbar controls while zoomed', () => {
    const stage = fixture.nativeElement.querySelector('.cf-image-viewer__stage') as HTMLElement;
    const toolbar = fixture.nativeElement.querySelector('.cf-image-viewer__toolbar') as HTMLElement;
    const setPointerCapture = jest.fn();
    stage.setPointerCapture = setPointerCapture;

    component.fit = 0.4;
    component.currentScale = 1.25;
    component.onPointerDown({
      target: toolbar,
      pointerId: 1,
    } as unknown as PointerEvent);

    expect(setPointerCapture).not.toHaveBeenCalled();
  });
});
