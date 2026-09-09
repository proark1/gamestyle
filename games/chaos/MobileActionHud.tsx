'use client';
import {
  ArrowUp,
  Hand,
  Send,
  Hammer,
  Paintbrush,
  RotateCw,
  Square,
  Trash2,
  X,
  Check,
  CircleSlash,
  MousePointer2,
} from 'lucide-react';
import type { MobileAction } from './mobile-actions';
import { TouchActionButton } from './TouchActionButton';

const icons = {
  grab: Hand,
  use: Hand,
  drop: Hand,
  throw: Send,
  place: Hammer,
  paint: Paintbrush,
  remove: Trash2,
  rotate: RotateCw,
  cancel: X,
  stop: Square,
};

export function MobileActionHud({
  primary,
  secondary,
  title,
  message,
  error,
  canJump,
  canCycle,
  onCycle,
  onAction,
  onJump,
}: {
  primary: MobileAction;
  secondary: MobileAction;
  title: string;
  message: string;
  error?: boolean;
  canJump: boolean;
  canCycle: boolean;
  onCycle: () => void;
  onAction: (action: MobileAction) => void;
  onJump: () => void;
}) {
  const Main = icons[primary.type],
    Second = icons[secondary.type];
  return (
    <>
      <div
        className={`mobile-action-note ${error ? 'blocked' : ''}`}
        aria-live="polite"
        aria-atomic="true"
      >
        <strong>
          {error ? <CircleSlash size={14} /> : <Check size={14} />}
          {title}
        </strong>
        <span>{message}</span>
        {canCycle && (
          <button onClick={onCycle}>
            <MousePointer2 size={14} /> Next target
          </button>
        )}
      </div>
      <div className="mobile-action-cluster" aria-label="Your actions">
        <TouchActionButton
          actionKey={`jump:${canJump}`}
          disabled={!canJump}
          onAction={onJump}
          immediate
          className="mobile-jump"
        >
          <ArrowUp size={22} />
          <span>Jump</span>
        </TouchActionButton>
        <TouchActionButton
          actionKey={secondary.key}
          disabled={secondary.disabled}
          onAction={() => onAction(secondary)}
          className="mobile-secondary-action"
        >
          <Second size={22} />
          <span>{secondary.label}</span>
        </TouchActionButton>
        <TouchActionButton
          actionKey={primary.key}
          disabled={primary.disabled}
          onAction={() => onAction(primary)}
          className={`mobile-primary-action ${primary.type === 'remove' ? 'danger-action' : ''}`}
        >
          <Main size={24} />
          <span>{primary.label}</span>
        </TouchActionButton>
      </div>
    </>
  );
}
