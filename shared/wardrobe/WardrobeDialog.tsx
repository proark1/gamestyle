'use client';
/* eslint-disable next/no-img-element, @next/next/no-img-element */

import { useMemo, useState, useSyncExternalStore } from 'react';
import { Dialog } from '@base-ui/react/dialog';
import {
  Award,
  Box,
  Check,
  Coins,
  Lock,
  Shirt,
  Sparkles,
  Trophy,
  User,
  X,
} from 'lucide-react';
import { getItemThumbnails } from '../rendering/cosmetics/standalone-item';
import { GOALS, ITEMS, SLOTS, type Item, type Slot } from './catalog';
import type { Look } from './look';
import {
  buyItem,
  checkAndUnlockGoals,
  equipItem,
  getGoalProgress,
  isItemUnlocked,
  serverWardrobeSnapshot,
  subscribeWardrobe,
  wardrobeSnapshot,
} from './wardrobe-state';
import WardrobePreview, { type WardrobePreviewMode } from './WardrobePreview';
import './wardrobe.css';

const SLOT_NAMES: Record<Slot | 'all', string> = {
  all: 'All items',
  hat: 'Hats',
  top: 'Tops',
  legs: 'Trousers',
  shoes: 'Shoes',
  face: 'Face',
};

export default function WardrobeDialog({
  open,
  onClose,
}: {
  open: boolean;
  onClose: () => void;
}) {
  const state = useSyncExternalStore(
    subscribeWardrobe,
    wardrobeSnapshot,
    serverWardrobeSnapshot,
  );

  const [activeTab, setActiveTab] = useState<'wardrobe' | 'goals'>('wardrobe');
  const [selectedSlot, setSelectedSlot] = useState<Slot | 'all'>('all');
  const [previewMode, setPreviewMode] = useState<WardrobePreviewMode>('avatar');
  const [selectedItem, setSelectedItem] = useState<Item | null>(
    ITEMS[0] ?? null,
  );
  const [fittedOverrides, setFittedOverrides] = useState<
    Partial<Record<Slot, string | null>>
  >({});

  const thumbnails = useMemo(() => {
    if (!open) return {};
    return getItemThumbnails(ITEMS.map((i) => i.id));
  }, [open]);

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

  const hasFittedChanges = Object.keys(fittedOverrides).length > 0;

  const toggleFit = (item: Item) => {
    const currentlyFitted = previewLook[item.slot] === item.id;
    if (currentlyFitted) {
      setFittedOverrides((prev) => {
        const next = { ...prev };
        delete next[item.slot];
        return next;
      });
    } else {
      setFittedOverrides((prev) => ({ ...prev, [item.slot]: item.id }));
      setPreviewMode('avatar');
    }
  };

  const filteredItems = ITEMS.filter((item) =>
    selectedSlot === 'all' ? true : item.slot === selectedSlot,
  );

  return (
    <Dialog.Root open={open} onOpenChange={(isOpen) => !isOpen && onClose()}>
      <Dialog.Portal>
        <Dialog.Backdrop className="wardrobe-backdrop" />
        <Dialog.Popup className="wardrobe-dialog" aria-modal="true">
          {/* Header */}
          <div className="wardrobe-header">
            <div className="wardrobe-header-title-wrap">
              <Dialog.Title className="wardrobe-title">
                <Shirt size={22} />
                Wardrobe & Perks
              </Dialog.Title>
              <span className="wardrobe-coins" title="Your party coins">
                <Coins size={15} />
                {state.coins} Coins
              </span>
            </div>

            <Dialog.Close
              className="wardrobe-close"
              aria-label="Close wardrobe"
            >
              <X size={18} />
            </Dialog.Close>
          </div>

          {/* Navigation tabs */}
          <div className="wardrobe-nav">
            <button
              type="button"
              className="wardrobe-nav-btn"
              data-active={activeTab === 'wardrobe'}
              onClick={() => setActiveTab('wardrobe')}
            >
              <Shirt size={15} /> Customizer & Shop
            </button>
            <button
              type="button"
              className="wardrobe-nav-btn"
              data-active={activeTab === 'goals'}
              onClick={() => {
                checkAndUnlockGoals();
                setActiveTab('goals');
              }}
            >
              <Trophy size={15} /> Unlockable Perks & Goals
            </button>
          </div>

          {/* Dialog Content */}
          <div className="wardrobe-body">
            {activeTab === 'wardrobe' ? (
              <div className="wardrobe-main-layout">
                {/* 3D Preview Panel with Dual Modes */}
                <div className="wardrobe-preview-panel">
                  {/* Mode Toggle Bar */}
                  <div className="wardrobe-preview-mode-bar">
                    <button
                      type="button"
                      className="wardrobe-mode-btn"
                      data-active={previewMode === 'item'}
                      onClick={() => setPreviewMode('item')}
                      title="View selected item alone in 3D"
                    >
                      <Box size={13} /> View Item Alone
                    </button>
                    <button
                      type="button"
                      className="wardrobe-mode-btn"
                      data-active={previewMode === 'avatar'}
                      onClick={() => setPreviewMode('avatar')}
                      title="Preview avatar wearing fitted outfit"
                    >
                      <User size={13} /> Fit to Avatar
                    </button>
                  </div>

                  <div className="wardrobe-preview-stage">
                    <WardrobePreview
                      look={previewLook}
                      mode={previewMode}
                      itemId={selectedItem?.id ?? null}
                    />
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
                          toggleFit(selectedItem);
                          setPreviewMode('avatar');
                        }}
                      >
                        <Sparkles size={13} /> Fit to Avatar
                      </button>
                    </div>
                  ) : (
                    <>
                      <div className="wardrobe-preview-hint">
                        Drag horizontally to rotate avatar
                      </div>
                      {hasFittedChanges && (
                        <div className="wardrobe-fitted-notice">
                          <span>Previewing fitted items</span>
                          <button
                            type="button"
                            className="wardrobe-reset-fit-btn"
                            onClick={() => setFittedOverrides({})}
                          >
                            Reset
                          </button>
                        </div>
                      )}
                    </>
                  )}
                </div>

                {/* Catalog & Equipment List */}
                <div className="wardrobe-catalog-panel">
                  {/* Slot Filter Buttons */}
                  <div className="wardrobe-slots-filter">
                    {(['all', ...SLOTS] as const).map((slot) => (
                      <button
                        key={slot}
                        type="button"
                        className="wardrobe-slot-btn"
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
                          data-selected={isSelected}
                          data-equipped={isEquipped}
                        >
                          {/* Standalone 3D Item Thumbnail */}
                          <button
                            type="button"
                            className="wardrobe-item-thumb-box"
                            title="Click to view item alone in 3D"
                            onClick={() => {
                              setSelectedItem(item);
                              setPreviewMode('item');
                            }}
                          >
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
                          </button>

                          <div className="wardrobe-item-meta">
                            <span className="wardrobe-item-slot">
                              {SLOT_NAMES[item.slot]}
                            </span>
                            {unlocked ? (
                              <span
                                style={{
                                  color: '#27634f',
                                  fontSize: '11px',
                                  display: 'flex',
                                  alignItems: 'center',
                                  gap: '2px',
                                }}
                              >
                                <Check size={12} /> Owned
                              </span>
                            ) : item.price ? (
                              <span
                                style={{
                                  color: '#8c5b08',
                                  fontSize: '11px',
                                  fontWeight: 600,
                                }}
                              >
                                {item.price} Coins
                              </span>
                            ) : null}
                          </div>

                          <button
                            type="button"
                            className="wardrobe-item-name-btn"
                            title="Select item"
                            onClick={() => setSelectedItem(item)}
                          >
                            {item.name}
                          </button>

                          <div className="wardrobe-item-actions">
                            {/* If Owned: Can Equip or Unequip */}
                            {isEquipped ? (
                              <button
                                type="button"
                                className="wardrobe-item-btn wardrobe-btn-unequip"
                                onClick={(e) => {
                                  e.stopPropagation();
                                  equipItem(item.slot, null);
                                }}
                              >
                                Unequip
                              </button>
                            ) : unlocked ? (
                              <button
                                type="button"
                                className="wardrobe-item-btn wardrobe-btn-equip"
                                onClick={(e) => {
                                  e.stopPropagation();
                                  equipItem(item.slot, item.id);
                                }}
                              >
                                <Sparkles size={13} /> Equip
                              </button>
                            ) : (
                              /* If NOT Owned: CANNOT equip! Can only Fit to Avatar to preview */
                              <>
                                <button
                                  type="button"
                                  className="wardrobe-item-btn wardrobe-btn-fit"
                                  data-active={isFitted}
                                  onClick={(e) => {
                                    e.stopPropagation();
                                    setSelectedItem(item);
                                    toggleFit(item);
                                  }}
                                  title="Try on avatar in 3D preview"
                                >
                                  <Sparkles size={12} />{' '}
                                  {isFitted ? 'Fitted' : 'Fit to Avatar'}
                                </button>

                                {item.price ? (
                                  <button
                                    type="button"
                                    className="wardrobe-item-btn wardrobe-btn-buy"
                                    disabled={state.coins < item.price}
                                    onClick={(e) => {
                                      e.stopPropagation();
                                      const ok = buyItem(item.id);
                                      if (ok) equipItem(item.slot, item.id);
                                    }}
                                    title={
                                      state.coins < item.price
                                        ? `Need ${item.price - state.coins} more coins`
                                        : `Buy for ${item.price} coins`
                                    }
                                  >
                                    <Coins size={12} />{' '}
                                    {state.coins < item.price
                                      ? `Need ${item.price - state.coins} more`
                                      : `Buy (${item.price})`}
                                  </button>
                                ) : associatedGoal ? (
                                  <div
                                    className="wardrobe-goal-locked"
                                    title={associatedGoal.label}
                                  >
                                    <Lock
                                      size={10}
                                      style={{
                                        display: 'inline',
                                        marginRight: '3px',
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
              </div>
            ) : (
              /* Goals & Perks Panel */
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
                      rewardItem &&
                      state.look[rewardItem.slot] === rewardItem.id;

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
                            <span>
                              Reward: <strong>{rewardItem.name}</strong> (
                              {SLOT_NAMES[rewardItem.slot]})
                            </span>
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
                                if (isEquipped) {
                                  equipItem(rewardItem.slot, null);
                                } else {
                                  equipItem(rewardItem.slot, rewardItem.id);
                                }
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
        </Dialog.Popup>
      </Dialog.Portal>
    </Dialog.Root>
  );
}
