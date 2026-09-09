export class FrameStats {
  gaps: number[] = [];
  costs: number[] = [];
  record(gap: number, cost: number) {
    if (gap > 0) {
      this.gaps.push(gap);
      this.costs.push(cost);
      if (this.gaps.length > 600) {
        this.gaps.shift();
        this.costs.shift();
      }
    }
  }
  read() {
    const sorted = [...this.gaps].sort((a, b) => a - b),
      costs = [...this.costs].sort((a, b) => a - b);
    return {
      frames: sorted.length,
      fps: Math.round(
        1000 / (this.gaps.reduce((n, v) => n + v, 0) / this.gaps.length || 1),
      ),
      p95FrameMs: sorted[Math.floor(sorted.length * 0.95)] ?? 0,
      p95WorkMs: costs[Math.floor(costs.length * 0.95)] ?? 0,
      longFrames: this.gaps.filter((v) => v > 34).length,
    };
  }
}
