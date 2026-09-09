'use client';
import {
  Check,
  Hammer,
  Home,
  Sofa,
  Sprout,
  X,
  RotateCw,
  Paintbrush,
  Trophy,
} from 'lucide-react';
import Image from 'next/image';
import { Tabs, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { CATALOG, type ItemKind } from './model';
import { PAINTS, finishesFor, type PaintId, type Finish } from './appearance';

type Props = {
  count: number;
  category: string;
  selected: ItemKind;
  thumbnails: Record<string, string>;
  rotation: number;
  paint: PaintId;
  finish: Finish;
  painting: boolean;
  wholeHouse: boolean;
  onCategory: (category: string) => void;
  onSelect: (kind: ItemKind) => void;
  onClose: () => void;
  onRotate: () => void;
  onPaint: (paint: PaintId) => void;
  onFinish: (finish: Finish) => void;
  onPainting: () => void;
  onWholeHouse: (value: boolean) => void;
  onProjects: () => void;
  onReady?: () => void;
};
export function BuildKit(p: Props) {
  const finishes = finishesFor(p.selected),
    finish = finishes.some((f) => f.id === p.finish) ? p.finish : 'classic';
  return (
    <div id="building-kit" className="build-tray home-build-kit">
      <div className="build-tray-top">
        <span>
          <Hammer size={15} /> BUILDING KIT <small>{p.count}/160</small>
        </span>
        <Tabs value={p.category} onValueChange={(v) => p.onCategory(String(v))}>
          <TabsList className="category-list">
            <TabsTrigger value="House">
              <Home size={14} />
              House
            </TabsTrigger>
            <TabsTrigger value="Furniture">
              <Sofa size={14} />
              Furniture
            </TabsTrigger>
            <TabsTrigger value="Decor">
              <Sprout size={14} />
              Decor
            </TabsTrigger>
          </TabsList>
        </Tabs>
        <button aria-label="Close building kit" onClick={p.onClose}>
          <X size={17} />
        </button>
      </div>
      <div className="piece-cards" aria-label={`${p.category} parts`}>
        {CATALOG.filter((i) => i.category === p.category).map((item, i) => (
          <button
            key={item.id}
            className={`piece-card ${p.selected === item.id ? 'active' : ''}`}
            aria-pressed={p.selected === item.id}
            aria-label={item.name}
            onClick={() => p.onSelect(item.id)}
          >
            {i < 9 && <kbd>{i + 1}</kbd>}
            {p.thumbnails[item.id] ? (
              <Image
                src={p.thumbnails[item.id]}
                alt=""
                width={76}
                height={62}
                unoptimized
              />
            ) : (
              <Hammer />
            )}
            <span>{item.name}</span>
          </button>
        ))}
      </div>
      <div className="finish-row">
        <strong>{CATALOG.find((i) => i.id === p.selected)?.name}</strong>
        {finishes.length > 1 && (
          <label>
            Finish{' '}
            <select
              aria-label="Surface finish"
              value={finish}
              onChange={(e) => p.onFinish(e.target.value as Finish)}
            >
              {finishes.map((f) => (
                <option key={f.id} value={f.id}>
                  {f.name}
                </option>
              ))}
            </select>
          </label>
        )}
      </div>
      <div className="paint-row">
        <span>
          Color · <b>{PAINTS.find((c) => c.id === p.paint)?.name}</b>
        </span>
        <fieldset className="paint-swatches" aria-label="Part color">
          {PAINTS.map((c) => (
            <button
              key={c.id}
              title={c.name}
              aria-label={`${c.name} paint`}
              aria-pressed={c.id === p.paint}
              className={`paint-swatch ${c.id === p.paint ? 'selected' : ''}`}
              style={{ background: c.hex }}
              onClick={() => p.onPaint(c.id)}
            >
              {c.id === p.paint && <Check size={15} />}
            </button>
          ))}
        </fieldset>
      </div>
      <div className="decorate-actions">
        <button
          className={p.painting ? 'active' : ''}
          aria-pressed={p.painting}
          onClick={p.onPainting}
        >
          <Paintbrush size={16} />
          {p.painting ? 'Painting · tap a part' : 'Paint existing parts'}
        </button>
        <button onClick={p.onProjects}>
          <Trophy size={16} />
          Home projects
        </button>
      </div>
      {p.painting && (
        <label className="whole-house">
          <input
            type="checkbox"
            checked={p.wholeHouse}
            onChange={(e) => p.onWholeHouse(e.target.checked)}
          />
          Paint all house walls together <span>Tap a wall or window</span>
        </label>
      )}
      {p.onReady && (
        <button className="primary-button" onClick={p.onReady}>
          {p.painting
            ? 'Start painting'
            : `Build with ${CATALOG.find((i) => i.id === p.selected)?.name}`}
          <Check size={16} />
        </button>
      )}
      <div className="build-hint">
        <span>
          {p.painting
            ? 'Tap a placed part. Select Roof to paint roof tiles.'
            : CATALOG.find((i) => i.id === p.selected)?.description}
        </span>
        <button onClick={p.onRotate}>
          <RotateCw size={13} />
          <kbd>R</kbd> Rotate · {p.rotation * 90}°
        </button>
      </div>
    </div>
  );
}
