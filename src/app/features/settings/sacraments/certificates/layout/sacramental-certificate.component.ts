import {
  AfterViewInit,
  ChangeDetectorRef,
  Component,
  ElementRef,
  Input,
  NgZone,
  OnChanges,
  OnDestroy,
  QueryList,
  ViewChild,
  ViewChildren,
  inject,
} from '@angular/core';
import { CommonModule } from '@angular/common';
import {
  formatCertificateDate,
  isAnointingCertificate,
  isBaptismCertificate,
  isConfirmationCertificate,
  isFirstCommunionCertificate,
  isHolyOrdersCertificate,
  isMatrimonyCertificate,
  LiturgicalTerminology,
  MatrimonySpouseSnapshot,
  PaperSize,
  PRINT_SPEC,
  SacramentCertificateData,
  SignatureSlot,
  CERT_RECIPIENT_FONT_MM,
} from '../models/certificate';
import { liturgicalTerminology } from '../terminology/en.catalog';
import { resolveTemplate } from '../templates/template-resolver';
import { fitCertificateText } from '../text-fit/text-fit';
import { CertificateDetailRow } from './certificate-details.component';

const MM_TO_PX = 96 / 25.4;

@Component({
  selector: 'app-sacramental-certificate',
  standalone: true,
  imports: [CommonModule],
  templateUrl: './sacramental-certificate.component.html',
  styleUrl: './sacramental-certificate.component.scss',
})
export class SacramentalCertificateComponent implements AfterViewInit, OnChanges, OnDestroy {
  @Input({ required: true }) data!: SacramentCertificateData;
  @Input() paper: PaperSize = 'A4';
  @Input() scaleToFit = true;
  @ViewChild('frame') frameRef?: ElementRef<HTMLElement>;
  @ViewChildren('nameEl') nameEls?: QueryList<ElementRef<HTMLElement>>;

  private readonly zone = inject(NgZone);
  private readonly cdr = inject(ChangeDetectorRef);
  private resizeObserver?: ResizeObserver;

  terms!: LiturgicalTerminology;
  detailRows: CertificateDetailRow[] = [];
  signatureSlots: SignatureSlot[] = [];
  recipientName = '';
  recipientLabel = '';
  groomName = '';
  brideName = '';
  groomSpouse: MatrimonySpouseSnapshot | null = null;
  brideSpouse: MatrimonySpouseSnapshot | null = null;
  isMatrimony = false;
  issuedAtDisplay = '';
  microprint = 'SACRAMENTAL REGISTER';
  themeClass = 'cert-theme-generic';
  scale = 1;

  get hasRegistry(): boolean {
    const r = this.data?.registry;
    return !!(
      r?.bookNumber ||
      r?.pageNumber ||
      r?.registryEntry ||
      r?.certificateNumber ||
      this.issuedAtDisplay
    );
  }

  /** Dense certificates need less flex spacer before signatures. */
  get compactLower(): boolean {
    return this.isMatrimony || this.detailRows.length >= 5;
  }

  ngOnChanges(): void {
    this.rebuild();
    queueMicrotask(() => this.updateScale());
  }

  ngAfterViewInit(): void {
    this.updateScale();
    const frame = this.frameRef?.nativeElement;
    if (typeof ResizeObserver !== 'undefined' && frame) {
      this.resizeObserver = new ResizeObserver(() => {
        this.zone.run(() => this.updateScale());
      });
      this.resizeObserver.observe(frame);
    }
  }

  ngOnDestroy(): void {
    this.resizeObserver?.disconnect();
  }

  private updateScale(): void {
    const spec = PRINT_SPEC[this.paper || 'A4'];
    const naturalW = spec.widthMm * MM_TO_PX;
    const frame = this.frameRef?.nativeElement;
    const available = frame?.clientWidth ?? 0;
    if (this.scaleToFit && available > 8 && naturalW > 0) {
      this.scale = available / naturalW;
    } else if (!this.scaleToFit) {
      this.scale = 1;
    }
    this.cdr.markForCheck();
    queueMicrotask(() => this.applyNameFit());
  }

  private applyNameFit(): void {
    const startPx = CERT_RECIPIENT_FONT_MM * MM_TO_PX;
    this.nameEls?.forEach((ref) => {
      const el = ref.nativeElement;
      const maxWidth = el.clientWidth;
      if (maxWidth < 8) {
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
        // jsdom has no canvas
      }
      const result = fitCertificateText({
        text: el.textContent || '',
        maxWidthPx: maxWidth,
        maxLines: 2,
        fontSizePx: startPx,
        measureWidth: measure,
      });
      el.style.fontSize = `${result.fontSizePx}px`;
    });
  }

