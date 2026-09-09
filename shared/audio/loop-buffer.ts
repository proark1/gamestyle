/** Join the tail to the head over a short overlap, preserving stereo phase. */
export function seamlessAmbience(
  context: BaseAudioContext,
  source: AudioBuffer,
): AudioBuffer {
  const overlap = Math.min(
    Math.floor(source.sampleRate * 0.35),
    Math.floor(source.length / 8),
  );
  if (overlap < 2) return source;
  const length = source.length - overlap;
  const result = context.createBuffer(
    source.numberOfChannels,
    length,
    source.sampleRate,
  );
  for (let channel = 0; channel < source.numberOfChannels; channel++) {
    const input = source.getChannelData(channel);
    const output = result.getChannelData(channel);
    output.set(input.subarray(overlap));
    for (let i = 0; i < overlap; i++) {
      const mix = i / (overlap - 1);
      const smooth = mix * mix * (3 - 2 * mix);
      output[length - overlap + i] =
        input[length + i] * (1 - smooth) + input[i] * smooth;
    }
  }
  return result;
}
