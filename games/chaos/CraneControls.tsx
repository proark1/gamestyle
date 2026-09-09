import { ArrowDownToLine, RotateCw, X } from 'lucide-react';
import type { CraneState } from './crane';
import { TouchActionButton } from './TouchActionButton';

export function CraneControls({
  crane,
  own,
  target,
  error,
  rotation,
  onPlace,
  onRotate,
  onClose,
  selectedRoof,
  onLift,
  actionKey = '',
  blocked = false,
}: {
  crane?: CraneState;
  own: boolean;
  target: boolean;
  error?: string | null;
  rotation: number;
  onPlace: () => void;
  onRotate: () => void;
  onClose: () => void;
  selectedRoof?: string | null;
  onLift?: () => void;
  actionKey?: string;
  blocked?: boolean;
}) {
  const ready = own && crane?.phase === 'ready';
  const message =
    crane && !own
      ? 'Another builder is using the crane.'
      : crane?.phase === 'pickup'
        ? 'Lowering the rope · Hooking on · Lifting…'
        : crane?.phase === 'placing'
          ? 'Moving over the house · Lowering into place…'
          : ready
            ? crane?.error ||
              error ||
              'Choose a spot on the house. Green means the roof fits.'
            : selectedRoof
              ? 'Roof selected. Choose Lift to secure it.'
              : 'Select a roof module beside the house.';
  return (
    <section className="crane-controls" aria-label="Crane controls">
      <output>
        <strong>Roof crane {ready ? '· Load secured' : ''}</strong>
        <span>{message}</span>
      </output>
      {!crane && onLift && (
        <TouchActionButton
          actionKey={`lift:${selectedRoof}`}
          disabled={!selectedRoof || blocked}
          onAction={onLift}
          className="primary-button"
        >
          <ArrowDownToLine size={18} />
          Lift roof
        </TouchActionButton>
      )}
      {ready && (
        <div className="crane-actions">
          <TouchActionButton
            actionKey={`roof-rotate:${actionKey}`}
            disabled={blocked}
            onAction={onRotate}
            label="Rotate suspended roof"
          >
            <RotateCw size={17} />
            {rotation * 90}°
          </TouchActionButton>
          <TouchActionButton
            actionKey={`roof-place:${actionKey}`}
            className="primary-button"
            onAction={onPlace}
            disabled={!target || !!error || blocked}
          >
            <ArrowDownToLine size={17} />
            Place roof
          </TouchActionButton>
        </div>
      )}
      <TouchActionButton
        actionKey={`roof-close:${actionKey}:${own}`}
        onAction={onClose}
        disabled={blocked}
        label={own && crane ? 'Return roof and leave crane' : 'Leave crane'}
      >
        <X size={19} />
        <span>{own && crane ? 'Return roof' : 'Done'}</span>
      </TouchActionButton>
    </section>
  );
}
