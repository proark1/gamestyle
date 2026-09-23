'use client';
/* oxlint-disable react/react-compiler */
import { useEffect, useRef, useState, useSyncExternalStore } from 'react';
import {
  Copy,
  Crown,
  Leaf,
  Rocket,
  Star,
  Sun,
  Users,
  Waves,
  Flame,
  Trophy,
} from 'lucide-react';
import {
  accountSnapshot,
  openAccountDialog,
  serverAccountSnapshot,
  subscribeAccount,
} from '../accounts/client';
import { apiFetch } from '../browser/api-fetch';
import { CREW_EMBLEMS, type CrewEmblem, type CrewReply } from './types';
import './crew.css';

const ICONS = {
  sun: Sun,
  leaf: Leaf,
  rocket: Rocket,
  wave: Waves,
  star: Star,
  flame: Flame,
};
export default function CrewPanel({ partyLink }: { partyLink: string }) {
  const { account, status, methods } = useSyncExternalStore(
    subscribeAccount,
    accountSnapshot,
    serverAccountSnapshot,
  );
  const [data, setData] = useState<{
    identity: typeof account;
    reply: CrewReply;
  } | null>(null);
  const [busy, setBusy] = useState(false),
    [error, setError] = useState(''),
    [notice, setNotice] = useState('');
  const [name, setName] = useState(''),
    [emblem, setEmblem] = useState<CrewEmblem>('sun'),
    [code, setCode] = useState('');
  const [invite, setInvite] = useState<CrewReply['invite']>(),
    [confirm, setConfirm] = useState<{
      op: string;
      memberId?: string;
      label: string;
    } | null>(null);
  const [editing, setEditing] = useState(false);
  const generation = useRef(0),
    revision = useRef(0),
    writing = useRef(false);
  const reply = data?.identity === account ? data.reply : null;
  const crew = reply?.crew;
  const owner = !!crew && crew.self === crew.owner;
  const Icon = ICONS[crew?.emblem ?? emblem];
  useEffect(() => {
    setInvite(undefined);
    setConfirm(null);
    setEditing(false);
  }, [crew?.id, crew?.owner]);

  useEffect(() => {
    const current = ++generation.current;
    setData(null);
    setInvite(undefined);
    setError('');
    setNotice('');
    setConfirm(null);
    setEditing(false);
    setName('');
    setCode('');
    writing.current = false;
    if (!account) {
      setBusy(false);
      return;
    }
    async function refresh() {
      if (document.hidden || writing.current) return;
      const asked = ++revision.current;
      try {
        const response = await apiFetch('/api/account/crew', {
          cache: 'no-store',
          signal: AbortSignal.timeout(10000),
        });
        const value = await response.json();
        if (!response.ok)
          throw new Error(value.error ?? 'Could not load your crew.');
        if (generation.current === current && revision.current === asked) {
          setData({ identity: account, reply: value });
          setError('');
        }
      } catch (reason) {
        if (generation.current === current && revision.current === asked)
          setError(
            reason instanceof Error
              ? reason.message
              : 'Could not load your crew.',
          );
      } finally {
        if (generation.current === current && revision.current === asked)
          setBusy(false);
      }
    }
    setBusy(true);
    void refresh();
    const timer = setInterval(() => void refresh(), 20000);
    const focus = () => void refresh();
    window.addEventListener('focus', focus);
    return () => {
      generation.current = current + 1;
      clearInterval(timer);
      window.removeEventListener('focus', focus);
    };
  }, [account, status]);

  async function request(body?: object) {
    if (!account || writing.current || (body && !reply)) return;
    writing.current = true;
    setBusy(true);
    setError('');
    setNotice('');
    const current = generation.current;
    revision.current++;
    try {
      const response = await apiFetch('/api/account/crew', {
        method: body ? 'POST' : 'GET',
        cache: 'no-store',
        signal: AbortSignal.timeout(10000),
        ...(body
          ? {
              headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify({
                ...body,
                ownerKey: reply!.ownerKey,
                crewId: crew?.id,
              }),
            }
          : {}),
      });
      const value = await response.json();
      if (!response.ok)
        throw new Error(value.error ?? 'Could not save your crew.');
      if (generation.current !== current) return;
      setData({ identity: account, reply: value });
      setConfirm(null);
      setEditing(false);
      if (value.invite) setInvite(value.invite);
      else if (body) setInvite(undefined);
      if (body) setNotice('Crew saved.');
    } catch (reason) {
      if (generation.current === current)
        setError(
          reason instanceof Error
            ? reason.message
            : 'Could not save your crew.',
        );
    } finally {
      if (generation.current === current) {
        writing.current = false;
        setBusy(false);
      }
    }
  }
  async function copy(value: string) {
    try {
      await navigator.clipboard.writeText(value);
      setNotice('Copied. Send it to your friends.');
    } catch {
      setNotice('Copy the link or code from the field below.');
    }
  }
  const picker = (
    <fieldset className="crew-emblems" disabled={busy}>
      <legend>Choose your emblem</legend>
      {CREW_EMBLEMS.map((mark) => {
        const Badge = ICONS[mark];
        return (
          <button
            type="button"
            key={mark}
            aria-label={`${mark} emblem`}
            aria-pressed={emblem === mark}
            onClick={() => setEmblem(mark)}
          >
            <Badge size={24} />
          </button>
        );
      })}
    </fieldset>
  );
  const nameForm = (create: boolean) => (
    <form
      className="crew-form"
      onSubmit={(event) => {
        event.preventDefault();
        void request({ op: create ? 'create' : 'edit', name, emblem });
      }}
    >
      <label>
        Crew name
        <input
          value={name}
          maxLength={56}
          required
          minLength={3}
          onChange={(event) => setName(event.target.value)}
          placeholder="The Wobbly Legends"
          disabled={busy}
        />
      </label>
      {picker}
      <div className="crew-actions">
        <button type="submit" disabled={busy}>
          {create ? 'Create crew' : 'Save crew'}
        </button>
        {!create && (
          <button
            type="button"
            disabled={busy}
            onClick={() => setEditing(false)}
          >
            Cancel
          </button>
        )}
      </div>
    </form>
  );
  return (
    <section
      className="crew-panel"
      aria-labelledby="crew-heading"
      aria-busy={busy}
    >
      <header className="crew-header">
        <span className="crew-badge">
          <Icon size={34} strokeWidth={2.4} />
        </span>
        <div>
          <p>THE CLUBHOUSE</p>
          <h2 id="crew-heading">{crew?.name ?? 'Give your crew a home'}</h2>
          <span>
            {crew
              ? `${crew.members.length}/8 members · 4 play at a time`
              : 'Same friends. New stories. Every party.'}
          </span>
        </div>
      </header>
      {status === 'unknown' || (account && !reply && busy) ? (
        <output>Opening your clubhouse…</output>
      ) : !account ? (
        <div className="crew-intro">
          <p>
            Keep a name, an emblem, and a roster that lasts after the party
            ends.
          </p>
          {methods.email || methods.google ? (
            <button
              type="button"
              onClick={() =>
                openAccountDialog(
                  'Sign in to create or join a persistent crew.',
                )
              }
            >
              Sign in for crews
            </button>
          ) : (
            <p>Crews need an account. Sign-in is not available right now.</p>
          )}
        </div>
      ) : reply && !crew ? (
        <div className="crew-onboarding">
          <div>
            <h3>Start your crew</h3>
            {nameForm(true)}
          </div>
          <form
            className="crew-form"
            onSubmit={(event) => {
              event.preventDefault();
              void request({ op: 'join', code });
            }}
          >
            <h3>Got an invitation?</h3>
            <label>
              Crew invite code
              <input
                value={code}
                maxLength={24}
                autoCapitalize="characters"
                autoComplete="off"
                spellCheck={false}
                placeholder="ABCD-EFGH-JKLM"
                required
                disabled={busy}
                onChange={(event) => setCode(event.target.value)}
              />
            </label>
            <button type="submit" disabled={busy}>
              Join crew
            </button>
            <p>This joins their crew. Party links are separate.</p>
          </form>
        </div>
      ) : crew ? (
        <>
          <ul className="crew-roster">
            {crew.members.map((member) => (
              <li key={member.id}>
                <span>
                  <Users size={18} />
                  <strong>
                    {member.name}
                    {member.id === crew.self ? ' (You)' : ''}
                  </strong>
                  {member.id === crew.owner && (
                    <span className="crew-leader">
                      <Crown size={13} /> Leader
                    </span>
                  )}
                </span>
                {owner && member.id !== crew.self && (
                  <div>
                    <button
                      type="button"
                      disabled={busy}
                      onClick={() =>
                        setConfirm({
                          op: 'transfer',
                          memberId: member.id,
                          label: `Make ${member.name} the crew leader? You will become a member and the old invite code will stop working.`,
                        })
                      }
                    >
                      Make leader
                    </button>
                    <button
                      type="button"
                      disabled={busy}
                      onClick={() =>
                        setConfirm({
                          op: 'remove',
                          memberId: member.id,
                          label: `Remove ${member.name} from this crew? Their items and game progress stay with them.`,
                        })
                      }
                    >
                      Remove
                    </button>
                  </div>
                )}
              </li>
            ))}
          </ul>
          <section className="crew-records" aria-label="Verified crew records">
            <div className="crew-records-heading">
              <Trophy size={21} aria-hidden="true" />
              <h3>Verified crew records</h3>
            </div>
            {reply?.records?.rankedRuns ? (
              <div className="crew-records-grid">
                <p>
                  <strong>
                    {(reply.records.bestTowerCm / 100).toFixed(2)} m
                  </strong>
                  <span>Best Stack or Sink tower</span>
                </p>
                <p>
                  <strong>{reply.records.rankedRuns}</strong>
                  <span>Qualified ranked runs</span>
                </p>
                <p>
                  <strong>{reply.records.towerAce}</strong>
                  <span>Tower Ace finishes</span>
                </p>
                <p>
                  <strong>{reply.records.skylineCrown}</strong>
                  <span>Skyline Crown finishes</span>
                </p>
              </div>
            ) : (
              <p>Complete a ranked Stack or Sink run to start your shelf.</p>
            )}
            <a href="/stack-or-sink?challenge=ranked">
              Build a tower together →
            </a>
          </section>
          <div className="crew-actions">
            {owner && (
              <>
                <button
                  type="button"
                  disabled={busy}
                  onClick={() => {
                    setName(crew.name);
                    setEmblem(crew.emblem);
                    setEditing(!editing);
                  }}
                >
                  Edit crew
                </button>
                <button
                  type="button"
                  disabled={busy}
                  onClick={() => void request({ op: 'invite' })}
                >
                  New crew invite
                </button>
              </>
            )}
            <button
              type="button"
              disabled={busy}
              onClick={() =>
                setConfirm({
                  op: 'leave',
                  label: owner
                    ? 'Leave this crew? Leadership passes to the oldest remaining member. An empty crew is archived.'
                    : 'Leave this crew? Your items and game progress stay with you.',
                })
              }
            >
              Leave crew
            </button>
          </div>
          {editing && nameForm(false)}
          {invite && owner && (
            <div className="crew-invite">
              <label>
                Crew invite code
                <input
                  readOnly
                  value={invite.code}
                  onFocus={(event) => event.target.select()}
                />
              </label>
              <button type="button" onClick={() => void copy(invite.code)}>
                <Copy size={15} /> Copy code
              </button>
              <p>
                Valid until {new Date(invite.expires).toLocaleDateString()}.
                Creating a new code replaces this one. Share only with people
                you want in your crew.
              </p>
            </div>
          )}
          <div className="crew-party-invite">
            <label>
              Bring your crew into this party
              <input
                readOnly
                value={partyLink}
                onFocus={(event) => event.target.select()}
              />
            </label>
            <button type="button" onClick={() => void copy(partyLink)}>
              <Copy size={15} /> Copy party link
            </button>
          </div>
          {confirm && (
            <div className="crew-confirm">
              <p>{confirm.label}</p>
              <button
                type="button"
                disabled={busy}
                onClick={() => void request(confirm)}
              >
                Confirm
              </button>
              <button
                type="button"
                disabled={busy}
                onClick={() => setConfirm(null)}
              >
                Cancel
              </button>
            </div>
          )}
        </>
      ) : null}
      {error && (
        <div className="crew-error" role="alert">
          {error}{' '}
          <button type="button" disabled={busy} onClick={() => void request()}>
            Reload crew
          </button>
        </div>
      )}
      {notice && <output aria-live="polite">{notice}</output>}
    </section>
  );
}
