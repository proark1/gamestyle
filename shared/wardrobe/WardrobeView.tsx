'use client';
/* eslint-disable next/no-img-element, @next/next/no-img-element */

import { useMemo, useRef, useState, useSyncExternalStore } from 'react';
import {
  Award,
  Box,
  Check,
  Coins,
  Footprints,
  Lock,
  RotateCcw,
  RotateCw,
  Shirt,
  Sparkles,
  Trophy,
  User,
  UserCheck,
  X,
} from 'lucide-react';
import { getItemThumbnails } from '../rendering/cosmetics/standalone-item';
import { PLAYER_KID } from '../rendering/avatars/kid';
import { KIT } from '../rendering/palette';
import { GOALS, ITEMS, SLOTS, type Item, type Slot } from './catalog';
import type { Look } from './look';
import { toggleTryOn } from './fitting';
import {
  adminAddCoins,
  adminResetWardrobe,
  adminUnlockAllItems,
  buyItem,
  checkAndUnlockGoals,
  equipItem,
  getGoalProgress,
  isItemUnlocked,
  serverWardrobeSnapshot,
  subscribeWardrobe,
  wardrobeSnapshot,
} from './wardrobe-state';
import WardrobePreview, {
  type WardrobePreviewHandle,
  type WardrobePreviewMode,
} from './WardrobePreview';
import type { WorkerPose } from '../rendering/worker-pose';
import './wardrobe.css';

const SLOT_NAMES: Record<Slot | 'all', string> = {
  all: 'All',
  hat: 'Hats',
  top: 'Tops',
  legs: 'Trousers',
  shoes: 'Shoes',
  face: 'Glasses',
  beard: 'Beards',
};

export type WardrobeViewProps = {
  embedded?: boolean;
  onClose?: () => void;
  showAdminControls?: boolean;
  title?: string;
  extraHeaderActions?: React.ReactNode;
};

