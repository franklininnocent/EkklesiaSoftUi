/**
 * Parish calendar date in the user's local timezone.
 * Date-only fields must never be derived from UTC ISO strings.
 */
export function localDateOnly(date: Date = new Date()): string {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, '0');
  const day = String(date.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
}

export function requiresGatewayReference(method: string): boolean {
  return method === 'cheque' || method === 'bank_transfer';
}

export function newIdempotencyKey(): string {
  if (typeof crypto !== 'undefined' && typeof crypto.randomUUID === 'function') {
    return crypto.randomUUID();
  }
  return `idemp-${Date.now()}-${Math.random().toString(16).slice(2)}`;
}
