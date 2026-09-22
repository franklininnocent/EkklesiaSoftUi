/**
 * Normalize API date strings for HTML <input type="date"> (YYYY-MM-DD).
 */
export function toDateInputValue(value: string | null | undefined): string {
  if (!value) {
    return '';
  }
  if (value.includes('T')) {
    return value.split('T')[0];
  }
  return value.length >= 10 ? value.slice(0, 10) : value;
}
