import { CommonModule } from '@angular/common';
import {
  AfterViewInit,
  ChangeDetectionStrategy,
  ChangeDetectorRef,
  Component,
  ElementRef,
  EventEmitter,
  HostListener,
  Input,
  OnDestroy,
  Output,
  ViewChild,
  inject,
} from '@angular/core';
import { LoadingSpinnerComponent } from '@shared/components/loading-spinner/loading-spinner.component';
import { ModalShellComponent } from '@shared/components/modal-shell/modal-shell.component';
import {
  clampScale,
  fitScale,
  formatZoomLabel,
  isAtFitScale,
  nextZoomStep,
} from './image-viewer.zoom';

@Component({
  selector: 'app-image-viewer',
  standalone: true,
  imports: [CommonModule, ModalShellComponent, LoadingSpinnerComponent],
  templateUrl: './image-viewer.component.html',
  styleUrl: './image-viewer.component.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class ImageViewerComponent implements AfterViewInit, OnDestroy {
  private readonly cdr = inject(ChangeDetectorRef);
  private resizeObserver: ResizeObserver | null = null;
  private panStart: { x: number; y: number; panX: number; panY: number } | null = null;
  private pinchStart: { distance: number; scale: number } | null = null;

  @Input({ required: true }) src!: string;
  @Input({ required: true }) alt!: string;
  @Input() title = '';
  @Input() subtitle = '';

  /** When true, stacks above an already-open dialog (e.g. image viewer over a form modal). */
  @Input() nested = false;

  @Output() closeRequested = new EventEmitter<void>();

  @ViewChild('stageRef') stageRef?: ElementRef<HTMLElement>;
  @ViewChild('imageRef') imageRef?: ElementRef<HTMLImageElement>;

  loading = true;
  loadError = false;
  naturalWidth = 0;
  naturalHeight = 0;
  fit = 1;
  currentScale = 1;
  panX = 0;
  panY = 0;

  ngAfterViewInit(): void {
    if (typeof ResizeObserver !== 'undefined' && this.stageRef?.nativeElement) {
      this.resizeObserver = new ResizeObserver(() => this.onStageResize());
      this.resizeObserver.observe(this.stageRef.nativeElement);
    }
  }

  ngOnDestroy(): void {
    this.resizeObserver?.disconnect();
    this.resizeObserver = null;
  }

  get zoomLabel(): string {
    return formatZoomLabel(this.currentScale, this.fit);
  }

  get canZoomOut(): boolean {
    return !isAtFitScale(this.currentScale, this.fit);
  }

  get canZoomIn(): boolean {
    return this.currentScale < 3 - 0.001;
  }

  get canvasTransform(): string {
    return `translate(${this.panX}px, ${this.panY}px) scale(${this.currentScale})`;
  }

  onImageLoad(): void {
    const image = this.imageRef?.nativeElement;
    if (!image) {
      return;
    }

    this.loading = false;
    this.loadError = false;
    this.naturalWidth = image.naturalWidth;
    this.naturalHeight = image.naturalHeight;
    this.resetToFit();
    this.cdr.markForCheck();
  }

  onImageError(): void {
    this.loading = false;
    this.loadError = true;
    this.cdr.markForCheck();
  }

  zoomIn(): void {
    if (!this.canZoomIn) {
      return;
    }

    this.currentScale = nextZoomStep(this.currentScale, this.fit, 'in');
    this.clampPan();
    this.cdr.detectChanges();
  }

  zoomOut(): void {
    if (!this.canZoomOut) {
      return;
    }

    this.currentScale = nextZoomStep(this.currentScale, this.fit, 'out');
    if (isAtFitScale(this.currentScale, this.fit)) {
      this.panX = 0;
      this.panY = 0;
    } else {
      this.clampPan();
    }
    this.cdr.detectChanges();
  }

  resetZoom(): void {
    this.resetToFit();
    this.cdr.detectChanges();
  }

  onStageKeyDown(event: KeyboardEvent): void {
    const target = event.target as HTMLElement | null;
    if (target && ['INPUT', 'TEXTAREA', 'SELECT'].includes(target.tagName)) {
      return;
    }

    if (event.key === '+' || event.key === '=') {
      event.preventDefault();
      this.zoomIn();
      return;
    }

    if (event.key === '-') {
      event.preventDefault();
      this.zoomOut();
      return;
    }

    if (event.key === '0') {
      event.preventDefault();
      this.resetZoom();
    }
  }

  onPointerDown(event: PointerEvent): void {
    if (this.loading || this.loadError || !this.stageRef?.nativeElement) {
      return;
    }

    const target = event.target;
    if (target instanceof Element && target.closest('.cf-image-viewer__toolbar')) {
      return;
    }

    if (!isAtFitScale(this.currentScale, this.fit)) {
      this.stageRef.nativeElement.setPointerCapture(event.pointerId);
      this.panStart = {
        x: event.clientX,
        y: event.clientY,
        panX: this.panX,
        panY: this.panY,
      };
    }
  }

  onPointerMove(event: PointerEvent): void {
    if (!this.panStart) {
      return;
    }

    this.panX = this.panStart.panX + (event.clientX - this.panStart.x);
    this.panY = this.panStart.panY + (event.clientY - this.panStart.y);
    this.clampPan();
    this.cdr.markForCheck();
  }

  onPointerUp(event: PointerEvent): void {
    if (this.stageRef?.nativeElement.hasPointerCapture(event.pointerId)) {
      this.stageRef.nativeElement.releasePointerCapture(event.pointerId);
    }
    this.panStart = null;
  }

  onTouchStart(event: TouchEvent): void {
    if (event.touches.length === 2) {
      this.panStart = null;
      this.pinchStart = {
        distance: this.getTouchDistance(event.touches),
        scale: this.currentScale,
      };
    }
  }

  onTouchMove(event: TouchEvent): void {
    if (event.touches.length !== 2 || !this.pinchStart) {
      return;
    }

    event.preventDefault();
    const distance = this.getTouchDistance(event.touches);
    if (distance <= 0 || this.pinchStart.distance <= 0) {
      return;
    }

    const ratio = distance / this.pinchStart.distance;
    this.currentScale = clampScale(this.pinchStart.scale * ratio, this.fit);
    this.clampPan();
    this.cdr.markForCheck();
  }

  onTouchEnd(): void {
    this.pinchStart = null;
  }

  @HostListener('window:keydown', ['$event'])
  onWindowKeyDown(event: KeyboardEvent): void {
    if (event.key === '+' || event.key === '=' || event.key === '-' || event.key === '0') {
      this.onStageKeyDown(event);
    }
  }

  private resetToFit(): void {
    this.fit = this.getStageFit();
    this.currentScale = this.fit;
    this.panX = 0;
    this.panY = 0;
  }

  private onStageResize(): void {
    const previousFit = this.fit;
    const wasAtFit = isAtFitScale(this.currentScale, previousFit);
    this.fit = this.getStageFit();

    if (wasAtFit) {
      this.currentScale = this.fit;
      this.panX = 0;
      this.panY = 0;
    } else {
      this.currentScale = clampScale(this.currentScale, this.fit);
      this.clampPan();
    }

    this.cdr.markForCheck();
  }

  private getStageFit(): number {
    const stage = this.stageRef?.nativeElement;
    if (!stage || this.naturalWidth <= 0 || this.naturalHeight <= 0) {
      return 1;
    }

    return fitScale(
      this.naturalWidth,
      this.naturalHeight,
      stage.clientWidth,
      stage.clientHeight,
    );
  }

  private clampPan(): void {
    const stage = this.stageRef?.nativeElement;
    if (!stage || this.naturalWidth <= 0 || this.naturalHeight <= 0) {
      return;
    }

    const displayWidth = this.naturalWidth * this.currentScale;
    const displayHeight = this.naturalHeight * this.currentScale;
    const maxPanX = Math.max(0, (displayWidth - stage.clientWidth) / 2);
    const maxPanY = Math.max(0, (displayHeight - stage.clientHeight) / 2);

    this.panX = clampBetween(this.panX, -maxPanX, maxPanX);
    this.panY = clampBetween(this.panY, -maxPanY, maxPanY);
  }

  private getTouchDistance(touches: TouchList): number {
    if (touches.length < 2) {
      return 0;
    }

    const first = touches[0];
    const second = touches[1];
    const dx = first.clientX - second.clientX;
    const dy = first.clientY - second.clientY;
    return Math.hypot(dx, dy);
  }
}

function clampBetween(value: number, min: number, max: number): number {
  return Math.max(min, Math.min(max, value));
}
