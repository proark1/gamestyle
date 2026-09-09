'use client';
import { useEffect, useEffectEvent, useState } from 'react';
import type { Session } from './connection';
export function BuildShelf({
  session,
  notify,
  onSaved,
}: {
  session?: Session;
  notify: (text: string) => void;
  onSaved?: (id: string) => void;
}) {
  const [open, setOpen] = useState(false),
    [title, setTitle] = useState('Our questionable masterpiece'),
    [busy, setBusy] = useState(false);
  const [items, setItems] = useState<
      { id: string; title: string; author: string }[]
    >([]),
    [saved, setSaved] = useState('');
  const reportLoadError = useEffectEvent(() =>
    notify('Your saved builds could not load. Try reopening the shelf.'),
  );
  useEffect(() => {
    if (!open) return;
    const abort = new AbortController();
    void fetch('/api/handwerker/builds', { signal: abort.signal })
      .then(async (r) => {
        if (!r.ok) throw new Error();
        const data = (await r.json()) as {
          builds: { id: string; title: string; author: string }[];
        };
        setItems(data.builds);
      })
      .catch((e) => {
        if (e.name !== 'AbortError') reportLoadError();
      });
    return () => abort.abort();
  }, [open, saved]); // notify does not change the request identity.
  async function save() {
    if (!session || busy) return;
    setBusy(true);
    try {
      const response = await fetch('/api/handwerker/builds', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ ...session, title }),
      });
      const data = (await response.json()) as { id: string; error?: string };
      if (!response.ok) throw new Error(data.error);
      setSaved(data.id);
      onSaved?.(data.id);
      notify('Build saved. Anyone with its link can explore a separate copy.');
    } catch (e) {
      notify((e as Error).message);
    } finally {
      setBusy(false);
    }
  }
  return (
    <div className="build-shelf">
      <button onClick={() => setOpen((v) => !v)} aria-expanded={open}>
        Saved builds & remixes
      </button>
      {open && (
        <div>
          {session && (
            <>
              <label>
                Build title
                <input
                  maxLength={60}
                  value={title}
                  onChange={(e) => setTitle(e.target.value)}
                />
              </label>
              <p>
                Save an unlisted copy on the server. Its link includes this
                build and your builder name. Your live room stays separate.
              </p>
              <button
                disabled={busy || !title.trim()}
                onClick={() => void save()}
              >
                {busy ? 'Saving…' : 'Save this build'}
              </button>
            </>
          )}
          {saved && (
            <p>
              <a href={`/build/${saved}`} target="_blank" rel="noreferrer">
                Open your saved build ↗
              </a>{' '}
              <button
                onClick={() =>
                  void navigator.clipboard
                    .writeText(`${location.origin}/build/${saved}`)
                    .then(
                      () => notify('Build link copied.'),
                      () =>
                        notify('Open the saved build and copy its address.'),
                    )
                }
              >
                Copy build link
              </button>
            </p>
          )}
          <p className="party-muted">
            This browser’s shelf. Builds are stored on the server; keep their
            links if you change browsers.
          </p>
          {items.length ? (
            <ul>
              {items.map((item) => (
                <li key={item.id}>
                  <a href={`/build/${item.id}`}>{item.title}</a>
                  <span> · {item.author}</span>
                </li>
              ))}
            </ul>
          ) : (
            <p>No saved builds in this browser yet.</p>
          )}
        </div>
      )}
    </div>
  );
}
