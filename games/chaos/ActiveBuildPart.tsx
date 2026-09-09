'use client';

import Image from 'next/image';
import { ChevronDown, Hammer, RotateCw } from 'lucide-react';

type Props = {
  name: string;
  thumbnail?: string;
  floor: string;
  rotation: number;
  message: string;
  error: boolean;
  onChoose: () => void;
  onRotate: () => void;
};

export function ActiveBuildPart(p: Props) {
  return (
    <section
      className={`active-build-part ${p.error ? 'blocked' : ''}`}
      aria-label="Selected building part"
    >
      <button
        className="active-part-choice"
        aria-label={`Change building part: ${p.name}`}
        aria-expanded={false}
        onClick={p.onChoose}
      >
        {p.thumbnail ? (
          <Image src={p.thumbnail} alt="" width={56} height={46} unoptimized />
        ) : (
          <Hammer size={24} />
        )}
        <span>
          <strong>{p.name}</strong>
          <small>Change part</small>
        </span>
        <ChevronDown size={18} />
      </button>
      <div className="active-part-options">
        <span>{p.floor}</span>
        <button
          aria-label="Rotate building preview"
          title="Rotate · R"
          onClick={p.onRotate}
        >
          <RotateCw size={16} />
          {p.rotation * 90}° <kbd>R</kbd>
        </button>
      </div>
      <output className="active-part-feedback">{p.message}</output>
    </section>
  );
}
