import { TextFitStatus } from '../models/certificate';

export const TEXT_FIT_MIN_SCALE = 0.72;
export const TEXT_FIT_SCALE_STEP = 0.04;

export interface TextFitInput {
  text: string;
  maxWidthPx: number;
  maxLines: number;
  fontSizePx: number;
  measureWidth: (text: string, fontSizePx: number) => number;
}

export interface TextFitResult {
  status: TextFitStatus;
  fontSizePx: number;
  lines: string[];
  overflow: boolean;
}

function wrapLine(text: string, maxWidthPx: number, fontSizePx: number, measureWidth: TextFitInput['measureWidth']): string[] {
  const words = text.trim().split(/\s+/).filter(Boolean);
  if (words.length === 0) {
    return [];
  }
  const lines: string[] = [];
  let current = '';
  for (const word of words) {
    const candidate = current ? `${current} ${word}` : word;
    if (measureWidth(candidate, fontSizePx) <= maxWidthPx || !current) {
      current = candidate;
    } else {
      lines.push(current);
      current = word;
    }
  }
  if (current) {
    lines.push(current);
  }
  return lines;
}

/**
 * WRAP_THEN_SCALE: wrap first, then reduce font size. Never clip names.
 * ERROR if the name still overflows after min scale (block issue).
 */
export function fitCertificateText(input: TextFitInput): TextFitResult {
  const text = (input.text || '').trim();
  if (!text) {
    return { status: 'OK', fontSizePx: input.fontSizePx, lines: [], overflow: false };
  }

  let fontSize = input.fontSizePx;
  let scaled = false;

  while (fontSize >= input.fontSizePx * TEXT_FIT_MIN_SCALE - 0.001) {
    const lines = wrapLine(text, input.maxWidthPx, fontSize, input.measureWidth);
    const anyOverflow = lines.some((line) => input.measureWidth(line, fontSize) > input.maxWidthPx);
    if (!anyOverflow && lines.length <= input.maxLines) {
      return {
        status: scaled ? 'SCALED' : 'OK',
        fontSizePx: fontSize,
        lines,
        overflow: false,
      };
    }
    scaled = true;
    fontSize = Math.round((fontSize - input.fontSizePx * TEXT_FIT_SCALE_STEP) * 100) / 100;
  }

  const finalSize = input.fontSizePx * TEXT_FIT_MIN_SCALE;
  const lines = wrapLine(text, input.maxWidthPx, finalSize, input.measureWidth);
  return {
    status: 'ERROR',
    fontSizePx: finalSize,
    lines,
    overflow: true,
  };
}

export function canIssueWithTextFit(results: TextFitResult[]): boolean {
  return results.every((row) => row.status !== 'ERROR');
}
