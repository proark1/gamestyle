import { Bot, Plus, UserRound, X } from 'lucide-react';
import { ANGLER_COLORS, type Angler, type ReelAction } from './types';

export function CrewSlots({
  players,
  host,
  busy,
  onAction,
}: {
  players: Angler[];
  host: boolean;
  busy: boolean;
  onAction: (action: ReelAction) => void;
}) {
  return (
    <div className="reel-slots" aria-label="Player and NPC crew slots">
      <div className="reel-slot-heading">
        <div>
          <h3>Your boat crew</h3>
          <p>Invite friends or bring an NPC angler along.</p>
        </div>
        {host && players.length < 4 && (
          <button
            type="button"
            className="reel-slot-fill"
            disabled={busy}
            onClick={() => onAction({ type: 'fill-npcs' })}
          >
            <Bot size={16} /> Fill empty slots
          </button>
        )}
      </div>
      <div className="reel-slot-grid">
        {[0, 1, 2, 3].map((slot) => {
          const player = players.find((p) => p.color === slot);
          return (
            <div className={`reel-slot${player ? '' : ' empty'}`} key={slot}>
              <span
                className="reel-slot-avatar"
                style={{ background: ANGLER_COLORS[slot] }}
              >
                {player?.bot ? <Bot size={19} /> : <UserRound size={19} />}
              </span>
              <div>
                <strong>{player?.name ?? `Slot ${slot + 1}`}</strong>
                <small>
                  {player?.bot
                    ? 'NPC angler'
                    : player
                      ? 'Player'
                      : 'Open for a friend'}
                </small>
              </div>
              {host &&
                (!player ? (
                  <button
                    type="button"
                    className="reel-slot-btn"
                    disabled={busy}
                    onClick={() => onAction({ type: 'add-npc', slot })}
                    aria-label={`Add NPC to slot ${slot + 1}`}
                  >
                    <Plus size={15} /> NPC
                  </button>
                ) : player.bot ? (
                  <button
                    type="button"
                    className="reel-slot-btn remove"
                    disabled={busy}
                    onClick={() =>
                      onAction({ type: 'remove-npc', target: player.id })
                    }
                    aria-label={`Remove NPC ${player.name}`}
                  >
                    <X size={16} />
                  </button>
                ) : null)}
            </div>
          );
        })}
      </div>
    </div>
  );
}
