import { CommonModule } from '@angular/common';
import { ChangeDetectionStrategy, Component, Input } from '@angular/core';
import { isEmptyRichText, looksLikeHtml } from '../rich-text.utils';

@Component({
  selector: 'app-rich-text-viewer',
  standalone: true,
  imports: [CommonModule],
  templateUrl: './rich-text-viewer.component.html',
  styleUrl: './rich-text-viewer.component.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class RichTextViewerComponent {
  @Input() content: string | null | undefined;
  /** Shown when content is empty. Defaults to em dash to match detail pages. */
  @Input() emptyLabel = '—';

  get isEmpty(): boolean {
    return isEmptyRichText(this.content);
  }

  get isPlainText(): boolean {
    if (this.isEmpty) {
      return false;
    }
    return !looksLikeHtml(String(this.content));
  }

  get htmlContent(): string {
    return String(this.content ?? '');
  }
}
