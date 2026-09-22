'use client';

import { Dialog } from '@base-ui/react/dialog';
import { Users } from 'lucide-react';
import { useLanguage } from '../language/useLanguage';
import VoicePanel from '../voice/VoicePanel';
import type { PeerRoomUI } from './usePeerRoom';
import './room-controls.css';

export default function PeerRoomControls({
  room,
  withVoice = false,
}: {
  room: PeerRoomUI;
  withVoice?: boolean;
}) {
  const { language } = useLanguage();
  const de = language === 'de';
  const label = room.session
    ? `${room.session.code} · ${room.players.length}/4`
    : de
      ? 'Mehrspieler'
      : 'Multiplayer';
  return (
    <>
      <button
        type="button"
        className="game-toolbar-button peer-room-trigger"
        aria-label={label}
        title={label}
        onClick={() => room.setOpen(true)}
      >
        <Users size={18} />
        <span>{label}</span>
      </button>
      {withVoice && <VoicePanel {...room.voice} />}
      {room.session && room.status !== 'online' && (
        <output className="peer-room-status">
          {room.status === 'expired'
            ? de
              ? 'Sitzung abgelaufen. Raum verlassen und erneut beitreten.'
              : 'Session expired. Leave the room and rejoin.'
            : de
              ? 'Verbindung wird hergestellt…'
              : 'Reconnecting…'}
        </output>
      )}
      {!room.open && room.notice && (
        <output className="peer-room-status">{room.notice}</output>
      )}
      <Dialog.Root
        open={room.open}
        onOpenChange={(open) => {
          if (!room.busy) room.setOpen(open);
        }}
      >
        <Dialog.Portal>
          <Dialog.Backdrop className="peer-room-backdrop" />
          <Dialog.Popup
            className="peer-room-dialog"
            aria-describedby={undefined}
          >
            <Dialog.Title>
              {de ? 'Mit Freunden spielen' : 'Play with friends'}
            </Dialog.Title>
            {room.session ? (
              <>
                <p>
                  {de ? 'Raumcode' : 'Room code'}:{' '}
                  <strong>{room.session.code}</strong>
                </p>
                <ul>
                  {room.players.map((p) => (
                    <li key={p.id}>{p.name}</li>
                  ))}
                </ul>
                <button
                  className="primary-button"
                  onClick={() => void room.copyInvite()}
                >
                  {de ? 'Einladungslink kopieren' : 'Copy invite link'}
                </button>
                <button
                  className="secondary-button"
                  disabled={room.busy}
                  onClick={() => void room.leave()}
                >
                  {de
                    ? 'Raum verlassen · Solo spielen'
                    : 'Leave room · Play solo'}
                </button>
              </>
            ) : (
              <>
                <p>
                  {de
                    ? 'Gemeinsam mit bis zu vier Spielern.'
                    : 'Play together with up to four players.'}
                </p>
                <label>
                  {de ? 'Dein Name' : 'Your name'}
                  <input
                    value={room.name}
                    maxLength={24}
                    autoComplete="off"
                    disabled={room.busy}
                    onChange={(e) => room.setName(e.target.value)}
                  />
                </label>
                <button
                  className="primary-button"
                  disabled={room.busy}
                  onClick={() => void room.enter('create')}
                >
                  {de ? 'Raum erstellen' : 'Create room'}
                </button>
                <form
                  onSubmit={(e) => {
                    e.preventDefault();
                    void room.enter('join');
                  }}
                >
                  <label>
                    {de ? 'Raumcode' : 'Room code'}
                    <input
                      value={room.code}
                      maxLength={6}
                      autoCapitalize="characters"
                      autoComplete="off"
                      disabled={room.busy}
                      onChange={(e) =>
                        room.setCode(e.target.value.toUpperCase())
                      }
                    />
                  </label>
                  <button
                    className="secondary-button"
                    disabled={room.busy || !room.code.trim()}
                    type="submit"
                  >
                    {de ? 'Raum beitreten' : 'Join room'}
                  </button>
                </form>
              </>
            )}
            {room.busy && <output>{de ? 'Verbinden…' : 'Connecting…'}</output>}
            {room.notice && <output>{room.notice}</output>}
            <Dialog.Close className="secondary-button" disabled={room.busy}>
              {de ? 'Schließen' : 'Close'}
            </Dialog.Close>
          </Dialog.Popup>
        </Dialog.Portal>
      </Dialog.Root>
    </>
  );
}
