import type * as T from 'three';
import type { AvatarLook } from '../../shared/rendering/avatar-preview';
import { dressedWorker } from '../../shared/rendering/cosmetics/dress';
import type { Look } from '../../shared/wardrobe/look';
import type { PlayerRole } from './types';

export type ShopperPoseState = {
  role: PlayerRole;
  moving: boolean;
  swatting: boolean;
  slipping: boolean;
};

/**
 * Poses the shared worker rig for wholesale warehouse derby:
 * Cart Pusher (gripping handle bar, athletic running stride) and
 * Basket Rider (crouched inside basket, wielding grabber pole).
 */
export function poseShopper(
  model: T.Object3D,
  time: number,
  state: ShopperPoseState,
) {
  const rig = model.userData as {
    body?: T.Group;
    legL?: T.Group;
    legR?: T.Group;
    armL?: T.Group;
    armR?: T.Group;
  };
  if (!rig.body || !rig.legL || !rig.legR || !rig.armL || !rig.armR) return;

  if (state.slipping) {
    // Comical cartoon slip-out: flailing limbs, body tilted back
    const twitch = Math.sin(time * 16) * 0.35;
    rig.body.position.y = 0.15;
    rig.body.rotation.set(-0.6, 0, twitch);
    rig.legL.rotation.set(-1.6, 0, -0.2);
    rig.legR.rotation.set(-1.4, 0, 0.2);
    rig.armL.rotation.set(2.2, 0, 0.4);
    rig.armR.rotation.set(2.0, 0, -0.4);
    return;
  }

  if (state.role === 'driver') {
    // Cart Pusher Driver: Both hands forward holding the cart grip
    if (state.moving) {
      const stride = time * 10;
      const legSwing = Math.sin(stride) * 0.7;
      rig.legL.rotation.set(legSwing, 0, 0);
      rig.legR.rotation.set(-legSwing, 0, 0);
      rig.body.position.y = Math.abs(Math.sin(stride)) * 0.04;
      rig.body.rotation.set(0.18, Math.sin(stride) * 0.03, 0); // Leaning forward into push
    } else {
      rig.legL.rotation.set(0, 0, 0.05);
      rig.legR.rotation.set(0, 0, -0.05);
      rig.body.position.y = 0;
      rig.body.rotation.set(0.08, 0, 0);
    }

    // Hands gripping push handle
    rig.armL.rotation.set(-1.25, 0, 0.2);
    rig.armR.rotation.set(-1.25, 0, -0.2);
  } else {
    // Basket Rider: Sitting crouched inside the basket
    if (state.moving) {
      const stride = time * 10;
      rig.body.position.y = -0.21 + Math.abs(Math.sin(stride)) * 0.04;
      rig.body.rotation.set(0.25, Math.sin(stride) * 0.04, 0);
      rig.legL.rotation.set(-1.0, 0, 0.2);
      rig.legR.rotation.set(-1.0, 0, -0.2);
    } else {
      rig.body.position.y = -0.25;
      rig.body.rotation.set(0.1, 0, 0);
      rig.legL.rotation.set(-1.2, 0, 0.2);
      rig.legR.rotation.set(-1.2, 0, -0.2);
    }

    if (state.swatting) {
      // Swatting grabber arm forward aggressively
      rig.armR.rotation.set(-1.8, Math.sin(time * 20) * 0.4, 0.1);
      rig.armL.rotation.set(-0.8, 0, 0.3);
    } else {
      // Aiming / resting grabber pole forward
      rig.armR.rotation.set(-1.3, 0, 0.1);
      rig.armL.rotation.set(-0.6, 0, 0.3);
    }
  }
}

export function createShopperWorker(color: number, look?: Look): T.Group {
  return dressedWorker(
    color,
    {
      shirt: color === 0 ? '#e74c3c' : color === 1 ? '#2980b9' : '#f39c12',
      overalls: '#2c3e50', // Wholesale club navy apron/pants
      boots: '#4c4840',
    },
    look,
  ).model;
}

export const sampleStampedeAvatars: readonly AvatarLook[] = [
  {
    key: 'shopper',
    label: 'Bulk Club Member',
    dressable: true,
    create(look) {
      const root = createShopperWorker(0, look);
      return {
        root,
        pose: (time, walking) =>
          poseShopper(root, time, {
            role: 'driver',
            moving: walking,
            swatting: false,
            slipping: false,
          }),
      };
    },
  },
  {
    key: 'rider',
    label: 'Basket Scout',
    dressable: true,
    create(look) {
      const root = createShopperWorker(1, look);
      return {
        root,
        pose: (time, walking) =>
          poseShopper(root, time, {
            role: 'grabber',
            moving: walking,
            swatting: !walking,
            slipping: false,
          }),
      };
    },
  },
];
