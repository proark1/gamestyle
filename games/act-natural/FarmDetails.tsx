import { Eye, Fence, KeyRound, Leaf, Zap } from 'lucide-react';
import { farmMode, type FarmSnapshot } from './types';

export function FarmDetails({
  snapshot,
  watched,
  spectating,
}: {
  snapshot: FarmSnapshot;
  watched: boolean;
  spectating: boolean;
}) {
  const w = snapshot.world,
    farmer = snapshot.you.role === 'farmer';
  const visibleCows = w.cows.filter((c) => !c.captured && !c.escaped);
  const grazingCows = visibleCows.filter((c) => c.grazing).length;
  const movingCows = visibleCows.filter((c) => c.moving).length;
  return (
    <>
      <aside className="farm-objectives">
        <span className="farm-small-label">
          {farmer ? 'KEEP AN EYE OUT' : 'THE ESCAPE PLAN'}
        </span>
        <h2>
          {farmer
            ? 'Somebody’s not a cow.'
            : farmMode(w) === 'human'
              ? 'Moonlight. Mischief. Moo.'
              : 'An ordinary day. An unusual herd.'}
        </h2>
        <p>
          {farmer
            ? 'Sweep your flashlight to find the cows. Hay blocks the beam. Listen for clues; carried keys stay concealed.'
            : 'Wander, pause, or graze near other cows. You don’t have to match every move.'}
        </p>
        <div className={w.keysDelivered === 2 ? 'complete' : ''}>
          <KeyRound size={17} />
          <span>Gate keys</span>
          <b>{w.keysDelivered}/2</b>
        </div>
        <div className={w.powerOff ? 'complete' : ''}>
          <Zap size={17} />
          <span>Fence power</span>
          <b>{w.powerOff ? 'OFF' : 'ON'}</b>
        </div>
        <div className={w.ladderPlaced ? 'complete' : ''}>
          <Fence size={17} />
          <span>East ladder</span>
          <b>{w.ladderPlaced ? 'READY' : '—'}</b>
        </div>
        <small>
          Both keys open the south gate.
          <br />
          The ladder bypasses the locks.
          <br />
          Either way, cut the power.
        </small>
        <div className="farm-inspections">
          <Eye size={17} />
          <span>Inspections left</span>
          <b>{w.inspections}/5</b>
        </div>
        <div
          className="inspection-dots"
          aria-label={`${w.inspections} inspections remaining`}
        >
          {Array.from({ length: 5 }, (_, i) => (
            <i className={i < w.inspections ? 'available' : ''} key={i} />
          ))}
        </div>
      </aside>
      <aside className="herd-cue">
        <span className="farm-small-label">HERD WATCH</span>
        <strong>
          <Leaf size={21} /> {farmer ? 'Cows in sight' : 'Mixed herd'}
        </strong>
        <span>
          {farmer
            ? 'Different directions are normal. Look for the real giveaways.'
            : 'Some eat. Some explore. Blend in with the cows around you.'}
        </span>
        <div className="herd-activity">
          <span>{grazingCows} grazing</span>
          <span>{movingCows} moving</span>
          <span>{visibleCows.length - grazingCows - movingCows} resting</span>
        </div>
        {!farmer && w.phase === 'playing' && !spectating && (
          <b className={watched ? 'farmer-watching' : ''}>
            {watched ? <Eye size={13} /> : <Leaf size={13} />}{' '}
            {watched ? 'In the farmer’s sight' : 'Outside the farmer’s sight'}
          </b>
        )}
      </aside>
      <div className="farm-roster">
        {w.players.map((p) => (
          <span key={p.id} className={p.status !== 'ready' ? 'resolved' : ''}>
            {p.role === 'farmer' ? <Eye size={13} /> : <Leaf size={13} />}{' '}
            {p.name}
            {p.bot ? ' · NPC' : ''}
            {p.id === snapshot.you.id ? ' (you)' : ''}
            {p.status === 'caught'
              ? ' · caught'
              : p.status === 'escaped'
                ? ' · escaped'
                : ''}
          </span>
        ))}
      </div>
    </>
  );
}
