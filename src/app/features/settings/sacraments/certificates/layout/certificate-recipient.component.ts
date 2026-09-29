import { afterNextRender, Component, ElementRef, Injector, Input, OnChanges, ViewChild } from '@angular/core';
import { CommonModule } from '@angular/common';
import { fitCertificateText } from '../text-fit/text-fit';

@Component({
  selector: 'app-certificate-recipient',
  standalone: true,
  imports: [CommonModule],
  template: `
    <div class="cert-recipient">
      <span class="cert-recipient__label">{{ label }}</span>
      <p #nameEl class="cert-recipient__name">{{ name }}</p>
    </div>
  `,
  styles: [`
    .cert-recipient { text-align: center; margin: 4mm 0; }
    .cert-recipient__label {
      display: block;
      text-transform: uppercase;
      letter-spacing: 0.8mm;
      font-size: 2.8mm;
      color: var(--cert-muted);
    }
    .cert-recipient__name {
      margin: 1.5mm 0 0;
      font-family: var(--cert-font-display);
      font-size: 9mm;
      line-height: 1.15;
      overflow-wrap: anywhere;
      white-space: normal;
    }
  `],
})
export class CertificateRecipientComponent implements OnChanges {
  @Input({ required: true }) name = '';
  @Input({ required: true }) label = '';
  @ViewChild('nameEl') nameEl?: ElementRef<HTMLElement>;
  fontSizePx = 34;
  overflow = false;

  constructor(private injector: Injector) {
    afterNextRender(() => this.applyFit(), { injector: this.injector });
  }

  ngOnChanges(): void {
    afterNextRender(() => this.applyFit(), { injector: this.injector });
  }

  private applyFit(): void {
    const el = this.nameEl?.nativeElement;
    if (!el) {
      return;
    }
    let measure: (text: string, size: number) => number = (text, size) => text.length * size * 0.52;
    try {
      const canvas = document.createElement('canvas').getContext('2d');
      if (canvas) {
        measure = (text: string, size: number) => {
          canvas.font = `${size}px "Playfair Display", serif`;
          return canvas.measureText(text).width;
        };
      }
    } catch {
      // jsdom has no canvas implementation
    }
    const maxWidth = el.clientWidth || 640;
    const result = fitCertificateText({
      text: this.name,
      maxWidthPx: maxWidth,
      maxLines: 2,
      fontSizePx: 34,
      measureWidth: measure,
    });
    this.fontSizePx = result.fontSizePx;
    this.overflow = result.overflow;
    el.style.fontSize = `${result.fontSizePx}px`;
  }
}
