import type { GameScene } from './scene';
import type { World } from './model';
import { CREW_JOBS } from './party';
import { portraitCrop, clipCaption } from './capture-layout';
export function downloadBlob(blob: Blob, name: string) {
  const url = URL.createObjectURL(blob),
    a = document.createElement('a');
  a.href = url;
  a.download = name;
  a.click();
  setTimeout(() => URL.revokeObjectURL(url), 30000);
}
function fit(
  ctx: CanvasRenderingContext2D,
  image: HTMLCanvasElement,
  x: number,
  y: number,
  w: number,
  h: number,
) {
  const scale = Math.min(w / image.width, h / image.height),
    sw = image.width * scale,
    sh = image.height * scale;
  ctx.drawImage(image, x + (w - sw) / 2, y + (h - sh) / 2, sw, sh);
}
function wrap(
  ctx: CanvasRenderingContext2D,
  text: string,
  x: number,
  y: number,
  width: number,
  step: number,
  max = 3,
) {
  let line = '',
    rows = 0;
  for (const word of text.split(' ')) {
    if (ctx.measureText(line + word).width > width && line) {
      ctx.fillText(line, x, y);
      y += step;
      line = '';
      if (++rows >= max) return y;
    }
    line += `${word} `;
  }
  ctx.fillText(line, x, y);
  return y + step;
}
export async function postcard(
  scene: GameScene,
  world: World,
  portrait = false,
  names = false,
  shareAddress = '',
): Promise<Blob> {
  const c = document.createElement('canvas');
  c.width = portrait ? 1080 : 1600;
  c.height = portrait ? 1920 : 900;
  const ctx = c.getContext('2d')!;
  ctx.fillStyle = '#f4eedf';
  ctx.fillRect(0, 0, c.width, c.height);
  scene.publicFrame(
    (canvas) => fit(ctx, canvas, 32, 120, c.width - 64, portrait ? 1120 : 540),
    names,
  );
  ctx.fillStyle = '#293c3b';
  ctx.font = '900 48px Arial';
  ctx.fillText('PERMIT PENDING', 48, 80);
  ctx.font = 'bold 20px Arial';
  ctx.fillText(
    CREW_JOBS.find((j) => j.id === world.party?.job)?.name || '',
    48,
    112,
  );
  let y = portrait ? 1330 : 715;
  ctx.font = 'bold 34px Arial';
  y = wrap(
    ctx,
    world.party?.result?.title || 'Another perfectly questionable delivery.',
    48,
    y,
    c.width - 96,
    44,
  );
  ctx.font = '24px Arial';
  for (const award of (world.party?.result?.awards || []).slice(0, 2))
    y = wrap(
      ctx,
      `${award.title}${names ? ` · ${award.text}` : ''}`,
      48,
      y + 12,
      c.width - 96,
      34,
      2,
    );
  ctx.font = 'bold 23px Arial';
  ctx.fillText('Same job. Your crew. Can you do better?', 48, c.height - 70);
  ctx.font = '18px Arial';
  ctx.fillText(
    shareAddress || location.host + '/chaos',
    48,
    c.height - 30,
    c.width - 96,
  );
  return new Promise((resolve, reject) =>
    c.toBlob(
      (b) =>
        b
          ? resolve(b)
          : reject(new Error('The picture could not be exported.')),
      'image/png',
    ),
  );
}
type Segment = {
  recorder: MediaRecorder;
  started: number;
  chunks: Blob[];
  done: Promise<Blob | null>;
  timer: ReturnType<typeof setTimeout>;
  generation: number;
};
export class MomentRecorder {
  highlights: { id: string; at: number; text: string; blob: Blob }[] = [];
  private highlightTimers = new Set<ReturnType<typeof setTimeout>>();
  private seenMoments = new Set<string>();
  private startedServer = 0;
  private caption = '';
  private captionUntil = 0;
  private canvas = document.createElement('canvas');
  private context?: AudioContext;
  private sources: MediaStreamAudioSourceNode[] = [];
  private stream?: MediaStream;
  private active: Segment[] = [];
  private interval?: ReturnType<typeof setInterval>;
  private generation = 0;
  private enabled = false;
  private mime = '';
  private baseline = 0;
  private lastCheck = 0;
  private slowWindows = 0;
  retroactive =
    !/Android|iPhone|iPad|iPod/i.test(navigator.userAgent) &&
    !(navigator.maxTouchPoints > 1 && /Macintosh/i.test(navigator.userAgent));
  constructor(
    private scene: GameScene,
    private state: (text: string) => void,
    private invalidatePreview: () => void,
    private ended: () => void,
    private names = false,
    short = false,
    private portrait = false,
    private shareAddress = '',
  ) {
    this.retroactive = this.retroactive && !short;
    this.canvas.width = portrait ? 720 : 1280;
    this.canvas.height = portrait ? 1280 : 720;
  }
  private draw = (source: HTMLCanvasElement) => {
    const now = performance.now();
    if (this.enabled && now - this.lastCheck > 5000) {
      this.lastCheck = now;
      const current = this.scene.frameP95();
      this.slowWindows =
        this.baseline && current > this.baseline * 1.2
          ? this.slowWindows + 1
          : 0;
      if (this.slowWindows >= 2) {
        void this.stop().then(() =>
          this.state(
            this.retroactive
              ? 'The moment buffer slowed this device. Choose a short recording, or save a postcard.'
              : 'Recording slowed this device. Save a postcard instead.',
          ),
        );
        return;
      }
    }
    const ctx = this.canvas.getContext('2d')!;
    const width = this.canvas.width,
      height = this.canvas.height;
    const snapshot = this.scene.snapshot;
    if (this.enabled && snapshot)
      for (const moment of snapshot.world.party?.inspection?.moments || []) {
        if (
          this.seenMoments.has(moment.id) ||
          moment.at < this.startedServer ||
          snapshot.now - moment.at > 15000
        )
          continue;
        this.seenMoments.add(moment.id);
        const text = clipCaption(
          moment.text,
          snapshot.players.map((v) => v.name),
          this.names,
        );
        this.caption = text;
        this.captionUntil = performance.now() + 7000;
        if (this.highlightTimers.size >= 2) continue;
        const generation = this.generation;
        const timer = setTimeout(() => {
          this.highlightTimers.delete(timer);
          if (!this.enabled || generation !== this.generation) return;
          void this.save()
            .then((blob) => {
              if (!blob?.size || generation !== this.generation) return;
              this.highlights.push({
                id: moment.id,
                at: moment.at,
                text,
                blob,
              });
              while (
                this.highlights.length > 3 ||
                this.highlights.reduce((sum, h) => sum + h.blob.size, 0) >
                  32 * 1024 * 1024
              )
                this.highlights.shift();
              this.state('Highlight kept · choose it after the round');
            })
            .catch(() =>
              this.state(
                'This highlight could not be kept. Recording continues.',
              ),
            );
        }, 3000);
        this.highlightTimers.add(timer);
      }
    ctx.fillStyle = '#20362f';
    ctx.fillRect(0, 0, width, height);
    if (this.portrait) {
      const crop = portraitCrop(
        source.width,
        source.height,
        width / (height - 220),
        this.scene.captureFocus(),
      );
      ctx.drawImage(
        source,
        crop.x,
        crop.y,
        crop.w,
        crop.h,
        0,
        90,
        width,
        height - 220,
      );
    } else fit(ctx, source, 0, 0, width, height - 62);
    ctx.fillStyle = '#fff5df';
    ctx.font = 'bold 22px Arial';
    ctx.fillText('PERMIT PENDING', 24, this.portrait ? 48 : height - 34);
    if (performance.now() < this.captionUntil) {
      ctx.font = 'bold 26px Arial';
      wrap(
        ctx,
        this.caption,
        24,
        this.portrait ? height - 104 : 42,
        width - 48,
        32,
        2,
      );
    }
    ctx.font = '16px Arial';
    ctx.fillText(
      this.shareAddress || location.host + '/chaos',
      24,
      height - 12,
      width - 48,
    );
    const p = this.scene.snapshot?.world.party;
    if (p) {
      ctx.font = '18px Arial';
      if (!this.portrait)
        ctx.fillText(
          CREW_JOBS.find((j) => j.id === p.job)?.name || '',
          920,
          height - 34,
        );
    }
  };
  async prepareAudio() {
    this.context ||= new AudioContext();
    await this.context.resume();
  }
  async start(audio: (MediaStream | undefined)[]) {
    if (this.enabled) return;
    if (typeof MediaRecorder === 'undefined' || !this.canvas.captureStream)
      throw new Error(
        'Video recording is unavailable here. Save a postcard instead.',
      );
    this.mime =
      [
        'video/webm;codecs=vp8,opus',
        'video/mp4;codecs=avc1.42E01E,mp4a.40.2',
        'video/webm',
        'video/mp4',
      ].find((t) => MediaRecorder.isTypeSupported(t)) || '';
    if (!this.mime)
      throw new Error('This browser cannot create a supported video file.');
    await this.prepareAudio();
    const context = this.context!;
    const destination = context.createMediaStreamDestination();
    for (const stream of audio)
      if (stream?.getAudioTracks().length) {
        const source = context.createMediaStreamSource(stream);
        source.connect(destination);
        this.sources.push(source);
      }
    this.baseline = this.scene.frameP95();
    this.lastCheck = performance.now();
    this.scene.exportNames = this.names;
    this.scene.publicFrame(this.draw, this.names);
    this.stream = this.canvas.captureStream(30);
    for (const track of destination.stream.getAudioTracks())
      this.stream.addTrack(track);
    this.enabled = true;
    this.startedServer = Date.now() + this.scene.clockOffset;
    this.scene.frameConsumers.add(this.draw);
    this.segment();
    if (this.retroactive)
      this.interval = setInterval(() => {
        if (this.active.length < 2) this.segment();
      }, 15000);
    this.state(
      this.retroactive
        ? 'Moment buffer on · 15–30 sec'
        : 'Recording now · up to 30 sec',
    );
  }
  private segment() {
    if (!this.enabled || !this.stream || this.active.length >= 2) return;
    const generation = this.generation,
      recorder = new MediaRecorder(this.stream, {
        mimeType: this.mime,
        videoBitsPerSecond: 2400000,
        audioBitsPerSecond: 96000,
      });
    let resolve!: (b: Blob | null) => void;
    const done = new Promise<Blob | null>((r) => {
      resolve = r;
    });
    const segment: Segment = {
      recorder,
      started: performance.now(),
      chunks: [],
      done,
      generation,
      timer: setTimeout(() => {
        if (recorder.state !== 'inactive') recorder.stop();
      }, 30000),
    };
    recorder.ondataavailable = (e) => {
      segment.chunks.push(e.data);
      if (
        this.active.reduce(
          (size, s) => size + s.chunks.reduce((n, c) => n + c.size, 0),
          0,
        ) >
        96 * 1024 * 1024
      ) {
        void this.stop().then(() =>
          this.state('Buffer full. Choose a short recording.'),
        );
      }
    };
    recorder.onstop = () => {
      clearTimeout(segment.timer);
      this.active = this.active.filter((s) => s !== segment);
      resolve(
        generation === this.generation
          ? new Blob(segment.chunks, { type: recorder.mimeType })
          : null,
      );
      segment.chunks = [];
      if (!this.retroactive && this.enabled) {
        this.enabled = false;
        void this.releaseStreams().then(() => {
          this.ended();
          this.state('Recording complete · save your moment');
        });
      }
    };
    recorder.onerror = () => {
      resolve(null);
      void this.stop().then(() =>
        this.state('Recording failed. Save a postcard instead.'),
      );
    };
    this.active.push(segment);
    recorder.start(1000);
    this.latest = done;
  }
  private latest?: Promise<Blob | null>;
  get hasMoment() {
    return !!this.latest;
  }
  async save() {
    const oldest = this.active[0];
    if (!oldest) return this.latest ? await this.latest : null;
    if (oldest.recorder.state !== 'inactive') oldest.recorder.stop();
    const blob = await oldest.done;
    if (this.enabled && this.retroactive && this.active.length < 2)
      this.segment();
    return blob;
  }
  invalidate() {
    this.generation++;
    this.highlights = [];
    for (const timer of this.highlightTimers) clearTimeout(timer);
    this.highlightTimers.clear();
    this.invalidatePreview();
    for (const s of this.active) {
      clearTimeout(s.timer);
      if (s.recorder.state !== 'inactive') s.recorder.stop();
    }
    this.latest = undefined;
    if (this.enabled) setTimeout(() => this.segment(), 50);
  }
  private async releaseStreams() {
    if (this.interval) clearInterval(this.interval);
    this.scene.frameConsumers.delete(this.draw);
    for (const source of this.sources) source.disconnect();
    this.sources = [];
    for (const t of this.stream?.getTracks() || []) t.stop();
    this.stream = undefined;
    const context = this.context;
    this.context = undefined;
    if (context && context.state !== 'closed') await context.close();
  }
  async stop() {
    this.enabled = false;
    this.generation++;
    this.highlights = [];
    for (const timer of this.highlightTimers) clearTimeout(timer);
    this.highlightTimers.clear();
    for (const s of this.active) {
      clearTimeout(s.timer);
      if (s.recorder.state !== 'inactive') s.recorder.stop();
    }
    this.active = [];
    this.latest = undefined;
    await this.releaseStreams();
    this.state('Recording off');
    this.ended();
  }
}
