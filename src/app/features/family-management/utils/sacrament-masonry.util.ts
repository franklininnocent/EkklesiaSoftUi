/**
 * Row span for a content-sized card inside a 1px-track masonry grid.
 * The span includes the card's bottom margin so the next card in that
 * column starts after a consistent gap, with at most one track of slack.
 */
export function sacramentMasonryRowSpan(
  contentHeightPx: number,
  marginBottomPx: number,
  rowHeightPx: number
): number {
  const row = rowHeightPx > 0 ? rowHeightPx : 1;
  const occupied = Math.max(0, contentHeightPx) + Math.max(0, marginBottomPx);
  if (occupied <= 0) {
    return 1;
  }
  return Math.max(1, Math.ceil(occupied / row));
}
