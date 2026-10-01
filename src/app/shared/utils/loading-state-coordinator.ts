/**
 * Reference-counted loading flag with generation tokens for stale async responses.
 */
export class LoadingStateCoordinator {
  private depth = 0;
  private generation = 0;

  get isLoading(): boolean {
    return this.depth > 0;
  }

  /** Start work; returns a token — only matching {@link end} decrements. */
  begin(): number {
    this.depth += 1;
    return this.generation;
  }

  end(token: number): void {
    if (token !== this.generation) {
      return;
    }
    this.depth = Math.max(0, this.depth - 1);
  }

  /** Invalidate in-flight tokens (e.g. route change, filter change). */
  invalidate(): void {
    this.generation += 1;
    this.depth = 0;
  }

  isCurrent(token: number): boolean {
    return token === this.generation;
  }
}