  private rebuild(): void {
    if (!this.data) {
      return;
    }
    this.paper = this.paper || this.data.paper || 'A4';
    this.terms = liturgicalTerminology(this.data.church.denominationType, this.data.sacramentType);
    const template = resolveTemplate({
      themeId: this.data.themeId,
      sacramentType: this.data.sacramentType,
      paper: this.paper,
    });
    this.microprint = template.microprintText;
    this.themeClass = `cert-theme-${this.data.themeId || 'generic'}`;
    this.isMatrimony = isMatrimonyCertificate(this.data);
    this.signatureSlots = template.signatureSlots.map((slot, index) => ({
      ...slot,
      name: index === 0 ? this.ministerName() : slot.name,
    }));
    this.detailRows = this.buildRows();
    this.recipientName = this.resolveRecipientName();
    this.recipientLabel = this.terms.recipientLabel;
    if (isMatrimonyCertificate(this.data)) {
      this.groomName = this.data.groomName;
      this.brideName = this.data.brideName;
      this.groomSpouse = this.data.groom || {
        fullName: this.data.groomName,
        fatherName: this.data.groomParents?.father,
        motherName: this.data.groomParents?.mother,
      };
      this.brideSpouse = this.data.bride || {
        fullName: this.data.brideName,
        fatherName: this.data.brideParents?.father,
        motherName: this.data.brideParents?.mother,
      };
    } else {
      this.groomName = '';
      this.brideName = '';
      this.groomSpouse = null;
      this.brideSpouse = null;
    }
    this.issuedAtDisplay = formatCertificateDate(this.data.issuedAt || '', this.data.locale);
  }

  private ministerName(): string | null {
    if ('ministerName' in this.data) {
      return this.data.ministerName || null;
    }
    return null;
  }

  private resolveRecipientName(): string {
    if (isMatrimonyCertificate(this.data)) {
      const groom = this.data.groomName || '';
      const bride = this.data.brideName || '';
      return groom || bride ? `${groom}  &  ${bride}`.trim() : '';
    }
    return this.data.recipientName || '';
  }

  private buildRows(): CertificateDetailRow[] {
    const rows: CertificateDetailRow[] = [];
    const date = formatCertificateDate(this.data.dateOfEvent, this.data.locale);
    if (date) {
      rows.push({ label: this.terms.dateLabel, value: date });
    }
    if (this.data.placeOfEvent) {
      rows.push({ label: this.terms.placeLabel, value: this.data.placeOfEvent });
    }

    if (isBaptismCertificate(this.data)) {
      const birth = formatCertificateDate(this.data.dateOfBirth, this.data.locale);
      if (birth) {
        rows.push({ label: this.terms.dateOfBirthLabel, value: birth });
      }
      if (this.data.placeOfBirth) {
        rows.push({ label: this.terms.placeOfBirthLabel, value: this.data.placeOfBirth });
      }
      if (this.data.fatherName) {
        rows.push({ label: this.terms.fatherLabel, value: this.data.fatherName });
      }
      if (this.data.motherName) {
        rows.push({ label: this.terms.motherLabel, value: this.data.motherName });
      }
      if ((this.data.sponsors ?? []).length) {
        rows.push({ label: this.terms.sponsorsLabel, value: (this.data.sponsors ?? []).join(', ') });
      }
    }

    if (isConfirmationCertificate(this.data)) {
      if (this.data.confirmationName) {
        rows.push({ label: 'Confirmation name', value: this.data.confirmationName });
      }
      if ((this.data.sponsors ?? []).length) {
        rows.push({ label: this.terms.sponsorsLabel, value: (this.data.sponsors ?? []).join(', ') });
      }
    }

    if (isFirstCommunionCertificate(this.data) && this.data.eventSubtype) {
      rows.push({ label: 'Rite', value: this.data.eventSubtype });
    }

    if (isAnointingCertificate(this.data) && this.data.placeClassification) {
      rows.push({ label: 'Location type', value: this.data.placeClassification });
    }

    if (isHolyOrdersCertificate(this.data)) {
      if (this.data.ordinationType) {
        rows.push({ label: 'Ordination', value: this.data.ordinationType });
      }
      if (this.data.dioceseName) {
        rows.push({ label: 'Diocese', value: this.data.dioceseName });
      }
      if ((this.data.coConsecrators ?? []).length) {
        rows.push({ label: 'Co-consecrators', value: (this.data.coConsecrators ?? []).join(', ') });
      }
    }

    if (isMatrimonyCertificate(this.data)) {
      (this.data.witnesses ?? []).forEach((name, index) => {
        if (!name) {
          return;
        }
        const label = index === 0 ? this.terms.witness1Label : index === 1 ? this.terms.witness2Label : `${this.terms.witnessesLabel} ${index + 1}`;
        rows.push({ label, value: name });
      });
    } else if (!isMatrimonyCertificate(this.data)) {
      const minister = this.ministerName();
      if (minister) {
        rows.push({ label: this.terms.ministerLabel, value: minister });
      }
    }

    return rows;
  }
}
