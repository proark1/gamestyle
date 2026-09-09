export function voiceConfig() {
  return {
    url: process.env.LIVEKIT_URL,
    key: process.env.LIVEKIT_API_KEY,
    secret: process.env.LIVEKIT_API_SECRET,
    disabled: process.env.LIVEKIT_DISABLED === 'true',
    sweep: !('WebSocketPair' in globalThis),
  };
}
