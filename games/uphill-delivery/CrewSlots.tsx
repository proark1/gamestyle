import { Bot, Plus, UserRound, X } from 'lucide-react';
import { COLORS } from '../../shared/rendering/palette';
import type { DeliveryAction, DeliveryPlayer } from './types';

export function CrewSlots({
  players,
  host,
  busy,
  onAction,
}: {
  players: DeliveryPlayer[];
  host: boolean;
  busy: boolean;
  onAction: (action: DeliveryAction) => void;
}) {
  return (
    <div className="delivery-slots">
      <div className="delivery-slot-heading">
        <div>
          <h3>Your delivery crew</h3>
          <p>Invite friends or bring an NPC along.</p>
        </div>
        {host && players.length < 4 && (
          <button
            className="delivery-secondary"
            disabled={busy}
            onClick={() => onAction({ type: 'fill-npcs' })}
          >
            <Bot size={16} /> Fill empty slots
          </button>
        )}
      </div>
      <div className="delivery-slot-grid">
        {[0, 1, 2, 3].map((slot) => {
          const player = players.find((p) => p.color === slot);
          return (
            <div className="delivery-slot" key={slot}>
              <span
                className="delivery-slot-avatar"
                style={{ background: COLORS[slot] }}
              >
                {player?.bot ? <Bot size={20} /> : <UserRound size={20} />}
              </span>
              <div>
                <strong>{player?.name ?? `Slot ${slot + 1}`}</strong>
                <small>
                  {player?.bot
                    ? 'NPC teammate'
                    : player
                      ? 'Player'
                      : 'Open for a friend'}
                </small>
              </div>
              {host &&
                (!player ? (
                  <button
                    disabled={busy}
                    onClick={() => onAction({ type: 'add-npc', slot })}
                    aria-label={`Add NPC to slot ${slot + 1}`}
                  >
                    <Plus size={16} /> NPC
                  </button>
                ) : player.bot ? (
                  <button
                    disabled={busy}
                    onClick={() =>
                      onAction({ type: 'remove-npc', target: player.id })
                    }
                    aria-label={`Remove NPC ${player.name}`}
                  >
                    <X size={17} />
                  </button>
                ) : null)}
            </div>
          );
        })}
      </div>
    </div>
  );
}
