import { Bot, Plus, UserRound, X } from 'lucide-react';
import type { NpcAction } from '../../shared/rooms/npc-slots';
import { LIMBS, type BrainPlayer } from './types';

export function CrewSlots({
  players,
  host,
  busy,
  manage,
}: {
  players: BrainPlayer[];
  host: boolean;
  busy: boolean;
  manage: (action: NpcAction) => void;
}) {
  return (
    <div
      className="brain-seats"
      aria-label="Player and NPC slots"
      aria-busy={busy}
    >
      <div className="brain-seats-heading">
        <strong>
          Your brain cells <span>{players.length}/4</span>
        </strong>
        {host && players.length < 4 && (
          <button disabled={busy} onClick={() => manage({ type: 'fill-npcs' })}>
            <Bot size={15} /> Fill empty slots
          </button>
        )}
      </div>
      <div className="brain-seats-grid">
        {[0, 1, 2, 3].map((slot) => {
          const p = players.find((p) => p.color === slot);
          return (
            <div className={`brain-seat${p ? '' : ' empty'}`} key={slot}>
              <i style={{ background: LIMBS[p?.limb ?? slot].color }}>
                {p?.bot ? <Bot size={19} /> : <UserRound size={19} />}
              </i>
              <span>
                <strong>{p?.name ?? `Slot ${slot + 1}`}</strong>
                <small>
                  {p
                    ? `${p.bot ? 'NPC · ' : ''}${LIMBS[p.limb].name}`
                    : 'Open for a friend'}
                </small>
              </span>
              {host && !p && (
                <button
                  disabled={busy}
                  aria-label={`Add NPC to slot ${slot + 1}`}
                  onClick={() => manage({ type: 'add-npc', slot })}
                >
                  <Plus size={14} /> NPC
                </button>
              )}
              {host && p?.bot && (
                <button
                  disabled={busy}
                  aria-label={`Remove NPC ${p.name}`}
                  onClick={() => manage({ type: 'remove-npc', target: p.id })}
                >
                  <X size={16} />
                </button>
              )}
            </div>
          );
        })}
      </div>
      <p>
        NPC hands cook and pour. NPC feet follow your foot, or carry you between
        stations.
      </p>
    </div>
  );
}
