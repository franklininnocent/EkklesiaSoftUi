import { EmblemId } from '../models/certificate';

/** Canonical sacramental header emblem — Chi-Rho (Holy Orders standard). */
export const CANONICAL_SACRAMENTAL_EMBLEM: EmblemId = 'CHI_RHO';

/** Inline Chi-Rho SVG matching public/certificates/emblems/chi-rho.svg */
export const CHI_RHO_SVG_INNER = `
  <circle cx="32" cy="32" r="30" fill="none" stroke="currentColor" stroke-width="1.5"/>
  <path d="M32 10v44M18 22h28" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round"/>
  <path d="M22 14c8 6 8 30 0 36M42 14c-8 6-8 30 0 36" fill="none" stroke="currentColor" stroke-width="2"/>
`.trim();
