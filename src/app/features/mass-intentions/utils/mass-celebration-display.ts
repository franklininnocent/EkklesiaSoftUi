export function formatMassDayTime(celebratedOn: string, celebratedAt?: string | null): string {
  if (!celebratedAt) {
    return celebratedOn;
  }
  const time = celebratedAt.length > 5 ? celebratedAt.slice(0, 5) : celebratedAt;

  return `${celebratedOn} · ${time}`;
}
