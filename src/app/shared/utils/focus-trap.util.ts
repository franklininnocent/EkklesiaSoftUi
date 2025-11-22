/**
 * Focus Trap Utility
 * 
 * Provides utilities for managing focus within modals and dialogs
 * to ensure proper keyboard navigation and accessibility.
 */

/**
 * Get all focusable elements within a container
 */
export function getFocusableElements(container: HTMLElement): HTMLElement[] {
  const focusableSelectors = [
    'a[href]',
    'button:not([disabled])',
    'textarea:not([disabled])',
    'input:not([disabled])',
    'select:not([disabled])',
    '[tabindex]:not([tabindex="-1"])',
    '[contenteditable="true"]'
  ].join(', ');

  return Array.from(container.querySelectorAll<HTMLElement>(focusableSelectors))
    .filter(element => {
      // Filter out hidden elements
      const style = window.getComputedStyle(element);
      return style.display !== 'none' && style.visibility !== 'hidden' && style.opacity !== '0';
    });
}

/**
 * Trap focus within a container
 * Returns a cleanup function
 */
export function trapFocus(container: HTMLElement): () => void {
  const focusableElements = getFocusableElements(container);
  
  if (focusableElements.length === 0) {
    return () => {}; // No cleanup needed
  }

  const firstElement = focusableElements[0];
  const lastElement = focusableElements[focusableElements.length - 1];

  // Focus the first element
  firstElement.focus();

  const handleKeyDown = (event: KeyboardEvent): void => {
    if (event.key !== 'Tab') {
      return;
    }

    if (event.shiftKey) {
      // Shift + Tab: move backwards
      if (document.activeElement === firstElement) {
        event.preventDefault();
        lastElement.focus();
      }
    } else {
      // Tab: move forwards
      if (document.activeElement === lastElement) {
        event.preventDefault();
        firstElement.focus();
      }
    }
  };

  container.addEventListener('keydown', handleKeyDown);

  // Return cleanup function
  return () => {
    container.removeEventListener('keydown', handleKeyDown);
  };
}

/**
 * Save the currently focused element
 */
export function saveActiveElement(): HTMLElement | null {
  return document.activeElement as HTMLElement;
}

/**
 * Restore focus to a previously saved element
 */
export function restoreActiveElement(element: HTMLElement | null): void {
  if (element && typeof element.focus === 'function') {
    element.focus();
  }
}

