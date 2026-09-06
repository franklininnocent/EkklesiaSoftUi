export type EmblemId = 'CHI_RHO' | 'SACRED_HEART' | 'DOVE' | 'CROSS' | 'PALM' | 'NONE';

export const CERTIFICATE_EMBLEM_PATH: Record<Exclude<EmblemId, 'NONE'>, string> = {
  CHI_RHO: '/certificates/emblems/chi-rho.svg',
  SACRED_HEART: '/certificates/emblems/sacred-heart.svg',
  DOVE: '/certificates/emblems/dove.svg',
  CROSS: '/certificates/emblems/cross.svg',
  PALM: '/certificates/emblems/palm.svg',
};
