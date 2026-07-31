/**
 * Standard Icons Constants
 * 
 * This file contains standardized SVG icons used throughout the application.
 * All icons follow a consistent design pattern for visual consistency.
 * 
 * IMPORTANT: When using these icons, always use the exact SVG code provided
 * to maintain consistency across the entire application.
 */

/**
 * Standard Delete Icon SVG Template
 * 
 * Simple, clean trash can icon for delete actions.
 * 
 * Usage in Angular templates:
 * ```html
 * <button class="btn-delete">
 *   <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" class="btn-icon">
 *     <polyline points="3 6 5 6 21 6"></polyline>
 *     <path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"></path>
 *     <line x1="10" y1="11" x2="10" y2="17"></line>
 *     <line x1="14" y1="11" x2="14" y2="17"></line>
 *   </svg>
 *   <span>Delete</span>
 * </button>
 * ```
 * 
 * Icon Specifications:
 * - ViewBox: 0 0 24 24
 * - Stroke: currentColor (inherits text color)
 * - Stroke Width: 2
 * - Stroke Linecap: round
 * - Stroke Linejoin: round
 * - Class: btn-icon (for consistent sizing)
 * - Size: 16px x 16px (controlled by CSS)
 */
export const STANDARD_DELETE_ICON = {
  viewBox: '0 0 24 24',
  strokeWidth: '2',
  strokeLinecap: 'round',
  strokeLinejoin: 'round',
  paths: [
    '<polyline points="3 6 5 6 21 6"></polyline>',
    '<path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"></path>',
    '<line x1="10" y1="11" x2="10" y2="17"></line>',
    '<line x1="14" y1="11" x2="14" y2="17"></line>'
  ]
};

/**
 * Standard Delete Icon - Complete SVG Template
 * Use this exact template for all delete buttons
 */
export const DELETE_ICON_SVG_TEMPLATE = `
<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" class="btn-icon">
  <polyline points="3 6 5 6 21 6"></polyline>
  <path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"></path>
  <line x1="10" y1="11" x2="10" y2="17"></line>
  <line x1="14" y1="11" x2="14" y2="17"></line>
</svg>
`;

/**
 * Standard View Icon - eye icon for preview/view actions
 */
export const VIEW_ICON_SVG_TEMPLATE = `
<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" class="btn-icon" aria-hidden="true">
  <path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z"></path>
  <circle cx="12" cy="12" r="3"></circle>
</svg>
`;

/**
 * Standard Print Icon - printer icon for print/PDF actions
 */
export const PRINT_ICON_SVG_TEMPLATE = `
<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" class="btn-icon" aria-hidden="true">
  <polyline points="6 9 6 2 18 2 18 9"></polyline>
  <path d="M6 18H4a2 2 0 0 1-2-2v-5a2 2 0 0 1 2-2h16a2 2 0 0 1 2 2v5a2 2 0 0 1-2 2h-2"></path>
  <rect x="6" y="14" width="12" height="8"></rect>
</svg>
`;