export default function WardrobeView({
  embedded = false,
  onClose,
  showAdminControls = false,
  title = 'Wardrobe & Perks',
  extraHeaderActions,
}: WardrobeViewProps) {
  const state = useSyncExternalStore(
    subscribeWardrobe,
    wardrobeSnapshot,
    serverWardrobeSnapshot,
  );

  const [activeTab, setActiveTab] = useState<'wardrobe' | 'goals'>('wardrobe');
  const [selectedSlot, setSelectedSlot] = useState<Slot | 'all'>('all');
  const [previewMode, setPreviewMode] = useState<WardrobePreviewMode>('avatar');
  const [avatarPose, setAvatarPose] = useState<WorkerPose>('still');
  // Which kit the preview shows; each game picks the real one.
  const [kit, setKit] = useState<string>(KIT.red);
  const [isSpinning, setIsSpinning] = useState(false);
  const [selectedItem, setSelectedItem] = useState<Item | null>(
    ITEMS[0] ?? null,
  );
  const [fittedOverrides, setFittedOverrides] = useState<
    Partial<Record<Slot, string | null>>
  >({});

  const previewRef = useRef<WardrobePreviewHandle>(null);

  const thumbnails = useMemo(() => {
    return getItemThumbnails(ITEMS.map((i) => i.id));
  }, []);

  // Merge equipped look with any temporary "Fit to Avatar" try-ons
  const previewLook: Look = useMemo(() => {
    const look: Look = { ...state.look };
    for (const slot of SLOTS) {
      if (fittedOverrides[slot] !== undefined) {
        const id = fittedOverrides[slot];
        if (id) look[slot] = id;
        else delete look[slot];
      }
    }
    return look;
  }, [state.look, fittedOverrides]);

  const hasFittedChanges = SLOTS.some(
    (slot) => previewLook[slot] !== state.look[slot],
  );

  const clearFit = (slot: Slot) => {
    setFittedOverrides((prev) => {
      const next = { ...prev };
      delete next[slot];
      return next;
    });
  };

  const toggleFit = (item: Item) => {
    setSelectedItem(item);
    setPreviewMode('avatar');
    setFittedOverrides((prev) => toggleTryOn(state.look, prev, item));
  };

  const commitItem = (item: Item, remove = false) => {
    equipItem(item.slot, remove ? null : item.id);
    clearFit(item.slot);
    setSelectedItem(item);
    setPreviewMode('avatar');
  };

  const filteredItems = ITEMS.filter((item) =>
    selectedSlot === 'all' ? true : item.slot === selectedSlot,
  );

  return (
    <div className={embedded ? 'wardrobe-embedded-card' : 'wardrobe-content'}>
      {/* Header */}
      <div className="wardrobe-header">
        <div className="wardrobe-header-title-wrap">
          <div className="wardrobe-title" id="wardrobe-dialog-title">
            <Shirt size={22} />
            {title}
          </div>
          <span className="wardrobe-coins" title="Your party coins">
            <Coins size={15} />
            {state.coins} Coins
          </span>
        </div>

        <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
          {extraHeaderActions}
          {onClose && (
            <button
              type="button"
              className="wardrobe-close"
              aria-label="Close wardrobe"
              onClick={onClose}
            >
              <X size={18} />
            </button>
          )}
        </div>
      </div>

      {/* Admin Debug / Quick Controls Bar */}
      {showAdminControls && (
        <div className="wardrobe-admin-bar">
          <div className="wardrobe-admin-actions">
            <span>Admin tools:</span>
            <button
              type="button"
              className="wardrobe-admin-btn"
              onClick={() => adminAddCoins(500)}
              title="Add 500 party coins"
            >
              <Coins size={12} /> +500 Coins
            </button>
            <button
              type="button"
              className="wardrobe-admin-btn"
              onClick={() => adminUnlockAllItems()}
              title="Unlock all catalog wardrobe items"
            >
              <Sparkles size={12} /> Unlock All Items
            </button>
            <button
              type="button"
              className="wardrobe-admin-btn"
              onClick={() => {
                adminResetWardrobe();
                setFittedOverrides({});
              }}
              title="Reset wardrobe back to starter defaults"
            >
              <RotateCcw size={12} /> Reset to Defaults
            </button>
          </div>
          <div className="wardrobe-admin-badge">
            {state.unlockedItems.length} of {ITEMS.length} Items Unlocked
          </div>
        </div>
      )}

      {/* Navigation tabs */}
      <div className="wardrobe-nav">
        <button
          type="button"
          className="wardrobe-nav-btn"
          aria-pressed={activeTab === 'wardrobe'}
          data-active={activeTab === 'wardrobe'}
          onClick={() => setActiveTab('wardrobe')}
        >
          <Shirt size={15} /> Customizer & Shop
        </button>
        <button
          type="button"
          className="wardrobe-nav-btn"
          aria-pressed={activeTab === 'goals'}
          data-active={activeTab === 'goals'}
          onClick={() => {
            checkAndUnlockGoals();
            setActiveTab('goals');
          }}
        >
          <Trophy size={15} /> Unlockable Perks & Goals
        </button>
      </div>

      {/* Content: 3D preview active across both Wardrobe and Perks */}
      <div className="wardrobe-body">
        <div className="wardrobe-main-layout">
          {/* 3D Preview Panel with Turning, Walk, Still and Poses */}
          <div className="wardrobe-preview-panel">
            {/* A kit colour to try items in; each game picks the real one */}
            <div className="wardrobe-kit-bar">
              <fieldset
                className="wardrobe-kit-swatches"
                aria-label="Kit colour"
              >
                {Object.entries(KIT).map(([name, colour]) => (
                  <button
                    key={name}
                    type="button"
                    className="wardrobe-kit-swatch"
                    style={{ background: colour }}
                    aria-pressed={kit === colour}
                    data-active={kit === colour}
                    aria-label={`${name} kit`}
                    title={`${name[0].toUpperCase()}${name.slice(1)} kit`}
                    onClick={() => setKit(colour)}
                  />
                ))}
              </fieldset>
            </div>

            {/* Mode Toggle Bar */}
            <div className="wardrobe-preview-mode-bar">
              <button
                type="button"
                className="wardrobe-mode-btn"
                aria-pressed={previewMode === 'item'}
                data-active={previewMode === 'item'}
                onClick={() => setPreviewMode('item')}
                title="View selected item alone in 3D"
              >
                <Box size={13} /> Item only
              </button>
              <button
                type="button"
                className="wardrobe-mode-btn"
                aria-pressed={previewMode === 'avatar'}
                data-active={previewMode === 'avatar'}
                onClick={() => setPreviewMode('avatar')}
                title="Preview avatar wearing fitted outfit"
              >
                <User size={13} /> On avatar
              </button>
            </div>

            {/* 3D Viewport */}
            <div className="wardrobe-preview-stage">
              <WardrobePreview
                ref={previewRef}
                look={previewLook}
                kid={PLAYER_KID}
                kit={kit}
                mode={previewMode}
                itemId={selectedItem?.id ?? null}
                pose={avatarPose}
                spinning={isSpinning}
              />
            </div>

            {/* Interactive Motion & Turning Controls */}
            <div className="wardrobe-motion-controls">
              {previewMode === 'avatar' && (
                <div
                  className="wardrobe-pose-row"
                  aria-label="Avatar movements and poses"
                >
                  <button
                    type="button"
                    className="wardrobe-ctrl-btn"
                    aria-pressed={avatarPose === 'still'}
                    data-active={avatarPose === 'still'}
                    onClick={() => setAvatarPose('still')}
                    title="Stand still with natural breathing"
                  >
                    <UserCheck size={12} /> Stand Still
                  </button>
                  <button
                    type="button"
                    className="wardrobe-ctrl-btn"
                    aria-pressed={avatarPose === 'walk'}
                    data-active={avatarPose === 'walk'}
                    onClick={() => setAvatarPose('walk')}
                    title="Walk in place"
                  >
                    <Footprints size={12} /> Walk
                  </button>
                  <button
                    type="button"
                    className="wardrobe-ctrl-btn"
                    aria-pressed={avatarPose === 'wave'}
                    data-active={avatarPose === 'wave'}
                    onClick={() => setAvatarPose('wave')}
                    title="Friendly greeting wave"
                  >
                    <Sparkles size={12} /> Wave
                  </button>
                  <button
                    type="button"
                    className="wardrobe-ctrl-btn"
                    aria-pressed={avatarPose === 'hero'}
                    data-active={avatarPose === 'hero'}
                    onClick={() => setAvatarPose('hero')}
                    title="Hero stance with hands on hips"
                  >
                    <Award size={12} /> Hero
                  </button>
                </div>
              )}

              {/* Turning Controls: Toggle Auto-Turn, Angle Steps & Face Front */}
              <div className="wardrobe-turn-row" aria-label="Avatar rotation">
                <button
                  type="button"
                  className="wardrobe-turn-btn wardrobe-turn-toggle"
                  aria-pressed={isSpinning}
                  data-active={isSpinning}
                  onClick={() => setIsSpinning((v) => !v)}
                  title={
                    isSpinning
                      ? 'Pause 360° turning'
                      : 'Activate continuous 360° turning'
                  }
                >
                  <RotateCw
                    size={12}
                    className={isSpinning ? 'wardrobe-spin-active' : ''}
                  />
                  <span>{isSpinning ? 'Turning: ON' : 'Turn: OFF'}</span>
                </button>
                <button
                  type="button"
                  className="wardrobe-turn-btn"
                  onClick={() => {
                    setIsSpinning(false);
                    previewRef.current?.turnBy(-Math.PI / 4);
                  }}
                  aria-label="Turn left 45 degrees"
                  title="Turn left 45°"
                >
                  <RotateCcw size={12} />
                </button>
                <button
                  type="button"
                  className="wardrobe-turn-btn"
                  onClick={() => {
                    setIsSpinning(false);
                    previewRef.current?.faceFront();
                  }}
                  title="Face front"
                >
                  Front
                </button>
                <button
                  type="button"
                  className="wardrobe-turn-btn"
                  onClick={() => {
                    setIsSpinning(false);
                    previewRef.current?.turnBy(Math.PI / 4);
                  }}
                  aria-label="Turn right 45 degrees"
                  title="Turn right 45°"
                >
                  <RotateCw size={12} />
                </button>
              </div>
            </div>

            {previewMode === 'item' && selectedItem ? (
              <div className="wardrobe-inspect-bar">
                <div className="wardrobe-inspect-info">
                  <span className="wardrobe-inspect-name">
                    {selectedItem.name}
                  </span>
                  <span className="wardrobe-inspect-slot">
                    {SLOT_NAMES[selectedItem.slot]}
                  </span>
                </div>
                <button
                  type="button"
                  className="wardrobe-btn-fit-action"
                  onClick={() => {
                    if (state.look[selectedItem.slot] === selectedItem.id) {
                      clearFit(selectedItem.slot);
                    } else {
                      setFittedOverrides((prev) => ({
                        ...prev,
                        [selectedItem.slot]: selectedItem.id,
                      }));
                    }
                    setPreviewMode('avatar');
                  }}
                >
                  <Sparkles size={13} /> Try on
                </button>
              </div>
            ) : (
              <>
                <div className="wardrobe-preview-hint">
                  Drag horizontally to rotate 360°
                </div>
                {hasFittedChanges && (
                  <div className="wardrobe-fitted-notice">
                    <span>Try-on only · not saved</span>
                    <button
                      type="button"
                      className="wardrobe-reset-fit-btn"
                      onClick={() => setFittedOverrides({})}
                    >
                      Reset try-on
                    </button>
                  </div>
                )}
              </>
            )}
          </div>

          {/* Right Panel: Customizer & Shop OR Unlockable Perks & Goals */}
          {activeTab === 'wardrobe' ? (
            <div className="wardrobe-catalog-panel">
              {/* Slot Filter Buttons */}
              <div className="wardrobe-slots-filter">
                {(['all', ...SLOTS] as const).map((slot) => (
                  <button
                    key={slot}
                    type="button"
                    className="wardrobe-slot-btn"
                    aria-pressed={selectedSlot === slot}
                    data-active={selectedSlot === slot}
                    onClick={() => setSelectedSlot(slot)}
                  >
                    {SLOT_NAMES[slot]}
                  </button>
                ))}
              </div>

              {/* Items Grid */}
              <div className="wardrobe-items-grid">
                {filteredItems.map((item) => {
                  const unlocked = isItemUnlocked(state, item);
                  const isEquipped = state.look[item.slot] === item.id;
                  const isFitted = previewLook[item.slot] === item.id;
                  const isSelected = selectedItem?.id === item.id;
                  const associatedGoal = item.goal
                    ? GOALS.find((g) => g.id === item.goal)
                    : null;

                  return (
                    <div
                      key={item.id}
                      className="wardrobe-item-card"
                      data-equipped={isEquipped}
                      data-fitted={isFitted && !isEquipped}
                      data-unlocked={unlocked}
                      data-selected={isSelected}
                    >
                      <button
                        type="button"
                        className="wardrobe-item-select"
                        aria-label={`Inspect ${item.name}`}
                        aria-pressed={isSelected}
                        onClick={() => {
                          setSelectedItem(item);
                          setPreviewMode('item');
                        }}
                      >
                        <div className="wardrobe-item-thumb-box">
                          {thumbnails[item.id] ? (
                            <img
                              src={thumbnails[item.id]}
                              alt={item.name}
                              className="wardrobe-item-thumb-img"
                              loading="lazy"
                            />
                          ) : (
                            <div className="wardrobe-item-thumb-placeholder" />
                          )}
                          {isEquipped && (
                            <span className="wardrobe-item-badge">
                              <Check size={11} strokeWidth={3} /> Equipped
                            </span>
                          )}
                          {!isEquipped && isFitted && (
                            <span className="wardrobe-item-badge wardrobe-badge-fitted">
                              <Sparkles size={10} /> Trying on
                            </span>
                          )}
                        </div>

                        <div className="wardrobe-item-info">
                          <span className="wardrobe-item-name">
                            {item.name}
                          </span>
                          <span className="wardrobe-item-slot-name">
                            {SLOT_NAMES[item.slot]}
                          </span>
                        </div>
                      </button>
                      <div className="wardrobe-item-actions">
                        <button
                          type="button"
                          className="wardrobe-item-btn wardrobe-btn-fit"
                          aria-pressed={isFitted}
                          data-active={isFitted}
                          onClick={() => toggleFit(item)}
                          title="Try on without changing your saved outfit"
                        >
                          <Sparkles size={11} />
                          {isFitted
                            ? isEquipped
                              ? 'Preview without'
                              : 'Undo try-on'
                            : 'Try on'}
                        </button>
                        {unlocked ? (
                          isEquipped ? (
                            <button
                              type="button"
                              className="wardrobe-item-btn wardrobe-btn-unequip"
                              onClick={(e) => {
                                e.stopPropagation();
                                commitItem(item, true);
                              }}
                            >
                              Take Off
                            </button>
                          ) : (
                            <button
                              type="button"
                              className="wardrobe-item-btn wardrobe-btn-equip"
                              onClick={(e) => {
                                e.stopPropagation();
                                commitItem(item);
                              }}
                            >
                              Equip
                            </button>
                          )
                        ) : (
                          <>
                            {item.price ? (
                              <button
                                type="button"
                                className="wardrobe-item-btn wardrobe-btn-buy"
                                disabled={state.coins < item.price}
                                onClick={(e) => {
                                  e.stopPropagation();
                                  buyItem(item.id);
                                }}
                                title={
                                  state.coins < item.price
                                    ? 'Not enough coins'
                                    : `Buy for ${item.price} coins`
                                }
                              >
                                <Coins size={12} /> Buy · {item.price}
                              </button>
                            ) : associatedGoal ? (
                              <div
                                className="wardrobe-item-goal-hint"
                                title={`Unlocked by: ${associatedGoal.label}`}
                              >
                                <Lock
                                  size={12}
                                  style={{
                                    display: 'inline',
                                    marginRight: '3px',
                                    verticalAlign: '-1px',
                                  }}
                                />
                                {associatedGoal.label}
                              </div>
                            ) : null}
                          </>
                        )}
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          ) : (
            /* Unlockable Perks & Goals Panel */
            <div className="wardrobe-goals-panel">
              <p className="wardrobe-goals-intro">
                Play games and spend time with friends across Jumbleyard to
                unlock legendary items and wardrobe perks!
              </p>

              <div className="wardrobe-goals-list">
                {GOALS.map((goal) => {
                  const progress = getGoalProgress(goal, state.stats);
                  const rewardItem = ITEMS.find(
                    (item) => item.goal === goal.id,
                  );
                  const isUnlocked = rewardItem
                    ? isItemUnlocked(state, rewardItem)
                    : progress.complete;
                  const isEquipped =
                    rewardItem && state.look[rewardItem.slot] === rewardItem.id;
                  const isFitted =
                    rewardItem &&
                    previewLook[rewardItem.slot] === rewardItem.id;

                  return (
                    <div
                      key={goal.id}
                      className="wardrobe-goal-card"
                      data-completed={progress.complete}
                    >
                      <div className="wardrobe-goal-title-wrap">
                        <h4 className="wardrobe-goal-label">{goal.label}</h4>
                        <span
                          className="wardrobe-goal-badge"
                          data-completed={progress.complete}
                        >
                          {progress.complete ? (
                            <span
                              style={{
                                display: 'flex',
                                alignItems: 'center',
                                gap: '3px',
                              }}
                            >
                              <Check size={12} /> Unlocked
                            </span>
                          ) : (
                            `${progress.percentage}%`
                          )}
                        </span>
                      </div>

                      {rewardItem && (
                        <div className="wardrobe-goal-reward">
                          <Award size={14} color="#8c5b08" />
                          <span style={{ flex: 1 }}>
                            Reward: <strong>{rewardItem.name}</strong> (
                            {SLOT_NAMES[rewardItem.slot]})
                          </span>
                          <button
                            type="button"
                            className="wardrobe-goal-fit-btn"
                            data-fitted={isFitted}
                            onClick={() => {
                              setSelectedItem(rewardItem);
                              toggleFit(rewardItem);
                            }}
                            title="Try on this reward item on your avatar"
                          >
                            <Sparkles size={11} />{' '}
                            {isFitted
                              ? isEquipped
                                ? 'Preview without'
                                : 'Undo try-on'
                              : 'Try on'}
                          </button>
                        </div>
                      )}

                      <div className="wardrobe-progress-bar-wrap">
                        <div
                          className="wardrobe-progress-bar-fill"
                          style={{ width: `${progress.percentage}%` }}
                        />
                      </div>

                      <div className="wardrobe-progress-text">
                        <span>
                          {goal.measure === 'every-game'
                            ? `${progress.current} of ${progress.target} games played`
                            : goal.measure === 'games'
                              ? `${progress.current} of ${progress.target} games played`
                              : `${progress.current} of ${progress.target} hours played`}
                        </span>
                        {rewardItem && isUnlocked && (
                          <button
                            type="button"
                            className="wardrobe-item-btn wardrobe-btn-equip"
                            style={{
                              padding: '3px 8px',
                              fontSize: '11px',
                              marginTop: 0,
                            }}
                            onClick={() => {
                              commitItem(rewardItem, !!isEquipped);
                            }}
                          >
                            {isEquipped ? 'Unequip' : 'Equip Reward'}
                          </button>
                        )}
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
