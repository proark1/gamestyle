import { useEffect, useRef, useState } from 'react';
import { RotateCcw, RotateCw } from 'lucide-react';
import type { AvatarLook } from '../../shared/rendering/avatar-preview';
import type { AvatarGame } from './avatars/catalog';
import type { AvatarStage, Measure, ScaleMode } from './avatars/stage';
import styles from './avatars.module.css';
import admin from './admin.module.css';

const metres = (value: number) => `${value.toFixed(2)} m`;

function difference(value: number, reference: number) {
  if (!reference) return '—';
  const change = Math.round(((value - reference) / reference) * 100);
  return change === 0
    ? 'same'
    : `${change > 0 ? '+' : '−'}${Math.abs(change)}%`;
}

/** Every game's player avatar side by side, at one scale, against a template. */
export default function AvatarsPanel() {
  const canvas = useRef<HTMLCanvasElement>(null);
  const [stage, setStage] = useState<AvatarStage | null>(null);
  const [games, setGames] = useState<readonly AvatarGame[]>([]);
  const [failure, setFailure] = useState('');
  const [chosen, setChosen] = useState<Record<string, string>>({});
  const [templateKey, setTemplateKey] = useState('');
  const [walking, setWalking] = useState(true);
  const [spinning, setSpinning] = useState(true);
  const [scale, setScale] = useState<ScaleMode>('game');
  const [measures, setMeasures] = useState<Record<string, Measure>>({});

  useEffect(() => {
    let cancelled = false;
    let created: AvatarStage | undefined;
    // three.js and every game's models load only once this tab is open.
    Promise.all([import('./avatars/stage'), import('./avatars/catalog')])
      .then(([{ AvatarStage }, { AVATAR_GAMES, DEFAULT_TEMPLATE }]) => {
        if (cancelled || !canvas.current) return;
        created = new AvatarStage(canvas.current, (key, measure) =>
          setMeasures((previous) => ({ ...previous, [key]: measure })),
        );
        setGames(AVATAR_GAMES);
        setTemplateKey((current) => current || DEFAULT_TEMPLATE);
        setStage(created);
      })
      .catch(() => {
        if (!cancelled)
          setFailure(
            'The 3D models could not start. This browser may not support WebGL.',
          );
      });
    return () => {
      cancelled = true;
      created?.dispose();
    };
  }, []);

  const options = games.flatMap((game) =>
    game.looks.map((look) => ({
      key: `${game.id}:${look.key}`,
      label: game.looks.length > 1 ? `${game.name} · ${look.label}` : game.name,
      look,
    })),
  );
  const template = options.find((option) => option.key === templateKey);
  const templateLook = template?.look;
  const templateMeasure = template ? measures[template.key] : undefined;

  useEffect(() => {
    stage?.setTemplate(templateKey, templateLook);
  }, [stage, templateKey, templateLook]);
  useEffect(() => {
    stage?.setWalking(walking);
  }, [stage, walking]);
  useEffect(() => {
    stage?.setSpinning(spinning);
  }, [stage, spinning]);
  useEffect(() => {
    stage?.setScaleMode(scale);
  }, [stage, scale]);

  return (
    <div className={admin.panel}>
      <canvas ref={canvas} className={styles.canvas} aria-hidden="true" />
      <section className={admin.card}>
        <h2>Player avatars</h2>
        <p className={admin.cardNote}>
          Each game&rsquo;s player character, built from the game&rsquo;s own
          model code and shown at the size the game uses it. The
          template&rsquo;s blue outline is laid over every other avatar, and the
          percentages compare against it. Drag any model to turn them all.
        </p>
        <div className={styles.controls}>
          <label>
            <span className={admin.srOnly}>Template</span>
            <select
              className={admin.select}
              value={templateKey}
              onChange={(event) => setTemplateKey(event.target.value)}
            >
              <option value="">No template</option>
              {options.map((option) => (
                <option key={option.key} value={option.key}>
                  Template: {option.label}
                </option>
              ))}
            </select>
          </label>
          <fieldset className={admin.segmented}>
            <legend className={admin.srOnly}>Scale</legend>
            <button
              type="button"
              aria-pressed={scale === 'game'}
              onClick={() => setScale('game')}
            >
              As in the game
            </button>
            <button
              type="button"
              aria-pressed={scale === 'height'}
              onClick={() => setScale('height')}
            >
              Same height
            </button>
          </fieldset>
          <button
            type="button"
            className={admin.quiet}
            aria-pressed={walking}
            onClick={() => setWalking((value) => !value)}
          >
            {walking ? 'Walking' : 'Standing still'}
          </button>
          <button
            type="button"
            className={admin.quiet}
            aria-pressed={spinning}
            onClick={() => setSpinning((value) => !value)}
          >
            {spinning ? 'Turning' : 'Not turning'}
          </button>
          <button
            type="button"
            className={admin.quiet}
            onClick={() => stage?.turnBy(-Math.PI / 4)}
          >
            <RotateCcw size={14} aria-hidden="true" />
            <span className={admin.srOnly}>Turn left</span>
          </button>
          <button
            type="button"
            className={admin.quiet}
            onClick={() => stage?.turnBy(Math.PI / 4)}
          >
            <RotateCw size={14} aria-hidden="true" />
            <span className={admin.srOnly}>Turn right</span>
          </button>
          <button
            type="button"
            className={admin.quiet}
            onClick={() => {
              setSpinning(false);
              stage?.faceFront();
            }}
          >
            Face front
          </button>
        </div>
        {failure && (
          <p role="alert" className={admin.error}>
            {failure}
          </p>
        )}
        {!failure && !stage && (
          <p className={admin.empty}>Loading every game&rsquo;s models…</p>
        )}
      </section>
      <div className={styles.grid}>
        {games.map((game) => {
          const look =
            game.looks.find((item) => item.key === chosen[game.id]) ??
            game.looks[0];
          const key = `${game.id}:${look.key}`;
          const measure = measures[key];
          const isTemplate = template?.look === look;
          return (
            <article key={game.id} className={styles.card}>
              <header className={styles.head}>
                <h3>{game.name}</h3>
                {isTemplate && <span className={styles.badge}>Template</span>}
              </header>
              {game.looks.length > 1 && (
                <fieldset className={styles.looks}>
                  <legend className={admin.srOnly}>{game.name} looks</legend>
                  {game.looks.map((item) => (
                    <button
                      key={item.key}
                      type="button"
                      aria-pressed={item === look}
                      onClick={() =>
                        setChosen((previous) => ({
                          ...previous,
                          [game.id]: item.key,
                        }))
                      }
                    >
                      {item.label}
                    </button>
                  ))}
                </fieldset>
              )}
              <StageBox stage={stage} slotKey={key} look={look} />
              <dl className={styles.facts}>
                <div>
                  <dt>Height</dt>
                  <dd>
                    {measure ? metres(measure.height) : '—'}
                    {templateMeasure && measure && !isTemplate && (
                      <small>
                        {' '}
                        {difference(measure.height, templateMeasure.height)}
                      </small>
                    )}
                  </dd>
                </div>
                <div>
                  <dt>Width</dt>
                  <dd>
                    {measure ? metres(measure.width) : '—'}
                    {templateMeasure && measure && !isTemplate && (
                      <small>
                        {' '}
                        {difference(measure.width, templateMeasure.width)}
                      </small>
                    )}
                  </dd>
                </div>
                <div>
                  <dt>Meshes</dt>
                  <dd>{measure?.meshes ?? '—'}</dd>
                </div>
              </dl>
              {game.note && <p className={styles.note}>{game.note}</p>}
              <button
                type="button"
                className={admin.quiet}
                onClick={() => setTemplateKey(isTemplate ? '' : key)}
              >
                {isTemplate ? 'Stop using as template' : 'Use as template'}
              </button>
            </article>
          );
        })}
      </div>
    </div>
  );
}

function StageBox({
  stage,
  slotKey,
  look,
}: {
  stage: AvatarStage | null;
  slotKey: string;
  look: AvatarLook;
}) {
  const box = useRef<HTMLDivElement>(null);
  useEffect(() => {
    const element = box.current;
    if (!stage || !element) return;
    stage.attach(slotKey, look, element);
    return () => stage.detach(slotKey);
  }, [stage, slotKey, look]);
  return <div ref={box} className={styles.stage} aria-hidden="true" />;
}
