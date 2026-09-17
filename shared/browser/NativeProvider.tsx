'use client';

import { useEffect } from 'react';
import { initNativeApp } from './platform';

export default function NativeProvider() {
  useEffect(() => {
    const cleanup = initNativeApp();
    return () => {
      cleanup();
    };
  }, []);

  return null;
}
