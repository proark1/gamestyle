'use client';

import { useEffect } from 'react';
import { initNativeApp } from './platform';
import { bindGamepad } from '../input/gamepad';
import ControllerPanel from '../input/ControllerPanel';

export default function NativeProvider() {
  useEffect(() => {
    const cleanup = initNativeApp();
    const controller = bindGamepad();
    return () => {
      cleanup();
      controller();
    };
  }, []);

  return <ControllerPanel />;
}
