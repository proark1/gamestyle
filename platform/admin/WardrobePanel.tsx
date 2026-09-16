import { PersonStanding, Shirt } from 'lucide-react';
import WardrobeView from '../../shared/wardrobe/WardrobeView';
import admin from './admin.module.css';
import styles from './avatars.module.css';

export default function WardrobePanel({
  onAvatars,
}: {
  onAvatars?: () => void;
}) {
  return (
    <div className={admin.panel}>
      <section className={admin.card}>
        <div
          className={styles.subtabs}
          role="tablist"
          aria-label="Avatar views"
        >
          <button
            type="button"
            role="tab"
            aria-selected="false"
            className={styles.subtabBtn}
            data-active="false"
            onClick={onAvatars}
          >
            <PersonStanding size={15} aria-hidden="true" /> Player Avatars
          </button>
          <button
            type="button"
            role="tab"
            aria-selected="true"
            className={styles.subtabBtn}
            data-active="true"
          >
            <Shirt size={15} aria-hidden="true" /> Wardrobe & Perks
          </button>
        </div>

        <h2>Wardrobe & Perks</h2>
        <p className={admin.cardNote}>
          Preview how hats, clothes, shoes and accessories fit on the shared
          player worker or view standalone items in 3D. Inspect live perks and
          goals progress across games, or use admin tools to unlock items and
          adjust coin balances.
        </p>

        <WardrobeView embedded showAdminControls />
      </section>
    </div>
  );
}
