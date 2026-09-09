import { Countdown } from './audio/countdown';
import type {
  SiteAudio,
  Atmosphere,
} from '../../shared/audio/construction/player';
import { jobProgress, type Snapshot, type Vec } from './model';

export class ChaosAudioDirector {
  private countdown = new Countdown();
  private round = '';
  private phase = '';
  private inspectionStep = -1;
  private awardStep = -1;
  private missionDone = false;
  private strained = false;
  constructor(private audio: SiteAudio) {}
  update(s: Snapshot | null, now: number, position?: Vec) {
    if (!s) {
      this.audio.atmosphere('menu');
      this.audio.setLoop('crew', null);
      this.round = '';
      return;
    }
    const w = s.world,
      p = w.party;
    const round = `${s.code}:${p?.roundId ?? w.started}`;
    const fresh = round !== this.round;
    if (fresh) {
      this.round = round;
      this.phase = '';
      this.inspectionStep = -1;
      this.awardStep = -1;
      this.missionDone = !!s.mission?.done;
      this.strained = false;
    }
    const seconds = ((p?.deadline || w.started + 240000) - now) / 1000;
    const legacyFinished =
      !p && w.mode === 'job' && (seconds <= 0 || jobProgress(w).ratio >= 1);
    const phase = p?.phase ?? (legacyFinished ? 'results' : 'building');
    const changed = phase !== this.phase;
    const timed =
      w.mode === 'job' && ['building', 'lastCall', 'rescue'].includes(phase);
    // Sample the zero crossing before disabling the timer for the inspection phase.
    const timerCues = this.countdown.sample(
      round,
      seconds,
      timed ||
        (!fresh && changed && this.phase !== 'lobby' && phase === 'inspection'),
    );
    timerCues.forEach((c) => this.audio.play(c));
    let mood: Atmosphere =
      phase === 'lobby'
        ? 'lobby'
        : phase === 'inspection'
          ? 'inspection'
          : phase === 'lastCall' || (timed && seconds <= 30)
            ? 'lastCall'
            : w.mode === 'job'
              ? 'challenge'
              : 'build';
    if (phase === 'results') {
      const pass = p?.result?.passed ?? jobProgress(w).ratio >= 1;
      mood = !p || now - p.phaseAt < 8000 ? (pass ? 'win' : 'fail') : 'results';
    }
    this.audio.atmosphere(mood, w.round);
    if (changed && !fresh) {
      if (phase === 'building' && this.phase === 'lobby')
        this.audio.play('speech.crew.start');
      if (phase === 'lastCall' && !timerCues.includes('timer.lastCall')) {
        this.audio.play('timer.lastCall');
        this.audio.play('speech.timer.lastCall');
      }
      if (phase === 'inspection') {
        if (!timerCues.includes('timer.end')) this.audio.play('timer.end');
        this.audio.play('inspection.arrive');
        this.audio.play('speech.inspection.arrive');
      }
      if (phase === 'results') {
        if (!p && seconds <= 0) this.audio.play('timer.end');
        this.audio.play('inspection.stamp');
        this.audio.play(
          (p?.result?.passed ?? jobProgress(w).ratio >= 1)
            ? 'speech.win'
            : 'speech.fail',
        );
      }
    }
    this.phase = phase;
    if (p && phase === 'inspection') {
      const step = Math.min(2, Math.floor((now - p.phaseAt - 6500) / 7000));
      if (step >= 0 && step > this.inspectionStep && !fresh) {
        const cues = [
          jobProgress(w).ratio >= 1 ? 'building.complete' : 'building.missing',
          p.task.phase === 'done' ? 'delivery.complete' : 'delivery.missing',
          p.stats.spills ? 'spills.some' : 'spills.none',
        ];
        this.audio.play(`speech.inspection.${cues[step]}`);
      }
      this.inspectionStep = Math.max(this.inspectionStep, step);
    }
    if (p?.result && phase === 'results') {
      const step = Math.min(
        p.result.awards.length - 1,
        Math.floor((now - p.phaseAt - 8500) / 7500),
      );
      if (step >= 0 && step > this.awardStep && !fresh) {
        const names: Record<string, string> = {
          'Most helpful pair': 'helpers',
          'Biggest spill': 'spill',
          'Rescue crew': 'rescue',
          'Air freight department': 'throw',
        };
        const name = names[p.result.awards[step].title];
        this.audio.play('inspection.award');
        if (name) this.audio.play(`speech.award.${name}`);
      }
      this.awardStep = Math.max(this.awardStep, step);
    }
    if (!fresh && s.mission?.done && !this.missionDone)
      this.audio.play('party.card.done');
    this.missionDone = !!s.mission?.done;
    let loop: string | null = null;
    if (p && ['building', 'lastCall', 'rescue'].includes(phase)) {
      const t = p.task;
      const moving =
        t.phase === 'working' &&
        Object.values(t.inputs).some(
          (i) => now - i.at < 500 && (i.x || i.z || i.turn),
        );
      const near =
        !position || Math.hypot(t.x - position.x, t.z - position.z) < 14;
      if (moving && near) loop = `party.${t.kind}.move`;
      if (!fresh && near && t.tilt >= 0.65 && !this.strained)
        this.audio.play('party.strain', 0.7);
      this.strained = t.tilt >= 0.45;
    }
    if (w.crane && w.crane.phase !== 'ready' && phase === 'building')
      loop = 'party.crane.move';
    this.audio.setLoop('crew', loop);
  }
}
