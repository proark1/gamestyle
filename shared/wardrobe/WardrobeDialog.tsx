'use client';

import { useState, useSyncExternalStore } from 'react';
import { Dialog } from '@base-ui/react/dialog';
import {
  Award,
  Check,
  Coins,
  Lock,
  Shirt,
  Sparkles,
  Trophy,
  X,
} from 'lucide-react';
import { GOALS, ITEMS, SLOTS, type Slot } from './catalog';
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
import WardrobePreview from './WardrobePreview';
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

            <Dialog.Close className="wardrobe-close" aria-label="Close wardrobe">
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
                {/* 3D Character Preview */}
                <div className="wardrobe-preview-panel">
                  <div className="wardrobe-preview-stage">
                    <WardrobePreview look={state.look} />
                  </div>
                  <div className="wardrobe-preview-hint">
                    Drag horizontally to rotate avatar
                  </div>
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
                      const associatedGoal = item.goal
                        ? GOALS.find((g) => g.id === item.goal)
                        : null;

                      return (
                        <div
                          key={item.id}
                          className="wardrobe-item-card"
                          data-equipped={isEquipped}
                        >
                          <div className="wardrobe-item-meta">
                            <span className="wardrobe-item-slot">
                              {SLOT_NAMES[item.slot]}
                            </span>
                            {unlocked && (
                              <span style={{ color: '#27634f', fontSize: '11px', display: 'flex', alignItems: 'center', gap: '2px' }}>
                                <Check size={12} /> Owned
                              </span>
                            )}
                          </div>

                          <h4 className="wardrobe-item-name">{item.name}</h4>

                          {isEquipped ? (
                            <button
                              type="button"
                              className="wardrobe-item-btn wardrobe-btn-unequip"
                              onClick={() => equipItem(item.slot, null)}
                            >
                              Unequip
                            </button>
                          ) : unlocked ? (
                            <button
                              type="button"
                              className="wardrobe-item-btn wardrobe-btn-equip"
                              onClick={() => equipItem(item.slot, item.id)}
                            >
                              <Sparkles size={13} /> Equip
                            </button>
                          ) : item.price ? (
                            <button
                              type="button"
                              className="wardrobe-item-btn wardrobe-btn-buy"
                              disabled={state.coins < item.price}
                              onClick={() => {
                                const ok = buyItem(item.id);
                                if (ok) equipItem(item.slot, item.id);
                              }}
                              title={
                                state.coins < item.price
                                  ? 'Not enough coins'
                                  : `Buy for ${item.price} coins`
                              }
                            >
                              <Coins size={12} /> Buy ({item.price})
                            </button>
                          ) : associatedGoal ? (
                            <div className="wardrobe-goal-locked" title={associatedGoal.label}>
                              <Lock size={10} style={{ display: 'inline', marginRight: '3px' }} />
                              {associatedGoal.label}
                            </div>
                          ) : null}
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
                  Play games and spend time with friends across Jumbleyard to unlock
                  legendary items and wardrobe perks!
                </p>

                <div className="wardrobe-goals-list">
                  {GOALS.map((goal) => {
                    const progress = getGoalProgress(goal, state.stats);
                    const rewardItem = ITEMS.find((item) => item.goal === goal.id);
                    const isUnlocked = rewardItem ? isItemUnlocked(state, rewardItem) : progress.complete;
                    const isEquipped = rewardItem && state.look[rewardItem.slot] === rewardItem.id;

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
                              <span style={{ display: 'flex', alignItems: 'center', gap: '3px' }}>
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
                              Reward: <strong>{rewardItem.name}</strong> ({SLOT_NAMES[rewardItem.slot]})
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
                              style={{ padding: '3px 8px', fontSize: '11px', marginTop: 0 }}
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
