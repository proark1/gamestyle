/** Sustained frame timing, not screen size alone, determines quality reductions. */
export class AdaptiveQuality {
  level = 0;
  private slow = 0;
  private fast = 0;
  record(gap: number) {
    if (gap <= 0 || gap > 5000) {
      this.reset();
      return false;
    }
    gap = Math.min(gap, 250);
    this.slow = gap > 23 ? this.slow + gap : Math.max(0, this.slow - gap * 2);
    this.fast = gap < 18.5 ? this.fast + gap : 0;
    const before = this.level;
    if (this.slow >= 3000 && this.level < 2) {
      this.level++;
      this.reset();
    } else if (this.fast >= 20000 && this.level > 0) {
      this.level--;
      this.reset();
    }
    return this.level !== before;
  }
  reset() {
    this.slow = 0;
    this.fast = 0;
  }
}
