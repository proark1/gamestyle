'use client';
import { useEffect, useRef, useState } from 'react';
/** A local-only input check: no peer, recording destination or speaker is attached. */
export default function MicrophoneCheck() {
  const [active, setActive] = useState(false),
    [level, setLevel] = useState(0),
    [error, setError] = useState('');
  const stop = useRef<() => void>(() => {});
  const generation = useRef(0);
  useEffect(() => {
    const cancel = () => {
      generation.current++;
      stop.current();
      setActive(false);
    };
    window.addEventListener('blur', cancel);
    return () => {
      cancel();
      window.removeEventListener('blur', cancel);
    };
  }, []);
  async function check() {
    if (active) {
      generation.current++;
      stop.current();
      return;
    }
    const request = ++generation.current;
    setActive(true);
    setError('');
    try {
      const stream = await navigator.mediaDevices.getUserMedia({
        audio: { echoCancellation: true, noiseSuppression: true },
        video: false,
      });
      if (request !== generation.current) {
        stream.getTracks().forEach((t) => t.stop());
        return;
      }
      const context = new AudioContext(),
        source = context.createMediaStreamSource(stream),
        analyser = context.createAnalyser();
      source.connect(analyser);
      const values = new Uint8Array(analyser.fftSize);
      const timer = setInterval(() => {
        analyser.getByteTimeDomainData(values);
        setLevel(
          Math.min(
            1,
            Math.sqrt(
              values.reduce((sum, v) => sum + ((v - 128) / 128) ** 2, 0) /
                values.length,
            ) * 4,
          ),
        );
      }, 100);
      const end = setTimeout(() => stop.current(), 10000);
      stop.current = () => {
        clearInterval(timer);
        clearTimeout(end);
        stream.getTracks().forEach((t) => t.stop());
        source.disconnect();
        void context.close();
        setActive(false);
        setLevel(0);
        stop.current = () => {};
      };
      await context.resume();
    } catch {
      stop.current();
      setActive(false);
      setError('Allow microphone access, then try again.');
    }
  }
  return (
    <div>
      <button type="button" onClick={() => void check()}>
        {active ? 'Stop microphone test' : 'Test microphone locally'}
      </button>
      {active && (
        <label>
          Local microphone level <progress value={level} max={1} />
        </label>
      )}
      <p className="voice-note">This test is not sent to other players.</p>
      {error && <p role="alert">{error}</p>}
    </div>
  );
}
