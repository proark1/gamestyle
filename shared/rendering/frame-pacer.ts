/** Carries fractional refresh periods; decisions are shared by all passes in a frame. */
export class FramePacer {
  private stamp = -1;
  private deadline = 0;
  private fps = 0;
  private accepted = true;
  private last = 0;
  refreshMs = 1000 / 60;
  reset() {
    this.stamp = -1;
    this.deadline = 0;
    this.last = 0;
    this.refreshMs = 1000 / 60;
  }
  due(stamp: number, fps: number) {
    if (stamp === this.stamp && fps === this.fps) return this.accepted;
    const gap = this.last ? stamp - this.last : 0;
    if (gap > 3 && gap < 40) this.refreshMs = Math.min(this.refreshMs, gap);
    this.last = stamp;
    this.stamp = stamp;
    const period = 1000 / fps;
    if (!this.deadline || fps !== this.fps || stamp - this.deadline > 1000)
      this.deadline = stamp;
    this.fps = fps;
    this.accepted = stamp + 0.5 >= this.deadline;
    if (this.accepted)
      this.deadline +=
        Math.max(1, Math.floor((stamp + 0.5 - this.deadline) / period) + 1) *
        period;
    return this.accepted;
  }
  qualityGap(gap: number, fps: number) {
    return (gap * Math.min(fps, 1000 / this.refreshMs)) / 60;
  }
}
