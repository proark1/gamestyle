/** Samples the server-aligned clock. Missing seconds never become a catch-up burst. */
export class Countdown {
  private round = '';
  private previous: number | null = null;
  sample(round: string, seconds: number, active: boolean): string[] {
    const remaining = Math.max(0, Math.ceil(seconds));
    if (!active || this.round !== round || this.previous === null) {
      this.round = round;
      this.previous = active ? remaining : null;
      return [];
    }
    const before = this.previous;
    this.previous = Math.min(before, remaining);
    if (remaining >= before) return [];
    if (remaining === 0) return ['timer.end'];
    if (remaining < 10) return ['timer.tick'];
    if (remaining <= 10 && before > 10)
      return ['timer.ten', 'speech.timer.ten'];
    if (remaining <= 30 && before > 30)
      return ['timer.lastCall', 'speech.timer.lastCall'];
    if (remaining <= 60 && before > 60)
      return ['timer.minute', 'speech.timer.minute'];
    return [];
  }
}
