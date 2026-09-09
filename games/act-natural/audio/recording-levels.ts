/** Downward-only conditioning of farm details. Saved audio and user gains stay intact. */
export function farmRecordingGain(id: string, buffer: AudioBuffer): number {
  if (!/^(animal\.|nature\.|movement\.grass\.|item\.ladder\.carry\.)/.test(id))
    return 1;
  let energy = 0,
    samples = 0,
    peak = 0;
  for (let channel = 0; channel < buffer.numberOfChannels; channel++) {
    const data = buffer.getChannelData(channel);
    for (const sample of data) {
      if (!Number.isFinite(sample)) return 0;
      energy += sample * sample;
      peak = Math.max(peak, Math.abs(sample));
    }
    samples += data.length;
  }
  if (!samples || !peak) return 1;
  const rms = Math.sqrt(energy / samples);
  const target = 10 ** ((id.startsWith('animal.moo.') ? -20 : -24) / 20);
  return Math.min(1, target / rms, 0.89 / peak);
}
