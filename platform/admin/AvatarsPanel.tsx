import { useEffect, useMemo, useRef, useState } from 'react';
import { RotateCcw, RotateCw } from 'lucide-react';
import type { AvatarLook } from '../../shared/rendering/avatar-preview';
import { ITEMS, SLOTS, type Slot } from '../../shared/wardrobe/catalog';
import type { Look } from '../../shared/wardrobe/look';
import type { AvatarCard } from './avatars/catalog';
import type { AvatarStage, Measure, ScaleMode } from './avatars/stage';
import styles from './avatars.module.css';
import admin from './admin.module.css';

const metres = (value: number) => `${value.toFixed(2)} m`;
const lookKey = (card: AvatarCard, look: AvatarLook) =>
  `${card.id}:${look.key}`;
const SLOT_NAMES: Record<Slot, string> = {
  hat: 'Hat',
  top: 'Top',
  legs: 'Legs',
  shoes: 'Shoes',
  face: 'Face',
};
const wearsSomething = (look: Look) => Object.values(look).some(Boolean);

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
  const [potential, setPotential] = useState<readonly AvatarCard[]>([]);
  const [games, setGames] = useState<readonly AvatarCard[]>([]);
  const [failure, setFailure] = useState('');
  const [chosen, setChosen] = useState<Record<string, string>>({});
  const [templateKey, setTemplateKey] = useState('');
  const [walking, setWalking] = useState(true);
  const [spinning, setSpinning] = useState(true);
  const [scale, setScale] = useState<ScaleMode>('game');
  const [measures, setMeasures] = useState<Record<string, Measure>>({});
  const [wearing, setWearing] = useState<Look>({});

  useEffect(() => {
    let cancelled = false;
    let created: AvatarStage | undefined;
    // three.js and every game's models load only once this tab is open.
    Promise.all([import('./avatars/stage'), import('./avatars/catalog')])
      .then(([{ AvatarStage }, catalog]) => {
        if (cancelled || !canvas.current) return;
        created = new AvatarStage(canvas.current, (key, measure) =>
          setMeasures((previous) => ({ ...previous, [key]: measure })),
        );
        setPotential(catalog.POTENTIAL_AVATARS);
        setGames(catalog.AVATAR_GAMES);
        setTemplateKey((current) => current || catalog.DEFAULT_TEMPLATE);
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

  const groups = [
    { label: 'Potential avatars', cards: potential },
    { label: 'Game avatars', cards: games },
  ].map((group) => ({
    label: group.label,
    options: group.cards.flatMap((card) =>
      card.looks.map((look) => ({
        key: lookKey(card, look),
        label:
          card.looks.length > 1 ? `${card.name} · ${look.label}` : card.name,
        look,
      })),
    ),
  }));
  const template = groups
    .flatMap((group) => group.options)
    .find((option) => option.key === templateKey);
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

  const renderCard = (card: AvatarCard) => {
    const look =
      card.looks.find((item) => item.key === chosen[card.id]) ?? card.looks[0];
    const isTemplate = templateLook === look;
    return (
      <AvatarCardView
        key={card.id}
        card={card}
        look={look}
        stage={stage}
        measure={measures[lookKey(card, look)]}
        templateMeasure={templateMeasure}
        isTemplate={isTemplate}
        wearing={wearing}
        onLook={(key) =>
          setChosen((previous) => ({ ...previous, [card.id]: key }))
        }
        onTemplate={() => setTemplateKey(isTemplate ? '' : lookKey(card, look))}
      />
    );
  };

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
              {groups.map(
                (group) =>
                  group.options.length > 0 && (
                    <optgroup key={group.label} label={group.label}>
                      {group.options.map((option) => (
                        <option key={option.key} value={option.key}>
                          Template: {option.label}
                        </option>
                      ))}
                    </optgroup>
                  ),
              )}
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
        <fieldset className={styles.wardrobe}>
          <legend>Try on wardrobe items</legend>
          {SLOTS.map((slot) => (
            <label key={slot}>
              <span>{SLOT_NAMES[slot]}</span>
              <select
                className={admin.select}
                value={wearing[slot] ?? ''}
                onChange={(event) => {
                  const id = event.target.value;
                  setWearing((current) => ({
                    ...current,
                    [slot]: id || undefined,
                  }));
                }}
              >
                <option value="">Game&rsquo;s own</option>
                {ITEMS.filter((item) => item.slot === slot).map((item) => (
                  <option key={item.id} value={item.id}>
                    {item.name}
                  </option>
                ))}
              </select>
            </label>
          ))}
          {wearsSomething(wearing) && (
            <button
              type="button"
              className={admin.quiet}
              onClick={() => setWearing({})}
            >
              Take it all off
            </button>
          )}
        </fieldset>
        {failure && (
          <p role="alert" className={admin.error}>
            {failure}
          </p>
        )}
        {!failure && !stage && (
          <p className={admin.empty}>Loading every game&rsquo;s models…</p>
        )}
      </section>
      {potential.length > 0 && (
        <section className={styles.section} aria-labelledby="potential-avatars">
          <h2 id="potential-avatars">Potential avatars</h2>
          <p className={admin.cardNote}>
            New characters to choose from for other games: one funny, one cute
            and one scary. Each is rigged like the shared worker, so a
            game&rsquo;s existing walk code can drive it, and each takes the
            player colour.
          </p>
          <div className={styles.grid}>{potential.map(renderCard)}</div>
        </section>
      )}
      {games.length > 0 && (
        <section className={styles.section} aria-labelledby="game-avatars">
          <h2 id="game-avatars">Game avatars</h2>
          <div className={styles.grid}>{games.map(renderCard)}</div>
        </section>
      )}
    </div>
  );
}

function AvatarCardView({
  card,
  look,
  stage,
  measure,
  templateMeasure,
  isTemplate,
  wearing,
  onLook,
  onTemplate,
}: {
  card: AvatarCard;
  look: AvatarLook;
  stage: AvatarStage | null;
  measure: Measure | undefined;
  templateMeasure: Measure | undefined;
  isTemplate: boolean;
  wearing: Look;
  onLook: (key: string) => void;
  onTemplate: () => void;
}) {
  // The template keeps the game's own look so its outline stays comparable.
  const dressing = !!look.dressable && !isTemplate && wearsSomething(wearing);
  const shown = useMemo<AvatarLook>(
    () => (dressing ? { ...look, create: () => look.create(wearing) } : look),
    [dressing, look, wearing],
  );
  return (
    <article className={styles.card}>
      <header className={styles.head}>
        <h3>
          {card.name}
          {card.tag && <span className={styles.tag}>{card.tag}</span>}
        </h3>
        {isTemplate && <span className={styles.badge}>Template</span>}
      </header>
      {card.looks.length > 1 && (
        <fieldset className={styles.looks}>
          <legend className={admin.srOnly}>{card.name} looks</legend>
          {card.looks.map((item) => (
            <button
              key={item.key}
              type="button"
              aria-pressed={item === look}
              onClick={() => onLook(item.key)}
            >
              {item.label}
            </button>
          ))}
        </fieldset>
      )}
      <StageBox stage={stage} slotKey={lookKey(card, look)} look={shown} />
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
              <small> {difference(measure.width, templateMeasure.width)}</small>
            )}
          </dd>
        </div>
        <div>
          <dt>Meshes</dt>
          <dd>{measure?.meshes ?? '—'}</dd>
        </div>
      </dl>
      {card.note && <p className={styles.note}>{card.note}</p>}
      {wearsSomething(wearing) && !look.dressable && (
        <p className={styles.note}>
          Wardrobe items don&rsquo;t show here: this avatar isn&rsquo;t built on
          the shared worker.
        </p>
      )}
      <button type="button" className={admin.quiet} onClick={onTemplate}>
        {isTemplate ? 'Stop using as template' : 'Use as template'}
      </button>
    </article>
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
