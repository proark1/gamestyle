'use client';

import { useEffect } from 'react';
import { initNativeApp } from './platform';
import { bindGamepad } from '../input/gamepad';
import ControllerPanel from '../input/ControllerPanel';
import { connectAccountInventory } from '../commerce/client';

export default function NativeProvider() {
  useEffect(() => {
    const cleanup = initNativeApp();
    const controller = bindGamepad();
    const inventory = connectAccountInventory();
    return () => {
      cleanup();
      controller();
      inventory();
    };
  }, []);

  return <ControllerPanel />;
}
